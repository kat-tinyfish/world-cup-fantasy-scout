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

declare global {
  var worldCupFantasyScoutStore: MemoryStore | undefined;
}

export function createStore(): Store {
  globalThis.worldCupFantasyScoutStore ??= new MemoryStore();
  return globalThis.worldCupFantasyScoutStore;
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

function normalizeDraftText(text: string): string {
  return text.toLowerCase().replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
}
