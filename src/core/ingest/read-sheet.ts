// Reads a plant worksheet into StageDayRecords using a fixed grammar.
//
// Replaces: profiler → resolver ladder → MOD → extract-from-mod. Those inferred
// what each column MEANT. The catalog already says what the plant measures, so
// all that is left is locating known roles in a grid — no statistics, no model.
//
// ONE algorithm covers the flat, side-by-side and multi-stage-group shapes:
//
//   1. find the header row — the row with the most known role words
//   2. walk it left→right, starting a NEW BLOCK whenever a role repeats
//   3. for each block, look up/left for its label ("VISUAL INSEPTION",
//      "VALVE INTEGRITY") and resolve that to a stageId via catalog aliases
//   4. find the defect-code row beneath the header, if any
//   5. read data rows, skipping footers and sentinels
//
// Verified against every DAILY ACTIVITY REPORT sheet (19/19) — that family drifts
// the most: the header row moves r4→r6, stages grow 5→7, HOLD appears per stage
// at different dates, and one sheet is offset a whole column.

import type { StageDayRecord, SourcedValue, DefectValue } from "@/lib/ingest/emit";
import { STAGE_ALIASES, canonicalDefectCode } from "@/core/ontology/plant-catalog";

export type Grid = (string | number | Date | null | undefined)[][];

export type Role = "date" | "batch" | "size" | "checked" | "accepted" | "hold" | "rejected" | "pct" | "lots";

/** Verbatim header spellings → role. Every entry was observed in the corpus. */
const ROLE_PATTERNS: [RegExp, Role][] = [
  [/^DATE ?:?$/, "date"],
  [/^(B\.? ?NO\.?|BATCH NO\.?|ITEMS? NAME)$/, "batch"],
  [/^SIZE$/, "size"],
  [/^(REC\.? QTY|RECEIVED QTY|CHECKED QTY|CHKD QTY|QUANTITY CHECKED|ACTUAL|PRODUCTION QTY)$/, "checked"],
  [/^(ACCEPT QTY|ACCEPTED QTY|ACCEPTED QUANTITY|ACPT QTY|A GRADE)$/, "accepted"],
  [/^(HOLD|HOLD QTY)$/, "hold"],
  [/^(REJ\.? QTY|REJECTION|REJ)$/, "rejected"],
  [/^(REJ ?\.? ?%|%)$/, "pct"],
  [/^NO\.? OF LOTS$/, "lots"],
];

/** Rows that are summaries or day-markers, never data. */
const NON_DATA_ROW =
  /^(TOTAL|TOTAL IN %|WEEKLY REPORT|GRAND TOTAL|%|IN %|OVERALL REJECTION|TARGET|DEVIATION|RESULTS?|CURRENT TREND|REMARKS?|SUPERVISOR|ASSEMBLY SUPERVISOR)/i;
const SENTINEL_CELL = /^(SUNDAY|HOLIDAY|NO PRODUCTION|N ?\/? ?A|NIL|-{1,3})$/i;
/** Trailing row-summary column groups ("TOTAL REJ | REJ%") and the defect-legend
 *  span are not stages, however much they look like one to the block splitter. */
const SUMMARY_BLOCK = /^(TOTAL|GRAND TOTAL|REASON FOR REJECTION|CURRENT TREND|SUMMARY)/i;

const norm = (v: unknown): string =>
  String(v ?? "").replace(/\s+/g, " ").trim().toUpperCase();

function roleOf(cell: unknown): Role | null {
  const s = norm(cell);
  if (!s) return null;
  for (const [re, r] of ROLE_PATTERNS) if (re.test(s)) return r;
  return null;
}

/** A1 column letters, so provenance cells stay clickable in the audit trail. */
export function colLetter(i: number): string {
  let s = "";
  for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s;
  return s;
}
const cellRef = (row: number, col: number) => `${colLetter(col)}${row + 1}`;

// ─────────────────────────────────────────────────────────────────────────────
// Stage resolution
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_BY_ALIAS = new Map<string, string>();
for (const [stageId, aliases] of Object.entries(STAGE_ALIASES))
  for (const a of aliases) STAGE_BY_ALIAS.set(norm(a), stageId);

/** Resolve a block label to a stageId. Tolerates the trailing process codes the
 *  plant writes into headings ("BALLOON ISPECTION REPORT - P17"). */
export function resolveStage(label: string): string | null {
  const s = norm(label);
  if (!s) return null;
  const direct = STAGE_BY_ALIAS.get(s);
  if (direct) return direct;
  // Longest alias contained in the heading wins, so "BALLOON ISPECTION REPORT
  // - P17" resolves to balloon rather than matching something shorter first.
  let best: { id: string; len: number } | null = null;
  for (const [alias, id] of STAGE_BY_ALIAS)
    if (alias.length > 2 && s.includes(alias) && (!best || alias.length > best.len))
      best = { id, len: alias.length };
  return best?.id ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Header / block detection
// ─────────────────────────────────────────────────────────────────────────────

export interface Block {
  label: string;
  stageId: string | null;
  cols: Partial<Record<Role, number>>;
  defects: { code: string; col: number; raw: string }[];
}

export interface SheetLayout {
  headerRow: number;
  defectRow: number | null;
  /** Column holding the row's date. On multi-stage forms the DATE heading is a
   *  merged cell in the row ABOVE the sub-headers, so it belongs to no block. */
  dateCol: number | null;
  blocks: Block[];
}

function findDateCol(rows: Grid, headerRow: number, blocks: Block[]): number | null {
  for (const b of blocks) if (b.cols.date !== undefined) return b.cols.date;
  // A merged "DATE" heading sitting above or below the sub-header row.
  for (let r = Math.max(0, headerRow - 2); r <= Math.min(headerRow + 2, rows.length - 1); r++)
    for (let c = 0; c < (rows[r] ?? []).length; c++) if (roleOf(rows[r][c]) === "date") return c;
  // Last resort: the leftmost column whose cells actually parse as dates.
  for (let c = 0; c < 3; c++) {
    let hits = 0;
    for (let r = headerRow + 1; r < Math.min(headerRow + 25, rows.length); r++) if (toIsoDate(rows[r]?.[c])) hits++;
    if (hits >= 3) return c;
  }
  return null;
}

/**
 * Split the header row into blocks. A repeated role means a new stage block —
 * that single rule is what makes the 7 DAR layouts one layout.
 */
function splitBlocks(headerCells: unknown[]): { cols: Partial<Record<Role, number>>; start: number }[] {
  const blocks: { cols: Partial<Record<Role, number>>; start: number }[] = [];
  let cur: { cols: Partial<Record<Role, number>>; start: number } | null = null;
  for (let c = 0; c < headerCells.length; c++) {
    const role = roleOf(headerCells[c]);
    if (!role) continue;
    // `date`, `batch` and `size` are row keys, not measurements — they belong to
    // whichever block is open (or the first one) and never start a new block.
    const isKey = role === "date" || role === "batch" || role === "size" || role === "lots";
    if (!cur || (!isKey && cur.cols[role] !== undefined)) {
      cur = { cols: {}, start: c };
      blocks.push(cur);
    }
    if (cur.cols[role] === undefined) cur.cols[role] = c;
  }
  return blocks;
}

/**
 * A block's stage label is the merged group heading ABOVE the header row
 * ("VISUAL INSEPTION", "BALLOON ISPECTION REPORT - P17").
 *
 * Never read it from the header row itself: on a single-block sheet the
 * rightmost header cell is "REASON FOR REJECTION" (the defect legend), which
 * would label the whole sheet as a stage called "Reason For Rejection".
 */
function labelFor(rows: Grid, headerRow: number, from: number, to: number): string {
  for (let r = headerRow - 1; r >= 0 && r >= headerRow - 3; r--) {
    // Scan left→right; a merged heading reports at its leftmost cell, so the
    // block start is normally where it sits.
    for (let c = from; c < to; c++) {
      const cell = rows[r]?.[c];
      if (cell instanceof Date) continue; // a date is a row key, never a stage name
      const v = String(cell ?? "").trim();
      if (!v || roleOf(v) || /^[\d.]+$/.test(v) || toIsoDate(v)) continue;
      return v;
    }
  }
  return "";
}

export function detectLayout(rows: Grid, maxScan = 14): SheetLayout | null {
  let headerRow = -1;
  let bestScore = 0;
  for (let r = 0; r < Math.min(rows.length, maxScan); r++) {
    const score = (rows[r] ?? []).filter((c) => roleOf(c)).length;
    if (score > bestScore) {
      bestScore = score;
      headerRow = r;
    }
  }
  if (headerRow < 0 || bestScore < 2) return null;

  const header = rows[headerRow] ?? [];
  const raw = splitBlocks(header);
  if (raw.length === 0) return null;

  // Defect codes sit in a row just under the header (often preceded by an
  // ordinal row 1..21). Take whichever nearby row matches the most known codes.
  let defectRow: number | null = null;
  let defectHits = 0;
  for (let r = headerRow; r <= Math.min(headerRow + 3, rows.length - 1); r++) {
    const hits = (rows[r] ?? []).filter((c) => canonicalDefectCode(String(c ?? ""))).length;
    if (hits > defectHits && hits >= 2) {
      defectHits = hits;
      defectRow = r;
    }
  }

  // The last block runs to the widest row on the sheet, not to the end of the
  // header row — defect columns often extend past the last header cell.
  const width = rows.reduce((w, r) => Math.max(w, (r ?? []).length), header.length);

  const blocks: Block[] = raw.map((b, i) => {
    const end = i + 1 < raw.length ? raw[i + 1].start : width;
    // Prefer a heading inside the block; fall back to the gap after the previous
    // block, since a merged heading can begin a column before its first role.
    const prevStart = i > 0 ? raw[i - 1].start : -1;
    const label =
      labelFor(rows, headerRow, b.start, end) || labelFor(rows, headerRow, prevStart + 1, b.start);
    const defects: Block["defects"] = [];
    if (defectRow !== null) {
      for (let c = b.start; c < end; c++) {
        const rawCode = String(rows[defectRow]?.[c] ?? "").trim();
        const code = rawCode && canonicalDefectCode(rawCode);
        if (code) defects.push({ code, col: c, raw: rawCode });
      }
    }
    return { label, stageId: SUMMARY_BLOCK.test(label) ? null : resolveStage(label), cols: b.cols, defects };
  });

  return { headerRow, defectRow, dateCol: findDateCol(rows, headerRow, blocks), blocks };
}

// ─────────────────────────────────────────────────────────────────────────────
// Value coercion
// ─────────────────────────────────────────────────────────────────────────────

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v ?? "").replace(/,/g, "").trim();
  if (!s || SENTINEL_CELL.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Dates arrive as real Dates, ISO strings, or the plant's "3.2.25" / "4-2-25". */
export function toIsoDate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return iso(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/);
  if (!m) return null;
  const [, d, mo, yRaw] = m;
  const y = Number(yRaw.length === 2 ? `20${yRaw}` : yRaw);
  const dd = Number(d);
  const mm = Number(mo);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return iso(y, mm, dd);
}

/** "6FR" / "3way 16FR" / "16 FR - 3 WAY" → Fr16 (variant travels separately). */
export function sizeFromText(text: string): string | null {
  const m = String(text ?? "").match(/(\d{1,2})\s*FR/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 6 && n <= 30 ? `Fr${n}` : null;
}

export function variantFromText(text: string): "three-way" | "female" | "two-way" {
  const s = norm(text);
  if (/3\s*-?\s*WAY|3WAY/.test(s)) return "three-way";
  if (/FEMALE/.test(s)) return "female";
  return "two-way";
}

// ─────────────────────────────────────────────────────────────────────────────
// Reader
// ─────────────────────────────────────────────────────────────────────────────

export interface ReadContext {
  file: string;
  fileHash: string;
  sheet: string;
  ingestionId: string;
  /** Stage to assume for single-stage sheets whose stage is implied by the FILE
   *  ("VISUAL/1 APRIL 26.xlsx"). Deliberately ignored on multi-block sheets — on
   *  a DAR the unlabelled trailing columns are a row summary, not this stage. */
  defaultStageId?: string | null;
}

/** Some forms carry one date for the whole sheet ("DATE: 03/02/25") and use the
 *  rows for batches instead. Find it so those rows aren't silently dropped. */
function sheetDate(rows: Grid, beforeRow: number): string | null {
  for (let r = 0; r < Math.min(beforeRow, rows.length); r++)
    for (let c = 0; c < (rows[r] ?? []).length; c++) {
      if (!/^DATE ?:/.test(norm(rows[r][c]))) continue;
      for (let k = c; k <= c + 3; k++) {
        const d = toIsoDate(rows[r][k]);
        if (d) return d;
      }
    }
  return null;
}

export interface ReadResult {
  records: StageDayRecord[];
  /** Why rows were skipped — surfaced to the operator, never swallowed. */
  skipped: { row: number; reason: string }[];
}

export function readSheet(rows: Grid, ctx: ReadContext): ReadResult {
  const layout = detectLayout(rows);
  const skipped: { row: number; reason: string }[] = [];
  if (!layout) return { records: [], skipped: [{ row: 0, reason: "no header row found" }] };

  const sheetSize = sizeFromText(ctx.sheet);
  const variant = variantFromText(ctx.sheet);
  const records: StageDayRecord[] = [];
  const fallbackDate = sheetDate(rows, layout.headerRow);
  // Only a single-block sheet can borrow its stage from the filename.
  const singleBlock = layout.blocks.length === 1;

  // Data starts below the header and any ordinal/defect-code rows.
  const firstData = Math.max(layout.headerRow, layout.defectRow ?? layout.headerRow) + 1;

  for (let r = firstData; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const firstCell = String(row[0] ?? "").trim();
    if (NON_DATA_ROW.test(firstCell)) continue;

    for (const block of layout.blocks) {
      const stageId = block.stageId ?? (singleBlock ? ctx.defaultStageId ?? null : null);
      if (!stageId) continue;

      const dateCol = block.cols.date ?? layout.dateCol;
      const date = (dateCol !== null && dateCol !== undefined ? toIsoDate(row[dateCol]) : null) ?? fallbackDate;
      if (!date) continue;

      const sv = (role: Role): SourcedValue | null => {
        const c = block.cols[role];
        if (c === undefined) return null;
        const v = num(row[c]);
        if (v === null) return null;
        return { value: v, cell: cellRef(r, c), header: String(rows[layout.headerRow]?.[c] ?? role) };
      };

      const checked = sv("checked");
      const rejected = sv("rejected");
      const accepted = sv("accepted");
      const rework = sv("hold");
      const defects: DefectValue[] = [];
      for (const d of block.defects) {
        const v = num(row[d.col]);
        if (v !== null && v !== 0) defects.push({ raw: d.code, value: v, cell: cellRef(r, d.col) });
      }

      // A row with no numbers at all is a blank calendar day, not a record.
      if (!checked && !rejected && !accepted && !rework && defects.length === 0) continue;

      const batchCol = block.cols.batch ?? layout.blocks[0].cols.batch;
      const sizeCol = block.cols.size ?? layout.blocks[0].cols.size;
      const rowSize = sizeCol !== undefined ? sizeFromText(String(row[sizeCol] ?? "")) : null;

      records.push({
        occurredOn: { kind: "day", start: date, end: date },
        stageId,
        size: rowSize ?? sheetSize ?? null,
        source: { file: ctx.file, fileHash: ctx.fileHash, sheet: ctx.sheet, tableId: `b${layout.blocks.indexOf(block) + 1}` },
        checked,
        acceptedGood: accepted,
        rework,
        rejected,
        defects,
        // The sheet's own % is a CLAIM to verify, never an input (emit.ts turns
        // it into an AggregateClaimEvent). Never used as a denominator.
        statedPct:
          block.cols.pct !== undefined && num(row[block.cols.pct]) !== null
            ? { value: num(row[block.cols.pct])!, cell: cellRef(r, block.cols.pct), formula: null }
            : null,
        extractedBy: "sheet-reader",
        ingestionId: ctx.ingestionId,
        customFields: {
          ...(batchCol !== undefined && String(row[batchCol] ?? "").trim()
            ? { batch: String(row[batchCol]).trim() }
            : {}),
          variant,
          sourceBlock: block.label || stageId,
        },
      });
    }
  }

  return { records, skipped };
}
