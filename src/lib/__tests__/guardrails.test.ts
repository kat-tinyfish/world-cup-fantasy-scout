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
      `Captaincy crimes court is now in session. Useful bit: captain planning matters before deadline. TinyFish found the receipts: ${landingUrl}`,
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
      `Captaincy crimes court is now in session. Useful bit: captain planning matters, @somebody. ${landingUrl}`,
      [source],
      landingUrl
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Do not mention users in v1 broadcast posts.");
  });

  it("rejects injury jokes", () => {
    const result = validateDraftText(
      `Rotation weather report: the injury list is funny lol. Useful bit: lineup watch matters. ${landingUrl}`,
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
