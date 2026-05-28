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
  coachAnalysis: string | null;
  sources: Source[];
};

type CoachAnalysisSource = Pick<Source, "agentInsight">;

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
        <h1>The proof behind the scout note.</h1>
        <p className="hero-copy">
          {receipt.text ??
            "Here is the public proof: the links TinyFish found, the clean source excerpts it pulled, and the coach analysis behind the post."}
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
          <p className="eyebrow">Proof desk</p>
          <h2>Search found the hidden intel. Fetch got the clean tackle. Agent did the coaching.</h2>
        </div>
        <ol>
          <li>TinyFish Search found {receipt.sources.length} useful source link(s) hiding in the pre-deadline noise.</li>
          <li>TinyFish Fetch got the clean tackle: readable excerpts without the tab swamp.</li>
          <li>
            {receipt.coachAnalysis
              ? `TinyFish Agent did the coaching: ${receipt.coachAnalysis}`
              : "TinyFish Agent did the coaching from the source evidence above."}
          </li>
        </ol>
      </section>

      <section className="source-list">
        <h2>Hidden intel and clean tackles</h2>
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
                <strong>Hidden intel:</strong> {source.snippet}
              </p>
            ) : null}
            {source.fetchedText ? (
              <p>
                <strong>Clean tackle:</strong> {source.fetchedText.slice(0, 520)}
              </p>
            ) : null}
            {source.agentInsight ? (
              <p>
                <strong>Coach analysis:</strong> {source.agentInsight}
              </p>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}

function receiptFromDraft(draft: DraftPost): ReceiptView {
  const text = draft.text.replace(draft.landingUrl, "").trim();
  return {
    id: draft.id,
    pillar: draft.pillar,
    text,
    coachAnalysis: extractCoachAnalysis(draft.generationNotes ?? [], draft.sources),
    sources: draft.sources
  };
}

function receiptFromSnapshot(snapshot: ReceiptSnapshot): ReceiptView {
  return {
    id: snapshot.draftId,
    pillar: snapshot.pillar,
    text: null,
    coachAnalysis: extractCoachAnalysis([], snapshot.sources) ?? snapshot.insight,
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
    }))
  };
}

function extractCoachAnalysis(notes: string[], sources: CoachAnalysisSource[]): string | null {
  const agentInsight = sources.find((source) => source.agentInsight)?.agentInsight;
  if (agentInsight) return agentInsight;

  const note = notes.find((item) => item.startsWith("TinyFish Agent: ") || item.startsWith("Source insight: "));
  if (note) {
    return note.replace(/^TinyFish Agent:\s*/, "").replace(/^Source insight:\s*/, "");
  }
  return null;
}
