import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/env";
import { generateDrafts, type GenerationProgressEvent } from "@/lib/generator";
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

  if (new URL(request.url).searchParams.get("stream") === "1") {
    return streamGenerate();
  }

  const store = createStore();
  const result = await generateDrafts({ store });

  return NextResponse.json(result);
}

function streamGenerate(): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: GenerationProgressEvent | { type: "error"; message: string } | { type: "result"; data: unknown }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const store = createStore();
        const result = await generateDrafts({
          store,
          onProgress: send
        });
        send({ type: "result", data: result });
      } catch (error) {
        send({ type: "error", message: error instanceof Error ? error.message : "Draft generation failed." });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}

async function hasValidFormToken(request: Request): Promise<boolean> {
  if (request.method !== "POST") return false;
  const clone = request.clone();
  const form = await clone.formData().catch(() => null);
  if (!form) return false;
  const token = String(form.get("token") ?? "");
  return token === process.env.ADMIN_APPROVAL_TOKEN;
}
