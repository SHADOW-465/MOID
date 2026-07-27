// The scorer is the thing that lets a reading prove itself. These cases use the
// real 01-Apr ASSEMBLY row, under both the correct and the previously-broken
// column readings, so the test states the actual bug in numbers.
import {
  scoreAssignment,
  compareScores,
  scoreCascade,
  type RoleAssignment,
} from "@/core/profiler/score-assignment";

// DATE | VISUAL QTY | VISUAL ACPT | REJ QTY | REJ% | BALLOON CHKD | BALLOON ACPT | REJ QTY
const ASSEMBLY_ROWS: unknown[][] = [
  ["2025-04-01", 10982, 9627, 1355, null, 9627, 9612, 15],
  ["2025-04-02", 11054, 9907, 1147, null, 9907, 9858, 49],
  ["2025-04-04", 11041, 9573, 1468, null, 9573, 9555, 18],
  ["2025-04-05", 8585, 7801, 784, null, 7038, 7018, 20],
  ["2025-04-07", 5230, 4553, 677, null, 4553, 4498, 55],
  ["2025-04-08", 10167, 9400, 767, null, 9400, 9326, 74],
];

const VISUAL_CORRECT: RoleAssignment = { checked: 1, accepted: 2, rejected: 3 };
// What the old parser did: checked from BALLOON, accepted+rejected from VISUAL.
const VISUAL_MIXED: RoleAssignment = { checked: 5, accepted: 2, rejected: 3 };

describe("scoreAssignment — the sheet's arithmetic picks the reading", () => {
  it("the correct reading balances on every row", () => {
    const s = scoreAssignment(ASSEMBLY_ROWS, VISUAL_CORRECT);
    expect(s.agreement).toBe(1);
    expect(s.applicable).toBe(6);
  });

  it("the mixed-stage reading fails almost every row", () => {
    const s = scoreAssignment(ASSEMBLY_ROWS, VISUAL_MIXED);
    // 9627 = 9627 + 1355 is false; only the row where visual and balloon
    // happen to disagree upstream could accidentally pass.
    expect(s.agreement).toBeLessThan(0.2);
  });

  it("prefers the correct reading over the mixed one", () => {
    const correct = scoreAssignment(ASSEMBLY_ROWS, VISUAL_CORRECT);
    const mixed = scoreAssignment(ASSEMBLY_ROWS, VISUAL_MIXED);
    expect(compareScores(correct, mixed)).toBeGreaterThan(0);
  });

  it("names the rows that fail, so a human knows where to look", () => {
    const rows: unknown[][] = [
      ["d1", 100, 90, 10],
      ["d2", 100, 80, 10], // 90 ≠ 100 — the plant's own error
      ["d3", 100, 95, 5],
    ];
    const s = scoreAssignment(rows, { checked: 1, accepted: 2, rejected: 3 });
    expect(s.agreement).toBeCloseTo(2 / 3);
    expect(s.invariants[0].failing).toEqual([1]);
  });

  it("scores 0 when nothing is checkable, so an empty reading can never win", () => {
    const s = scoreAssignment(ASSEMBLY_ROWS, {});
    expect(s.agreement).toBe(0);
    expect(s.applicable).toBe(0);
    expect(compareScores(scoreAssignment(ASSEMBLY_ROWS, VISUAL_CORRECT), s)).toBeGreaterThan(0);
  });
});

describe("scoreAssignment — defect columns and stated percentages", () => {
  it("checks Σ defects against rejected", () => {
    // checked, accepted, rejected, d1, d2
    const rows: unknown[][] = [
      [100, 90, 10, 6, 4],
      [200, 180, 20, 11, 9],
      [150, 142, 8, 3, 1], // defects sum to 4, rejected says 8
    ];
    const s = scoreAssignment(rows, { checked: 0, accepted: 1, rejected: 2, defects: [3, 4] });
    const defectSum = s.invariants.find((i) => i.invariant === "defect-sum")!;
    expect(defectSum.applicable).toBe(3);
    expect(defectSum.agreeing).toBe(2);
    expect(defectSum.failing).toEqual([2]);
  });

  it("accepts a stated percentage written either as 9.5 or 0.095", () => {
    const rows: unknown[][] = [[1000, 900, 100, 10]];
    expect(scoreAssignment(rows, { checked: 0, rejected: 2, pct: 3 }).agreement).toBe(1);
    const asFraction: unknown[][] = [[1000, 900, 100, 0.1]];
    const s = scoreAssignment(asFraction, { checked: 0, rejected: 2, pct: 3 });
    expect(s.invariants.find((i) => i.invariant === "stated-pct")!.agreeing).toBe(1);
  });

  it("tolerates a one-unit rounding slack but not a real mismatch", () => {
    expect(scoreAssignment([[100, 89, 10]], { checked: 0, accepted: 1, rejected: 2 }).agreement).toBe(1);
    expect(scoreAssignment([[100, 85, 10]], { checked: 0, accepted: 1, rejected: 2 }).agreement).toBe(0);
  });
});

describe("compareScores — evidence beats a lucky small sample", () => {
  it("a perfect 3-row reading loses to a 95% reading over 160 rows", () => {
    const tiny = { agreement: 1, applicable: 3, coverage: 3, invariants: [], satisfied: 3 };
    const broad = { agreement: 0.95, applicable: 160, coverage: 3, invariants: [], satisfied: 152 };
    expect(compareScores(broad, tiny)).toBeGreaterThan(0);
  });
});

describe("scoreCascade — units flow forward between blocks", () => {
  it("confirms each block's checked is the previous block's accepted", () => {
    const s = scoreCascade(ASSEMBLY_ROWS, [
      { checked: 1, accepted: 2 }, // visual
      { checked: 5, accepted: 6 }, // balloon
    ])!;
    // Row index 3 is 05-Apr, where the source itself breaks the chain
    // (visual accepted 7801 vs balloon checked 7038).
    expect(s.applicable).toBe(6);
    expect(s.failing).toEqual([3]);
  });
});
