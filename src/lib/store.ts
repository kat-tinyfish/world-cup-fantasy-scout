import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { getEnv } from "./env";
import type { DraftPatch, DraftPost, DraftStatus, Lead, Source } from "./types";

export type AppStateValue = string | number | boolean | null | Record<string, unknown>;

export interface Store {
  ensureReady(): Promise<void>;
  upsertSources(sources: Source[]): Promise<Source[]>;
  createDraft(draft: DraftPost): Promise<DraftPost>;
  getDraft(id: string): Promise<DraftPost | null>;
  listDrafts(status?: DraftStatus): Promise<DraftPost[]>;
  updateDraft(id: string, patch: DraftPatch): Promise<DraftPost | null>;
  findSimilarDraft(text: string): Promise<DraftPost | null>;
  createLead(lead: Lead): Promise<Lead>;
  getState<T extends AppStateValue>(key: string): Promise<T | null>;
  setState<T extends AppStateValue>(key: string, value: T): Promise<void>;
}

export function createStore(): Store {
  const env = getEnv();
  if (env.databaseUrl) {
    return new PostgresStore(env.databaseUrl);
  }
  return new JsonFileStore(path.join(process.cwd(), ".data", "scout.json"));
}

export class MemoryStore implements Store {
  private sources = new Map<string, Source>();
  private drafts = new Map<string, DraftPost>();
  private leads = new Map<string, Lead>();
  private state = new Map<string, AppStateValue>();

  async ensureReady(): Promise<void> {}

  async upsertSources(sources: Source[]): Promise<Source[]> {
    for (const source of sources) {
      const existing = [...this.sources.values()].find((item) => item.url === source.url);
      this.sources.set(existing?.id ?? source.id, { ...existing, ...source });
    }
    return sources;
  }

  async createDraft(draft: DraftPost): Promise<DraftPost> {
    this.drafts.set(draft.id, draft);
    return draft;
  }

  async getDraft(id: string): Promise<DraftPost | null> {
    return this.drafts.get(id) ?? null;
  }

  async listDrafts(status?: DraftStatus): Promise<DraftPost[]> {
    return [...this.drafts.values()]
      .filter((draft) => !status || draft.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateDraft(id: string, patch: DraftPatch): Promise<DraftPost | null> {
    const existing = this.drafts.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    this.drafts.set(id, updated);
    return updated;
  }

  async findSimilarDraft(text: string): Promise<DraftPost | null> {
    const normalized = normalizeDraftText(text);
    return [...this.drafts.values()].find((draft) => normalizeDraftText(draft.text) === normalized) ?? null;
  }

  async createLead(lead: Lead): Promise<Lead> {
    this.leads.set(lead.id, lead);
    return lead;
  }

  async getState<T extends AppStateValue>(key: string): Promise<T | null> {
    return (this.state.get(key) as T | undefined) ?? null;
  }

  async setState<T extends AppStateValue>(key: string, value: T): Promise<void> {
    this.state.set(key, value);
  }
}

class JsonFileStore extends MemoryStore {
  constructor(private readonly filePath: string) {
    super();
  }

  override async ensureReady(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await readFile(this.filePath, "utf8");
      const data = JSON.parse(raw) as PersistedData;
      for (const source of data.sources ?? []) {
        await super.upsertSources([source]);
      }
      for (const draft of data.drafts ?? []) {
        await super.createDraft(draft);
      }
      for (const lead of data.leads ?? []) {
        await super.createLead(lead);
      }
      for (const [key, value] of Object.entries(data.state ?? {})) {
        await super.setState(key, value);
      }
    } catch {
      await this.persist();
    }
  }

  override async upsertSources(sources: Source[]): Promise<Source[]> {
    const result = await super.upsertSources(sources);
    await this.persist();
    return result;
  }

  override async createDraft(draft: DraftPost): Promise<DraftPost> {
    const result = await super.createDraft(draft);
    await this.persist();
    return result;
  }

  override async updateDraft(id: string, patch: DraftPatch): Promise<DraftPost | null> {
    const result = await super.updateDraft(id, patch);
    await this.persist();
    return result;
  }

  override async createLead(lead: Lead): Promise<Lead> {
    const result = await super.createLead(lead);
    await this.persist();
    return result;
  }

  override async setState<T extends AppStateValue>(key: string, value: T): Promise<void> {
    await super.setState(key, value);
    await this.persist();
  }

  private async persist(): Promise<void> {
    const data: PersistedData = {
      sources: await super.upsertSources([]),
      drafts: await super.listDrafts(),
      leads: [],
      state: {}
    };
    const anyStore = this as unknown as {
      sources: Map<string, Source>;
      leads: Map<string, Lead>;
      state: Map<string, AppStateValue>;
    };
    data.sources = [...anyStore.sources.values()];
    data.leads = [...anyStore.leads.values()];
    data.state = Object.fromEntries(anyStore.state.entries());
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }
}

class PostgresStore implements Store {
  private readonly sql;
  private ready: Promise<void> | null = null;

  constructor(databaseUrl: string) {
    this.sql = postgres(databaseUrl, { max: 3, idle_timeout: 20 });
  }

  async ensureReady(): Promise<void> {
    this.ready ??= this.sql.unsafe(`
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
    `).then(() => undefined);
    await this.ready;
  }

  async upsertSources(sources: Source[]): Promise<Source[]> {
    await this.ensureReady();
    const saved: Source[] = [];
    for (const source of sources) {
      const rows = await this.sql`
        INSERT INTO sources (
          id,
          url,
          title,
          site_name,
          snippet,
          published_date,
          fetched_text,
          discovered_at,
          used_in_draft_ids
        )
        VALUES (
          ${source.id},
          ${source.url},
          ${source.title},
          ${source.siteName},
          ${source.snippet},
          ${source.publishedDate},
          ${source.fetchedText},
          ${source.discoveredAt},
          ${this.sql.json(source.usedInDraftIds)}
        )
        ON CONFLICT (url) DO UPDATE SET
          title = EXCLUDED.title,
          site_name = EXCLUDED.site_name,
          snippet = EXCLUDED.snippet,
          published_date = EXCLUDED.published_date,
          fetched_text = EXCLUDED.fetched_text,
          discovered_at = EXCLUDED.discovered_at
        RETURNING *
      `;
      saved.push(rowToSource(rows[0]));
    }
    return saved;
  }

  async createDraft(draft: DraftPost): Promise<DraftPost> {
    await this.ensureReady();
    const rows = await this.sql`
      INSERT INTO draft_posts (
        id,
        status,
        pillar,
        tone_score,
        usefulness_score,
        text,
        landing_url,
        sources,
        scheduled_for,
        approved_by,
        published_post_id,
        created_at,
        updated_at
      )
      VALUES (
        ${draft.id},
        ${draft.status},
        ${draft.pillar},
        ${draft.toneScore},
        ${draft.usefulnessScore},
        ${draft.text},
        ${draft.landingUrl},
        ${this.sql.json(draft.sources)},
        ${draft.scheduledFor},
        ${draft.approvedBy},
        ${draft.publishedPostId},
        ${draft.createdAt},
        ${draft.updatedAt}
      )
      RETURNING *
    `;
    return rowToDraft(rows[0]);
  }

  async getDraft(id: string): Promise<DraftPost | null> {
    await this.ensureReady();
    const rows = await this.sql`SELECT * FROM draft_posts WHERE id = ${id} LIMIT 1`;
    return rows[0] ? rowToDraft(rows[0]) : null;
  }

  async listDrafts(status?: DraftStatus): Promise<DraftPost[]> {
    await this.ensureReady();
    const rows = status
      ? await this.sql`SELECT * FROM draft_posts WHERE status = ${status} ORDER BY created_at DESC`
      : await this.sql`SELECT * FROM draft_posts ORDER BY created_at DESC`;
    return rows.map(rowToDraft);
  }

  async updateDraft(id: string, patch: DraftPatch): Promise<DraftPost | null> {
    await this.ensureReady();
    const existing = await this.getDraft(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    const rows = await this.sql`
      UPDATE draft_posts SET
        status = ${updated.status},
        pillar = ${updated.pillar},
        tone_score = ${updated.toneScore},
        usefulness_score = ${updated.usefulnessScore},
        text = ${updated.text},
        landing_url = ${updated.landingUrl},
        sources = ${this.sql.json(updated.sources)},
        scheduled_for = ${updated.scheduledFor},
        approved_by = ${updated.approvedBy},
        published_post_id = ${updated.publishedPostId},
        updated_at = ${updated.updatedAt}
      WHERE id = ${id}
      RETURNING *
    `;
    return rowToDraft(rows[0]);
  }

  async findSimilarDraft(text: string): Promise<DraftPost | null> {
    const drafts = await this.listDrafts();
    const normalized = normalizeDraftText(text);
    return drafts.find((draft) => normalizeDraftText(draft.text) === normalized) ?? null;
  }

  async createLead(lead: Lead): Promise<Lead> {
    await this.ensureReady();
    const rows = await this.sql`
      INSERT INTO leads ${this.sql({
        id: lead.id,
        email: lead.email,
        role: lead.role,
        source_utm: lead.sourceUtm,
        consent_at: lead.consentAt,
        created_at: lead.createdAt
      })}
      RETURNING *
    `;
    return {
      id: rows[0].id,
      email: rows[0].email,
      role: rows[0].role,
      sourceUtm: rows[0].source_utm,
      consentAt: toIso(rows[0].consent_at),
      createdAt: toIso(rows[0].created_at)
    };
  }

  async getState<T extends AppStateValue>(key: string): Promise<T | null> {
    await this.ensureReady();
    const rows = await this.sql`SELECT value FROM app_state WHERE key = ${key} LIMIT 1`;
    return (rows[0]?.value as T | undefined) ?? null;
  }

  async setState<T extends AppStateValue>(key: string, value: T): Promise<void> {
    await this.ensureReady();
    await this.sql`
      INSERT INTO app_state (key, value, updated_at)
      VALUES (${key}, ${this.sql.json(value as never)}, ${new Date().toISOString()})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
    `;
  }
}

type PersistedData = {
  sources: Source[];
  drafts: DraftPost[];
  leads: Lead[];
  state: Record<string, AppStateValue>;
};

function rowToSource(row: Record<string, unknown>): Source {
  return {
    id: String(row.id),
    url: String(row.url),
    title: String(row.title),
    siteName: String(row.site_name),
    snippet: String(row.snippet),
    publishedDate: nullableString(row.published_date),
    fetchedText: nullableString(row.fetched_text),
    discoveredAt: toIso(row.discovered_at),
    usedInDraftIds: Array.isArray(row.used_in_draft_ids) ? row.used_in_draft_ids.map(String) : []
  };
}

function rowToDraft(row: Record<string, unknown>): DraftPost {
  return {
    id: String(row.id),
    status: row.status as DraftPost["status"],
    pillar: row.pillar as DraftPost["pillar"],
    toneScore: Number(row.tone_score),
    usefulnessScore: Number(row.usefulness_score),
    text: String(row.text),
    landingUrl: String(row.landing_url),
    sources: Array.isArray(row.sources) ? (row.sources as Source[]) : [],
    scheduledFor: toIso(row.scheduled_for),
    approvedBy: nullableString(row.approved_by),
    publishedPostId: nullableString(row.published_post_id),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function normalizeDraftText(text: string): string {
  return text.toLowerCase().replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
}
