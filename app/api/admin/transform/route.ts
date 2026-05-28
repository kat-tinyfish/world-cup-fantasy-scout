import { NextResponse } from "next/server";
import { requireAdminToken } from "@/lib/env";
import { regenerateInsight, regenerateJoke } from "@/lib/generator";
import type { DraftPost } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    token?: string;
    draft?: DraftPost;
    action?: "regenerate-joke" | "regenerate-insight";
  };

  try {
    requireAdminToken(body.token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!body.draft) {
    return NextResponse.json({ error: "Missing draft payload." }, { status: 400 });
  }

  if (body.action === "regenerate-joke") {
    return NextResponse.json({ draft: regenerateJoke(body.draft) });
  }

  if (body.action === "regenerate-insight") {
    return NextResponse.json({ draft: regenerateInsight(body.draft) });
  }

  return NextResponse.json({ error: "Unknown transform action." }, { status: 400 });
}
