import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    published: [],
    message:
      "No persistent draft queue is configured. Publish approved drafts from the admin console, which sends the selected draft payload directly."
  });
}

export async function POST(request: Request) {
  return GET(request);
}
