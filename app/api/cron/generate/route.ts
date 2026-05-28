import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/env";
import {
  generateDrafts,
  normalizePillars,
  normalizeTargetCount,
  type GenerationProgressEvent
} from "@/lib/generator";
import { createStore } from "@/lib/store";
import type { ContentPillar } from "@/lib/types";

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

  const generationRequest = parseGenerationRequest(request);

  if (generationRequest.stream) {
    return streamGenerate(generationRequest);
  }

  const store = createStore();
  const result = await generateDrafts({
    store,
    pillars: generationRequest.pillars,
    targetCount: generationRequest.count
  });

  return NextResponse.json(result);
}

function streamGenerate(generationRequest: ParsedGenerationRequest): Response {
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
          pillars: generationRequest.pillars,
          targetCount: generationRequest.count,
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

type ParsedGenerationRequest = {
  stream: boolean;
  count: number;
  pillars: ContentPillar[];
};

function parseGenerationRequest(request: Request): ParsedGenerationRequest {
  const params = new URL(request.url).searchParams;
  const rawPillars = params.get("pillars")?.split(",").filter(Boolean) as ContentPillar[] | undefined;
  const rawCount = Number(params.get("count") ?? rawPillars?.length ?? 1);

  return {
    stream: params.get("stream") === "1",
    count: normalizeTargetCount(rawCount),
    pillars: normalizePillars(rawPillars)
  };
}

async function hasValidFormToken(request: Request): Promise<boolean> {
  if (request.method !== "POST") return false;
  const clone = request.clone();
  const form = await clone.formData().catch(() => null);
  if (!form) return false;
  const token = String(form.get("token") ?? "");
  return token === process.env.ADMIN_APPROVAL_TOKEN;
}
