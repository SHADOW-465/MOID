// src/core/profiler/assisted-profile.ts
//
// Profiling with an optional model assist for the sheets that need one.
//
// The deterministic pass runs first and, on a well-formed sheet, settles the
// reading on its own — the model is never called. It is invoked only where the
// arithmetic came out UNCONVINCING: a sheet whose chosen reading explains few
// rows, or none at all. That keeps a slow, non-deterministic, costed component
// off the critical path of the common case, which matters because the primary
// backend here is a 1B model.
//
// Whatever the model proposes is then re-scored against the same invariants. It
// is adopted only if it reads the sheet BETTER. A bad proposal costs one wasted
// call, never a wrong ledger.

import { buildProfilingTables } from "./from-workbook";
import type { ProfilingTable } from "./types";
import type { StageBlock } from "./split-regions";

/** Below this, the chosen reading isn't corroborated enough to trust blindly. */
const WEAK_AGREEMENT = 0.8;
/** Fewer checkable rows than this and the "agreement" is not evidence. */
const MIN_EVIDENCE_ROWS = 5;

export type LayoutAssist = (req: {
  sheetName: string;
  columns: { index: number; header: string }[];
  dateIndex: number | null;
}) => Promise<StageBlock[][]>;

/** Sheets whose reading the arithmetic did not settle. */
export function unconvincingSheets(tables: ProfilingTable[]): string[] {
  const bySheet = new Map<string, ProfilingTable[]>();
  for (const t of tables) {
    const list = bySheet.get(t.sheetName);
    if (list) list.push(t);
    else bySheet.set(t.sheetName, [t]);
  }

  const weak: string[] = [];
  for (const [sheetName, regions] of bySheet) {
    const applicable = regions.reduce((s, r) => s + (r.evidence?.applicable ?? 0), 0);
    if (applicable < MIN_EVIDENCE_ROWS) {
      // Nothing was checkable. A defect-only sheet is legitimately like this and
      // the model can't validate a layout guess either — but a sheet with
      // quantity-looking columns and no working arithmetic is worth a second
      // opinion, because it usually means the roles were read wrongly.
      const looksQuantitative = regions.some((r) => r.header.some((h) => /qty|quantity|checked|reject/i.test(h)));
      if (looksQuantitative) weak.push(sheetName);
      continue;
    }
    const agreeing = regions.reduce((s, r) => s + (r.evidence?.agreement ?? 0) * (r.evidence?.applicable ?? 0), 0);
    if (agreeing / applicable < WEAK_AGREEMENT) weak.push(sheetName);
  }
  return weak;
}

/**
 * Profile a workbook, calling `assist` only for sheets the deterministic pass
 * could not settle. Falls back silently to the deterministic tables whenever
 * the assist is absent, errors, or fails to improve the reading.
 */
export async function buildProfilingTablesAssisted(
  data: ArrayBuffer | Buffer,
  fileName: string,
  opts: { maxRows?: number; assist?: LayoutAssist } = {},
): Promise<{ tables: ProfilingTable[]; assistedSheets: string[] }> {
  const base = buildProfilingTables(data, fileName, { maxRows: opts.maxRows });
  if (!opts.assist) return { tables: base, assistedSheets: [] };

  const weak = unconvincingSheets(base);
  if (weak.length === 0) return { tables: base, assistedSheets: [] };

  const extraCandidates: Record<string, StageBlock[][]> = {};
  for (const sheetName of weak) {
    const regions = base.filter((t) => t.sheetName === sheetName);
    // Reconstruct the sheet's columns from the regions the first pass produced.
    const columns = new Map<number, string>();
    for (const r of regions) {
      r.header.forEach((h, i) => {
        const letter = r.colLetters[i];
        if (letter) columns.set(colLabelToIndex(letter), h);
      });
    }
    const cols = [...columns.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([index, header]) => ({ index, header }));
    const dateCol = cols.find((c) => /\b(date|day)\b/i.test(c.header));

    try {
      const proposals = await opts.assist({
        sheetName,
        columns: cols,
        dateIndex: dateCol ? dateCol.index : null,
      });
      if (proposals.length > 0) extraCandidates[sheetName] = proposals;
    } catch {
      // An assist failure must never fail an upload.
    }
  }

  if (Object.keys(extraCandidates).length === 0) return { tables: base, assistedSheets: [] };

  // Re-profile with the proposals in the running. The scorer re-runs from
  // scratch, so a proposal that reads worse simply loses again.
  const assisted = buildProfilingTables(data, fileName, { maxRows: opts.maxRows, extraCandidates });
  return { tables: assisted, assistedSheets: Object.keys(extraCandidates) };
}

function colLabelToIndex(label: string): number {
  let idx = 0;
  for (let i = 0; i < label.length; i++) idx = idx * 26 + (label.charCodeAt(i) - 64);
  return idx - 1;
}
