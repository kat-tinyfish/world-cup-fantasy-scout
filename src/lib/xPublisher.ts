import { getEnv } from "./env";
import { validateDraftText } from "./guardrails";
import type { Store } from "./store";
import type { DraftPost } from "./types";

export type PublishResult = {
  id: string;
  text: string;
  dryRun: boolean;
};

export type PublishOptions = {
  store: Store;
  draft: DraftPost;
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
};

export async function publishDraft(options: PublishOptions): Promise<PublishResult> {
  const { store, draft, dryRun = false, fetchImpl = fetch } = options;
  if (draft.status !== "approved") {
    throw new Error("Only approved drafts can be published.");
  }

  const validation = validateDraftText(draft.text, draft.sources, draft.landingUrl);
  if (!validation.ok) {
    throw new Error(`Draft failed guardrails: ${validation.errors.join(" ")}`);
  }

  if (dryRun || process.env.X_DRY_RUN === "1") {
    return { id: `dry_${draft.id}`, text: draft.text, dryRun: true };
  }

  const accessToken = await refreshXAccessToken(store, fetchImpl);
  const response = await fetchImpl(`${getEnv().xApiBaseUrl}/2/tweets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text: draft.text })
  });

  if (!response.ok) {
    throw new Error(`X publish failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { data?: { id?: string; text?: string } };
  const id = data.data?.id;
  if (!id) {
    throw new Error("X publish response did not include a post id.");
  }

  await store.updateDraft(draft.id, {
    status: "published",
    publishedPostId: id
  });

  return { id, text: data.data?.text ?? draft.text, dryRun: false };
}

export async function publishApprovedDueDrafts(store: Store, now = new Date()): Promise<PublishResult[]> {
  await store.ensureReady();
  const drafts = await store.listDrafts("approved");
  const due = drafts.filter((draft) => new Date(draft.scheduledFor) <= now && !draft.publishedPostId);
  const results: PublishResult[] = [];

  for (const draft of due) {
    results.push(await publishDraft({ store, draft }));
  }

  return results;
}

async function refreshXAccessToken(store: Store, fetchImpl: typeof fetch): Promise<string> {
  const env = getEnv();
  if (!env.xClientId || !env.xClientSecret) {
    throw new Error("X_CLIENT_ID and X_CLIENT_SECRET are required to publish.");
  }

  const storedRefreshToken = await store.getState<string>("x_refresh_token");
  const refreshToken = storedRefreshToken ?? env.xRefreshToken;
  if (!refreshToken) {
    throw new Error("X_REFRESH_TOKEN is required to publish.");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });

  const response = await fetchImpl(env.xOAuthTokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.xClientId}:${env.xClientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw new Error(`X token refresh failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token?: string; refresh_token?: string };
  if (!data.access_token) {
    throw new Error("X token refresh response did not include an access token.");
  }

  if (data.refresh_token) {
    await store.setState("x_refresh_token", data.refresh_token);
  }

  return data.access_token;
}
