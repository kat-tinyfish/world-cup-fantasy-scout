import { createStore } from "@/lib/store";
import { requireAdminToken } from "@/lib/env";
import { PILLAR_LABELS } from "@/lib/personality";
import type { DraftPost } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string; status?: DraftPost["status"] }>;
}) {
  const params = await searchParams;
  try {
    requireAdminToken(params.token);
  } catch {
    return (
      <main className="admin-shell">
        <section className="admin-login">
          <h1>Scout desk locked</h1>
          <p>Add <code>?token=ADMIN_APPROVAL_TOKEN</code> to review drafts.</p>
        </section>
      </main>
    );
  }

  const store = createStore();
  await store.ensureReady();
  const drafts = await store.listDrafts(params.status);

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Human approval queue</p>
          <h1>World Cup Fantasy Scout drafts</h1>
        </div>
        <form action="/api/cron/generate" method="post">
          <input type="hidden" name="token" value={params.token} />
          <button className="button primary" type="submit">
            Generate drafts
          </button>
        </form>
      </header>

      <section className="draft-list">
        {drafts.map((draft) => (
          <article className="draft-card" key={draft.id}>
            <div className="draft-meta">
              <span>{draft.status}</span>
              <span>{PILLAR_LABELS[draft.pillar]}</span>
              <span>Tone {draft.toneScore}</span>
              <span>Useful {draft.usefulnessScore}</span>
            </div>
            <form action={`/api/admin/drafts/${draft.id}`} method="post">
              <input type="hidden" name="token" value={params.token} />
              <label>
                Draft text
                <textarea name="text" defaultValue={draft.text} rows={5} />
              </label>
              <div className="admin-actions">
                <button name="action" value="edit" type="submit">Save edit</button>
                <button name="action" value="regenerate-joke" type="submit">Regenerate joke</button>
                <button name="action" value="regenerate-insight" type="submit">Regenerate insight</button>
                <button name="action" value="approve" type="submit">Approve</button>
                <button name="action" value="reject" type="submit">Reject</button>
                <button name="action" value="publish-now" type="submit">Publish now</button>
              </div>
            </form>
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
