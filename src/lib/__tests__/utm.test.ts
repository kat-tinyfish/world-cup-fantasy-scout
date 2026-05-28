import { describe, expect, it } from "vitest";
import { buildCampaignUrl } from "../utm";

describe("buildCampaignUrl", () => {
  it("adds the required campaign UTM params", () => {
    const url = new URL(buildCampaignUrl("https://agent.tinyfish.ai/world-cup-fantasy", "daily_scout"));

    expect(url.searchParams.get("utm_source")).toBe("x");
    expect(url.searchParams.get("utm_medium")).toBe("bot");
    expect(url.searchParams.get("utm_campaign")).toBe("world_cup_fantasy");
    expect(url.searchParams.get("utm_content")).toBe("daily_scout");
  });

  it("routes draft links to receipts pages", () => {
    const url = new URL(buildCampaignUrl("https://agent.tinyfish.ai", "captaincy_chaos", "draft_123"));

    expect(url.pathname).toBe("/receipts/draft_123");
  });

  it("preserves a path-based app base URL", () => {
    const url = new URL(buildCampaignUrl("https://agent.tinyfish.ai/world-cup-fantasy", "captaincy_chaos", "draft_123"));

    expect(url.pathname).toBe("/world-cup-fantasy/receipts/draft_123");
  });

  it("embeds receipt snapshots when provided", () => {
    const url = new URL(buildCampaignUrl("https://agent.tinyfish.ai", "captaincy_chaos", "draft_123", "snapshot"));

    expect(url.pathname).toBe("/receipts/draft_123");
    expect(url.searchParams.get("r")).toBe("snapshot");
  });
});
