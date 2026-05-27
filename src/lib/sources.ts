import { createHash } from "node:crypto";
import type { Source } from "./types";

export type SearchResult = {
  url: string;
  title: string;
  site_name?: string;
  siteName?: string;
  snippet?: string;
};

export type FetchResult = {
  url: string;
  final_url?: string | null;
  title?: string | null;
  description?: string | null;
  text?: string | null;
  published_date?: string | null;
};

export function sourceIdForUrl(url: string): string {
  return `src_${createHash("sha256").update(url).digest("hex").slice(0, 18)}`;
}

export function normalizeSourceUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  for (const param of [...parsed.searchParams.keys()]) {
    if (param.toLowerCase().startsWith("utm_")) {
      parsed.searchParams.delete(param);
    }
  }
  return parsed.toString();
}

export function dedupeSearchResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    if (!result.url) return false;
    const normalized = normalizeSourceUrl(result.url);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export function mergeSearchAndFetch(
  searchResults: SearchResult[],
  fetchResults: FetchResult[],
  now = new Date()
): Source[] {
  const fetchedByUrl = new Map<string, FetchResult>();
  for (const fetched of fetchResults) {
    fetchedByUrl.set(normalizeSourceUrl(fetched.url), fetched);
    if (fetched.final_url) {
      fetchedByUrl.set(normalizeSourceUrl(fetched.final_url), fetched);
    }
  }

  return dedupeSearchResults(searchResults).map((result) => {
    const url = normalizeSourceUrl(result.url);
    const fetched = fetchedByUrl.get(url);

    return {
      id: sourceIdForUrl(url),
      url,
      title: fetched?.title ?? result.title ?? "Untitled source",
      siteName: result.site_name ?? result.siteName ?? new URL(url).hostname,
      snippet: result.snippet ?? fetched?.description ?? "",
      publishedDate: fetched?.published_date ?? null,
      fetchedText: fetched?.text ?? null,
      discoveredAt: now.toISOString(),
      usedInDraftIds: []
    };
  });
}

export function sourceSummary(source: Source): string {
  const text = source.fetchedText || source.snippet || source.title;
  return text.replace(/\s+/g, " ").trim().slice(0, 220);
}
