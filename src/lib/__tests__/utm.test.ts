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
});
