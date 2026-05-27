import { getEnv } from "./env";
import type { FetchResult, SearchResult } from "./sources";

export interface TinyFishClient {
  search(query: string): Promise<SearchResult[]>;
  fetch(urls: string[]): Promise<FetchResult[]>;
}

export class TinyFishApiClient implements TinyFishClient {
  constructor(
    private readonly apiKey = getEnv().tinyfishApiKey,
    private readonly searchBaseUrl = "https://api.search.tinyfish.ai",
    private readonly fetchBaseUrl = "https://api.fetch.tinyfish.ai"
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
}
