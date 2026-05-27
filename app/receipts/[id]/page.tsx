import { notFound } from "next/navigation";
import { createStore } from "@/lib/store";
import { PILLAR_LABELS } from "@/lib/personality";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = createStore();
  await store.ensureReady();
  const draft = await store.getDraft(id);
  if (!draft) notFound();

  return (
    <main>
      <section className="hero compact">
        <div className="eyebrow">{PILLAR_LABELS[draft.pillar]}</div>
        <h1>TinyFish found the receipts.</h1>
        <p className="hero-copy">{draft.text.replace(draft.landingUrl, "").trim()}</p>
        <div className="hero-actions">
          <a className="button primary" href="/#signup">
            Get daily scout drops
          </a>
          <a className="button secondary" href="https://docs.tinyfish.ai/fetch-api">
            How Fetch works
          </a>
        </div>
      </section>

      <section className="source-list">
        <h2>Sources behind this scout note</h2>
        {draft.sources.map((source) => (
          <article className="source-card" key={source.id}>
            <div>
              <span>{source.siteName}</span>
              {source.publishedDate ? <span>{source.publishedDate}</span> : null}
            </div>
            <h3>
              <a href={source.url}>{source.title}</a>
            </h3>
            <p>{source.snippet || source.fetchedText?.slice(0, 260)}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
