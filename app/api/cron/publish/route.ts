import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/env";
import { createStore } from "@/lib/store";
import { publishApprovedDueDrafts } from "@/lib/xPublisher";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = createStore();
  const result = await publishApprovedDueDrafts(store);
  return NextResponse.json({ published: result });
}

export async function POST(request: Request) {
  return GET(request);
}
