import { getEnv } from "./env";
import { validateDraftText, xWeightedLength } from "./guardrails";
import { HOOKS } from "./personality";
import type { ContentPillar, Source } from "./types";

export type LlmTweetInput = {
  pillar: ContentPillar;
  insight: string;
  landingUrl: string;
  sources: Source[];
  hookVariant?: number;
};

export type LlmTweetResult = {
  text: string;
  usedLlm: boolean;
  note: string;
};

export async function writeTweetWithLlm(input: LlmTweetInput): Promise<LlmTweetResult> {
  const fallback = buildFallbackTweet(input);
  const env = getEnv();
  if (!env.openaiApiKey) {
    return {
      text: fallback,
      usedLlm: false,
      note: "LLM tweet writing skipped because OPENAI_API_KEY is not set."
    };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.openaiModel,
      max_output_tokens: 180,
      input: [
        {
          role: "developer",
          content: [
            "You write the final X/Twitter post for a World Cup Fantasy assistant.",
            "TinyFish campaign voice: fantasy insider talking to another fantasy insider, smart friend in the deadline-chaos group chat, specific, wry, and useful without sounding like a brand account.",
            "Make the first line a hook that proves you understand World Cup Fantasy pain: captain blanks, template panic, rotation risk, ownership traps, deadline scrambling, and mini-league receipts.",
            "The joke should come from the source-backed fantasy insight, not random mascot lore or builder/product language.",
            "Structure: one funny hook, one concrete fantasy insight, then the exact proof URL. The URL is the receipt, so do not explain it.",
            "Avoid corporate filler, press-release voice, generic hype, builder-to-builder phrasing, goblin/hydra bits, 'Useful bit', 'TinyFish found the receipts', labels, and hashtags.",
            "Hard rules: keep the exact URL unchanged; keep the whole post under 280 X-weighted characters; do not mention users; do not joke about injuries; do not invent facts.",
            "Return only the final post text. No markdown, no labels, no alternatives."
          ].join(" ")
        },
        {
          role: "user",
          content: [
            `Pillar: ${input.pillar}`,
            `Agent insight to turn into the tweet: ${input.insight}`,
            `Required URL: ${input.landingUrl}`,
            `Clean source evidence from Fetch: ${input.sources
              .map((source) => `${source.title}: ${source.snippet || source.fetchedText?.slice(0, 240) || source.url}`)
              .join("\n")}`
          ].join("\n\n")
        }
      ]
    })
  });

  if (!response.ok) {
    return {
      text: fallback,
      usedLlm: false,
      note: `LLM tweet writing skipped because OpenAI returned ${response.status}.`
    };
  }

  const data = (await response.json()) as OpenAIResponse;
  const candidate = cleanModelTweet(extractResponseText(data));
  const validation = validateDraftText(candidate, input.sources, input.landingUrl);

  if (!candidate || !validation.ok) {
    return {
      text: fallback,
      usedLlm: false,
      note: `LLM tweet rejected by guardrails: ${validation.errors.join(" ")}`
    };
  }

  return {
    text: candidate,
    usedLlm: true,
    note: "LLM wrote the final tweet from the source-backed insight."
  };
}

export function buildFallbackTweet(input: LlmTweetInput): string {
  const hook = fallbackHookForPillar(input.pillar, input.hookVariant ?? 0);
  const compactInsight = compactSentence(input.insight, 145);
  const candidates = [
    `${hook} ${compactInsight} ${input.landingUrl}`,
    `${hook} ${compactSentence(input.insight, 105)} ${input.landingUrl}`,
    `${compactSentence(`${hook} ${input.insight}`, 215)} ${input.landingUrl}`
  ];

  return (
    candidates.find((candidate) => validateDraftText(candidate, input.sources, input.landingUrl).ok) ??
    forceFitTweet(`${hook} ${compactSentence(input.insight, 80)}`, input.landingUrl)
  );
}

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
};

function extractResponseText(response: OpenAIResponse): string {
  if (response.output_text) return response.output_text;

  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

function cleanModelTweet(text: string): string {
  return text
    .replace(/^["']|["']$/g, "")
    .replace(/^(tweet|post|draft)\s*:\s*/i, "")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function fallbackHookForPillar(pillar: ContentPillar, variant: number): string {
  const pillarHooks = HOOKS[pillar];
  return pillarHooks[variant % pillarHooks.length];
}

function compactSentence(text: string, maxChars: number): string {
  if (maxChars <= 0) return "";
  const cleaned = text
    .replace(/\s+/g, " ")
    .replace(/^useful bit:\s*/i, "")
    .replace(/\s+https?:\/\/\S+/g, "")
    .trim();
  if (cleaned.length <= maxChars) return cleaned;
  const truncated = cleaned.slice(0, maxChars - 1);
  const lastSpace = truncated.lastIndexOf(" ");
  const shortened = truncated
    .slice(0, lastSpace > 24 ? lastSpace : truncated.length)
    .trim()
    .replace(/[;,:-]+$/g, "");
  if (!shortened) return "";
  return /[.!?]$/.test(shortened) ? shortened : `${shortened}.`;
}

function forceFitTweet(body: string, landingUrl: string): string {
  let compactBody = compactSentence(body, 220);
  let candidate = `${compactBody} ${landingUrl}`;

  while (compactBody.length > 0 && xWeightedLength(candidate) > 280) {
    compactBody = compactSentence(compactBody, Math.max(0, compactBody.length - 12));
    candidate = `${compactBody} ${landingUrl}`;
  }

  return candidate;
}
