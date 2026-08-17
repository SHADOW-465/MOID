// GM operational inbox. Memory for tests (`MOID_STORE=memory`); Supabase
// `plant_notifications` otherwise so an operator save on one request is
// still there when the GM opens the bell on the next.

import { shouldUseSupabase } from "@/lib/store";
import { createServerClient } from "@/lib/supabase";
import type {
  PlantNotification,
  NotificationStatus,
  NotificationType,
  NotificationActionKind,
  NotificationHistoryEntry,
} from "./types";

export type CreateInput = {
  type: NotificationType;
  title: string;
  body: string;
  createdBy: string;
  targetPersona?: PlantNotification["targetPersona"];
  payload: PlantNotification["payload"];
};

export type PatchInput = {
  action: NotificationActionKind;
  actor?: string;
  note?: string;
};

export interface NotificationStore {
  list(filter?: {
    status?: NotificationStatus | "all" | "closed";
    type?: NotificationType;
  }): Promise<PlantNotification[]>;
  openCount(): Promise<number>;
  create(input: CreateInput): Promise<PlantNotification>;
  patch(id: string, input: PatchInput | NotificationActionKind): Promise<PlantNotification | null>;
  clear(): Promise<void>;
}

function normalize(n: PlantNotification): PlantNotification {
  const history = Array.isArray(n.history) ? n.history : [];
  return { ...n, history };
}

function applyFilter(
  list: PlantNotification[],
  filter?: { status?: NotificationStatus | "all" | "closed"; type?: NotificationType },
): PlantNotification[] {
  let out = list.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filter?.status && filter.status !== "all") {
    if (filter.status === "closed") out = out.filter((n) => n.status !== "open");
    else out = out.filter((n) => n.status === filter.status);
  }
  if (filter?.type) out = out.filter((n) => n.type === filter.type);
  return out;
}

function applyPatch(prev: PlantNotification, input: PatchInput): PlantNotification {
  const now = new Date().toISOString();
  const actor = (input.actor ?? "gm").trim() || "gm";
  const note = input.note?.trim() || undefined;
  const status: NotificationStatus =
    input.action === "ack" ? "acked" : input.action === "approve" ? "approved" : "denied";
  const entry: NotificationHistoryEntry = {
    action: input.action,
    at: now,
    by: actor,
    ...(note ? { note } : {}),
  };
  return {
    ...prev,
    status,
    updatedAt: now,
    history: [...(prev.history ?? []), entry],
    resolvedBy: actor,
    resolvedAt: now,
    resolutionNote: note,
  };
}

class MemoryNotificationStore implements NotificationStore {
  private rows: PlantNotification[] = [];

  async list(filter?: {
    status?: NotificationStatus | "all" | "closed";
    type?: NotificationType;
  }) {
    return applyFilter(this.rows.map(normalize), filter);
  }
  async openCount() {
    return this.rows.filter((n) => n.status === "open").length;
  }
  async create(input: CreateInput) {
    const now = new Date().toISOString();
    const n: PlantNotification = {
      id: globalThis.crypto?.randomUUID?.() ?? `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: input.type,
      status: "open",
      title: input.title,
      body: input.body,
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy,
      targetPersona: input.targetPersona ?? "gm",
      payload: input.payload,
      history: [],
    };
    this.rows = [n, ...this.rows];
    return n;
  }
  async patch(id: string, input: PatchInput | NotificationActionKind) {
    const patch: PatchInput = typeof input === "string" ? { action: input } : input;
    const idx = this.rows.findIndex((n) => n.id === id);
    if (idx < 0) return null;
    const next = applyPatch(this.rows[idx], patch);
    const copy = this.rows.slice();
    copy[idx] = next;
    this.rows = copy;
    return next;
  }
  async clear() {
    this.rows = [];
  }
}

type NotificationDbRow = {
  id: string;
  type: NotificationType;
  status: NotificationStatus;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  target_persona: PlantNotification["targetPersona"];
  payload: PlantNotification["payload"];
  history: NotificationHistoryEntry[];
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
};

function fromDb(r: NotificationDbRow): PlantNotification {
  return normalize({
    id: r.id,
    type: r.type,
    status: r.status,
    title: r.title,
    body: r.body,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    createdBy: r.created_by,
    targetPersona: r.target_persona ?? "gm",
    payload: r.payload ?? {},
    history: Array.isArray(r.history) ? r.history : [],
    resolvedBy: r.resolved_by ?? undefined,
    resolvedAt: r.resolved_at ?? undefined,
    resolutionNote: r.resolution_note ?? undefined,
  });
}

function toDb(n: PlantNotification): NotificationDbRow {
  return {
    id: n.id,
    type: n.type,
    status: n.status,
    title: n.title,
    body: n.body,
    created_at: n.createdAt,
    updated_at: n.updatedAt,
    created_by: n.createdBy,
    target_persona: n.targetPersona,
    payload: n.payload,
    history: n.history ?? [],
    resolved_by: n.resolvedBy ?? null,
    resolved_at: n.resolvedAt ?? null,
    resolution_note: n.resolutionNote ?? null,
  };
}

function tableMissing(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = err.message ?? "";
  return (
    err.code === "42P01" ||
    err.code === "PGRST205" ||
    (/plant_notifications/i.test(msg) && /does not exist|not find|schema cache/i.test(msg))
  );
}

class SupabaseNotificationStore implements NotificationStore {
  private fallback = new MemoryNotificationStore();
  private missingTable = false;

  private db() {
    return createServerClient();
  }

  private async useFallback() {
    this.missingTable = true;
  }

  async list(filter?: {
    status?: NotificationStatus | "all" | "closed";
    type?: NotificationType;
  }) {
    if (this.missingTable) return this.fallback.list(filter);
    const { data, error } = await this.db()
      .from("plant_notifications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      if (tableMissing(error)) {
        await this.useFallback();
        return this.fallback.list(filter);
      }
      throw error;
    }
    return applyFilter((data ?? []).map((r) => fromDb(r as NotificationDbRow)), filter);
  }

  async openCount() {
    if (this.missingTable) return this.fallback.openCount();
    const { count, error } = await this.db()
      .from("plant_notifications")
      .select("id", { count: "exact", head: true })
      .eq("status", "open");
    if (error) {
      if (tableMissing(error)) {
        await this.useFallback();
        return this.fallback.openCount();
      }
      throw error;
    }
    return count ?? 0;
  }

  async create(input: CreateInput) {
    const now = new Date().toISOString();
    const n: PlantNotification = {
      id: globalThis.crypto?.randomUUID?.() ?? `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: input.type,
      status: "open",
      title: input.title,
      body: input.body,
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy,
      targetPersona: input.targetPersona ?? "gm",
      payload: input.payload,
      history: [],
    };
    if (this.missingTable) return this.fallback.create(input);
    const { data, error } = await this.db()
      .from("plant_notifications")
      .insert(toDb(n))
      .select("*")
      .single();
    if (error) {
      if (tableMissing(error)) {
        await this.useFallback();
        return this.fallback.create(input);
      }
      throw error;
    }
    return fromDb(data as NotificationDbRow);
  }

  async patch(id: string, input: PatchInput | NotificationActionKind) {
    const patch: PatchInput = typeof input === "string" ? { action: input } : input;
    if (this.missingTable) return this.fallback.patch(id, patch);
    const { data: existing, error: readErr } = await this.db()
      .from("plant_notifications")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (readErr) {
      if (tableMissing(readErr)) {
        await this.useFallback();
        return this.fallback.patch(id, patch);
      }
      throw readErr;
    }
    if (!existing) return null;
    const next = applyPatch(fromDb(existing as NotificationDbRow), patch);
    const { data, error } = await this.db()
      .from("plant_notifications")
      .update(toDb(next))
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return fromDb(data as NotificationDbRow);
  }

  async clear() {
    if (this.missingTable) return this.fallback.clear();
    const { error } = await this.db().from("plant_notifications").delete().neq("id", "");
    if (error && tableMissing(error)) {
      await this.useFallback();
      return this.fallback.clear();
    }
    if (error) throw error;
  }
}

const g = globalThis as unknown as { __moidNotificationStore?: NotificationStore };

export function getNotificationStore(): NotificationStore {
  if (!g.__moidNotificationStore) {
    g.__moidNotificationStore = shouldUseSupabase()
      ? new SupabaseNotificationStore()
      : new MemoryNotificationStore();
  }
  return g.__moidNotificationStore;
}

export async function listNotifications(filter?: {
  status?: NotificationStatus | "all" | "closed";
  type?: NotificationType;
}): Promise<PlantNotification[]> {
  return getNotificationStore().list(filter);
}

export async function openCount(): Promise<number> {
  return getNotificationStore().openCount();
}

export async function createNotification(input: CreateInput): Promise<PlantNotification> {
  return getNotificationStore().create(input);
}

export async function patchNotification(
  id: string,
  input: PatchInput | NotificationActionKind,
): Promise<PlantNotification | null> {
  return getNotificationStore().patch(id, input);
}

export async function __resetNotificationsForTests(): Promise<void> {
  await getNotificationStore().clear();
  g.__moidNotificationStore = undefined;
}
