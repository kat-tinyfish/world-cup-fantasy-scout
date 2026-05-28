"use client";

import { useEffect, useState, useTransition } from "react";
import { PILLAR_LABELS } from "@/lib/personality";
import type { DraftPost } from "@/lib/types";

type GenerateResponse = {
  created: DraftPost[];
  skipped: Array<{ pillar: DraftPost["pillar"]; reason: string }>;
};

type PublishResponse = {
  published: {
    id: string;
    text: string;
    dryRun: boolean;
  };
};

const SESSION_KEY = "world-cup-fantasy-scout:drafts";

export function AdminConsole({ token }: { token: string }) {
  const [drafts, setDrafts] = useState<DraftPost[]>([]);
  const [message, setMessage] = useState("Drafts live in this browser tab and disappear when the session closes.");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      setDrafts(JSON.parse(stored) as DraftPost[]);
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(drafts));
  }, [drafts]);

  function generateDrafts() {
    startTransition(async () => {
      setMessage("Generating source-backed chaos. The goblin is reading.");
      const response = await fetch(`/api/cron/generate?token=${encodeURIComponent(token)}`, {
        cache: "no-store"
      });
      const data = (await response.json()) as GenerateResponse | { error: string };
      if (!response.ok || "error" in data) {
        setMessage("Generation failed. Check TINYFISH_API_KEY and the server logs.");
        return;
      }

      setDrafts((existing) => mergeDrafts(data.created, existing));
      setMessage(`Generated ${data.created.length} draft(s). Skipped ${data.skipped.length}.`);
    });
  }

  function updateDraft(id: string, patch: Partial<DraftPost>) {
    setDrafts((existing) =>
      existing.map((draft) =>
        draft.id === id ? { ...draft, ...patch, updatedAt: new Date().toISOString() } : draft
      )
    );
  }

  function transformDraft(id: string, action: "regenerate-joke" | "regenerate-insight") {
    const draft = drafts.find((item) => item.id === id);
    if (!draft) return;

    startTransition(async () => {
      const response = await fetch("/api/admin/transform", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ token, draft, action })
      });
      const data = (await response.json()) as { draft?: DraftPost; error?: string };
      if (!response.ok || !data.draft) {
        setMessage(data.error ?? "Regeneration failed.");
        return;
      }
      updateDraft(id, data.draft);
      setMessage("Draft regenerated. Still smells like football panic, but legally distinct.");
    });
  }

  function publishDraft(id: string) {
    const draft = drafts.find((item) => item.id === id);
    if (!draft) return;

    startTransition(async () => {
      const approvedDraft = { ...draft, status: "approved" as const, approvedBy: "admin" };
      const response = await fetch("/api/admin/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ token, draft: approvedDraft })
      });
      const data = (await response.json()) as PublishResponse | { error: string };
      if (!response.ok || "error" in data) {
        setMessage("Publish failed. Keep X_DRY_RUN=1 until credentials are ready, then check server logs.");
        return;
      }

      updateDraft(id, {
        status: "published",
        approvedBy: "admin",
        publishedPostId: data.published.id
      });
      setMessage(data.published.dryRun ? "Dry-run publish succeeded. No tweet was posted." : "Published to X.");
    });
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Human approval queue</p>
          <h1>World Cup Fantasy Scout drafts</h1>
          <p>{message}</p>
        </div>
        <div className="hero-actions">
          <button className="button primary" type="button" onClick={generateDrafts} disabled={isPending}>
            {isPending ? "Working..." : "Generate drafts"}
          </button>
          <button className="button secondary" type="button" onClick={() => setDrafts([])}>
            Clear session drafts
          </button>
        </div>
      </header>

      <section className="draft-list">
        {drafts.length === 0 ? (
          <article className="draft-card">
            <h2>No drafts yet.</h2>
            <p>Generate a batch to preview joke-first, source-backed post ideas.</p>
          </article>
        ) : null}

        {drafts.map((draft) => (
          <article className="draft-card" key={draft.id}>
            <div className="draft-meta">
              <span>{draft.status}</span>
              <span>{PILLAR_LABELS[draft.pillar]}</span>
              <span>Tone {draft.toneScore}</span>
              <span>Useful {draft.usefulnessScore}</span>
              {draft.publishedPostId ? <span>Post {draft.publishedPostId}</span> : null}
            </div>
            <label>
              Draft text
              <textarea
                value={draft.text}
                rows={5}
                onChange={(event) => updateDraft(draft.id, { text: event.target.value })}
              />
            </label>
            <div className="admin-actions">
              <button type="button" onClick={() => transformDraft(draft.id, "regenerate-joke")}>
                Regenerate joke
              </button>
              <button type="button" onClick={() => transformDraft(draft.id, "regenerate-insight")}>
                Regenerate insight
              </button>
              <button type="button" onClick={() => updateDraft(draft.id, { status: "approved", approvedBy: "admin" })}>
                Approve
              </button>
              <button type="button" onClick={() => updateDraft(draft.id, { status: "rejected" })}>
                Reject
              </button>
              <button type="button" onClick={() => publishDraft(draft.id)}>
                Publish now
              </button>
            </div>
            <details>
              <summary>Source evidence</summary>
              <ul>
                {draft.sources.map((source) => (
                  <li key={source.id}>
                    <a href={source.url}>{source.title}</a>
                  </li>
                ))}
              </ul>
            </details>
          </article>
        ))}
      </section>
    </main>
  );
}

function mergeDrafts(incoming: DraftPost[], existing: DraftPost[]): DraftPost[] {
  const seen = new Set(existing.map((draft) => draft.id));
  return [...incoming.filter((draft) => !seen.has(draft.id)), ...existing];
}
