// Two workbooks covering the same stage must UNION into one schema, not have
// one sheet's columns win. A shared defect code IS the learned relation between
// the two files; a code only one file has must still appear in Data Entry.

import { templateFrom } from "../route";
import type { ModRowT } from "@/shared/models/ontology";

function mod(fileName: string, defectCodes: string[], captures: string[], letters?: string[]): ModRowT {
  return {
    modId: `mod-${fileName}`,
    version: 1,
    status: "verified",
    document: {
      workbook: { fileName, fileHash: `hash-${fileName}` },
      stages: [{ stageId: "visual", label: "Visual", captures, sizeWise: false, isQualityGate: true }],
      defects: defectCodes.map((c) => ({ defectCode: c, label: c, stages: ["visual"] })),
      sizes: [],
      validation: [],
      layout: [],
      entities: [
        {
          kind: "stage",
          canonical: "STAGE:visual",
          verified: true,
          original: { sheet: "S1", tableId: "t1", header: "Visual" },
        },
        ...defectCodes.map((c, i) => ({
          kind: "defect" as const,
          canonical: `DEFECT:${c}`,
          verified: true,
          original: { sheet: "S1", tableId: "t1", header: c, colLetter: letters?.[i] ?? null },
        })),
      ],
    },
  } as unknown as ModRowT;
}

test("defect columns union across workbooks, with source traceability", () => {
  const t = templateFrom([
    mod("jan.xlsx", ["SCRATCH", "DENT"], ["checked", "rejected"]),
    mod("feb.xlsx", ["DENT", "LEAK"], ["checked", "rejected"]),
  ]);

  expect(t.stages).toHaveLength(1);
  const codes = t.stages[0].defects.map((d) => d.defectCode).sort();
  expect(codes).toEqual(["DENT", "LEAK", "SCRATCH"]);

  // The shared code is one column taught by both files — the relation, recorded.
  const dent = t.stages[0].defects.find((d) => d.defectCode === "DENT")!;
  expect(dent.sources.sort()).toEqual(["feb.xlsx", "jan.xlsx"]);
});

const catalog = (defects: { defectCode: string; label: string; stages: string[] }[]) => ({
  stages: [],
  defects: defects.map((d) => ({ ...d, aliases: [d.defectCode] })),
  sizes: [],
  fiscalYearStartMonth: 4,
  updatedAt: null,
  lastMergedFrom: null,
});

test("Data Schema renames, removals, and additions reach the entry template", () => {
  const rows = [mod("sept.xlsx", ["COAG", "RW"], ["checked", "rejected"])];

  const renamed = templateFrom(
    rows,
    catalog([
      { defectCode: "COAG", label: "Coagulant", stages: ["visual"] },
      { defectCode: "RW", label: "RW", stages: ["visual"] },
    ]),
  );
  expect(renamed.stages[0].defects.map((d) => d.label)).toEqual(["Coagulant", "RW"]);

  // Deleted on Data Schema → gone from Data Entry.
  const removed = templateFrom(rows, catalog([{ defectCode: "RW", label: "RW", stages: ["visual"] }]));
  expect(removed.stages[0].defects.map((d) => d.defectCode)).toEqual(["RW"]);

  // Added on Data Schema → appears, after the Excel-order columns.
  const added = templateFrom(
    rows,
    catalog([
      { defectCode: "COAG", label: "COAG", stages: ["visual"] },
      { defectCode: "RW", label: "RW", stages: ["visual"] },
      { defectCode: "NEW", label: "Hand-added", stages: ["visual"] },
    ]),
  );
  expect(added.stages[0].defects.map((d) => d.defectCode)).toEqual(["COAG", "RW", "NEW"]);
  expect(added.stages[0].defects[2].sources).toEqual(["Data Schema"]);
});

test("an empty catalog never strips Excel-taught columns", () => {
  const t = templateFrom([mod("a.xlsx", ["COAG"], ["checked"])], catalog([]));
  expect(t.stages[0].defects.map((d) => d.defectCode)).toEqual(["COAG"]);
});

test("defect order follows the sheet column, not entity array order", () => {
  // Entities arrive shuffled (alphabetical); columns H..K say COAG, SD, TT, BL.
  const rows = [mod("apr.xlsx", ["BL", "COAG", "SD", "TT"], ["checked", "rejected"], ["K", "H", "I", "J"])];
  expect(templateFrom(rows).stages[0].defects.map((d) => d.defectCode)).toEqual(["COAG", "SD", "TT", "BL"]);
  // …and the catalog override keeps that order.
  const withCatalog = templateFrom(
    rows,
    catalog(["BL", "COAG", "SD", "TT"].map((c) => ({ defectCode: c, label: c, stages: ["visual"] }))),
  );
  expect(withCatalog.stages[0].defects.map((d) => d.defectCode)).toEqual(["COAG", "SD", "TT", "BL"]);
});

test("capture columns union and keep canonical order", () => {
  const t = templateFrom([
    mod("a.xlsx", ["X"], ["checked", "rejected"]),
    mod("b.xlsx", ["X"], ["checked", "accepted", "hold"]),
  ]);
  expect(t.stages[0].columns.map((c) => c.key)).toEqual([
    "checked",
    "acceptedGood",
    "rework",
    "rejected",
  ]);
});
