import { requireAdminToken } from "@/lib/env";
import { AdminConsole } from "./AdminConsole";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  try {
    requireAdminToken(params.token);
  } catch {
    return (
      <main className="admin-shell">
        <section className="admin-login">
          <h1>Scout desk locked</h1>
          <p>
            Add <code>?token=ADMIN_APPROVAL_TOKEN</code> to review drafts.
          </p>
        </section>
      </main>
    );
  }

  return <AdminConsole token={params.token ?? ""} />;
}
