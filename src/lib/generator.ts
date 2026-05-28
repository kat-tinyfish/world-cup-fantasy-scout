import { getEnv } from "./env";
import { validateDraftText } from "./guardrails";
import { makeId } from "./ids";
import { buildFallbackTweet, writeTweetWithLlm } from "./llm";
import { PILLAR_LABELS, PILLAR_QUERIES } from "./personality";
import { buildReceiptSnapshot, encodeReceiptSnapshot } from "./receiptSnapshot";
import { mergeSearchAndFetch, sourceSummary, type SearchResult } from "./sources";
import type { Store } from "./store";
import { TinyFishApiClient, type TinyFishClient } from "./tinyfish";
import type { ContentPillar, DraftPost, Source } from "./types";
import { buildCampaignUrl } from "./utm";

const DEFAULT_PILLARS: ContentPillar[] = [
  "daily_scout",
  "differential_radar",
  "captaincy_chaos",
  "lineup_news_watch",
  "template_panic_meter",
  "mini_league_banter",
  "built_with_tinyfish"
];

export const MAX_DRAFTS_PER_GENERATION = 12;

export type GenerateDraftsOptions = {
  store: Store;
  tinyfish?: TinyFishClient;
  pillars?: ContentPillar[];
  targetCount?: number;
  now?: Date;
  receiptLinks?: boolean;
  onProgress?: (event: GenerationProgressEvent) => void;
};

export type GenerateDraftsResult = {
  created: DraftPost[];
  skipped: Array<{ pillar: ContentPillar; reason: string }>;
};

export type GenerationProgressEvent = {
  type:
    | "batch:start"
    | "pillar:start"
    | "search:start"
    | "search:complete"
    | "fetch:start"
    | "fetch:complete"
    | "agent:start"
    | "agent:progress"
    | "agent:complete"
    | "agent:skip"
    | "llm:start"
    | "llm:complete"
    | "llm:skip"
    | "draft:created"
    | "draft:skipped"
    | "batch:complete";
  pillar?: ContentPillar;
  message: string;
  count?: number;
};

export async function generateDrafts(options: GenerateDraftsOptions): Promise<GenerateDraftsResult> {
  const store = options.store;
  const tinyfish = options.tinyfish ?? new TinyFishApiClient();
  const now = options.now ?? new Date();
  const env = getEnv();
  const pillars = normalizePillars(options.pillars);
  const targetCount = normalizeTargetCount(options.targetCount ?? pillars.length);
  const plan = buildGenerationPlan(pillars, targetCount);
  const created: DraftPost[] = [];
  const skipped: GenerateDraftsResult["skipped"] = [];
  let agentRuns = 0;
  const emit = options.onProgress ?? (() => undefined);

  await store.ensureReady();
  emit({
    type: "batch:start",
    message: `Starting ${targetCount} requested draft(s) across ${pillars.length} content pillar(s).`,
    count: targetCount
  });

  for (const [index, pillar] of plan.entries()) {
    emit({ type: "pillar:start", pillar, message: `Starting draft ${index + 1}/${plan.length}: ${PILLAR_LABELS[pillar]}.` });
    emit({
      type: "search:start",
      pillar,
      message: `Searching ${PILLAR_QUERIES[pillar].length} query pattern(s).`
    });
    const searchResults = await runPillarSearches(tinyfish, pillar);
    emit({ type: "search:complete", pillar, message: `Found ${searchResults.length} result(s).`, count: searchResults.length });
    if (!searchResults.length) {
      skipped.push({ pillar, reason: "No source results." });
      emit({ type: "draft:skipped", pillar, message: "Skipped: no source results." });
      continue;
    }

    const urls = searchResults.map((result) => result.url).filter(Boolean).slice(0, 10);
    emit({ type: "fetch:start", pillar, message: `Fetching ${urls.length} source URL(s).`, count: urls.length });
    const fetchedResults = await tinyfish.fetch(urls);
    emit({ type: "fetch:complete", pillar, message: `Fetched ${fetchedResults.length} source page(s).`, count: fetchedResults.length });
    const sources = mergeSearchAndFetch(searchResults, fetchedResults, now).filter(hasUsableSourceText).slice(0, 4);
    if (!sources.length) {
      skipped.push({ pillar, reason: "No usable fetched or snippet text." });
      emit({ type: "draft:skipped", pillar, message: "Skipped: no usable fetched or snippet text." });
      continue;
    }

    const generationNotes: string[] = [];
    let agentInsight: string | null = null;
    const shouldRunAgent =
      env.tinyfishAgentEnabled && Boolean(tinyfish.agentInsight) && agentRuns < env.tinyfishAgentMaxRuns;

    if (shouldRunAgent) {
      agentRuns += 1;
      emit({ type: "agent:start", pillar, message: `TinyFish Agent is reading ${sources[0].siteName}.` });
      try {
        const agentResult = await tinyfish.agentInsight?.({
          url: sources[0].url,
          pillarLabel: PILLAR_LABELS[pillar],
          sourceTitle: sources[0].title,
          onEvent: (event) =>
            emit({
              type: event.type === "complete" ? "agent:complete" : "agent:progress",
              pillar,
              message: event.message
            })
        });
        agentInsight = agentResult?.insight ?? null;
        if (agentInsight) {
          sources[0] = { ...sources[0], agentInsight };
          generationNotes.push(`TinyFish Agent: ${agentInsight}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "TinyFish Agent failed.";
        generationNotes.push(message);
        emit({ type: "agent:skip", pillar, message });
      }
    } else {
      const reason = !env.tinyfishAgentEnabled
        ? "TinyFish Agent skipped. Set TINYFISH_AGENT_ENABLED=1 to enable enrichment."
        : !tinyfish.agentInsight
          ? "TinyFish Agent skipped because this TinyFish client does not expose Agent insight."
          : "TinyFish Agent skipped because max runs for this batch was reached.";
      generationNotes.push(reason);
      emit({ type: "agent:skip", pillar, message: reason });
    }

    const insight = buildSourceBackedInsight(pillar, sources, agentInsight);
    if (!agentInsight) {
      generationNotes.push(`Source insight: ${insight}`);
    }

    await store.upsertSources(sources);
    let draft = buildDraftFromSources(pillar, sources, now, {
      receiptLinks: options.receiptLinks ?? true,
      insight,
      generationNotes,
      hookOffset: index
    });

    emit({ type: "llm:start", pillar, message: "Writing the final X post from the source-backed insight." });
    const tweet = await writeTweetWithLlm({
      pillar,
      insight,
      landingUrl: draft.landingUrl,
      sources: draft.sources,
      hookVariant: index
    }).catch((error) => ({
      text: draft.text,
      usedLlm: false,
      note: error instanceof Error ? `LLM tweet writing skipped: ${error.message}` : "LLM tweet writing skipped."
    }));
    generationNotes.push(tweet.note);
    const tweetValidation = validateDraftText(tweet.text, draft.sources, draft.landingUrl);
    draft = {
      ...draft,
      text: tweet.text,
      toneScore: tweetValidation.toneScore,
      usefulnessScore: tweetValidation.usefulnessScore,
      generationNotes: [...generationNotes]
    };
    emit({ type: tweet.usedLlm ? "llm:complete" : "llm:skip", pillar, message: tweet.note });

    const duplicate = await store.findSimilarDraft(draft.text);
    if (duplicate) {
      skipped.push({ pillar, reason: `Duplicate draft ${duplicate.id}.` });
      emit({ type: "draft:skipped", pillar, message: `Skipped duplicate draft ${duplicate.id}.` });
      continue;
    }

    const validation = validateDraftText(draft.text, draft.sources, draft.landingUrl);
    if (!validation.ok) {
      skipped.push({ pillar, reason: validation.errors.join(" ") });
      emit({ type: "draft:skipped", pillar, message: `Skipped by guardrails: ${validation.errors.join(" ")}` });
      continue;
    }

    const saved = await store.createDraft({
      ...draft,
      toneScore: validation.toneScore,
      usefulnessScore: validation.usefulnessScore
    });
    created.push(saved);
    emit({ type: "draft:created", pillar, message: `Created draft for ${PILLAR_LABELS[pillar]}.` });
  }

  emit({ type: "batch:complete", message: `Done. Created ${created.length}, skipped ${skipped.length}.` });
  return { created, skipped };
}

export function normalizePillars(pillars?: ContentPillar[]): ContentPillar[] {
  const allowed = new Set(DEFAULT_PILLARS);
  const normalized = [...new Set((pillars?.length ? pillars : DEFAULT_PILLARS).filter((pillar) => allowed.has(pillar)))];
  return normalized.length ? normalized : DEFAULT_PILLARS;
}

export function normalizeTargetCount(count: number): number {
  if (!Number.isFinite(count)) return 1;
  return Math.min(MAX_DRAFTS_PER_GENERATION, Math.max(1, Math.floor(count)));
}

export function buildGenerationPlan(pillars: ContentPillar[], targetCount: number): ContentPillar[] {
  const normalizedPillars = normalizePillars(pillars);
  const normalizedCount = normalizeTargetCount(targetCount);
  return Array.from({ length: normalizedCount }, (_, index) => normalizedPillars[index % normalizedPillars.length]);
}

export function buildDraftFromSources(
  pillar: ContentPillar,
  sources: Source[],
  now = new Date(),
  options: { receiptLinks?: boolean; insight?: string | null; generationNotes?: string[]; hookOffset?: number } = {}
): DraftPost {
  const id = makeId("draft");
  const insight = options.insight || buildSourceBackedInsight(pillar, sources);
  const landingUrl = buildLandingUrl({
    id,
    pillar,
    sources,
    insight,
    receiptLinks: options.receiptLinks ?? true
  });
  const text = buildFallbackTweet({
    pillar,
    insight,
    landingUrl,
    sources,
    hookVariant: options.hookOffset ?? 0
  });
  const validation = validateDraftText(text, sources, landingUrl);
  const timestamp = now.toISOString();

  return {
    id,
    status: "draft",
    pillar,
    toneScore: validation.toneScore,
    usefulnessScore: validation.usefulnessScore,
    text,
    landingUrl,
    sources: sources.map((source) => ({
      ...source,
      usedInDraftIds: [...new Set([...source.usedInDraftIds, id])]
    })),
    scheduledFor: nextPostingSlot(now).toISOString(),
    approvedBy: null,
    publishedPostId: null,
    generationNotes: options.generationNotes ?? [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function regenerateJoke(draft: DraftPost): DraftPost {
  const insight = buildSourceBackedInsight(draft.pillar, draft.sources);
  const landingUrl = buildLandingUrl({
    id: draft.id,
    pillar: draft.pillar,
    sources: draft.sources,
    insight,
    receiptLinks: isReceiptLink(draft.landingUrl)
  });
  const text = buildFallbackTweet({
    pillar: draft.pillar,
    insight,
    landingUrl,
    sources: draft.sources,
    hookVariant: draft.text.length + 1
  });
  const validation = validateDraftText(text, draft.sources, landingUrl);
  return {
    ...draft,
    text,
    landingUrl,
    toneScore: validation.toneScore,
    usefulnessScore: validation.usefulnessScore,
    updatedAt: new Date().toISOString()
  };
}

export function regenerateInsight(draft: DraftPost): DraftPost {
  const rotatedSources = [...draft.sources.slice(1), draft.sources[0]].filter(Boolean);
  const sources = rotatedSources.length ? rotatedSources : draft.sources;
  const insight = buildSourceBackedInsight(draft.pillar, sources);
  const landingUrl = buildLandingUrl({
    id: draft.id,
    pillar: draft.pillar,
    sources,
    insight,
    receiptLinks: isReceiptLink(draft.landingUrl)
  });
  const text = buildFallbackTweet({
    pillar: draft.pillar,
    insight,
    landingUrl,
    sources,
    hookVariant: draft.text.length + 2
  });
  const validation = validateDraftText(text, sources, landingUrl);
  return {
    ...draft,
    sources,
    text,
    landingUrl,
    toneScore: validation.toneScore,
    usefulnessScore: validation.usefulnessScore,
    updatedAt: new Date().toISOString()
  };
}

export function nextPostingSlot(now: Date): Date {
  const slotsUtc = [13, 20];
  for (const hour of slotsUtc) {
    const slot = new Date(now);
    slot.setUTCHours(hour, 0, 0, 0);
    if (slot > now) return slot;
  }
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(slotsUtc[0], 0, 0, 0);
  return tomorrow;
}

async function runPillarSearches(tinyfish: TinyFishClient, pillar: ContentPillar): Promise<SearchResult[]> {
  const batches = await Promise.all(PILLAR_QUERIES[pillar].map((query) => tinyfish.search(query)));
  const seen = new Set<string>();
  return batches
    .flat()
    .filter((result) => {
      if (!result.url || seen.has(result.url)) return false;
      seen.add(result.url);
      return true;
    })
    .slice(0, 10);
}

export function buildSourceBackedInsight(pillar: ContentPillar, sources: Source[], agentInsight?: string | null): string {
  const source = sources[0];
  const enrichedInsight = cleanInsight(agentInsight || source?.agentInsight || "");
  if (enrichedInsight) {
    return enrichedInsight;
  }

  const title = cleanSourceTitle(source);

  if (pillar === "built_with_tinyfish") {
    return "Search finds the fantasy mess and Fetch turns the page into clean text, so the scout note starts with evidence instead of timeline vibes.";
  }

  const templates: Record<Exclude<ContentPillar, "built_with_tinyfish">, string> = {
    daily_scout: `Use ${title} before deadline; rules and news beat letting the template pick your team for you.`,
    differential_radar: `Treat ${title} as a shortlist starter; differential punts need minutes, role, and ownership context.`,
    captaincy_chaos: `Build captain switches from ${title}; captaincy is two deadlines in a trench coat, not one brave button.`,
    lineup_news_watch: `Check ${title} before locking a lineup; rotation risk is where tidy drafts lose their shoes.`,
    template_panic_meter: `Compare the template against ${title}; ownership is useful signal, not permission to stop thinking.`,
    mini_league_banter: `Drop ${title} before deadline; sourced mini-league banter beats screenshot astrology.`
  };

  return templates[pillar];
}

function cleanSourceTitle(source?: Source): string {
  if (!source) return "the latest source";
  const title = source.title.replace(/\s+/g, " ").trim();
  if (title && title.toLowerCase() !== "untitled source") {
    return title.length > 64 ? `${title.slice(0, 61).trim()}...` : title;
  }
  const summary = sourceSummary(source);
  return summary ? "this source" : source.siteName || "the latest source";
}

function cleanInsight(value: string): string {
  return value.replace(/\s+/g, " ").replace(/^useful bit:\s*/i, "").trim();
}

function buildLandingUrl(input: {
  id: string;
  pillar: ContentPillar;
  sources: Source[];
  insight: string;
  receiptLinks: boolean;
}): string {
  if (!input.receiptLinks) {
    return buildCampaignUrl(getEnv().appBaseUrl, input.pillar);
  }

  const snapshot = encodeReceiptSnapshot(
    buildReceiptSnapshot({
      draftId: input.id,
      pillar: input.pillar,
      insight: input.insight,
      sources: input.sources
    })
  );

  return buildCampaignUrl(getEnv().appBaseUrl, input.pillar, input.id, snapshot);
}

function isReceiptLink(url: string): boolean {
  try {
    return new URL(url).pathname.startsWith("/receipts/");
  } catch {
    return false;
  }
}

function hasUsableSourceText(source: Source): boolean {
  return Boolean(source.title || source.snippet || source.fetchedText);
}
