import { getEnv } from "./env";
import { validateDraftText } from "./guardrails";
import type { ContentPillar, Source } from "./types";

export type LlmPolishInput = {
  pillar: ContentPillar;
  draftText: string;
  landingUrl: string;
  sources: Source[];
  agentInsight?: string | null;
};

export type LlmPolishResult = {
  text: string;
  usedLlm: boolean;
  note: string;
};

export async function polishDraftWithLlm(input: LlmPolishInput): Promise<LlmPolishResult> {
  const env = getEnv();
  if (!env.openaiApiKey) {
    return {
      text: input.draftText,
      usedLlm: false,
      note: "LLM polish skipped because OPENAI_API_KEY is not set."
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
            "You write funny, concise X posts for a World Cup Fantasy assistant.",
            "Voice: witty scout, medium banter, joke-first, football-native, never mean-spirited.",
            "Hard rules: keep the exact URL unchanged; stay within 280 X-weighted characters; include one useful fantasy insight; do not mention users; do not joke about injuries; do not invent facts.",
            "Return only the final post text. No markdown, no labels, no alternatives."
          ].join(" ")
        },
        {
          role: "user",
          content: [
            `Current draft: ${input.draftText}`,
            `Pillar: ${input.pillar}`,
            `Required URL: ${input.landingUrl}`,
            input.agentInsight ? `TinyFish Agent insight: ${input.agentInsight}` : "TinyFish Agent insight: none",
            `Source evidence: ${input.sources
              .map((source) => `${source.title}: ${source.snippet || source.fetchedText?.slice(0, 220) || source.url}`)
              .join("\n")}`
          ].join("\n\n")
        }
      ]
    })
  });

  if (!response.ok) {
    return {
      text: input.draftText,
      usedLlm: false,
      note: `LLM polish skipped because OpenAI returned ${response.status}.`
    };
  }

  const data = (await response.json()) as OpenAIResponse;
  const candidate = extractResponseText(data).replace(/^["']|["']$/g, "").trim();
  const validation = validateDraftText(candidate, input.sources, input.landingUrl);

  if (!candidate || !validation.ok) {
    return {
      text: input.draftText,
      usedLlm: false,
      note: `LLM polish rejected by guardrails: ${validation.errors.join(" ")}`
    };
  }

  return {
    text: candidate,
    usedLlm: true,
    note: "LLM polished the joke and wording."
  };
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
