// src/core/profiler/split-regions.ts
//
// Splitting a sheet's columns into TABLE REGIONS — one per stage block.
//
// A plant sheet often lays several inspection stages out side by side, one row
// per date:
//
//   DATE │ VISUAL QTY  VISUAL ACPT  REJ QTY  REJ% │ BALLOON CHKD  BALLOON ACPT  REJ QTY  REJ% │ …
//
// The bare `REJ QTY` / `REJ %` headers mean nothing on their own — they belong
// to the stage named to their LEFT. Downstream, a region is the unit that
// carries exactly one stage and one column per role, so getting this split
// right is what keeps balloon's Checked from being read as visual's.
//
// Two boundary signals, in order of trust:
//   1. a header naming a stage      → opens a new block (strong, and it is how
//                                     the plant itself reads the sheet)
//   2. a role repeating in a block  → opens a new block (general fallback for
//                                     unlabeled repeats we haven't seen yet)
//
// Blank-column separation is handled by the caller and composes with this: a
// gap-separated region is split further if it still holds several stages.

import {
  scoreAssignment,
  scoreCascade,
  compareScores,
  type AssignmentScore,
  type InvariantScore,
} from "./score-assignment";

/** Column roles we can recognise from header text alone. */
export type ColumnRole = "checked" | "accepted" | "rework" | "rejected" | "pct" | "other";

/**
 * Stage vocabulary. Keys are matched as whole words against header text; the
 * value is the region label handed to the resolver (which already maps a label
 * to a canonical stage). Callers may extend this with the company catalog's
 * own stage labels so a plant that renames a station still splits correctly.
 */
export const DEFAULT_STAGE_TOKENS: { re: RegExp; label: string }[] = [
  { re: /\bvisual\b/i, label: "Visual" },
  { re: /\bballoon\b/i, label: "Balloon" },
  { re: /\bvalve\b/i, label: "Valve Integrity" },
  { re: /\bfinal\b/i, label: "Final" },
  { re: /\beye\s*punch/i, label: "Eye Punching" },
];

/** Derived / roll-up columns that belong to no single stage. */
const AGGREGATE_RE = /\btotal\b|\bcommulative\b|\bcumulative\b|\bgrand\b/i;

export function roleOf(header: string): ColumnRole {
  const h = header.toLowerCase();
  if (AGGREGATE_RE.test(h)) return "other";
  // Order matters: "REJ %" is a pct, not a rejected qty.
  if (/%|\bpct\b|percent/.test(h)) return "pct";
  if (/\bhold\b|\brework\b/.test(h)) return "rework";
  if (/\brej/.test(h)) return "rejected";
  if (/\bacpt\b|\baccept/.test(h)) return "accepted";
  if (/\bchk|\bchecked\b|\bchecked|\brec\.?\s*qty\b|\binput\b/.test(h)) return "checked";
  // A bare "<STAGE> QTY" is the stage's input count ("VISUAL QTY" = checked).
  if (/\bqty\b|\bquantity\b/.test(h)) return "checked";
  return "other";
}

export function stageTokenIn(
  header: string,
  tokens: { re: RegExp; label: string }[] = DEFAULT_STAGE_TOKENS,
): string | null {
  if (AGGREGATE_RE.test(header)) return null; // "TOTAL REJ QTY" names no stage
  for (const t of tokens) if (t.re.test(header)) return t.label;
  return null;
}

export interface ColumnInput {
  /** Index into the sheet's column array (0-based, absolute). */
  index: number;
  header: string;
  /** True when the column holds at least one numeric sample value. */
  hasNumericData: boolean;
}

export interface StageBlock {
  label: string | null;
  /** Absolute column indices belonging to this block, in sheet order. */
  columns: number[];
}

/**
 * Split one contiguous run of columns into stage blocks.
 *
 * Returns a single unlabeled block when the run shows no stage structure, so a
 * plain single-stage sheet is completely unaffected.
 */
export function splitStageBlocks(
  cols: ColumnInput[],
  opts: { stageTokens?: { re: RegExp; label: string }[]; dateIndex?: number } = {},
): StageBlock[] {
  const tokens = opts.stageTokens ?? DEFAULT_STAGE_TOKENS;
  const blocks: StageBlock[] = [];
  let current: StageBlock | undefined;
  let rolesSeen = new Set<ColumnRole>();

  const open = (label: string | null): StageBlock => {
    const block: StageBlock = { label, columns: [] };
    blocks.push(block);
    rolesSeen = new Set<ColumnRole>();
    return block;
  };

  for (const col of cols) {
    if (col.index === opts.dateIndex) continue; // the date axis is shared, added back per block

    const token = stageTokenIn(col.header, tokens);
    const role = roleOf(col.header);

    // Signal 1 — a header that names a stage starts that stage's block. Only a
    // QUANTITY column may open one: defect columns routinely carry a stage word
    // ("STRUCK BALLOON", "BALLOOM BRUST" are balloon defects, not a new balloon
    // block) and splitting on those would tear a stage's defects off its counts.
    // A repeated name further right also opens a block, so the trailing decoy
    // header runs some sheets carry cannot merge back into the real one.
    if (token && role !== "other" && (!current || current.label !== token || rolesSeen.has(role))) {
      current = open(token);
    } else if (
      // Signal 2 — the same quantitative role coming round again means the
      // previous block ended, even with nothing naming the new one.
      current &&
      role !== "other" &&
      rolesSeen.has(role)
    ) {
      current = open(null);
    } else if (!current) {
      current = open(token);
    }

    current.columns.push(col.index);
    if (role !== "other") rolesSeen.add(role);
  }

  // A block with no numeric data at all is a decoy header run (stale headers
  // sitting over a text marker column) — never a stage.
  const numeric = new Map(cols.map((c) => [c.index, c.hasNumericData]));
  const live = blocks.filter((b) => b.columns.some((c) => numeric.get(c)));

  // No stage structure found → hand back one region, exactly as before.
  if (live.length <= 1) {
    return [{ label: live[0]?.label ?? null, columns: cols.filter((c) => c.index !== opts.dateIndex).map((c) => c.index) }];
  }
  return live;
}

/** Which boundary signals a candidate split was allowed to use. */
export type SplitStrategy = "stage-and-role" | "stage-only" | "role-only" | "whole";

/**
 * The candidate readings of one column run, for the scorer to choose between.
 *
 * Header text alone can't settle where a stage ends — so don't make it. Offer
 * every plausible split and let the sheet's own arithmetic decide which one is
 * true. `whole` is always included so a single-stage table can win by simply
 * balancing, no heuristic required.
 */
export function candidateSplits(
  cols: ColumnInput[],
  opts: { stageTokens?: { re: RegExp; label: string }[]; dateIndex?: number } = {},
): { strategy: SplitStrategy; blocks: StageBlock[] }[] {
  const noTokens: { re: RegExp; label: string }[] = [];
  const all = cols.filter((c) => c.index !== opts.dateIndex).map((c) => c.index);

  const out: { strategy: SplitStrategy; blocks: StageBlock[] }[] = [
    { strategy: "stage-and-role", blocks: splitStageBlocks(cols, opts) },
    { strategy: "role-only", blocks: splitStageBlocks(cols, { ...opts, stageTokens: noTokens }) },
    { strategy: "whole", blocks: [{ label: null, columns: all }] },
  ];

  // "stage-only" differs from "stage-and-role" only where a role repeats inside
  // one named block; generating it separately is what lets the scorer reject an
  // over-eager role split on a sheet that legitimately repeats a column.
  const stageOnly = splitOnStageTokensOnly(cols, opts);
  if (stageOnly.length > 1) out.splice(1, 0, { strategy: "stage-only", blocks: stageOnly });

  // Drop duplicates — identical splits waste a scoring pass and can only tie.
  const seen = new Set<string>();
  return out.filter((c) => {
    const key = c.blocks.map((b) => b.columns.join(",")).join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitOnStageTokensOnly(
  cols: ColumnInput[],
  opts: { stageTokens?: { re: RegExp; label: string }[]; dateIndex?: number },
): StageBlock[] {
  const tokens = opts.stageTokens ?? DEFAULT_STAGE_TOKENS;
  const blocks: StageBlock[] = [];
  let current: StageBlock | undefined;

  for (const col of cols) {
    if (col.index === opts.dateIndex) continue;
    const token = stageTokenIn(col.header, tokens);
    const role = roleOf(col.header);
    if (token && role !== "other" && (!current || current.label !== token)) {
      current = { label: token, columns: [] };
      blocks.push(current);
    } else if (!current) {
      current = { label: token, columns: [] };
      blocks.push(current);
    }
    current.columns.push(col.index);
  }

  const numeric = new Map(cols.map((c) => [c.index, c.hasNumericData]));
  return blocks.filter((b) => b.columns.some((c) => numeric.get(c)));
}

/** Role → column index for one block, using the shared header vocabulary. */
export function assignRoles(
  block: StageBlock,
  headers: Map<number, string>,
): { checked?: number; accepted?: number; rework?: number; rejected?: number; pct?: number; defects: number[] } {
  const out: ReturnType<typeof assignRoles> = { defects: [] };
  for (const c of block.columns) {
    const role = roleOf(headers.get(c) ?? "");
    // First column of a role wins — later ones are roll-ups ("TOTAL REJ QTY").
    if (role === "other") continue;
    if (role === "checked" && out.checked === undefined) out.checked = c;
    else if (role === "accepted" && out.accepted === undefined) out.accepted = c;
    else if (role === "rework" && out.rework === undefined) out.rework = c;
    else if (role === "rejected" && out.rejected === undefined) out.rejected = c;
    else if (role === "pct" && out.pct === undefined) out.pct = c;
  }
  return out;
}

/** What the scorer concluded about one block — surfaced to the verify panel. */
export interface BlockEvidence {
  label: string | null;
  columns: number[];
  agreement: number;
  applicable: number;
  invariants: InvariantScore[];
}

export interface ChosenSplit {
  strategy: SplitStrategy;
  blocks: StageBlock[];
  /** Per-block arithmetic agreement, in block order. */
  evidence: BlockEvidence[];
  /** Σagreeing / Σapplicable across every block plus the cascade. */
  agreement: number;
  applicable: number;
}

/**
 * Choose how a column run splits into stages by testing each candidate against
 * the sheet's own arithmetic.
 *
 * This is the part that ends the tuning treadmill: a new plant's layout needs
 * no new rule, because the correct reading is the one whose numbers add up.
 * When nothing is checkable — a defect-only sheet, or a table with no accepted
 * column anywhere — it falls back to the heuristic split, which is exactly the
 * behaviour that shipped before scoring existed.
 */
export function chooseSplit(
  cols: ColumnInput[],
  rows: unknown[][],
  opts: { stageTokens?: { re: RegExp; label: string }[]; dateIndex?: number } = {},
): ChosenSplit {
  const headers = new Map(cols.map((c) => [c.index, c.header]));
  const candidates = candidateSplits(cols, opts);

  // Quantity columns the reading OUGHT to account for. A candidate that leaves
  // most of them unassigned must not win by checking only the few it kept.
  const quantityCols = cols.filter(
    (c) => c.index !== opts.dateIndex && c.hasNumericData && roleOf(c.header) !== "other",
  ).length;

  const evaluated = candidates.map((candidate) => {
    const assignments = candidate.blocks.map((b) => assignRoles(b, headers));
    const scores: AssignmentScore[] = candidate.blocks.map((b, i) =>
      scoreAssignment(rows, { ...assignments[i], defects: undefined }),
    );

    let agreeing = scores.reduce((s, x) => s + x.satisfied, 0);
    let applicable = scores.reduce((s, x) => s + x.applicable, 0);

    // Units flow forward between blocks — a split that breaks the chain is
    // usually a split in the wrong place.
    const cascade = candidate.blocks.length > 1 ? scoreCascade(rows, assignments) : null;
    if (cascade) {
      agreeing += cascade.agreeing;
      applicable += cascade.applicable;
    }

    const explained = new Set<number>();
    for (const a of assignments) {
      for (const idx of [a.checked, a.accepted, a.rework, a.rejected, a.pct]) {
        if (idx !== undefined) explained.add(idx);
      }
    }
    const unexplained = Math.max(0, quantityCols - explained.size);

    // Ranking key. Every satisfied invariant is corroboration; every violated
    // one is evidence against and costs double; every quantity column the
    // reading never accounts for is a part of the sheet it failed to explain.
    // Without that last term a reading can score a perfect 1.0 by looking at
    // three columns and ignoring fifteen.
    const failing = applicable - agreeing;
    const net = agreeing - 2 * failing - unexplained;

    const total: AssignmentScore = {
      agreement: applicable === 0 ? 0 : agreeing / applicable,
      applicable,
      coverage: scores.reduce((s, x) => s + x.coverage, 0),
      invariants: [],
      satisfied: agreeing,
    };

    return {
      ...candidate,
      total,
      net,
      evidence: candidate.blocks.map((b, i) => ({
        label: b.label,
        columns: b.columns,
        agreement: scores[i].agreement,
        applicable: scores[i].applicable,
        invariants: scores[i].invariants,
      })),
    };
  });

  const scorable = evaluated.filter((e) => e.total.applicable > 0);
  if (scorable.length === 0) {
    // Nothing to verify against — keep the heuristic reading.
    const fallback = evaluated[0];
    return {
      strategy: fallback.strategy,
      blocks: fallback.blocks,
      evidence: fallback.evidence,
      agreement: 0,
      applicable: 0,
    };
  }

  const best = scorable.reduce((a, b) =>
    b.net !== a.net ? (b.net > a.net ? b : a) : compareScores(b.total, a.total) > 0 ? b : a,
  );
  return {
    strategy: best.strategy,
    blocks: best.blocks,
    evidence: best.evidence,
    agreement: best.total.agreement,
    applicable: best.total.applicable,
  };
}
