import { describe, expect, it, vi } from "vitest";
import { generateDrafts, nextPostingSlot } from "../generator";
import { MemoryStore } from "../store";
import type { TinyFishClient } from "../tinyfish";

vi.stubEnv("APP_BASE_URL", "https://agent.tinyfish.ai/world-cup-fantasy");

const tinyfish: TinyFishClient = {
  async search() {
    return [
      {
        url: "https://example.com/world-cup-fantasy-captain-guide",
        title: "World Cup Fantasy captain guide",
        site_name: "Example FC",
        snippet: "Captain guide and deadline tips for World Cup Fantasy."
      }
    ];
  },
  async fetch() {
    return [
      {
        url: "https://example.com/world-cup-fantasy-captain-guide",
        title: "World Cup Fantasy captain guide",
        text: "Captain guide and deadline tips for World Cup Fantasy managers.",
        published_date: "2026-05-27"
      }
    ];
  }
};

describe("generateDrafts", () => {
  it("creates source-backed drafts that await approval", async () => {
    const store = new MemoryStore();
    const result = await generateDrafts({
      store,
      tinyfish,
      pillars: ["captaincy_chaos"],
      now: new Date("2026-05-27T12:00:00Z")
    });

    expect(result.created).toHaveLength(1);
    expect(result.created[0].status).toBe("draft");
    expect(result.created[0].sources).toHaveLength(1);
    expect(result.created[0].text).toContain("TinyFish found the receipts");
  });

  it("skips drafts when no sources exist", async () => {
    const store = new MemoryStore();
    const result = await generateDrafts({
      store,
      tinyfish: { search: async () => [], fetch: async () => [] },
      pillars: ["daily_scout"]
    });

    expect(result.created).toHaveLength(0);
    expect(result.skipped[0].reason).toBe("No source results.");
  });
});

describe("nextPostingSlot", () => {
  it("uses the next 9 AM or 4 PM ET slot represented in UTC during EDT", () => {
    expect(nextPostingSlot(new Date("2026-05-27T12:00:00Z")).toISOString()).toBe("2026-05-27T13:00:00.000Z");
    expect(nextPostingSlot(new Date("2026-05-27T13:01:00Z")).toISOString()).toBe("2026-05-27T20:00:00.000Z");
  });
});
