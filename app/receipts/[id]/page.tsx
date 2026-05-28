import { notFound } from "next/navigation";
import { createStore } from "@/lib/store";
import { PILLAR_LABELS } from "@/lib/personality";
import { decodeReceiptSnapshot, type ReceiptSnapshot } from "@/lib/receiptSnapshot";
import type { ContentPillar, DraftPost, Source } from "@/lib/types";

export const dynamic = "force-dynamic";

type ReceiptView = {
  id: string;
  pillar: ContentPillar;
  text: string | null;
  insight: string | null;
  generationNotes: string[];
  sources: Source[];
  isSnapshot: boolean;
};

export default async function ReceiptPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ r?: string | string[] }>;
}) {
  const { id } = await params;
  const { r } = await searchParams;
  const receiptSnapshot = decodeReceiptSnapshot(Array.isArray(r) ? r[0] : r);
  const store = createStore();
  await store.ensureReady();
  const draft = await store.getDraft(id);
  const receipt = draft ? receiptFromDraft(draft) : receiptSnapshot ? receiptFromSnapshot(receiptSnapshot) : null;
  if (!receipt) notFound();

  return (
    <main>
      <section className="hero compact">
        <div className="eyebrow">{PILLAR_LABELS[receipt.pillar]}</div>
        <h1>The receipts behind the scout note.</h1>
        <p className="hero-copy">
          {receipt.text ??
            "This page carries the source trail embedded in the X link: Search results, Fetch excerpts, and the Agent/insight pass behind the post."}
        </p>
        <div className="hero-actions">
          <a className="button primary" href="/#signup">
            Get daily scout drops
          </a>
          <a className="button secondary" href="https://docs.tinyfish.ai/fetch-api">
            How Fetch works
          </a>
        </div>
      </section>

      <section className="receipt-panel">
        <div>
          <p className="eyebrow">Scout trail</p>
          <h2>Search found it. Fetch cleaned it. Agent pulled the angle.</h2>
        </div>
        <ol>
          <li>Search surfaced {receipt.sources.length} source link(s) for this draft.</li>
          <li>Fetch extracted readable snippets so the reviewer can see the evidence without opening every tab.</li>
          <li>
            {receipt.insight
              ? `Scout insight: ${receipt.insight}`
              : "Agent insight was not available for this draft, so the app used the fetched source text."}
          </li>
        </ol>
      </section>

      <section className="source-list">
        <h2>Sources behind this scout note</h2>
        {receipt.isSnapshot ? (
          <p className="source-note">This receipt snapshot is embedded in the tweet link, so it still works without a database.</p>
        ) : null}
        {receipt.sources.map((source) => (
          <article className="source-card" key={source.id}>
            <div>
              <span>{source.siteName}</span>
              {source.publishedDate ? <span>{source.publishedDate}</span> : null}
            </div>
            <h3>
              <a href={source.url}>{source.title}</a>
            </h3>
            {source.snippet ? (
              <p>
                <strong>Search snippet:</strong> {source.snippet}
              </p>
            ) : null}
            {source.fetchedText ? (
              <p>
                <strong>Fetched excerpt:</strong> {source.fetchedText.slice(0, 520)}
              </p>
            ) : null}
            {source.agentInsight ? (
              <p>
                <strong>Agent takeaway:</strong> {source.agentInsight}
              </p>
            ) : null}
          </article>
        ))}
      </section>

      {receipt.generationNotes.length ? (
        <section className="source-list">
          <h2>Generation notes</h2>
          <article className="source-card">
            <ul>
              {receipt.generationNotes.map((note, index) => (
                <li key={`${receipt.id}-note-${index}`}>{note}</li>
              ))}
            </ul>
          </article>
        </section>
      ) : null}
    </main>
  );
}

function receiptFromDraft(draft: DraftPost): ReceiptView {
  const text = draft.text.replace(draft.landingUrl, "").trim();
  return {
    id: draft.id,
    pillar: draft.pillar,
    text,
    insight: extractInsight(draft.generationNotes ?? [], draft.sources),
    generationNotes: draft.generationNotes ?? [],
    sources: draft.sources,
    isSnapshot: false
  };
}

function receiptFromSnapshot(snapshot: ReceiptSnapshot): ReceiptView {
  return {
    id: snapshot.draftId,
    pillar: snapshot.pillar,
    text: null,
    insight: snapshot.insight,
    generationNotes: snapshot.generationNotes,
    sources: snapshot.sources.map((source, index) => ({
      id: `${snapshot.draftId}-source-${index}`,
      url: source.url,
      title: source.title,
      siteName: source.siteName,
      snippet: source.snippet,
      publishedDate: source.publishedDate,
      fetchedText: source.fetchedText,
      agentInsight: source.agentInsight,
      discoveredAt: "",
      usedInDraftIds: [snapshot.draftId]
    })),
    isSnapshot: true
  };
}

function extractInsight(notes: string[], sources: Source[]): string | null {
  const note = notes.find((item) => item.startsWith("TinyFish Agent: ") || item.startsWith("Source insight: "));
  if (note) {
    return note.replace(/^TinyFish Agent:\s*/, "").replace(/^Source insight:\s*/, "");
  }
  return sources.find((source) => source.agentInsight)?.agentInsight ?? null;
}
