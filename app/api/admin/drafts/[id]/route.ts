import { NextResponse } from "next/server";
import { requireAdminToken } from "@/lib/env";
import { regenerateInsight, regenerateJoke } from "@/lib/generator";
import { validateDraftText } from "@/lib/guardrails";
import { createStore } from "@/lib/store";
import { publishDraft } from "@/lib/xPublisher";
import type { DraftPatch } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const form = await request.formData();
  const token = String(form.get("token") ?? "");

  try {
    requireAdminToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const action = String(form.get("action") ?? "");
  const store = createStore();
  await store.ensureReady();
  const draft = await store.getDraft(id);
  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  let patch: DraftPatch | null = null;

  if (action === "edit") {
    const text = String(form.get("text") ?? "");
    const validation = validateDraftText(text, draft.sources, draft.landingUrl);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.errors }, { status: 400 });
    }
    patch = { text, toneScore: validation.toneScore, usefulnessScore: validation.usefulnessScore };
  }

  if (action === "regenerate-joke") {
    const updated = regenerateJoke(draft);
    patch = {
      text: updated.text,
      toneScore: updated.toneScore,
      usefulnessScore: updated.usefulnessScore
    };
  }

  if (action === "regenerate-insight") {
    const updated = regenerateInsight(draft);
    patch = {
      text: updated.text,
      sources: updated.sources,
      toneScore: updated.toneScore,
      usefulnessScore: updated.usefulnessScore
    };
  }

  if (action === "approve") {
    const text = String(form.get("text") ?? draft.text);
    const validation = validateDraftText(text, draft.sources, draft.landingUrl);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.errors }, { status: 400 });
    }
    patch = {
      status: "approved",
      text,
      approvedBy: "admin",
      toneScore: validation.toneScore,
      usefulnessScore: validation.usefulnessScore
    };
  }

  if (action === "reject") {
    patch = { status: "rejected" };
  }

  if (action === "publish-now") {
    const text = String(form.get("text") ?? draft.text);
    const updated = await store.updateDraft(id, {
      status: "approved",
      text,
      approvedBy: "admin"
    });
    if (!updated) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }
    await publishDraft({ store, draft: updated });
    return NextResponse.redirect(new URL(`/admin?token=${encodeURIComponent(token)}`, request.url), { status: 303 });
  }

  if (!patch) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  await store.updateDraft(id, patch);
  return NextResponse.redirect(new URL(`/admin?token=${encodeURIComponent(token)}`, request.url), { status: 303 });
}
