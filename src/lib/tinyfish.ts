import { getEnv } from "./env";
import type { FetchResult, SearchResult } from "./sources";

export interface TinyFishClient {
  search(query: string): Promise<SearchResult[]>;
  fetch(urls: string[]): Promise<FetchResult[]>;
  agentInsight?(input: TinyFishAgentInsightInput): Promise<TinyFishAgentInsightResult>;
}

export type TinyFishAgentInsightInput = {
  url: string;
  pillarLabel: string;
  sourceTitle: string;
  onEvent?: (event: TinyFishAgentProgressEvent) => void;
};

export type TinyFishAgentProgressEvent = {
  type: "started" | "progress" | "complete";
  message: string;
  runId?: string;
};

export type TinyFishAgentInsightResult = {
  insight: string | null;
  events: TinyFishAgentProgressEvent[];
};

export class TinyFishApiClient implements TinyFishClient {
  constructor(
    private readonly apiKey = getEnv().tinyfishApiKey,
    private readonly searchBaseUrl = "https://api.search.tinyfish.ai",
    private readonly fetchBaseUrl = "https://api.fetch.tinyfish.ai",
    private readonly agentBaseUrl = "https://agent.tinyfish.ai"
  ) {}

  async search(query: string): Promise<SearchResult[]> {
    if (!this.apiKey) {
      throw new Error("TINYFISH_API_KEY is required to search sources.");
    }

    const url = new URL("/", this.searchBaseUrl);
    url.searchParams.set("query", query);
    url.searchParams.set("location", "US");
    url.searchParams.set("language", "en");

    const response = await fetch(url, {
      headers: {
        "X-API-Key": this.apiKey
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`TinyFish Search failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as { results?: SearchResult[] };
    return data.results ?? [];
  }

  async fetch(urls: string[]): Promise<FetchResult[]> {
    if (!this.apiKey) {
      throw new Error("TINYFISH_API_KEY is required to fetch sources.");
    }
    if (!urls.length) return [];

    const response = await fetch(new URL("/", this.fetchBaseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey
      },
      body: JSON.stringify({
        urls: urls.slice(0, 10),
        format: "markdown",
        links: false,
        image_links: false
      }),
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`TinyFish Fetch failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as { results?: FetchResult[] };
    return data.results ?? [];
  }

  async agentInsight(input: TinyFishAgentInsightInput): Promise<TinyFishAgentInsightResult> {
    if (!this.apiKey) {
      throw new Error("TINYFISH_API_KEY is required to run TinyFish Agent.");
    }

    const events: TinyFishAgentProgressEvent[] = [];
    const pushEvent = (event: TinyFishAgentProgressEvent) => {
      events.push(event);
      input.onEvent?.(event);
    };

    const response = await fetch(new URL("/v1/automation/run-sse", this.agentBaseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey
      },
      body: JSON.stringify({
        url: input.url,
        browser_profile: "lite",
        goal: [
          `Review this page for the TinyFish World Cup Fantasy Scout ${input.pillarLabel} pillar.`,
          "Extract one timely, source-backed fantasy football insight that would make a World Cup Fantasy manager think: right, that matters before deadline.",
          "Prefer starter risk, captaincy, ownership, fixture, set-piece, chip, lineup, or deadline-relevant details.",
          "Write like a fantasy insider, not a generic sports analyst.",
          "Return a single concise sentence with the practical why. Do not include markdown, citations, or unsupported claims."
        ].join(" ")
      })
    });

    if (!response.ok || !response.body) {
      throw new Error(`TinyFish Agent failed: ${response.status} ${await response.text()}`);
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let insight: string | null = null;

    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true });
      const parts = buffer.split(/\n\n|\r\n\r\n/);
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const parsed = parseAgentEvent(part);
        if (!parsed) continue;

        if (parsed.type === "STARTED") {
          pushEvent({ type: "started", message: "TinyFish Agent opened the source.", runId: runIdFromEvent(parsed) });
        }

        if (parsed.type === "PROGRESS") {
          pushEvent({
            type: "progress",
            message: String(parsed.purpose ?? parsed.message ?? "TinyFish Agent is working."),
            runId: runIdFromEvent(parsed)
          });
        }

        if (parsed.type === "COMPLETE") {
          insight = extractAgentInsight(parsed.result);
          pushEvent({
            type: "complete",
            message: insight ? `Agent insight: ${insight}` : "TinyFish Agent completed without a concise insight.",
            runId: runIdFromEvent(parsed)
          });
        }
      }
    }

    return { insight, events };
  }
}

function parseAgentEvent(part: string): Record<string, unknown> | null {
  const dataLine = part
    .split(/\r?\n/)
    .find((line) => line.startsWith("data:"))
    ?.replace(/^data:\s*/, "");
  const raw = dataLine ?? part.trim();
  if (!raw || raw === "[DONE]") return null;

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractAgentInsight(result: unknown): string | null {
  if (!result) return null;
  if (typeof result === "string") return cleanInsight(result);
  if (typeof result !== "object") return null;

  const resultObject = result as Record<string, unknown>;
  for (const key of ["insight", "takeaway", "summary", "text", "result"]) {
    const value = resultObject[key];
    if (typeof value === "string") return cleanInsight(value);
  }

  return cleanInsight(JSON.stringify(resultObject));
}

function runIdFromEvent(event: Record<string, unknown>): string | undefined {
  return typeof event.run_id === "string" ? event.run_id : undefined;
}

function cleanInsight(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 180);
}
