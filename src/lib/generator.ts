import { getEnv } from "./env";
import { validateDraftText, xWeightedLength } from "./guardrails";
import { makeId } from "./ids";
import { HOOKS, PILLAR_LABELS, PILLAR_QUERIES } from "./personality";
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

export type GenerateDraftsOptions = {
  store: Store;
  tinyfish?: TinyFishClient;
  pillars?: ContentPillar[];
  now?: Date;
};

export type GenerateDraftsResult = {
  created: DraftPost[];
  skipped: Array<{ pillar: ContentPillar; reason: string }>;
};

export async function generateDrafts(options: GenerateDraftsOptions): Promise<GenerateDraftsResult> {
  const store = options.store;
  const tinyfish = options.tinyfish ?? new TinyFishApiClient();
  const now = options.now ?? new Date();
  const created: DraftPost[] = [];
  const skipped: GenerateDraftsResult["skipped"] = [];

  await store.ensureReady();

  for (const pillar of options.pillars ?? DEFAULT_PILLARS) {
    const searchResults = await runPillarSearches(tinyfish, pillar);
    if (!searchResults.length) {
      skipped.push({ pillar, reason: "No source results." });
      continue;
    }

    const urls = searchResults.map((result) => result.url).filter(Boolean).slice(0, 10);
    const fetchedResults = await tinyfish.fetch(urls);
    const sources = mergeSearchAndFetch(searchResults, fetchedResults, now).filter(hasUsableSourceText).slice(0, 4);
    if (!sources.length) {
      skipped.push({ pillar, reason: "No usable fetched or snippet text." });
      continue;
    }

    await store.upsertSources(sources);
    const draft = buildDraftFromSources(pillar, sources, now);
    const duplicate = await store.findSimilarDraft(draft.text);
    if (duplicate) {
      skipped.push({ pillar, reason: `Duplicate draft ${duplicate.id}.` });
      continue;
    }

    const validation = validateDraftText(draft.text, draft.sources, draft.landingUrl);
    if (!validation.ok) {
      skipped.push({ pillar, reason: validation.errors.join(" ") });
      continue;
    }

    const saved = await store.createDraft({
      ...draft,
      toneScore: validation.toneScore,
      usefulnessScore: validation.usefulnessScore
    });
    created.push(saved);
  }

  return { created, skipped };
}

export function buildDraftFromSources(pillar: ContentPillar, sources: Source[], now = new Date()): DraftPost {
  const id = makeId("draft");
  const landingUrl = buildCampaignUrl(getEnv().appBaseUrl, pillar, id);
  const text = composePostText(pillar, sources, landingUrl);
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
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function regenerateJoke(draft: DraftPost): DraftPost {
  const hook = pickHook(draft.pillar, draft.id.length + 1);
  const insight = extractInsight(draft.pillar, draft.sources);
  const text = trimForX(`${hook} ${insight} TinyFish found the receipts: ${draft.landingUrl}`);
  const validation = validateDraftText(text, draft.sources, draft.landingUrl);
  return {
    ...draft,
    text,
    toneScore: validation.toneScore,
    usefulnessScore: validation.usefulnessScore,
    updatedAt: new Date().toISOString()
  };
}

export function regenerateInsight(draft: DraftPost): DraftPost {
  const rotatedSources = [...draft.sources.slice(1), draft.sources[0]].filter(Boolean);
  const sources = rotatedSources.length ? rotatedSources : draft.sources;
  const text = composePostText(draft.pillar, sources, draft.landingUrl, 1);
  const validation = validateDraftText(text, sources, draft.landingUrl);
  return {
    ...draft,
    sources,
    text,
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

function composePostText(pillar: ContentPillar, sources: Source[], landingUrl: string, hookOffset = 0): string {
  const hook = pickHook(pillar, sources.length + hookOffset);
  const insight = extractInsight(pillar, sources);
  return trimForX(`${hook} ${insight} TinyFish found the receipts: ${landingUrl}`);
}

function pickHook(pillar: ContentPillar, offset: number): string {
  const hooks = HOOKS[pillar];
  return hooks[offset % hooks.length];
}

function extractInsight(pillar: ContentPillar, sources: Source[]): string {
  const source = sources[0];
  const summary = sourceSummary(source);
  const title = source.title.replace(/\s+/g, " ").trim();
  const label = PILLAR_LABELS[pillar].toLowerCase();

  if (pillar === "built_with_tinyfish") {
    return `Useful bit: this scout is built from search plus fetch, so the ${label} comes with source links instead of vibes.`;
  }

  if (/captain/i.test(label)) {
    return `Useful bit: captain and substitution planning should track ${title}; if the first punt blanks, pivot with a source in hand.`;
  }

  if (/lineup|rotation/i.test(label)) {
    return `Useful bit: watch ${title} before locking a lineup; rotation risk is where tidy drafts go to get silly.`;
  }

  if (/differential/i.test(label)) {
    return `Useful bit: differential hunting starts with ${title}; ownership punts need a real source, not just goblin confidence.`;
  }

  if (/mini-league/i.test(label)) {
    return `Useful bit: share ${title} before deadline so your mini-league banter has evidence and not just vibes in a trench coat.`;
  }

  return `Useful bit: ${summary || title} Watch the source before the deadline and do not let the template hydra drive.`;
}

function trimForX(text: string): string {
  if (xWeightedLength(text) <= 280) return text;

  const receiptMarker = "TinyFish found the receipts:";
  const receiptIndex = text.lastIndexOf(receiptMarker);
  if (receiptIndex >= 0) {
    const suffix = text.slice(receiptIndex).trim();
    let body = text.slice(0, receiptIndex).trimEnd();
    while (body.length > 0 && xWeightedLength(`${body} ${suffix}`) > 280) {
      body = body.slice(0, -1).trimEnd();
    }
    return `${body} ${suffix}`;
  }

  const urlMatch = text.match(/https?:\/\/\S+$/);
  const url = urlMatch?.[0] ?? "";
  let withoutUrl = url ? text.slice(0, -url.length).trimEnd() : text;
  const suffix = url ? ` ${url}` : "";

  while (withoutUrl.length > 0 && xWeightedLength(`${withoutUrl}...${suffix}`) > 280) {
    withoutUrl = withoutUrl.slice(0, -1).trimEnd();
  }

  return `${withoutUrl}...${suffix}`;
}

function hasUsableSourceText(source: Source): boolean {
  return Boolean(source.title || source.snippet || source.fetchedText);
}
