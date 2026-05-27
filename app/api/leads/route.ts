import { NextResponse } from "next/server";
import { makeId } from "@/lib/ids";
import { createStore } from "@/lib/store";
import type { LeadRole } from "@/lib/types";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const role = String(form.get("role") ?? "player") as LeadRole;
  const sourceUtm = String(form.get("sourceUtm") ?? "unknown");

  if (!email || !["player", "creator", "developer"].includes(role)) {
    return NextResponse.json({ error: "Invalid lead submission." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const store = createStore();
  await store.ensureReady();
  await store.createLead({
    id: makeId("lead"),
    email,
    role,
    sourceUtm,
    consentAt: now,
    createdAt: now
  });

  return NextResponse.redirect(new URL("/?joined=1#signup", request.url), { status: 303 });
}
