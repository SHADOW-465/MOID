import type { AgentSession, EntrySlots, ReportSlots, TaskKind, TaskStatus } from "./types";

const STORAGE_KEY = "moid_agent_session_v1";

export function newSession(kind: TaskKind, status: TaskStatus = "collecting"): AgentSession {
  const now = new Date().toISOString();
  return {
    taskId: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    status,
    entrySlots: {},
    reportSlots: {},
    missing: [],
    notes: [],
    createdAt: now,
    updatedAt: now,
    validationError: null,
  };
}

export function touch(session: AgentSession, patch: Partial<AgentSession>): AgentSession {
  return {
    ...session,
    ...patch,
    entrySlots: patch.entrySlots
      ? { ...session.entrySlots, ...patch.entrySlots }
      : session.entrySlots,
    reportSlots: patch.reportSlots
      ? { ...session.reportSlots, ...patch.reportSlots }
      : session.reportSlots,
    updatedAt: new Date().toISOString(),
  };
}

export function mergeEntrySlots(base: EntrySlots, next: EntrySlots): EntrySlots {
  const defects =
    next.defects || base.defects
      ? { ...(base.defects ?? {}), ...(next.defects ?? {}) }
      : undefined;
  return {
    ...base,
    ...next,
    defects,
  };
}

export function mergeReportSlots(base: ReportSlots, next: ReportSlots): ReportSlots {
  return { ...base, ...next };
}

export function loadSession(): AgentSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AgentSession;
  } catch {
    return null;
  }
}

export function saveSession(session: AgentSession | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!session || session.status === "done" || session.status === "idle") {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* quota */
  }
}

export function clearSession(): null {
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* */
    }
  }
  return null;
}
