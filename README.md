# World Cup Fantasy Scout

A joke-first, source-backed X/Twitter broadcast bot for the World Cup Fantasy campaign.

The bot drafts funny fantasy posts, attaches TinyFish-powered receipts, and waits for a human reviewer before anything can go live. V1 is intentionally broadcast-only: no replies, DMs, likes, follows, quote-tweet dunking, or browser automation.

## What it ships

- Public campaign landing page at `/`
- Per-draft proof pages at `/receipts/:id` with embedded public evidence, so no database is required
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
TINYFISH_AGENT_ENABLED=1
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

No database is required for V1. Drafts are stored in the admin browser tab's `sessionStorage` and are discarded when that browser session ends. Tweet proof links carry compact public evidence in the URL, so the public page can still show TinyFish Search links, TinyFish Fetch excerpts, and TinyFish Agent coach analysis without durable storage.

## Operational flow

1. A human opens `/admin?token=...`, chooses the number of drafts and content pillars, then clicks **Generate drafts**.
2. `/api/cron/generate` runs TinyFish Search queries for the selected pillars. If the requested count is higher than the number of selected pillars, the generator cycles through them.
3. TinyFish Fetch gets clean text for up to 10 source URLs and the app dedupes that into usable source evidence.
4. The admin console streams live progress events so reviewers can see search, fetch, TinyFish Agent, LLM, and draft outcomes as they happen.
5. TinyFish Agent runs when `TINYFISH_AGENT_ENABLED=1`, using `/v1/automation/run-sse` to inspect the top source page and produce the fantasy insight.
6. The app builds a proof URL under `/receipts/:draftId` with UTM params plus compact public evidence.
7. The LLM writes the final funny X post from that insight when `OPENAI_API_KEY` is set. If the LLM is unavailable or fails guardrails, the app uses a short deterministic fallback.
8. The admin console stores drafts in browser `sessionStorage` for review, editing, approval, and dry-run publishing.
9. When a human clicks **Publish now**, `/api/admin/publish` validates that selected draft and posts through the official X API, or returns a dry-run result when `X_DRY_RUN=1`.

## Bot voice

- Fantasy insider to fantasy insider: smart, wry, specific, and useful without sounding like a brand account.
- Joke first, concrete fantasy insight second, proof link third. The URL is the receipt, so posts do not explain it.
- Recurring bits can hit captain blanks, template panic, rotation risk, ownership traps, deadline scrambling, mini-league receipts, and bench regret.
- Never mock injuries, attack users, target protected classes, or mention users in v1 posts.

## Tweet links

Every generated tweet should link to the app proof page, not only the generic landing page:

```text
APP_BASE_URL/receipts/<draftId>?utm_source=x&utm_medium=bot&utm_campaign=world_cup_fantasy&utm_content=<pillar>&r=<public-proof>
```

That page is customer-facing proof, not an internal trace. It shows: TinyFish Search found the hidden intel, TinyFish Fetch got the clean tackle, and TinyFish Agent did the coaching. The page includes source links, Search snippets, Fetch excerpts, and coach analysis when available. It does not show generation notes or internal process logs.

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

For shared demos, keep `X_DRY_RUN=1`. Set `TINYFISH_AGENT_ENABLED=1` for the intended Search -> Fetch -> Agent insight -> LLM tweet pipeline, or `0` when you need a faster deterministic fallback. Leave `OPENAI_API_KEY` empty to use deterministic copy only, or set it to let the LLM write the final tweet.

Real posting with `X_DRY_RUN=0` does not require a database, but X may rotate refresh tokens; if that happens, update `X_REFRESH_TOKEN` in Vercel with the newest token.

No Vercel cron schedule is configured for V1. Draft generation should be triggered from the admin console so ephemeral drafts stay in the reviewer's browser session instead of being generated and discarded in a background job.
