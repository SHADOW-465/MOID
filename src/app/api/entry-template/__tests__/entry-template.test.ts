// The entry template is a pure projection of the company catalog. The things
// that must hold: defect ORDER is the catalog's order (the plant reads its own
// columns COAG, SD, TT, … and the grid has to match), defects are scoped to the
// stage that reports them, and capture columns land in canonical order however
// the catalog happens to list them.

import { templateFrom } from "../route";
import { plantCatalog } from "@/core/ontology/plant-catalog";
import type { CompanyCatalog } from "@/core/ontology/store/catalog-store";

const catalog = (over: Partial<CompanyCatalog> = {}): CompanyCatalog => ({
  stages: [],
  defects: [],
  sizes: [],
  fiscalYearStartMonth: 4,
  updatedAt: null,
  lastMergedFrom: null,
  ...over,
});

const stage = (stageId: string, captures: string[], extra: Record<string, unknown> = {}) => ({
  stageId,
  label: stageId,
  effectiveFrom: null,
  effectiveTo: null,
  upstream: [],
  captures,
  ...extra,
}) as CompanyCatalog["stages"][number];

const defect = (defectCode: string, stages: string[]) => ({
  defectCode,
  label: defectCode,
  aliases: [defectCode],
  stages,
});

test("defect order follows the catalog, not the alphabet", () => {
  const t = templateFrom(
    catalog({
      stages: [stage("visual", ["checked", "rejected"])],
      defects: [defect("COAG", ["visual"]), defect("SD", ["visual"]), defect("TT", ["visual"]), defect("BL", ["visual"])],
    }),
  );
  expect(t.stages[0].defects.map((d) => d.defectCode)).toEqual(["COAG", "SD", "TT", "BL"]);
});

test("defects are scoped to the stage that reports them", () => {
  const t = templateFrom(
    catalog({
      stages: [stage("visual", ["checked"]), stage("balloon", ["checked"])],
      defects: [defect("COAG", ["visual"]), defect("LEAK", ["balloon"]), defect("BM", ["visual", "balloon"])],
    }),
  );
  expect(t.stages[0].defects.map((d) => d.defectCode)).toEqual(["COAG", "BM"]);
  expect(t.stages[1].defects.map((d) => d.defectCode)).toEqual(["LEAK", "BM"]);
});

test("capture columns are emitted in canonical order regardless of catalog order", () => {
  const t = templateFrom(catalog({ stages: [stage("visual", ["rejected", "hold", "checked", "accepted"])] }));
  expect(t.stages[0].columns.map((c) => c.key)).toEqual(["checked", "acceptedGood", "rework", "rejected"]);
  // A stage that counts rejects must state a denominator.
  expect(t.stages[0].columns.filter((c) => c.required).map((c) => c.key)).toEqual(["checked", "rejected"]);
});

test("throughput-only stages get one column and no defects", () => {
  const t = templateFrom(
    catalog({ stages: [stage("trimming", ["checked"])], defects: [defect("COAG", ["visual"])] }),
  );
  expect(t.stages[0].columns.map((c) => c.key)).toEqual(["checked"]);
  expect(t.stages[0].defects).toEqual([]);
});

test("the authored plant catalog projects into a usable grid", () => {
  const t = templateFrom(plantCatalog());
  const byId = Object.fromEntries(t.stages.map((s) => [s.stageId, s]));

  // Production is present and upstream of the gates — the bug that started this.
  expect(t.stages[0].stageId).toBe("production");
  expect(byId["visual"].defects.map((d) => d.defectCode).slice(0, 3)).toEqual(["COAG", "SD", "TT"]);
  expect(byId["balloon"].defects).toHaveLength(4);
  expect(byId["valve-integrity"].defects).toHaveLength(5);
  expect(byId["production"].defects).toHaveLength(8);
  expect(byId["trimming"].columns.map((c) => c.key)).toEqual(["checked"]);
  expect(byId["visual"].columns.map((c) => c.key)).toEqual([
    "checked",
    "acceptedGood",
    "rework",
    "rejected",
  ]);
});

test("shared defect codes are ordered per stage, not globally", () => {
  // COAG/LEAK/OTH appear in several vocabularies. A flat catalog list would let
  // whichever stage created the entry first dictate order everywhere.
  const t = templateFrom(plantCatalog());
  const byId = Object.fromEntries(t.stages.map((s) => [s.stageId, s]));
  expect(byId["balloon"].defects.map((d) => d.defectCode)).toEqual(["STBL", "BLBR", "LEAK", "OTH"]);
  expect(byId["valve-integrity"].defects.map((d) => d.defectCode)).toEqual(["LEAK", "90/10", "BUB", "THSP", "OTH"]);
  expect(byId["production"].defects.map((d) => d.defectCode)).toEqual(["COAG", "RW", "SD", "OL", "BM", "WEB", "MF", "OTH"]);
});

test("a stage with no capture columns is not an entry station", () => {
  // Old resolvers minted stages from "Cummulative" sheets. You cannot type into
  // one, so it must not render — but it stays in the catalog to be deleted.
  const t = templateFrom(
    catalog({
      stages: [stage("visual", ["checked"]), stage("commulative", [])],
      defects: [defect("COAG", ["visual", "commulative"])],
    }),
  );
  expect(t.stages.map((s) => s.stageId)).toEqual(["visual"]);
});

test("codes the plant added but we don't know sort after the authored ones", () => {
  const t = templateFrom(
    catalog({
      stages: [stage("visual", ["checked"])],
      defects: [defect("ZZZ", ["visual"]), defect("SD", ["visual"]), defect("COAG", ["visual"])],
    }),
  );
  expect(t.stages[0].defects.map((d) => d.defectCode)).toEqual(["COAG", "SD", "ZZZ"]);
});
