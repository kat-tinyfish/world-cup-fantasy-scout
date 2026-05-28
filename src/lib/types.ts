export type DraftStatus = "draft" | "approved" | "rejected" | "published";

export type LeadRole = "player" | "creator" | "developer";

export type ContentPillar =
  | "daily_scout"
  | "differential_radar"
  | "captaincy_chaos"
  | "lineup_news_watch"
  | "template_panic_meter"
  | "mini_league_banter"
  | "built_with_tinyfish";

export type Source = {
  id: string;
  url: string;
  title: string;
  siteName: string;
  snippet: string;
  publishedDate: string | null;
  fetchedText: string | null;
  agentInsight?: string | null;
  discoveredAt: string;
  usedInDraftIds: string[];
};

export type DraftPost = {
  id: string;
  status: DraftStatus;
  pillar: ContentPillar;
  toneScore: number;
  usefulnessScore: number;
  text: string;
  landingUrl: string;
  sources: Source[];
  scheduledFor: string;
  approvedBy: string | null;
  publishedPostId: string | null;
  generationNotes?: string[];
  createdAt: string;
  updatedAt: string;
};

export type Lead = {
  id: string;
  email: string;
  role: LeadRole;
  sourceUtm: string;
  consentAt: string;
  createdAt: string;
};

export type DraftPatch = Partial<
  Pick<
    DraftPost,
    | "status"
    | "toneScore"
    | "usefulnessScore"
    | "text"
    | "landingUrl"
    | "sources"
    | "scheduledFor"
    | "approvedBy"
    | "publishedPostId"
  >
>;
