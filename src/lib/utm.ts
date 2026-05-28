import type { ContentPillar } from "./types";

export function buildCampaignUrl(baseUrl: string, content: ContentPillar, draftId?: string, receiptSnapshot?: string): string {
  const path = draftId ? `receipts/${draftId}` : "";
  const url = new URL(path, normalizeBaseUrl(baseUrl));
  url.searchParams.set("utm_source", "x");
  url.searchParams.set("utm_medium", "bot");
  url.searchParams.set("utm_campaign", "world_cup_fantasy");
  url.searchParams.set("utm_content", content);
  if (receiptSnapshot) {
    url.searchParams.set("r", receiptSnapshot);
  }
  return url.toString();
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
