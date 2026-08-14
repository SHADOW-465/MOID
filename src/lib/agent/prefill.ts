// Build Data Entry prefill payloads from an entry draft (sessionStorage + URL).

import type { EntryDraft } from "./types";

export const PREFILL_STORAGE_KEY = "moid_agent_entry_prefill";

export interface EntryPrefillPayload {
  macro: string;
  /** @deprecated Retired local process id. Prefer `stageId`. */
  micro?: string;
  stageId: string;
  date: string;
  batchId: string;
  size: string;
  checked: number;
  accept: number;
  reject: number;
  hold: number;
  defects: Record<string, number>;
  productType: string;
  shift: string;
  remarks: string;
  source: "ask-moid";
  savedAt: string;
}

export function prefillFromDraft(draft: EntryDraft): EntryPrefillPayload {
  const s = draft.slots;
  return {
    macro: s.macro,
    stageId: s.stageId,
    date: s.date,
    batchId: s.batchId,
    size: s.size,
    checked: s.checked,
    accept: s.acceptedGood ?? 0,
    reject: s.rejected ?? 0,
    hold: s.hold ?? 0,
    defects: s.defects ?? {},
    productType: s.productType ?? "2 way",
    shift: s.shift ?? "Day Shift",
    remarks: s.remarks ?? "Prefill from Ask MOID",
    source: "ask-moid",
    savedAt: new Date().toISOString(),
  };
}

export function writePrefill(payload: EntryPrefillPayload): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PREFILL_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* */
  }
}

export function readPrefill(): EntryPrefillPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PREFILL_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EntryPrefillPayload;
  } catch {
    return null;
  }
}

export function clearPrefill(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PREFILL_STORAGE_KEY);
  } catch {
    /* */
  }
}

/** Deep link that Data Entry can honor: /data-entry?prefill=1&batch=… */
export function prefillDataEntryHref(draft: EntryDraft): string {
  const s = draft.slots;
  const q = new URLSearchParams();
  q.set("prefill", "1");
  q.set("batch", s.batchId);
  if (s.date) q.set("date", s.date);
  if (s.size) q.set("size", s.size);
  if (s.macro) q.set("macro", s.macro);
  if (s.stageId) q.set("stage", s.stageId);
  return `/data-entry?${q.toString()}`;
}

/** Shareable investigation URL for current origin + path + scope. */
export function investigationShareUrl(
  path: string,
  state: { from?: string; to?: string; grain?: string; stage?: string },
): string {
  const base =
    typeof window !== "undefined" ? window.location.origin : "";
  const q = new URLSearchParams();
  if (state.grain) q.set("grain", state.grain);
  if (state.from) q.set("from", state.from);
  if (state.to) q.set("to", state.to);
  if (state.stage) q.set("stage", state.stage);
  const qs = q.toString();
  return `${base}${path}${qs ? `?${qs}` : ""}`;
}
