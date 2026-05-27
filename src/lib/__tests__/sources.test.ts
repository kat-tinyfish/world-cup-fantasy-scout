import { describe, expect, it } from "vitest";
import { dedupeSearchResults, mergeSearchAndFetch, normalizeSourceUrl } from "../sources";

describe("sources", () => {
  it("normalizes tracking params without destroying the source URL", () => {
    expect(normalizeSourceUrl("https://example.com/a?utm_source=x&keep=yes#section")).toBe(
      "https://example.com/a?keep=yes"
    );
  });

  it("dedupes equivalent search results", () => {
    const results = dedupeSearchResults([
      { url: "https://example.com/a?utm_campaign=test", title: "A" },
      { url: "https://example.com/a", title: "A again" },
      { url: "https://example.com/b", title: "B" }
    ]);

    expect(results).toHaveLength(2);
  });

  it("merges search and fetch evidence", () => {
    const sources = mergeSearchAndFetch(
      [{ url: "https://example.com/a", title: "Search title", site_name: "Example", snippet: "Snippet" }],
      [{ url: "https://example.com/a", title: "Fetched title", text: "Fetched text", published_date: "2026-05-27" }],
      new Date("2026-05-27T12:00:00Z")
    );

    expect(sources[0]).toMatchObject({
      title: "Fetched title",
      fetchedText: "Fetched text",
      publishedDate: "2026-05-27"
    });
  });
});
