import { describe, expect, it, vi } from "vitest";
import { buildDraftFromSources } from "../generator";
import { MemoryStore } from "../store";
import type { Source } from "../types";
import { publishDraft } from "../xPublisher";

vi.stubEnv("APP_BASE_URL", "https://agent.tinyfish.ai/world-cup-fantasy");
vi.stubEnv("X_CLIENT_ID", "client");
vi.stubEnv("X_CLIENT_SECRET", "secret");
vi.stubEnv("X_REFRESH_TOKEN", "refresh");
vi.stubEnv("X_OAUTH_TOKEN_URL", "https://x.example/oauth");
vi.stubEnv("X_API_BASE_URL", "https://x.example");
vi.stubEnv("X_DRY_RUN", "0");

const source: Source = {
  id: "src_1",
  url: "https://example.com/captain-guide",
  title: "Captain guide",
  siteName: "Example",
  snippet: "Captain guide and deadline tips.",
  publishedDate: "2026-05-27",
  fetchedText: "Captain guide and deadline tips.",
  discoveredAt: "2026-05-27T12:00:00Z",
  usedInDraftIds: []
};

describe("publishDraft", () => {
  it("refuses unapproved drafts", async () => {
    const draft = buildDraftFromSources("captaincy_chaos", [source], new Date("2026-05-27T12:00:00Z"));

    await expect(publishDraft({ store: new MemoryStore(), draft, dryRun: true })).rejects.toThrow(
      "Only approved drafts can be published."
    );
  });

  it("publishes exactly one approved post through the X post endpoint", async () => {
    const store = new MemoryStore();
    const draft = {
      ...buildDraftFromSources("captaincy_chaos", [source], new Date("2026-05-27T12:00:00Z")),
      status: "approved" as const,
      approvedBy: "admin"
    };
    await store.createDraft(draft);

    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/oauth")) {
        return Response.json({ access_token: "access", refresh_token: "next-refresh" });
      }
      expect(url).toBe("https://x.example/2/tweets");
      expect(JSON.parse(String(init?.body))).toEqual({ text: draft.text });
      return Response.json({ data: { id: "post_123", text: draft.text } });
    }) as unknown as typeof fetch;

    const result = await publishDraft({ store, draft, fetchImpl });

    expect(result.id).toBe("post_123");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(await store.getState("x_refresh_token")).toBe("next-refresh");
  });
});
