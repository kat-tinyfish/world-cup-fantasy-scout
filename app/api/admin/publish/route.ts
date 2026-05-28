import { NextResponse } from "next/server";
import { requireAdminToken } from "@/lib/env";
import { createStore } from "@/lib/store";
import type { DraftPost } from "@/lib/types";
import { publishDraft } from "@/lib/xPublisher";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as { token?: string; draft?: DraftPost };

  try {
    requireAdminToken(body.token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!body.draft) {
    return NextResponse.json({ error: "Missing draft payload." }, { status: 400 });
  }

  const store = createStore();
  await store.ensureReady();
  try {
    const published = await publishDraft({
      store,
      draft: {
        ...body.draft,
        status: "approved",
        approvedBy: body.draft.approvedBy ?? "admin"
      }
    });

    return NextResponse.json({ published });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Publish failed." },
      { status: 400 }
    );
  }
}
