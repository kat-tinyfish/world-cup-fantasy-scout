CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  site_name TEXT NOT NULL,
  snippet TEXT NOT NULL,
  published_date TEXT,
  fetched_text TEXT,
  discovered_at TIMESTAMPTZ NOT NULL,
  used_in_draft_ids JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS draft_posts (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  pillar TEXT NOT NULL,
  tone_score INTEGER NOT NULL,
  usefulness_score INTEGER NOT NULL,
  text TEXT NOT NULL,
  landing_url TEXT NOT NULL,
  sources JSONB NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  approved_by TEXT,
  published_post_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  source_utm TEXT NOT NULL,
  consent_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
