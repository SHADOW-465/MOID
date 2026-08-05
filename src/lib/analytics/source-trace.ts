// View Source classification — progressive structure for metric provenance.
// Mirrors Audit trail discipline: summarize → group → open one slice → detail.
// Never invents quantities; only rolls up rows already attached to the metric.

/**
 * "rework" is deliberately its own kind, not a flavour of "checked".
 *
 * A rework/hold event is units pulled OUT of the flow at a gate, not units that
 * entered it. Folding them into checked made View Source disagree with the
 * dashboard: batch 26G04-14 at Visual reported 6,115 checked (5,930 produced +
 * 185 held) against the dashboard's 5,930, and 286/6,115 = 4.68% instead of the
 * 4.82% every other screen showed. lib/analytics/rejection.ts has always kept
 * rework in its own StageAgg bucket; this mirrors that.
 */
import { STAGES, STAGE_CATEGORY, STAGE_CATEGORIES } from "@/core/ontology/plant-catalog";

export type SourceKind = "checked" | "accepted" | "rejected" | "rework" | "defect" | "other";

export type SourceGroupMode =
  | "stage"
  | "period"
  | "file"
  | "type"
  | "size"
  | "defect"
  | "flat";

/** Hints the modal which default group mode + summary to use. */
export type SourceMetricKind =
  | "rejection_rate"
  | "checked"
  | "rejected"
  | "pareto"
  | "size"
  | "copq"
  | "generic";

export type SourcePeriodGrain = "day" | "week" | "month" | "fiscal-year";

export interface SourceRow {
  date: string;
  /** Display label (e.g. "Visual Inspection"). */
  stage: string;
  /** Canonical stage id for sort/group when known. */
  stageId?: string;
  size?: string | null;
  /** Legacy concatenated label kept for callers/tests. */
  type: string;
  kind: SourceKind;
  defectCode?: string | null;
  batch?: string | null;
  qty: number | string;
  file: string;
  fileHash?: string | null;
  sheet?: string;
  cell: string;
  isDirect?: boolean;
}

export interface SourceRowFilter {
  stageId?: string;
  defectCode?: string;
  size?: string;
  types?: string[];
}

export interface SourceTraceFilters {
  source: "all" | "excel" | "manual";
  stageId: string; // "all" | id
  size: string; // "all" | size id
  kind: "all" | SourceKind;
  search: string;
}

export interface SourceSummary {
  recordCount: number;
  excelCount: number;
  manualCount: number;
  fileCount: number;
  dateFrom: string | null;
  dateTo: string | null;
  /** Units that ENTERED, measured once at the most upstream stage present. */
  checkedQty: number;
  /** Which stage checkedQty was measured at, when a single section is in view.
   *  Null once several sections contribute — then read `sectionBreakdown`. */
  entryStage: string | null;
  acceptedQty: number;
  rejectedQty: number;
  /** Held / reworked units — never folded into checkedQty. */
  reworkQty: number;
  defectQty: number;
  /** Top group label for the default mode (stage / defect / size). */
  topDriver: { label: string; sharePct: number; mode: SourceGroupMode } | null;
  /** Per-gate composition. `rate` is the gate's OWN rejected ÷ its OWN checked;
   *  the headline rejection % is the SUM of these, not rejectedQty ÷ checkedQty
   *  (see rejection.ts `rejectionRate`). Showing them is what stops the panel
   *  reading as if two aggregates divided into the headline. */
  stageBreakdown: {
    key: string;
    label: string;
    count: number;
    rejectedQty: number;
    checkedQty: number;
    rate: number;
  }[];
  /**
   * How the headline rejection % is actually built: one row per SECTION, each
   * with its own denominator, summing to the headline. Primary / Secondary /
   * Assembly are separate populations; the gates inside a section are not.
   * This — not `stageBreakdown` — is what the drill-down must show.
   */
  sectionBreakdown: {
    key: string;
    label: string;
    entryLabel: string;
    checkedQty: number;
    rejectedQty: number;
    rate: number;
  }[];
}

export interface SourceGroup {
  key: string;
  label: string;
  rows: SourceRow[];
  recordCount: number;
  checkedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  defectQty: number;
  /** Share of primary qty among siblings (0–100). */
  contributionPct: number;
  source: "manual" | "excel" | "mixed";
  fileCount: number;
}

// Process order and labels come from the authored catalog — the same list
// rejection.ts measures against. This file used to keep its own five-stage
// table that omitted production/secondary/valve-fixing and sorted eye-punching
// between visual and balloon, so View Source ordered and grouped stages
// differently from every other screen.
const STAGE_ORDER: string[] = STAGES.map((s) => s.stageId);

/** Display name: the catalog label minus its SOP suffix ("Visual Inspection
 *  (P17)" → "Visual Inspection"). */
export const STAGE_LABELS: Record<string, string> = Object.fromEntries(
  STAGES.map((s) => [s.stageId, s.label.replace(/\s*\(.*\)$/, "")]),
);

const STAGE_ID_BY_LABEL = new Map(
  Object.entries(STAGE_LABELS).map(([id, label]) => [label.toLowerCase(), id]),
);

const KIND_ORDER: SourceKind[] = ["checked", "accepted", "rejected", "rework", "defect", "other"];

export function fileBasename(path: string): string {
  if (!path) return "—";
  return path.split(/[\\/]/).pop() || path;
}

export function qtyNumber(qty: number | string | undefined | null): number {
  if (typeof qty === "number" && Number.isFinite(qty)) return qty;
  if (typeof qty === "string") {
    const n = Number(qty.replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function stageSortKey(stageId: string | undefined, stageLabel: string): number {
  const id = (stageId || stageLabel || "").toLowerCase();
  const idx = STAGE_ORDER.indexOf(id);
  if (idx >= 0) return idx;
  // label may be pretty ("Visual Inspection") rather than an id
  const byLabel = STAGE_ID_BY_LABEL.get((stageLabel || "").toLowerCase());
  return byLabel ? STAGE_ORDER.indexOf(byLabel) : 99;
}

/** One consolidated ledger entry — the checked / accepted / rejected / rework /
 *  defect kind-rows of a single (date · batch · size · stage · file) collapsed into one
 *  line, the way the Audit Trail shows it. */
export interface SourceEntryRow {
  key: string;
  date: string;
  stage: string;
  stageId?: string;
  size?: string | null;
  batch?: string | null;
  file: string;
  isDirect?: boolean;
  checkedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  /** Held / reworked units. Never added to checkedQty — see SourceKind. */
  reworkQty: number;
  defects: { code: string; qty: number }[];
  /** Source cell refs that folded into this entry (for provenance). */
  cells: string[];
  /** Number of raw kind-rows that folded in. */
  rowCount: number;
}

/** Collapse kind-split SourceRows into one entry per date·batch·size·stage·file.
 *  Insertion order is preserved so the first entry stays the top contributor. */
export function consolidateEntries(rows: SourceRow[]): SourceEntryRow[] {
  const map = new Map<string, SourceEntryRow>();
  for (const r of rows) {
    const key = [r.date, r.batch ?? "", r.size ?? "", r.stageId ?? r.stage, r.file].join("|");
    let e = map.get(key);
    if (!e) {
      e = {
        key,
        date: r.date,
        stage: r.stage,
        stageId: r.stageId,
        size: r.size,
        batch: r.batch,
        file: r.file,
        isDirect: r.isDirect,
        checkedQty: 0,
        acceptedQty: 0,
        rejectedQty: 0,
        reworkQty: 0,
        defects: [],
        cells: [],
        rowCount: 0,
      };
      map.set(key, e);
    }
    const q = qtyNumber(r.qty);
    if (r.kind === "checked") e.checkedQty += q;
    else if (r.kind === "accepted") e.acceptedQty += q;
    else if (r.kind === "rejected") e.rejectedQty += q;
    else if (r.kind === "rework") e.reworkQty += q;
    else if (r.kind === "defect") {
      const code = r.defectCode || "DEFECT";
      const d = e.defects.find((x) => x.code === code);
      if (d) d.qty += q;
      else e.defects.push({ code, qty: q });
    }
    if (r.cell) e.cells.push(r.cell);
    e.rowCount++;
  }
  return [...map.values()];
}

/** Infer kind from event fields or legacy type string. */
export function inferSourceKind(input: {
  eventType?: string;
  disposition?: string;
  defectCode?: string | null;
  type?: string;
}): SourceKind {
  const et = (input.eventType || "").toLowerCase();
  const disp = (input.disposition || "").toLowerCase();
  const defect = input.defectCode || "";
  const type = (input.type || "").toLowerCase();

  if (et === "rejection" || defect || type.includes("rejection") || /\bdefect\b/.test(type)) {
    // inspection·rejected with defect code → defect; bare rejection → defect if code else rejected
    if (defect || /rejection\s+\S+/.test(type) || type.includes("defect")) return "defect";
    if (et === "rejection") return "defect";
  }
  if (et === "production" || type.startsWith("production")) return "checked";
  if (et === "inspection") {
    if (disp === "rejected" || type.includes("rejected")) return "rejected";
    if (disp === "accepted" || disp === "good" || type.includes("accepted") || type.includes("good")) {
      return "accepted";
    }
    // Held / reworked units. This used to fall through to "checked" below,
    // which is what inflated the drill-down's denominator.
    if (disp === "rework" || disp === "hold" || type.includes("rework") || type.includes("hold")) {
      return "rework";
    }
    return "checked";
  }
  if (type.includes("·rejected") || type.includes("inspection·rejected")) return "rejected";
  if (type.includes("·accepted") || type.includes("·good")) return "accepted";
  if (type.includes("·rework") || type.includes("·hold")) return "rework";
  if (type.startsWith("production")) return "checked";
  return "other";
}

export function kindLabel(kind: SourceKind, defectCode?: string | null): string {
  switch (kind) {
    case "checked":
      return "Checked";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
    case "rework":
      return "Rework / hold";
    case "defect":
      return defectCode ? `Defect · ${defectCode}` : "Defect";
    default:
      return "Other";
  }
}

/** Ensure rows have kind/stageId; parse legacy type soup when needed. */
export function normalizeSourceRows(rows: SourceRow[]): SourceRow[] {
  return rows.map((r) => {
    const stageId =
      r.stageId ||
      STAGE_ID_BY_LABEL.get((r.stage || "").toLowerCase()) ||
      (STAGE_ORDER.includes((r.stage || "").toLowerCase()) ? r.stage.toLowerCase() : undefined);
    const defectFromType =
      r.defectCode ||
      (() => {
        const m = /\brejection\s+([A-Za-z0-9_-]+)/i.exec(r.type || "");
        if (m) return m[1];
        const m2 = /\bDEFECT:([A-Za-z0-9_-]+)/i.exec(r.type || "");
        return m2?.[1] ?? null;
      })();
    const kind = r.kind || inferSourceKind({ type: r.type, defectCode: defectFromType });
    return {
      ...r,
      stageId,
      kind,
      defectCode: r.defectCode ?? defectFromType,
      file: r.file || "Manual Entry",
    };
  });
}

/**
 * Map canonical ledger events → provenance rows for View Source.
 * Shared by Dashboard, analytics pages, and Workbooks.
 */
export function toSourceRows(
  events: unknown[],
  filter: SourceRowFilter = {},
): SourceRow[] {
  const out: SourceRow[] = [];
  for (const raw of events as any[]) {
    if (filter.types && !filter.types.includes(raw.eventType)) continue;
    if (filter.stageId && raw.stageId !== filter.stageId) continue;
    if (filter.size && raw.size !== filter.size) continue;
    if (
      filter.defectCode &&
      raw.defectCodeRaw !== filter.defectCode &&
      raw.defectCode !== filter.defectCode
    ) {
      continue;
    }
    const prov = raw.provenance ?? {};
    const stageId = raw.stageId ?? undefined;
    const defectCode = raw.defectCodeRaw ?? raw.defectCode ?? null;
    const kind = inferSourceKind({
      eventType: raw.eventType,
      disposition: raw.disposition,
      defectCode,
    });
    const type =
      raw.eventType +
      (raw.disposition ? `·${raw.disposition}` : "") +
      (defectCode ? ` ${defectCode}` : "");
    const batch =
      raw.batchNo ??
      raw.customFields?.batch ??
      raw.customFields?.batchId ??
      null;
    out.push({
      date: raw.occurredOn?.start ?? "—",
      stage: STAGE_LABELS[stageId ?? ""] ?? stageId ?? "—",
      stageId,
      size: raw.size ?? null,
      type,
      kind,
      defectCode,
      batch: typeof batch === "string" && batch.trim() ? batch.trim() : null,
      qty: raw.quantity ?? raw.statedValue ?? "—",
      file: prov.file ?? "Manual Entry",
      fileHash: prov.fileHash ?? null,
      sheet: prov.sheet,
      cell: prov.cells?.[0] ?? "ENTRY",
      isDirect:
        prov.is_direct_entry === true ||
        raw.extractedBy === "direct-entry" ||
        raw.isDirectEntry === true,
    });
  }
  return sortSourceDetail(out);
}

export function defaultGroupMode(metricKind: SourceMetricKind = "generic"): SourceGroupMode {
  switch (metricKind) {
    case "pareto":
      return "defect";
    case "size":
      return "size";
    case "checked":
    case "rejected":
    case "rejection_rate":
    case "copq":
    case "generic":
    default:
      return "stage";
  }
}

export function defaultSourceFilters(): SourceTraceFilters {
  return {
    source: "all",
    stageId: "all",
    size: "all",
    kind: "all",
    search: "",
  };
}

export function filterSourceRows(
  rows: SourceRow[],
  filters: SourceTraceFilters,
): SourceRow[] {
  const q = filters.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (filters.source === "excel" && r.isDirect) return false;
    if (filters.source === "manual" && !r.isDirect) return false;
    if (filters.stageId !== "all") {
      const id = r.stageId || r.stage;
      if (id !== filters.stageId && r.stage !== filters.stageId) return false;
    }
    if (filters.size !== "all" && (r.size || "") !== filters.size) return false;
    if (filters.kind !== "all" && r.kind !== filters.kind) return false;
    if (q) {
      const hay = [
        r.date,
        r.stage,
        r.stageId,
        r.size,
        r.type,
        r.kind,
        r.defectCode,
        r.batch,
        r.file,
        fileBasename(r.file),
        r.cell,
        r.sheet,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function periodKey(date: string, grain: SourcePeriodGrain): string {
  if (!date || date === "—") return "(unknown period)";
  if (grain === "day") return date.slice(0, 10);
  if (grain === "month" || grain === "fiscal-year") return date.slice(0, 7) || date;
  // week: ISO year-week rough (Mon-based via UTC)
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date.slice(0, 7) || date;
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function periodLabel(key: string, grain: SourcePeriodGrain): string {
  if (key.startsWith("(")) return key;
  if (grain === "day") return key;
  if (grain === "week") return key.replace("-W", " · W");
  // month
  const [y, m] = key.split("-");
  if (y && m) {
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mi = Number(m) - 1;
    return `${names[mi] ?? m} ${y}`;
  }
  return key;
}

function groupKeyFor(row: SourceRow, mode: SourceGroupMode, grain: SourcePeriodGrain): { key: string; label: string } {
  switch (mode) {
    case "stage": {
      const key = row.stageId || row.stage || "(unknown stage)";
      return { key, label: row.stage || key };
    }
    case "period": {
      const key = periodKey(row.date, grain);
      return { key, label: periodLabel(key, grain) };
    }
    case "file": {
      const key = fileBasename(row.file).toLowerCase();
      return { key, label: fileBasename(row.file) };
    }
    case "type": {
      const key = row.kind;
      return { key, label: kindLabel(row.kind, null) };
    }
    case "size": {
      const key = row.size || "(no size)";
      return { key, label: row.size || "No size" };
    }
    case "defect": {
      if (row.kind === "defect" || row.defectCode) {
        const code = row.defectCode || "UNKNOWN";
        return { key: code, label: code };
      }
      return { key: "(non-defect)", label: "Non-defect rows" };
    }
    case "flat":
    default:
      return { key: "all", label: "All records" };
  }
}

/**
 * Units that ENTERED, measured once at the most upstream stage present — the
 * same rule as rejection.ts `totalChecked`, which is what the KPI on the card
 * shows. Primary → Secondary → Assembly are sequential departments handling the
 * SAME physical catheters, and within Assembly, Visual → Balloon → Valve →
 * Final are sequential gates: Visual's accepted units are Balloon's input.
 * Summing them counted one catheter up to four times (572,920 against the
 * dashboard's 176,838).
 *
 * Rejected is the opposite case and IS summed — a unit scrapped at Visual and
 * another scrapped at Final are two different units.
 */
/**
 * Section-aware "entered" count.
 *
 * Primary / Secondary / Assembly are separate populations, so each is measured
 * once at its OWN entry gate and the results add. Inside a section the gates are
 * sequential, so only the first one counts. Mirrors rejection.ts `bySection` —
 * this is a presentation rollup of the same rule, not a second rule.
 */
function entryStageChecked(rows: SourceRow[]): {
  qty: number;
  label: string | null;
  sections: { section: string; entryStageId: string; entryLabel: string; checked: number }[];
} {
  // section -> best (most upstream) gate seen so far
  const best = new Map<string, { key: number; stage: string; label: string }>();
  const byStage = new Map<string, number>();

  for (const r of rows) {
    if (r.kind !== "checked") continue;
    const q = qtyNumber(r.qty);
    if (q <= 0) continue;
    const stage = r.stageId || r.stage || "(unknown stage)";
    byStage.set(stage, (byStage.get(stage) ?? 0) + q);

    // Unclassified stages become their own section rather than borrowing one.
    const section = STAGE_CATEGORY[stage] ?? stage;
    const key = stageSortKey(r.stageId, r.stage);
    const cur = best.get(section);
    // Ties break on id so the answer never depends on row order.
    if (!cur || key < cur.key || (key === cur.key && stage < cur.stage)) {
      best.set(section, { key, stage, label: STAGE_LABELS[stage] ?? r.stage ?? stage });
    }
  }

  const sections = [...best.entries()]
    .map(([section, b]) => ({
      section,
      entryStageId: b.stage,
      entryLabel: b.label,
      checked: byStage.get(b.stage) ?? 0,
      _k: b.key,
    }))
    .sort((a, b) => a._k - b._k)
    .map(({ _k, ...rest }) => rest);

  return {
    qty: sections.reduce((sum, x) => sum + x.checked, 0),
    label: sections.length === 1 ? sections[0].entryLabel : null,
    sections,
  };
}

function rollup(rows: SourceRow[]) {
  const entry = entryStageChecked(rows);
  const checkedQty = entry.qty;
  const entrySections = entry.sections;
  let acceptedQty = 0;
  let rejectedQty = 0;
  let reworkQty = 0;
  let defectQty = 0;
  const files = new Set<string>();
  let excel = 0;
  let manual = 0;
  for (const r of rows) {
    const q = qtyNumber(r.qty);
    if (r.kind === "accepted") acceptedQty += q;
    else if (r.kind === "rejected") rejectedQty += q;
    else if (r.kind === "rework") reworkQty += q;
    else if (r.kind === "defect") defectQty += q;
    files.add(fileBasename(r.file).toLowerCase());
    if (r.isDirect) manual++;
    else excel++;
  }
  const source: "manual" | "excel" | "mixed" =
    excel > 0 && manual > 0 ? "mixed" : manual > 0 ? "manual" : "excel";
  return { checkedQty, entryStage: entry.label, entrySections, acceptedQty, rejectedQty, reworkQty, defectQty, fileCount: files.size, source, excel, manual };
}

/**
 * Single-count rejected units — same rule as rejection.ts `aggregate()`.
 *
 * Plants log the same scrapped catheter twice: once as inspection·rejected
 * (disposition total) and again as per-defect rejection rows (why it failed).
 * Adding both double-counts (13,562 + 13,527 → 27,089). Disposition wins;
 * defect qty only fills the gap when no disposition rejects were logged.
 */
export function resolvedRejectedQty(rejectedQty: number, defectQty: number): number {
  return rejectedQty > 0 ? rejectedQty : defectQty;
}

/** Primary quantity for ranking groups given metric kind. */
export function primaryQty(
  roll: { checkedQty: number; rejectedQty: number; defectQty: number; acceptedQty: number },
  metricKind: SourceMetricKind,
): number {
  switch (metricKind) {
    case "checked":
      return roll.checkedQty || roll.acceptedQty;
    case "pareto":
      // Pareto is *about* defect codes — prefer the itemized breakdown.
      return roll.defectQty || roll.rejectedQty;
    case "rejected":
    case "rejection_rate":
    case "copq":
      return resolvedRejectedQty(roll.rejectedQty, roll.defectQty) || roll.checkedQty;
    case "size":
    case "generic":
    default:
      return (
        resolvedRejectedQty(roll.rejectedQty, roll.defectQty) ||
        roll.checkedQty ||
        roll.acceptedQty
      );
  }
}

export function groupSourceRows(
  rows: SourceRow[],
  mode: SourceGroupMode,
  opts: { grain?: SourcePeriodGrain; metricKind?: SourceMetricKind } = {},
): SourceGroup[] {
  const grain = opts.grain ?? "month";
  const metricKind = opts.metricKind ?? "generic";
  const normalized = normalizeSourceRows(rows);

  if (mode === "flat") {
    const sorted = sortSourceDetail(normalized);
    const r = rollup(sorted);
    return [
      {
        key: "all",
        label: "All records",
        rows: sorted,
        recordCount: sorted.length,
        checkedQty: r.checkedQty,
        acceptedQty: r.acceptedQty,
        rejectedQty: r.rejectedQty,
        defectQty: r.defectQty,
        contributionPct: 100,
        source: r.source,
        fileCount: r.fileCount,
      },
    ];
  }

  const map = new Map<string, { label: string; rows: SourceRow[] }>();
  for (const row of normalized) {
    const { key, label } = groupKeyFor(row, mode, grain);
    const cur = map.get(key);
    if (cur) cur.rows.push(row);
    else map.set(key, { label, rows: [row] });
  }

  const groups: SourceGroup[] = [];
  for (const [key, { label, rows: gr }] of map) {
    const sorted = sortSourceDetail(gr);
    const r = rollup(sorted);
    groups.push({
      key,
      label,
      rows: sorted,
      recordCount: sorted.length,
      checkedQty: r.checkedQty,
      acceptedQty: r.acceptedQty,
      rejectedQty: r.rejectedQty,
      defectQty: r.defectQty,
      contributionPct: 0,
      source: r.source,
      fileCount: r.fileCount,
    });
  }

  const totalPrimary = groups.reduce((s, g) => s + primaryQty(g, metricKind), 0) || 1;
  for (const g of groups) {
    g.contributionPct = (primaryQty(g, metricKind) / totalPrimary) * 100;
  }

  groups.sort((a, b) => {
    const pa = primaryQty(a, metricKind);
    const pb = primaryQty(b, metricKind);
    if (pb !== pa) return pb - pa;
    if (mode === "stage") {
      return stageSortKey(a.key, a.label) - stageSortKey(b.key, b.label);
    }
    if (mode === "period") return b.key.localeCompare(a.key);
    return a.label.localeCompare(b.label);
  });

  return groups;
}

export function sortSourceDetail(rows: SourceRow[]): SourceRow[] {
  const norm = normalizeSourceRows(rows);
  return [...norm].sort((a, b) => {
    const d = (b.date || "").localeCompare(a.date || "");
    if (d) return d;
    const sa = stageSortKey(a.stageId, a.stage);
    const sb = stageSortKey(b.stageId, b.stage);
    if (sa !== sb) return sa - sb;
    const ka = KIND_ORDER.indexOf(a.kind);
    const kb = KIND_ORDER.indexOf(b.kind);
    if (ka !== kb) return ka - kb;
    const size = (a.size || "").localeCompare(b.size || "");
    if (size) return size;
    return fileBasename(a.file).localeCompare(fileBasename(b.file));
  });
}

export function summarizeSource(
  rows: SourceRow[],
  metricKind: SourceMetricKind = "generic",
): SourceSummary {
  const normalized = normalizeSourceRows(rows);
  const r = rollup(normalized);
  let dateFrom: string | null = null;
  let dateTo: string | null = null;
  for (const row of normalized) {
    const d = row.date?.slice(0, 10);
    if (!d || d === "—") continue;
    if (!dateFrom || d < dateFrom) dateFrom = d;
    if (!dateTo || d > dateTo) dateTo = d;
  }

  const mode = defaultGroupMode(metricKind);
  const groups = groupSourceRows(normalized, mode === "flat" ? "stage" : mode, { metricKind });
  const top = groups[0] && groups[0].recordCount > 0
    ? { label: groups[0].label, sharePct: groups[0].contributionPct, mode }
    : null;

  const stageGroups = groupSourceRows(normalized, "stage", { metricKind });
  const stageBreakdown = stageGroups
    .map((g) => {
      // Disposition rejects OR defect breakdown — never both (double-count).
      const rejectedQty = resolvedRejectedQty(g.rejectedQty, g.defectQty);
      return {
        key: g.key,
        label: g.label,
        count: g.recordCount,
        rejectedQty,
        // Single-stage group, so checkedQty is that gate's own denominator.
        checkedQty: g.checkedQty,
        rate: g.checkedQty > 0 ? rejectedQty / g.checkedQty : 0,
      };
    })
    .sort((a, b) => stageSortKey(a.key, a.label) - stageSortKey(b.key, b.label));

  // Sections: entry gate supplies the denominator, every gate in the section
  // supplies the numerator. Sums to the headline rejection %.
  const SECTION_LABEL: Record<string, string> = Object.fromEntries(
    STAGE_CATEGORIES.map((c) => [c.id, c.label.replace(/\s*\(.*\)$/, "")]),
  );
  const sectionRejected = new Map<string, number>();
  for (const g of stageGroups) {
    const section = STAGE_CATEGORY[g.key] ?? g.key;
    const rejectedQty = resolvedRejectedQty(g.rejectedQty, g.defectQty);
    sectionRejected.set(section, (sectionRejected.get(section) ?? 0) + rejectedQty);
  }
  const sectionBreakdown = r.entrySections.map((sec) => {
    const rejectedQty = sectionRejected.get(sec.section) ?? 0;
    return {
      key: sec.section,
      label: SECTION_LABEL[sec.section] ?? sec.entryLabel,
      entryLabel: sec.entryLabel,
      checkedQty: sec.checked,
      rejectedQty,
      rate: sec.checked > 0 ? rejectedQty / sec.checked : 0,
    };
  });

  return {
    recordCount: normalized.length,
    excelCount: r.excel,
    manualCount: r.manual,
    fileCount: r.fileCount,
    dateFrom,
    dateTo,
    checkedQty: r.checkedQty,
    entryStage: r.entryStage,
    acceptedQty: r.acceptedQty,
    rejectedQty: r.rejectedQty,
    reworkQty: r.reworkQty,
    defectQty: r.defectQty,
    topDriver: top,
    stageBreakdown,
    sectionBreakdown,
  };
}

/** Unique stage options present in rows (for filter chips). */
export function stageOptionsFromRows(rows: SourceRow[]): { id: string; label: string }[] {
  const map = new Map<string, string>();
  for (const r of normalizeSourceRows(rows)) {
    const id = r.stageId || r.stage || "(unknown)";
    if (!map.has(id)) map.set(id, r.stage || id);
  }
  return [...map.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => stageSortKey(a.id, a.label) - stageSortKey(b.id, b.label));
}

export function sizeOptionsFromRows(rows: SourceRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) if (r.size) set.add(r.size);
  return [...set].sort();
}

export const DETAIL_PAGE_SIZE = 50;

/**
 * Headline rejection % from a source summary, using the same three conventions
 * as rejection.ts `rejectionRate`. Keeps COMPUTED VALUE and HOW IT ADDS UP on
 * one formula so the modal never shows 20.28% (pooled) next to a 9.44% section sum.
 */
export function rejectionRateFromSummary(
  summary: Pick<
    SourceSummary,
    "sectionBreakdown" | "stageBreakdown" | "checkedQty" | "rejectedQty" | "defectQty"
  >,
  mode: "by-section" | "pooled" | "sum-of-stage-rates" = "by-section",
): { value: number; rows: { key: string; label: string; detail: string; rate: number }[] } {
  if (mode === "sum-of-stage-rates") {
    const rows = summary.stageBreakdown
      .filter((g) => g.checkedQty > 0)
      .map((g) => ({
        key: g.key,
        label: g.label,
        detail: `${g.rejectedQty.toLocaleString()} / ${g.checkedQty.toLocaleString()}`,
        rate: g.rate,
      }));
    return { value: rows.reduce((t, r) => t + r.rate, 0), rows };
  }

  if (mode === "pooled") {
    const rejected = resolvedRejectedQty(summary.rejectedQty, summary.defectQty);
    const checked = summary.checkedQty;
    const rate = checked > 0 ? rejected / checked : 0;
    return {
      value: rate,
      rows: [
        {
          key: "pooled",
          label: "All rejects ÷ entry checked",
          detail: `${rejected.toLocaleString()} / ${checked.toLocaleString()}`,
          rate,
        },
      ],
    };
  }

  // by-section (plant rule): each section's own rate, then add.
  const rows = summary.sectionBreakdown
    .filter((s) => s.checkedQty > 0 || s.rejectedQty > 0)
    .map((s) => ({
      key: s.key,
      label: s.label,
      detail: `${s.rejectedQty.toLocaleString()} / ${s.checkedQty.toLocaleString()} · at ${s.entryLabel}`,
      rate: s.rate,
    }));
  return { value: rows.reduce((t, r) => t + r.rate, 0), rows };
}

