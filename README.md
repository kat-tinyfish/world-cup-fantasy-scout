# World Cup Fantasy Scout

A joke-first, source-backed X/Twitter broadcast bot for the World Cup Fantasy campaign.

The bot drafts funny fantasy posts, attaches TinyFish-powered receipts, and waits for a human reviewer before anything can go live. V1 is intentionally broadcast-only: no replies, DMs, likes, follows, quote-tweet dunking, or browser automation.

## What it ships

- Public campaign landing page at `/`
- Per-draft receipts pages at `/receipts/:id`
- Admin approval queue at `/admin?token=ADMIN_APPROVAL_TOKEN`
- Cron draft generator at `/api/cron/generate`
- Cron publisher at `/api/cron/publish`
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
```

Required for production publishing:

```bash
X_CLIENT_ID=...
X_CLIENT_SECRET=...
X_REFRESH_TOKEN=...
X_BOT_USER_ID=...
APP_BASE_URL=https://agent.tinyfish.ai/world-cup-fantasy
ADMIN_APPROVAL_TOKEN=...
DATABASE_URL=...
```

If `DATABASE_URL` is missing, the app uses `.data/scout.json` for local development only.

## Operational flow

1. `/api/cron/generate` runs TinyFish Search queries for each content pillar.
2. The app fetches up to 10 source URLs, merges source evidence, and drafts funny posts.
3. Guardrails reject bland, uncited, unsafe, too-long, or user-mentioning drafts.
4. A human reviews drafts at `/admin?token=...`, edits if needed, and approves.
5. `/api/cron/publish` posts only approved due drafts through the official X API.

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
