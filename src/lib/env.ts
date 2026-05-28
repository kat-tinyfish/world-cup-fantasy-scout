export type AppEnv = {
  tinyfishApiKey: string | undefined;
  tinyfishAgentEnabled: boolean;
  tinyfishAgentMaxRuns: number;
  openaiApiKey: string | undefined;
  openaiModel: string;
  appBaseUrl: string;
  adminApprovalToken: string | undefined;
  xClientId: string | undefined;
  xClientSecret: string | undefined;
  xRefreshToken: string | undefined;
  xBotUserId: string | undefined;
  xApiBaseUrl: string;
  xOAuthTokenUrl: string;
};

export function getEnv(): AppEnv {
  return {
    tinyfishApiKey: process.env.TINYFISH_API_KEY,
    tinyfishAgentEnabled: process.env.TINYFISH_AGENT_ENABLED === "1",
    tinyfishAgentMaxRuns: Number(process.env.TINYFISH_AGENT_MAX_RUNS ?? "2"),
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL ?? "gpt-5.2",
    appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
    adminApprovalToken: process.env.ADMIN_APPROVAL_TOKEN,
    xClientId: process.env.X_CLIENT_ID,
    xClientSecret: process.env.X_CLIENT_SECRET,
    xRefreshToken: process.env.X_REFRESH_TOKEN,
    xBotUserId: process.env.X_BOT_USER_ID,
    xApiBaseUrl: process.env.X_API_BASE_URL ?? "https://api.x.com",
    xOAuthTokenUrl:
      process.env.X_OAUTH_TOKEN_URL ?? "https://api.x.com/2/oauth2/token"
  };
}

export function requireAdminToken(token: string | null | undefined): void {
  const expected = getEnv().adminApprovalToken;
  if (!expected || token !== expected) {
    throw new Error("Unauthorized");
  }
}

export function isAuthorizedCron(request: Request): boolean {
  const expected = getEnv().adminApprovalToken;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  const queryToken = new URL(request.url).searchParams.get("token");
  const vercelCron = request.headers.get("x-vercel-cron") === "1";

  return Boolean(vercelCron || (expected && (token === expected || queryToken === expected)));
}
