// Interim notification store — memory + localStorage (browser) / process memory (server/tests).
// Real auth + Supabase can replace this later without changing the API shape.

import type {
  PlantNotification,
  NotificationStatus,
  NotificationType,
} from "./types";

const STORAGE_KEY = "moid_notifications";

type CreateInput = {
  type: NotificationType;
  title: string;
  body: string;
  createdBy: string;
  targetPersona?: PlantNotification["targetPersona"];
  payload: PlantNotification["payload"];
};

// Server-side / test process memory
const g = globalThis as unknown as { __moidNotifications?: PlantNotification[] };
function mem(): PlantNotification[] {
  if (!g.__moidNotifications) g.__moidNotifications = [];
  return g.__moidNotifications;
}

function fromBrowser(): PlantNotification[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PlantNotification[]) : [];
  } catch {
    return [];
  }
}

function toBrowser(list: PlantNotification[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function all(): PlantNotification[] {
  const browser = fromBrowser();
  if (browser) return browser;
  return mem();
}

function write(list: PlantNotification[]): void {
  g.__moidNotifications = list;
  toBrowser(list);
}

export function listNotifications(filter?: {
  status?: NotificationStatus | "all";
  type?: NotificationType;
}): PlantNotification[] {
  let list = all().slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filter?.status && filter.status !== "all") {
    list = list.filter((n) => n.status === filter.status);
  }
  if (filter?.type) list = list.filter((n) => n.type === filter.type);
  return list;
}

export function openCount(): number {
  return all().filter((n) => n.status === "open").length;
}

export function createNotification(input: CreateInput): PlantNotification {
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
  };
  write([n, ...all()]);
  return n;
}

export function patchNotification(
  id: string,
  action: "ack" | "approve" | "deny",
): PlantNotification | null {
  const list = all();
  const idx = list.findIndex((n) => n.id === id);
  if (idx < 0) return null;
  const status: NotificationStatus =
    action === "ack" ? "acked" : action === "approve" ? "approved" : "denied";
  const next = {
    ...list[idx],
    status,
    updatedAt: new Date().toISOString(),
  };
  const copy = list.slice();
  copy[idx] = next;
  write(copy);
  return next;
}

/** Test helper */
export function __resetNotificationsForTests(): void {
  g.__moidNotifications = [];
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}
