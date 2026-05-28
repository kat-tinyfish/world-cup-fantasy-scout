import { describe, expect, it } from "vitest";
import { validateDraftText, xWeightedLength } from "../guardrails";
import type { Source } from "../types";

const landingUrl = "https://agent.tinyfish.ai/receipts/draft_123?utm_source=x";
const source: Source = {
  id: "src_1",
  url: "https://example.com/world-cup-fantasy",
  title: "World Cup Fantasy captain guide",
  siteName: "Example",
  snippet: "A useful captain guide for World Cup Fantasy managers before the deadline.",
  publishedDate: "2026-05-27",
  fetchedText: "A useful captain guide for World Cup Fantasy managers before the deadline.",
  discoveredAt: "2026-05-27T12:00:00Z",
  usedInDraftIds: []
};

describe("guardrails", () => {
  it("accepts a funny, useful, source-backed post", () => {
    const result = validateDraftText(
      `Captaincy plan before the group chat becomes a courtroom. Build captain switches before deadline. ${landingUrl}`,
      [source],
      landingUrl
    );

    expect(result.ok).toBe(true);
  });

  it("rejects bland posts", () => {
    const result = validateDraftText(
      `Here are some World Cup Fantasy tips with a source: ${landingUrl}`,
      [source],
      landingUrl
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Draft needs a distinctive joke, bit, or funny hook.");
  });

  it("rejects user mentions in v1", () => {
    const result = validateDraftText(
      `Captaincy plan before the group chat becomes a courtroom. Build captain switches before deadline, @somebody. ${landingUrl}`,
      [source],
      landingUrl
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Do not mention users in v1 broadcast posts.");
  });

  it("rejects injury jokes", () => {
    const result = validateDraftText(
      `Lineup watch, aka certainty wearing a fake mustache. The injury list is funny lol, but lineup watch matters. ${landingUrl}`,
      [source],
      landingUrl
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Do not joke about injuries.");
  });

  it("weights X URLs as 23 characters", () => {
    expect(xWeightedLength(`hello ${landingUrl}`)).toBe(6 + 23);
  });
});
