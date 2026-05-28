import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/env";
import { generateDrafts } from "@/lib/generator";
import { createStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return generate(request);
}

export async function POST(request: Request) {
  return generate(request);
}

async function generate(request: Request) {
  if (!isAuthorizedCron(request) && !(await hasValidFormToken(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = createStore();
  const result = await generateDrafts({ store });

  return NextResponse.json(result);
}

async function hasValidFormToken(request: Request): Promise<boolean> {
  if (request.method !== "POST") return false;
  const clone = request.clone();
  const form = await clone.formData().catch(() => null);
  if (!form) return false;
  const token = String(form.get("token") ?? "");
  return token === process.env.ADMIN_APPROVAL_TOKEN;
}
