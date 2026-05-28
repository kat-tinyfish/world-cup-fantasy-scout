# World Cup Fantasy Scout

A joke-first, source-backed X/Twitter broadcast bot for the World Cup Fantasy campaign.

The bot drafts funny fantasy posts, attaches TinyFish-powered receipts, and waits for a human reviewer before anything can go live. V1 is intentionally broadcast-only: no replies, DMs, likes, follows, quote-tweet dunking, or browser automation.

## What it ships

- Public campaign landing page at `/`
- Per-draft receipts pages at `/receipts/:id` for future durable-storage mode
- Admin approval queue at `/admin?token=ADMIN_APPROVAL_TOKEN`
- On-demand draft generator at `/api/cron/generate`
- Session-based publishing from the admin console
- Lead capture at `/api/leads`
- TinyFish Search and Fetch clients
- Official X API publisher using `POST /2/tweets`
- Guardrails for humor, usefulness, evidence, X character weighting, and safety boundaries

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Required for real source generation:

```bash
TINYFISH_API_KEY=...
TINYFISH_AGENT_ENABLED=0
TINYFISH_AGENT_MAX_RUNS=2
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.2
```

Required for production publishing:

```bash
X_CLIENT_ID=...
X_CLIENT_SECRET=...
X_REFRESH_TOKEN=...
X_BOT_USER_ID=...
APP_BASE_URL=https://agent.tinyfish.ai/world-cup-fantasy
ADMIN_APPROVAL_TOKEN=...
```

No database is required for V1. Drafts are stored in the admin browser tab's `sessionStorage` and are discarded when that browser session ends. This is intentional: drafts are review artifacts, not durable campaign records.

## Operational flow

1. A human opens `/admin?token=...` and clicks **Generate drafts**.
2. `/api/cron/generate` runs TinyFish Search queries for each content pillar.
3. The app fetches up to 10 source URLs, merges source evidence, and drafts funny posts.
4. The admin console streams live progress events so reviewers can see search, fetch, TinyFish Agent, LLM, and draft outcomes as they happen.
5. Optional TinyFish Agent enrichment runs when `TINYFISH_AGENT_ENABLED=1`, using `/v1/automation/run-sse` to inspect top source pages for richer fantasy insights.
6. Optional LLM joke polish runs when `OPENAI_API_KEY` is set. If the LLM output fails guardrails, the deterministic draft is kept.
7. The admin console stores drafts in browser `sessionStorage` for review, editing, approval, and dry-run publishing.
8. When a human clicks **Publish now**, `/api/admin/publish` validates that selected draft and posts through the official X API, or returns a dry-run result when `X_DRY_RUN=1`.

## Bot voice

- Witty Scout with medium banter.
- Joke first, useful insight second, receipts link third.
- Recurring bits include captaincy crimes, differential goblin hour, rotation weather report, template hydra, bench regret support group, and TinyFish found the receipts.
- Never mock injuries, attack users, target protected classes, or mention users in v1 posts.

## Testing

```bash
npm run typecheck
npm test
npm run build
```

The tests cover UTM links, source dedupe, guardrails, draft generation, and the X publisher dry-run/official-endpoint path.

## Vercel deployment

Set these environment variables in Vercel:

```bash
TINYFISH_API_KEY
TINYFISH_AGENT_ENABLED
TINYFISH_AGENT_MAX_RUNS
OPENAI_API_KEY
OPENAI_MODEL
APP_BASE_URL
ADMIN_APPROVAL_TOKEN
X_DRY_RUN
X_CLIENT_ID
X_CLIENT_SECRET
X_REFRESH_TOKEN
X_BOT_USER_ID
```

For shared demos, keep `X_DRY_RUN=1`. Set `TINYFISH_AGENT_ENABLED=0` for faster/cheaper draft generation, or `1` when you want the richer source-reading Agent pass. Leave `OPENAI_API_KEY` empty to use deterministic jokes only, or set it to let the LLM polish the final tweet copy.

Real posting with `X_DRY_RUN=0` does not require a database, but X may rotate refresh tokens; if that happens, update `X_REFRESH_TOKEN` in Vercel with the newest token.

No Vercel cron schedule is configured for V1. Draft generation should be triggered from the admin console so ephemeral drafts stay in the reviewer's browser session instead of being generated and discarded in a background job.
