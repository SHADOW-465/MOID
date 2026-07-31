// The reader's grammar, on synthetic grids of each shape it has to handle.
// The corpus proof lives outside the suite (1,368 sheets, 100% fidelity against
// an independent row-sum); these lock the rules that proof depends on.

import { readSheet, detectLayout, toIsoDate, sizeFromText, resolveStage, type Grid } from "../read-sheet";

const ctx = { file: "f.xlsx", fileHash: "h", sheet: "6FR", ingestionId: "i" };
const read = (rows: Grid, over = {}) => readSheet(rows, { ...ctx, ...over }).records;

describe("flat single-block sheet (REJECTION ANALYSIS, size-wise detail)", () => {
  const rows: Grid = [
    ["VISUAL INSPECTION APRIL 2025"],
    ["DATE", "QUANTITY CHECKED", "REJECTION", "%"],
    ["2025-04-01", 11054, 828, 7.49],
    ["2025-04-02", 12039, 847, 7.03],
    ["", 23093, 1675, 7.25], // TOTAL-ish row with no date
  ];

  test("reads each dated row and ignores the untotalled tail", () => {
    const recs = read(rows, { defaultStageId: "visual" });
    expect(recs).toHaveLength(2);
    expect(recs[0].checked?.value).toBe(11054);
    expect(recs[0].rejected?.value).toBe(828);
    expect(recs[0].stageId).toBe("visual");
    expect(recs[0].occurredOn.start).toBe("2025-04-01");
  });

  test("the sheet's own % is captured as a claim, never as an input", () => {
    const recs = read(rows, { defaultStageId: "visual" });
    expect(recs[0].statedPct).toEqual({ value: 7.49, cell: "D3", formula: null });
    // Nothing derives from it — checked/rejected are the only quantities.
    expect(recs[0].checked?.cell).toBe("B3");
  });
});

describe("side-by-side blocks (BALLOON + VALVE on one row)", () => {
  const rows: Grid = [
    ["", "", "BALLOON ISPECTION REPORT - P17", "", "", "", "VALVE INTEGRITY"],
    ["DATE", "BATCH NO.", "CHECKED QTY", "ACCEPT QTY", "REJ. QTY", "", "CHECKED QTY", "ACCEPT QTY", "REJ. QTY"],
    ["2026-05-03", "26D01", 19342, 19281, 61, "", 17798, 17338, 460],
  ];

  test("a repeated role starts a new block, and each resolves its own stage", () => {
    const layout = detectLayout(rows)!;
    expect(layout.blocks).toHaveLength(2);
    expect(layout.blocks.map((b) => b.stageId)).toEqual(["balloon", "valve-integrity"]);
  });

  test("both stages are emitted from one row, with the shared batch and date", () => {
    const recs = read(rows);
    expect(recs.map((r) => r.stageId)).toEqual(["balloon", "valve-integrity"]);
    expect(recs[0].checked?.value).toBe(19342);
    expect(recs[1].checked?.value).toBe(17798);
    expect(recs.every((r) => r.customFields?.batch === "26D01")).toBe(true);
    expect(recs.every((r) => r.occurredOn.start === "2026-05-03")).toBe(true);
  });
});

describe("group-block multi-stage sheet (DAILY ACTIVITY REPORT)", () => {
  // The shape that drifts most: DATE is a merged heading in the row ABOVE the
  // sub-headers, so no block owns a date column.
  // Column positions copied from DAILY ACTIVITY REPORT 2025 :: JULY 25 — each
  // merged group heading sits exactly at its block's first column.
  const rows: Grid = [
    ["DAILY ACTIVITY REPORT JULY 2025"],
    ["DATE", "PRODUCTION", "", "", "", "EYE PUNCHING", "", "", "VISUAL INSEPTION", "", "", "", "TOTAL REJ", "REJ%"],
    ["", "NO OF LOTS", "ACTUAL", "ACPT QTY", "REJ", "ACTUAL", "ACPT QTY", "REJ", "CHKD QTY", "ACPT QTY", "HOLD", "REJ"],
    ["2025-07-01", 10, 7792, 7666, 126, 14596, 14462, 134, 13349, 11022, 1352, 975],
  ];

  test("finds the date column from the merged heading above the sub-headers", () => {
    expect(detectLayout(rows)!.dateCol).toBe(0);
  });

  test("each stage group becomes its own record", () => {
    const recs = read(rows);
    const byStage = Object.fromEntries(recs.map((r) => [r.stageId, r]));
    expect(Object.keys(byStage).sort()).toEqual(["eye-punching", "production", "visual"]);
    expect(byStage["production"].checked?.value).toBe(7792);
    expect(byStage["production"].rejected?.value).toBe(126);
    expect(byStage["visual"].checked?.value).toBe(13349);
    expect(byStage["visual"].rework?.value).toBe(1352);
    expect(byStage["visual"].rejected?.value).toBe(975);
  });

  test("the trailing TOTAL REJ / REJ% summary is not a stage", () => {
    expect(read(rows).some((r) => /total/i.test(r.stageId))).toBe(false);
  });

  test("a stage label is never taken from the header row itself", () => {
    // "REASON FOR REJECTION" sits in the header row of single-block forms and
    // must not become a stage called "Reason For Rejection".
    const legend: Grid = [
      ["DATE", "REC. QTY", "REJ. QTY", "REASON FOR REJECTION"],
      ["2025-04-01", 100, 5, ""],
    ];
    expect(detectLayout(legend)!.blocks[0].stageId).toBeNull();
  });
});

describe("defect columns", () => {
  const rows: Grid = [
    ["DATE", "REC. QTY", "REJ. QTY", "REASON FOR REJECTION"],
    ["", "", "", "1", "2", "3"],
    ["", "", "", "COAG", "SD", "PH"],
    ["2026-05-04", 13014, 292, 51, 9, 0],
  ];

  test("codes are matched through catalog aliases and zeros are not recorded", () => {
    const recs = read(rows, { defaultStageId: "visual" });
    expect(recs[0].defects).toEqual([
      { raw: "COAG", value: 51, cell: "D4" },
      { raw: "SD", value: 9, cell: "E4" },
    ]);
  });
});

describe("non-data rows and sentinels", () => {
  const rows: Grid = [
    ["DATE", "REC. QTY", "REJ. QTY"],
    ["2026-05-02", "SUNDAY", ""],
    ["2026-05-03", "NO PRODUCTION", ""],
    ["2026-05-04", 13014, 292],
    ["TOTAL", 13014, 292],
    ["%", 97.7, 2.24],
    ["OVERALL REJECTION TARGET", 0.01, ""],
    ["RESULTS", "OK", "OK"],
  ];

  test("footers are skipped and sentinels never become numbers", () => {
    const recs = read(rows, { defaultStageId: "final" });
    expect(recs).toHaveLength(1);
    expect(recs[0].checked?.value).toBe(13014);
  });
});

describe("dates and sizes", () => {
  test("every format the plant writes", () => {
    expect(toIsoDate(new Date(Date.UTC(2025, 3, 1)))).toBe("2025-04-01");
    expect(toIsoDate("2025-04-01")).toBe("2025-04-01");
    expect(toIsoDate("3.2.25")).toBe("2025-02-03"); // d.m.yy
    expect(toIsoDate("4-2-25")).toBe("2025-02-04");
    expect(toIsoDate("SUNDAY")).toBeNull();
    expect(toIsoDate("")).toBeNull();
    expect(toIsoDate("32.1.25")).toBeNull();
  });

  test("size comes from the sheet name, however it is spelled", () => {
    expect(sizeFromText("6FR")).toBe("Fr6");
    expect(sizeFromText("3way 16FR")).toBe("Fr16");
    expect(sizeFromText("22 FR - 3 WAY")).toBe("Fr22");
    expect(sizeFromText("COMMULATIVE")).toBeNull();
  });

  test("a sheet-level DATE: cell covers forms whose rows are batches", () => {
    const rows: Grid = [
      ["DATE:", "2025-02-03"],
      ["B.NO", "SIZE", "REC. QTY", "REJ. QTY"],
      ["25A28", "16FR", 2374, 61],
    ];
    const recs = read(rows, { sheet: "4-2-25", defaultStageId: "visual" });
    expect(recs).toHaveLength(1);
    expect(recs[0].occurredOn.start).toBe("2025-02-03");
    expect(recs[0].customFields?.batch).toBe("25A28");
    expect(recs[0].size).toBe("Fr16");
  });
});

test("stage headings resolve through the plant's own misspellings", () => {
  expect(resolveStage("VISUAL INSEPTION")).toBe("visual");
  expect(resolveStage("BALOON INSEPTION")).toBe("balloon");
  expect(resolveStage("BALLOON ISPECTION REPORT - P17")).toBe("balloon");
  expect(resolveStage("BALLLOON PRODUCTION")).toBe("balloon-production");
  expect(resolveStage("TRIMMNG")).toBe("trimming");
  expect(resolveStage("GUAGE")).toBe("gauge");
  expect(resolveStage("nonsense heading")).toBeNull();
});
