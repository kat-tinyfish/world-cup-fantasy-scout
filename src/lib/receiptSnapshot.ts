import { deflateRawSync, inflateRawSync } from "node:zlib";
import type { ContentPillar, Source } from "./types";

export type ReceiptSnapshot = {
  v: 1;
  draftId: string;
  pillar: ContentPillar;
  insight: string;
  generationNotes: string[];
  sources: ReceiptSnapshotSource[];
};

export type ReceiptSnapshotSource = Pick<Source, "url" | "title" | "siteName" | "publishedDate" | "snippet" | "fetchedText" | "agentInsight">;

export function buildReceiptSnapshot(input: {
  draftId: string;
  pillar: ContentPillar;
  insight: string;
  sources: Source[];
  generationNotes?: string[];
}): ReceiptSnapshot {
  return {
    v: 1,
    draftId: input.draftId,
    pillar: input.pillar,
    insight: excerpt(input.insight, 420),
    generationNotes: (input.generationNotes ?? []).map((note) => excerpt(note, 360)).slice(0, 8),
    sources: input.sources.slice(0, 4).map((source) => ({
      url: source.url,
      title: excerpt(source.title, 160),
      siteName: excerpt(source.siteName, 80),
      publishedDate: source.publishedDate,
      snippet: excerpt(source.snippet, 360),
      fetchedText: source.fetchedText ? excerpt(source.fetchedText, 640) : null,
      agentInsight: source.agentInsight ? excerpt(source.agentInsight, 420) : null
    }))
  };
}

export function encodeReceiptSnapshot(snapshot: ReceiptSnapshot): string {
  return deflateRawSync(Buffer.from(JSON.stringify(snapshot), "utf8")).toString("base64url");
}

export function decodeReceiptSnapshot(encoded: string | null | undefined): ReceiptSnapshot | null {
  if (!encoded) return null;

  try {
    const json = inflateRawSync(Buffer.from(encoded, "base64url")).toString("utf8");
    const parsed = JSON.parse(json) as ReceiptSnapshot;
    if (parsed.v !== 1 || !parsed.draftId || !parsed.pillar || !Array.isArray(parsed.sources)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function excerpt(value: string, maxLength: number): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  const truncated = cleaned.slice(0, maxLength - 3);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${truncated.slice(0, lastSpace > 40 ? lastSpace : truncated.length).trim()}...`;
}
