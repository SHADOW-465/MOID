// Header rows are verbatim from the plant corpus — these are the shapes that
// actually broke, not invented ones.
import { splitStageBlocks, chooseSplit, roleOf, type ColumnInput } from "@/core/profiler/split-regions";

/** Build ColumnInput[] from header text; every column numeric unless listed. */
function cols(headers: string[], nonNumeric: number[] = []): ColumnInput[] {
  return headers.map((header, index) => ({
    index,
    header,
    hasNumericData: !nonNumeric.includes(index),
  }));
}

// ASSEMBLY_REJECTION_REPORT_corrected.xlsx › "APRIL 25" row 4.
// Four stage blocks packed with NO separating blank column, bare repeated
// "REJ QTY"/"REJ %" headers, and a trailing decoy run over a "WEEK 1" marker.
const ASSEMBLY = [
  "DATE",
  "VISUAL\nQTY", "VISUAL \nACPT QTY", "REJ\nQTY", "REJ\n%",
  "BALLOON\nCHKD QTY", "BALLOON\nACPT QTY", "REJ\nQTY", "REJ\n%",
  "VALVE INT\nCHKD Q", "VALVE INTY\nACPT ", "VALVE INTY\nREJ Q", "REJ\n%",
  "FINAL CHECKED QT", "FINAL REJECTION", "TOTAL REJ QTY", "FINAL REJ %",
  "VISUAL CHECKED Q", "VISUAL REJ QTY", "VISUAL REJ %",
];

describe("splitStageBlocks — ASSEMBLY four-stage sheet", () => {
  const blocks = splitStageBlocks(cols(ASSEMBLY, [17, 18, 19]), { dateIndex: 0 });

  it("finds one block per stage instead of collapsing the sheet", () => {
    expect(blocks.map((b) => b.label)).toEqual(["Visual", "Balloon", "Valve Integrity", "Final"]);
  });

  it("attaches bare REJ QTY / REJ % to the stage on their left", () => {
    // Visual owns B,C,D,E — the D "REJ QTY" belongs to visual, not balloon.
    expect(blocks[0].columns).toEqual([1, 2, 3, 4]);
    expect(blocks[1].columns).toEqual([5, 6, 7, 8]);
    expect(blocks[2].columns).toEqual([9, 10, 11, 12]);
  });

  it("drops the trailing decoy header run that holds no numbers", () => {
    // "VISUAL CHECKED Q / VISUAL REJ QTY / VISUAL REJ %" sit over a "WEEK 1"
    // text marker — a name-first parser grabs them and reads a string as a qty.
    const all = blocks.flatMap((b) => b.columns);
    expect(all).not.toContain(17);
    expect(all).not.toContain(18);
    expect(all).not.toContain(19);
  });

  it("keeps each block's checked column inside its own stage", () => {
    // The bug: balloon's CHKD (index 5) was read as the row's Checked while
    // accepted/rejected came from visual, giving 9627 = 9627 + 0 + 1355.
    expect(blocks[0].columns).not.toContain(5);
  });
});

// BALLOON_VALVE_corrected.xlsx › "APRIL 25" row 8, left region (cols A–L).
// Already gap-separated, so this must stay ONE block: its stage words live in
// defect names, which must not trigger a split.
describe("splitStageBlocks — defect names carrying a stage word", () => {
  const balloonRegion = [
    "DATE", "CHECKED QTY", "ACCEPT QTY", "HOLD QTY", "REJ. QTY", "REJ. %",
    "STRUCK BALLOON", "BALLOOM BRUST", "LEAKAGE", "OTHERS", "Remarks",
  ];

  it("does not split a stage away from its own defect columns", () => {
    const blocks = splitStageBlocks(cols(balloonRegion), { dateIndex: 0 });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].columns).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

// SHOPFLOOR_REJECTION_REPORT_corrected.xlsx › row 3 — defect columns only.
describe("splitStageBlocks — single-stage sheets are untouched", () => {
  it("returns one region for a defect-only shopfloor sheet", () => {
    const shopfloor = [
      "DATE", "No of TROLLEYS", "COAG", "Raised Wire", "Surface Defect",
      "Overlaping", "Black Mark", "Webbing", "Missing Formers", "Others", "Total",
    ];
    const blocks = splitStageBlocks(cols(shopfloor), { dateIndex: 0 });
    expect(blocks).toHaveLength(1);
  });

  it("returns one region for the per-day VISUAL batch sheet", () => {
    const visual = [
      "B.NO", "SIZE", "REC. QTY", "A GRADE", "HOLD", "LOCAL GRADE", "REJ. QTY", "REJ %",
      "1", "2", "3", "4", "5",
    ];
    const blocks = splitStageBlocks(cols(visual));
    expect(blocks).toHaveLength(1);
  });
});

describe("splitStageBlocks — role-cycle fallback (signal 2)", () => {
  it("splits on a repeating role even with nothing naming the stages", () => {
    const blocks = splitStageBlocks(
      cols(["DATE", "CHECKED QTY", "REJ QTY", "CHECKED QTY", "REJ QTY"]),
      { dateIndex: 0 },
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0].columns).toEqual([1, 2]);
    expect(blocks[1].columns).toEqual([3, 4]);
  });
});

describe("roleOf", () => {
  it("reads the corpus's header vocabulary", () => {
    expect(roleOf("VISUAL\nQTY")).toBe("checked");        // bare "<stage> QTY" is the input count
    expect(roleOf("BALLOON\nCHKD QTY")).toBe("checked");
    expect(roleOf("REC. QTY")).toBe("checked");
    expect(roleOf("VISUAL \nACPT QTY")).toBe("accepted");
    expect(roleOf("HOLD QTY")).toBe("rework");
    expect(roleOf("REJ\nQTY")).toBe("rejected");
    expect(roleOf("REJ\n%")).toBe("pct");
    expect(roleOf("FINAL REJ %")).toBe("pct");
    expect(roleOf("TOTAL REJ QTY")).toBe("other");        // a roll-up owns no stage
    expect(roleOf("STRUCK BALLOON")).toBe("other");       // a defect, not a count
  });
});

describe("chooseSplit — the numbers pick the reading, not the headers", () => {
  // DATE | V QTY | V ACPT | REJ QTY | B CHKD | B ACPT | REJ QTY
  const rows: unknown[][] = [
    ["2025-04-01", 10982, 9627, 1355, 9627, 9612, 15],
    ["2025-04-02", 11054, 9907, 1147, 9907, 9858, 49],
    ["2025-04-04", 11041, 9573, 1468, 9573, 9555, 18],
    ["2025-04-07", 5230, 4553, 677, 4553, 4498, 55],
    ["2025-04-08", 10167, 9400, 767, 9400, 9326, 74],
    ["2025-04-09", 9455, 8912, 543, 8912, 8886, 26],
  ];
  const headers = ["DATE", "VISUAL QTY", "VISUAL ACPT QTY", "REJ QTY", "BALLOON CHKD QTY", "BALLOON ACPT QTY", "REJ QTY"];
  const input = headers.map((header, index) => ({ index, header, hasNumericData: index > 0 }));

  it("rejects the whole-sheet reading that scores 100% by ignoring most columns", () => {
    // Read as one table, the first checked/accepted/rejected trio balances
    // perfectly — a flawless score earned by looking at 3 of 6 columns. The
    // reading must still lose to the one that explains the entire sheet.
    const chosen = chooseSplit(input, rows, { dateIndex: 0 });
    expect(chosen.blocks).toHaveLength(2);
    expect(chosen.blocks.map((b: { label: string | null }) => b.label)).toEqual(["Visual", "Balloon"]);
  });

  it("reports the evidence for each block it chose", () => {
    const chosen = chooseSplit(input, rows, { dateIndex: 0 });
    expect(chosen.agreement).toBeGreaterThan(0.9);
    expect(chosen.evidence[0].applicable).toBe(6);
    expect(chosen.evidence[0].agreement).toBe(1);
  });

  it("falls back to the heuristic split when nothing is checkable", () => {
    // Defect-only sheet: no checked/accepted pair anywhere, so no invariant
    // applies. The reading must still be produced, just without evidence.
    const defectHeaders = ["DATE", "COAG", "Raised Wire", "Overlaping"];
    const defectInput = defectHeaders.map((header, index) => ({ index, header, hasNumericData: index > 0 }));
    const chosen = chooseSplit(defectInput, [["2025-04-01", 5, 11, 6]], { dateIndex: 0 });
    expect(chosen.blocks).toHaveLength(1);
    expect(chosen.applicable).toBe(0);
  });
});
