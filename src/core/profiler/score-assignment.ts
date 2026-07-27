// src/core/profiler/score-assignment.ts
//
// Scoring a candidate reading of a table against the sheet's OWN arithmetic.
//
// Header text is a weak signal: it varies per plant, per month, per typist, and
// the column that matters most ("VISUAL QTY") often never says what it is. But a
// production sheet is redundant — the numbers check each other:
//
//     checked = accepted + rework + rejected
//     Σ defect columns = rejected
//     stated %        = rejected / checked
//     next stage's checked = this stage's accepted        (cross-block, below)
//
// So the right reading is discoverable WITHOUT understanding the words: it is
// the one under which the sheet's arithmetic is most true. That turns mapping
// from classification (fragile, needs a rule per corpus) into search (self-
// correcting, works on files nobody has seen).
//
// Agreement is a FRACTION, never all-or-nothing, because these sheets are
// maintained by hand and contain genuine arithmetic mistakes. A reading that
// balances on 38 of 40 rows is correct; the 2 that don't are the human errors
// worth surfacing — the same measurement answers both questions.

export interface RoleAssignment {
  /** Column indices into the row arrays. */
  checked?: number;
  accepted?: number;
  rework?: number;
  rejected?: number;
  pct?: number;
  defects?: number[];
}

export type InvariantId = "balance" | "defect-sum" | "stated-pct";

export interface InvariantScore {
  invariant: InvariantId;
  /** Rows where every column the invariant needs held a number. */
  applicable: number;
  agreeing: number;
  /** Row indices (into the scored rows) that failed — the cells to look at. */
  failing: number[];
}

export interface AssignmentScore {
  /** Σagreeing / Σapplicable across invariants. 0 when nothing was checkable. */
  agreement: number;
  /** Total rows an invariant could be evaluated on — how much evidence exists. */
  applicable: number;
  /** Distinct roles the candidate managed to name. */
  coverage: number;
  invariants: InvariantScore[];
  /** Absolute count of satisfied checks — the raw corroboration this reading
   *  earned, independent of how many checks it chose to attempt. */
  satisfied: number;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/** Quantities are whole units; a 1-unit slack absorbs rounding in the source. */
const QTY_TOLERANCE = 1;
/** A stated percentage is rounded for display — compare loosely. */
const PCT_TOLERANCE = 0.05;

export function scoreAssignment(rows: unknown[][], a: RoleAssignment): AssignmentScore {
  const at = (row: unknown[], idx: number | undefined) =>
    idx === undefined ? null : num(row[idx]);

  const invariants: InvariantScore[] = [];
  const push = (
    invariant: InvariantId,
    check: (row: unknown[]) => boolean | null, // null ⇒ not applicable on this row
  ) => {
    let applicable = 0;
    let agreeing = 0;
    const failing: number[] = [];
    rows.forEach((row, i) => {
      const ok = check(row);
      if (ok === null) return;
      applicable++;
      if (ok) agreeing++;
      else failing.push(i);
    });
    if (applicable > 0) invariants.push({ invariant, applicable, agreeing, failing });
  };

  // checked = accepted + rework + rejected.
  //
  // Needs BOTH checked and accepted. With only checked and rejected the
  // equation is unprovable — the accepted units are simply unknown, and
  // treating the missing column as 0 would fail every row of a perfectly good
  // reading (a Final gate that records no accepted count, for instance).
  push("balance", (row) => {
    const checked = at(row, a.checked);
    const accepted = at(row, a.accepted);
    const rework = at(row, a.rework);
    const rejected = at(row, a.rejected);
    if (checked === null || accepted === null) return null;
    const sum = accepted + (rework ?? 0) + (rejected ?? 0);
    return Math.abs(checked - sum) <= QTY_TOLERANCE;
  });

  // Σ defect columns = rejected.
  push("defect-sum", (row) => {
    const rejected = at(row, a.rejected);
    if (rejected === null || !a.defects?.length) return null;
    let sum = 0;
    let any = false;
    for (const d of a.defects) {
      const v = at(row, d);
      if (v !== null) { sum += v; any = true; }
    }
    if (!any) return null;
    return Math.abs(sum - rejected) <= QTY_TOLERANCE;
  });

  // stated % = rejected / checked. The sheet may write 9.5 or 0.095.
  push("stated-pct", (row) => {
    const stated = at(row, a.pct);
    const checked = at(row, a.checked);
    const rejected = at(row, a.rejected);
    if (stated === null || checked === null || rejected === null || checked === 0) return null;
    const ratio = (rejected / checked) * 100;
    return Math.abs(stated - ratio) <= PCT_TOLERANCE || Math.abs(stated * 100 - ratio) <= PCT_TOLERANCE;
  });

  const applicable = invariants.reduce((s, i) => s + i.applicable, 0);
  const agreeing = invariants.reduce((s, i) => s + i.agreeing, 0);
  const coverage = [a.checked, a.accepted, a.rework, a.rejected, a.pct].filter((x) => x !== undefined).length
    + (a.defects?.length ? 1 : 0);

  return {
    agreement: applicable === 0 ? 0 : agreeing / applicable,
    applicable,
    coverage,
    invariants,
    satisfied: agreeing,
  };
}

/**
 * Rank two candidate readings. Higher is better.
 *
 * Agreement first, but only once there is enough evidence to mean anything — a
 * reading that checks 3 rows perfectly must not beat one that checks 160 rows at
 * 95%. Ties fall to whichever named more roles.
 */
export function compareScores(a: AssignmentScore, b: AssignmentScore): number {
  const evidence = (s: AssignmentScore) => (s.applicable >= 5 ? 1 : 0);
  if (evidence(a) !== evidence(b)) return evidence(a) - evidence(b);
  if (Math.abs(a.agreement - b.agreement) > 0.02) return a.agreement - b.agreement;
  if (a.applicable !== b.applicable) return a.applicable - b.applicable;
  return a.coverage - b.coverage;
}

/**
 * Cross-block invariant: units flow forward, so a stage's Checked is the
 * previous stage's Accepted. Scored over the blocks of one sheet, in order.
 */
export function scoreCascade(
  rows: unknown[][],
  blocks: { checked?: number; accepted?: number }[],
): InvariantScore | null {
  let applicable = 0;
  let agreeing = 0;
  const failing: number[] = [];
  rows.forEach((row, i) => {
    let rowApplicable = false;
    let rowAgrees = true;
    for (let b = 1; b < blocks.length; b++) {
      const prev = blocks[b - 1].accepted;
      const cur = blocks[b].checked;
      if (prev === undefined || cur === undefined) continue;
      const a = num(row[prev]);
      const c = num(row[cur]);
      if (a === null || c === null) continue;
      rowApplicable = true;
      if (Math.abs(a - c) > QTY_TOLERANCE) rowAgrees = false;
    }
    if (!rowApplicable) return;
    applicable++;
    if (rowAgrees) agreeing++;
    else failing.push(i);
  });
  if (applicable === 0) return null;
  return { invariant: "balance", applicable, agreeing, failing };
}
