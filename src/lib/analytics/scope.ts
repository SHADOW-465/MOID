// Analytics scope: filter the event set + bucket by period (plan 02).
// FY = April–March. Pure functions; no I/O.
//
// Source channel filter (excel vs data-entry) is applied BEFORE
// canonicalizeEvents so "Excel only" can still see uploaded rows that
// would otherwise lose to a same-day direct entry under full-scope rules.

import type { Event } from "@/lib/store/types";
import { canonicalizeEvents } from "./canonical";

export type Grain = "day" | "week" | "month" | "fy";

/** Intake channel that produced a ledger event. */
export type SourceChannel = "excel" | "direct-entry";

export interface Scope {
  dateFrom?: string; // ISO yyyy-mm-dd (inclusive)
  dateTo?: string;   // ISO yyyy-mm-dd (inclusive)
  stageIds?: string[];
  sizes?: string[];
  grain: Grain;
  /**
   * Which intake channels contribute. Omit / empty / both = all channels.
   * `["excel"]` = uploaded workbooks only; `["direct-entry"]` = Data Entry only.
   */
  sourceChannels?: SourceChannel[];
  /**
   * When Excel is included: restrict to these provenance file labels
   * (basename of provenance.file). Omit / empty = every Excel file.
   * Ignored when excel is not in sourceChannels.
   */
  sourceFiles?: string[];
  /**
   * Restrict to these batch IDs (`batchNo` / customFields.batch*).
   * Omit / empty = every batch (and events with no batch).
   * Non-empty = only matching batches; events without a batch are dropped.
   */
  batchIds?: string[];
  // V2 dimensions — ignored by selectors until events carry them.
  shift?: string;
  productIds?: string[];
  machineIds?: string[];
  operatorIds?: string[];
}

export const DEFAULT_SCOPE: Scope = { grain: "month" };

function stageOf(e: Event): string | null {
  return "stageId" in e ? (e.stageId as string) : null;
}
function sizeOf(e: Event): string | null {
  return "size" in e ? ((e.size as string | null) ?? null) : null;
}

/** Manual Data Entry / batch matrix (not an uploaded workbook). */
export function isDirectEntryEvent(e: Event): boolean {
  const any = e as Event & { extractedBy?: string; isDirectEntry?: boolean };
  if (any.extractedBy === "direct-entry" || any.isDirectEntry === true) return true;
  const file = any.provenance?.file ?? "";
  return file === "Manual Entry" || /^Batch Entry /i.test(file);
}

export function eventSourceChannel(e: Event): SourceChannel {
  return isDirectEntryEvent(e) ? "direct-entry" : "excel";
}

/** Stable label for an Excel file (basename). Empty for direct-entry. */
export function eventSourceFileLabel(e: Event): string {
  if (isDirectEntryEvent(e)) return "";
  const file = (e as Event & { provenance?: { file?: string } }).provenance?.file ?? "";
  if (!file || file === "Manual Entry") return "";
  return file.split(/[/\\]/).pop() ?? file;
}

/** Distinct Excel file labels present in a raw event list (for the Sources picker). */
export function listExcelSourceFiles(events: Event[]): string[] {
  const set = new Set<string>();
  for (const e of events) {
    const label = eventSourceFileLabel(e);
    if (label) set.add(label);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * Batch ID on a ledger event — same fields Data Entry + Audit trail use.
 * Uppercases for stable compare / picker keys.
 */
export function eventBatchId(e: Event): string | null {
  const any = e as Event & {
    batchNo?: string | null;
    customFields?: Record<string, unknown>;
  };
  const raw =
    any.batchNo ??
    (typeof any.customFields?.batch === "string" ? any.customFields.batch : null) ??
    (typeof any.customFields?.batchId === "string" ? any.customFields.batchId : null) ??
    null;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t ? t.toUpperCase() : null;
}

/**
 * Event types that carry live plant quantities. Corrections / annotations may
 * still reference a batch after a purge path failed — they must not keep a
 * deleted batch in the Sources picker.
 */
const BATCH_LIST_TYPES = new Set(["production", "inspection", "rejection"]);

/** Distinct batch IDs in a raw event list (for the Sources picker), newest-looking first. */
export function listBatchIds(events: Event[]): string[] {
  const set = new Set<string>();
  for (const e of events) {
    if (!BATCH_LIST_TYPES.has(e.eventType)) continue;
    const b = eventBatchId(e);
    if (b) set.add(b);
  }
  // Lexicographic desc tends to put newer plant batch codes (yy letter day-size) near top
  return [...set].sort((a, b) => b.localeCompare(a));
}

export function countBySourceChannel(events: Event[]): { excel: number; directEntry: number } {
  let excel = 0;
  let directEntry = 0;
  for (const e of events) {
    if (isDirectEntryEvent(e)) directEntry++;
    else excel++;
  }
  return { excel, directEntry };
}

/** Human label for the Sources filter — used in report headers / cover. */
export function describeSourceFilter(scope: Scope): string {
  const channels = scope.sourceChannels;
  const files = scope.sourceFiles;
  const batches = scope.batchIds;
  const excelOn = !channels || channels.includes("excel");
  const deOn = !channels || channels.includes("direct-entry");

  const batchSuffix =
    batches && batches.length > 0
      ? batches.length === 1
        ? ` · batch ${batches[0]}`
        : ` · ${batches.length} batches`
      : "";

  if (excelOn && deOn && (!files || files.length === 0)) {
    return `All sources (Excel + Data entry)${batchSuffix}`;
  }
  if (excelOn && deOn && files?.length) {
    return `Data entry + Excel: ${files.join(", ")}${batchSuffix}`;
  }
  if (excelOn && !deOn) {
    if (!files || files.length === 0) return `Excel uploads only${batchSuffix}`;
    if (files.length === 1) return `Excel: ${files[0]}${batchSuffix}`;
    return `Excel files (${files.length}): ${files.join(", ")}${batchSuffix}`;
  }
  if (!excelOn && deOn) {
    if (batches?.length === 1) return `Data entry · batch ${batches[0]}`;
    if (batches && batches.length > 1) return `Data entry · ${batches.length} batches`;
    return "Data entry only";
  }
  if (channels && channels.length === 0) return "No sources selected";
  return batchSuffix ? `All sources${batchSuffix}` : "All sources";
}

/** The week-of-month bucket containing `day` in `month`/`year`. Buckets are
 *  fixed 7-day chunks counted from the 1st (1-7, 8-14, 15-21, 22-28, 29-31+)
 *  — NOT real Monday-Sunday weeks. This is the one place that definition
 *  lives; `periodKey`'s "week" case and Data Entry's week picker both call
 *  this instead of re-deriving the math. */
export function weekOfMonthBounds(year: number, month: number, day: number): { week: number; startDay: number; endDay: number } {
  const week = Math.floor((day - 1) / 7) + 1;
  const startDay = (week - 1) * 7 + 1;
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const endDay = Math.min(week * 7, lastDayOfMonth);
  return { week, startDay, endDay };
}

/** The Apr-Mar fiscal year containing `dateIso`, with its label (matching
 *  periodKey's "fy" format) and calendar bounds. */
export function fyContaining(dateIso: string): { startYear: number; label: string; from: string; to: string } {
  const [y, m] = dateIso.split("-").map(Number);
  const startYear = m >= 4 ? y : y - 1;
  return {
    startYear,
    label: periodKey(dateIso, "fy"),
    from: `${startYear}-04-01`,
    to: `${startYear + 1}-03-31`,
  };
}

/**
 * Apply date / stage / size / **source** filters, then canonicalize so the
 * remaining set never double-counts. Source filter runs first so channel
 * selection is meaningful (Excel-only keeps upload rows even when a same-day
 * direct entry would win under an unscoped full ledger).
 */
export function scopeEvents(events: Event[], scope: Scope): Event[] {
  const channels = scope.sourceChannels?.length
    ? new Set(scope.sourceChannels)
    : null;
  const files =
    scope.sourceFiles?.length && (!channels || channels.has("excel"))
      ? new Set(scope.sourceFiles)
      : null;
  const batches = scope.batchIds?.length
    ? new Set(scope.batchIds.map((b) => b.toUpperCase()))
    : null;

  const filtered = events.filter((e) => {
    if (scope.dateFrom && e.occurredOn.end < scope.dateFrom) return false;
    if (scope.dateTo && e.occurredOn.start > scope.dateTo) return false;
    if (scope.stageIds?.length) {
      const s = stageOf(e);
      if (s != null && !scope.stageIds.includes(s)) return false;
    }
    if (scope.sizes?.length) {
      const s = sizeOf(e);
      if (s != null && !scope.sizes.includes(s)) return false;
    }

    const channel = eventSourceChannel(e);
    if (channels && !channels.has(channel)) return false;

    if (channel === "excel" && files) {
      const label = eventSourceFileLabel(e);
      if (!label || !files.has(label)) return false;
    }

    if (batches) {
      const batch = eventBatchId(e);
      if (!batch || !batches.has(batch)) return false;
    }

    return true;
  });

  return canonicalizeEvents(filtered);
}

/** Bucket key for a date under a grain. FY runs Apr(4)–Mar(3). */
export function periodKey(iso: string, grain: Grain): string {
  const [y, m, d] = iso.split("-").map(Number);
  switch (grain) {
    case "day":
      return iso;
    case "month":
      return `${y}-${String(m).padStart(2, "0")}`;
    case "fy": {
      const fy = m >= 4 ? y : y - 1;
      return `FY${fy}-${String((fy + 1) % 100).padStart(2, "0")}`;
    }
    case "week": {
      const { week } = weekOfMonthBounds(y, m, d);
      return `${y}-${String(m).padStart(2, "0")}-W${week}`;
    }
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Human label for a period key (e.g. "2025-04" → "Apr-25"). */
export function periodLabel(key: string): string {
  const d = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (d) return `${d[3]} ${MONTHS[Number(d[2]) - 1]}`;
  const m = key.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${MONTHS[Number(m[2]) - 1]}-${m[1].slice(2)}`;
  const w = key.match(/^(\d{4})-(\d{2})-W(\d)$/);
  if (w) return `W${w[3]} (${MONTHS[Number(w[2]) - 1]})`;
  if (key.startsWith("FY")) {
    return key.replace("FY20", "FY");
  }
  return key;
}

/** Every calendar period key between two ISO dates (inclusive), in order —
 *  the shared timeline builder. Walks day by day so day/week/month/FY all fall
 *  out of periodKey with no per-grain arithmetic. */
export function calendarPeriods(fromIso: string, toIso: string, grain: Grain): string[] {
  const out: string[] = [];
  let last: string | null = null;
  const end = Date.parse(`${toIso}T00:00:00Z`);
  if (!Number.isFinite(end)) return out;
  for (let t = Date.parse(`${fromIso}T00:00:00Z`); Number.isFinite(t) && t <= end; t += 86400000) {
    const key = periodKey(new Date(t).toISOString().slice(0, 10), grain);
    if (key !== last) {
      out.push(key);
      last = key;
    }
  }
  return out;
}

/** Chronological period keys spanning the COMPLETE calendar range — never just
 *  the periods that happen to have records, so charts keep uniform spacing and
 *  empty periods stay visible. Bounds come from `range` (the selected date
 *  window) when given, else from the events' min/max dates. */
export function periodsIn(events: Event[], grain: Grain, range?: { from?: string; to?: string }): string[] {
  const dates = events.map((e) => e.occurredOn.start).sort();
  const from = range?.from ?? dates[0];
  const to = range?.to ?? dates[dates.length - 1];
  if (!from || !to) return [];
  return calendarPeriods(from, to, grain);
}

export interface ScopeTweaks {
  grain: Grain;
  datePreset: "all" | "last-90-days" | "last-12-months" | "this-fy" | "custom";
  dateFrom: string;
  dateTo: string;
  stageView?: string;
  /** Default true — include uploaded Excel events. */
  includeExcel?: boolean;
  /** Default true — include Data Entry / batch matrix events. */
  includeDirectEntry?: boolean;
  /**
   * When includeExcel: null/undefined/empty = all Excel files;
   * non-empty = only these basenames.
   */
  excelFiles?: string[] | null;
  /**
   * Empty / null = all batches. Non-empty = only these batch IDs
   * (matches eventBatchId — case-insensitive).
   */
  batchIds?: string[] | null;
}

/**
 * The single source of truth for turning the header controls into a Scope.
 * Date presets anchor on the DATA's latest date (never a hardcoded "today"), so
 * "Last 90 days" actually lands on real data. `stageView !== "cumulative"` scopes
 * the WHOLE screen to one stage — the universal per-stage separation.
 */
export function resolveScope(events: Event[], t: ScopeTweaks): Scope {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const dates = events.length ? events.map((e) => e.occurredOn.start).sort() : [];
  const dataMin = dates[0];
  const dataMax = dates[dates.length - 1];
  const anchor = dataMax ? new Date(`${dataMax}T00:00:00Z`) : new Date();

  let from: string | undefined = t.dateFrom || undefined;
  let to: string | undefined = t.dateTo || undefined;

  if (t.datePreset === "custom") {
    /* keep typed from/to */
  } else if (t.datePreset === "last-90-days") {
    from = iso(new Date(anchor.getTime() - 90 * 86400000));
    to = iso(anchor);
  } else if (t.datePreset === "last-12-months") {
    const p = new Date(anchor);
    p.setUTCFullYear(p.getUTCFullYear() - 1);
    from = iso(p);
    to = iso(anchor);
  } else if (t.datePreset === "this-fy") {
    const m = anchor.getUTCMonth();
    const y = anchor.getUTCFullYear();
    const fy = m >= 3 ? y : y - 1; // fiscal year Apr–Mar
    from = `${fy}-04-01`;
    to = `${fy + 1}-03-31`;
  } else {
    from = dataMin; // "all"
    to = dataMax;
  }

  const stageIds = t.stageView && t.stageView !== "cumulative" ? [t.stageView] : undefined;

  const includeExcel = t.includeExcel !== false;
  const includeDirectEntry = t.includeDirectEntry !== false;
  const sourceChannels: SourceChannel[] = [];
  if (includeExcel) sourceChannels.push("excel");
  if (includeDirectEntry) sourceChannels.push("direct-entry");
  // Neither selected → empty result set (explicit "no sources")
  const channelsProp =
    sourceChannels.length === 2 ? undefined : sourceChannels.length === 0 ? ([] as SourceChannel[]) : sourceChannels;

  const sourceFiles =
    includeExcel && t.excelFiles && t.excelFiles.length > 0 ? t.excelFiles : undefined;

  const batchIds =
    t.batchIds && t.batchIds.length > 0
      ? t.batchIds.map((b) => b.toUpperCase())
      : undefined;

  return {
    grain: t.grain,
    dateFrom: from,
    dateTo: to,
    stageIds,
    sourceChannels: channelsProp,
    sourceFiles,
    batchIds,
  };
}

/** The immediately-prior equal-length window, for "vs previous period" deltas. */
export function prevWindow(scope: Scope): Scope {
  if (!scope.dateFrom || !scope.dateTo) return scope;
  const from = new Date(scope.dateFrom + "T00:00:00Z").getTime();
  const to = new Date(scope.dateTo + "T00:00:00Z").getTime();
  const day = 86_400_000;
  const len = to - from + day;
  const pTo = from - day;
  const pFrom = pTo - len + day;
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return { ...scope, dateFrom: iso(pFrom), dateTo: iso(pTo) };
}
