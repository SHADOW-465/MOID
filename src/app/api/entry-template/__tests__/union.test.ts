// Two workbooks covering the same stage must UNION into one schema, not have
// one sheet's columns win. A shared defect code IS the learned relation between
// the two files; a code only one file has must still appear in Data Entry.

import { templateFrom } from "../route";
import type { ModRowT } from "@/shared/models/ontology";

function mod(fileName: string, defectCodes: string[], captures: string[]): ModRowT {
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
        ...defectCodes.map((c) => ({
          kind: "defect" as const,
          canonical: `DEFECT:${c}`,
          verified: true,
          original: { sheet: "S1", tableId: "t1", header: c },
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
