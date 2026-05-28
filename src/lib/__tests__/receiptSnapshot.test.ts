import { describe, expect, it } from "vitest";
import { buildReceiptSnapshot, decodeReceiptSnapshot, encodeReceiptSnapshot } from "../receiptSnapshot";
import type { Source } from "../types";

const source: Source = {
  id: "src_1",
  url: "https://example.com/world-cup-fantasy",
  title: "World Cup Fantasy captain guide",
  siteName: "Example",
  snippet: "Captain guide and deadline tips for World Cup Fantasy managers.",
  publishedDate: "2026-05-27",
  fetchedText: "Fetched captain guide text with lineup watch and ownership context.",
  agentInsight: "Manual substitutions make captaincy a two-step decision.",
  discoveredAt: "2026-05-27T12:00:00Z",
  usedInDraftIds: []
};

describe("receipt snapshots", () => {
  it("round-trips source evidence without durable storage", () => {
    const snapshot = buildReceiptSnapshot({
      draftId: "draft_123",
      pillar: "captaincy_chaos",
      insight: "Build captain switches before deadline.",
      sources: [source],
      generationNotes: ["TinyFish Agent: Manual substitutions make captaincy a two-step decision."]
    });

    const decoded = decodeReceiptSnapshot(encodeReceiptSnapshot(snapshot));

    expect(decoded).toMatchObject({
      draftId: "draft_123",
      pillar: "captaincy_chaos",
      insight: "Build captain switches before deadline."
    });
    expect(decoded?.sources[0]).toMatchObject({
      url: source.url,
      snippet: source.snippet,
      fetchedText: source.fetchedText,
      agentInsight: source.agentInsight
    });
  });
});
