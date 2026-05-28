"use client";

import { useEffect, useState, useTransition } from "react";
import { PILLAR_LABELS } from "@/lib/personality";
import type { GenerationProgressEvent } from "@/lib/generator";
import type { ContentPillar, DraftPost } from "@/lib/types";

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
const LOG_SESSION_KEY = "world-cup-fantasy-scout:generation-log";
const SETTINGS_SESSION_KEY = "world-cup-fantasy-scout:generation-settings";
const PILLAR_OPTIONS = Object.keys(PILLAR_LABELS) as ContentPillar[];

export function AdminConsole({ token }: { token: string }) {
  const [drafts, setDrafts] = useState<DraftPost[]>([]);
  const [generationLog, setGenerationLog] = useState<GenerationProgressEvent[]>([]);
  const [draftCount, setDraftCount] = useState(3);
  const [selectedPillars, setSelectedPillars] = useState<ContentPillar[]>([
    "daily_scout",
    "differential_radar",
    "captaincy_chaos"
  ]);
  const [message, setMessage] = useState("Drafts live in this browser tab and disappear when the session closes.");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      setDrafts(JSON.parse(stored) as DraftPost[]);
    }

    const storedLog = sessionStorage.getItem(LOG_SESSION_KEY);
    if (storedLog) {
      setGenerationLog(JSON.parse(storedLog) as GenerationProgressEvent[]);
    }

    const storedSettings = sessionStorage.getItem(SETTINGS_SESSION_KEY);
    if (storedSettings) {
      const parsed = JSON.parse(storedSettings) as { draftCount?: number; selectedPillars?: ContentPillar[] };
      if (parsed.draftCount) setDraftCount(parsed.draftCount);
      if (parsed.selectedPillars?.length) setSelectedPillars(parsed.selectedPillars);
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(drafts));
  }, [drafts]);

  useEffect(() => {
    sessionStorage.setItem(LOG_SESSION_KEY, JSON.stringify(generationLog));
  }, [generationLog]);

  useEffect(() => {
    sessionStorage.setItem(SETTINGS_SESSION_KEY, JSON.stringify({ draftCount, selectedPillars }));
  }, [draftCount, selectedPillars]);

  async function generateDrafts() {
    setIsGenerating(true);
    setGenerationLog([]);
    try {
      const params = new URLSearchParams({
        token,
        stream: "1",
        count: String(draftCount),
        pillars: selectedPillars.join(",")
      });
      setMessage(`Generating ${draftCount} draft(s). The goblin is reading with intent.`);
      const response = await fetch(`/api/cron/generate?${params.toString()}`, {
        cache: "no-store"
      });
      if (!response.ok || !response.body) {
        setMessage("Generation failed. Check TINYFISH_API_KEY and the server logs.");
        return;
      }

      await readSseStream(response, (event) => {
        if (event.type === "result") {
          const data = event.data as GenerateResponse;
          setDrafts((existing) => mergeDrafts(data.created, existing));
          setMessage(`Generated ${data.created.length} draft(s). Skipped ${data.skipped.length}.`);
          return;
        }

        if (event.type === "error") {
          setMessage(event.message);
          return;
        }

        setGenerationLog((existing) => [...existing, event]);
        setMessage(event.message);
      });
    } finally {
      setIsGenerating(false);
    }
  }

  function togglePillar(pillar: ContentPillar) {
    setSelectedPillars((existing) => {
      if (existing.includes(pillar)) {
        return existing.length === 1 ? existing : existing.filter((item) => item !== pillar);
      }
      return [...existing, pillar];
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
          <button className="button primary" type="button" onClick={generateDrafts} disabled={isPending || isGenerating}>
            {isGenerating ? "Generating..." : "Generate drafts"}
          </button>
          <button className="button secondary" type="button" onClick={() => setDrafts([])}>
            Clear session drafts
          </button>
        </div>
      </header>

      <section className="controls-panel">
        <div>
          <p className="eyebrow">Generation controls</p>
          <h2>Choose the flavor of chaos.</h2>
          <p>
            Generate up to 12 drafts per batch. If the count is higher than the selected pillars, the app cycles
            through your selected draft types.
          </p>
        </div>
        <label>
          Number of drafts
          <input
            type="number"
            min={1}
            max={12}
            value={draftCount}
            onChange={(event) => setDraftCount(clampDraftCount(Number(event.target.value)))}
          />
        </label>
        <fieldset>
          <legend>Draft types</legend>
          <div className="pillar-grid">
            {PILLAR_OPTIONS.map((pillar) => (
              <label className="pillar-option" key={pillar}>
                <input
                  type="checkbox"
                  checked={selectedPillars.includes(pillar)}
                  onChange={() => togglePillar(pillar)}
                />
                <span>{PILLAR_LABELS[pillar]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="progress-panel" aria-live="polite">
        <div className="draft-meta">
          <span>{isGenerating ? "Live generation" : "Latest generation"}</span>
          <span>{generationLog.length} event(s)</span>
        </div>
        {generationLog.length === 0 ? (
          <p>No generation events yet. Click generate and the scout goblin will narrate the crime scene.</p>
        ) : (
          <ol className="progress-list">
            {generationLog.map((event, index) => (
              <li key={`${event.type}-${event.pillar ?? "batch"}-${index}`}>
                <span>{event.pillar ? PILLAR_LABELS[event.pillar] : "Batch"}</span>
                <strong>{event.type.replace(":", " ")}</strong>
                <p>{event.message}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

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
                    {source.agentInsight ? <p>Agent: {source.agentInsight}</p> : null}
                  </li>
                ))}
              </ul>
              {draft.generationNotes?.length ? (
                <div className="generation-notes">
                  <strong>Generation notes</strong>
                  <ul>
                    {draft.generationNotes.map((note, index) => (
                      <li key={`${draft.id}-note-${index}`}>{note}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
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

function clampDraftCount(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(12, Math.max(1, Math.floor(value)));
}

type StreamEvent =
  | GenerationProgressEvent
  | { type: "result"; data: unknown }
  | { type: "error"; message: string };

async function readSseStream(response: Response, onEvent: (event: StreamEvent) => void): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\n\n|\r\n\r\n/);
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const data = part
        .split(/\r?\n/)
        .find((line) => line.startsWith("data:"))
        ?.replace(/^data:\s*/, "");
      if (!data) continue;
      onEvent(JSON.parse(data) as StreamEvent);
    }
  }
}
