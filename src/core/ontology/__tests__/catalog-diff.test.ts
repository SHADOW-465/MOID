import {
  diffAgainstCatalog,
  filterIncomingForCatalogMerge,
} from "../catalog-diff";
import type { CompanyCatalog } from "../store/catalog-store";

const base: CompanyCatalog = {
  stages: [
    {
      stageId: "visual",
      label: "Visual",
      effectiveFrom: null,
      effectiveTo: null,
      upstream: [],
    },
  ],
  defects: [
    {
      defectCode: "PINH",
      label: "Pinhole",
      aliases: ["PINHOLE"],
      stages: ["visual"],
    },
  ],
  sizes: [{ sizeId: "Fr14", label: "14 FR" }],
  fiscalYearStartMonth: 4,
  updatedAt: null,
  lastMergedFrom: null,
};

describe("catalog-diff", () => {
  it("flags novel stages/defects when plant is configured", () => {
    const diff = diffAgainstCatalog(base, {
      stages: [
        base.stages[0]!,
        {
          stageId: "mystery",
          label: "Mystery",
          effectiveFrom: null,
          effectiveTo: null,
          upstream: [],
        },
      ],
      defects: [
        base.defects[0]!,
        {
          defectCode: "NEW1",
          label: "New defect",
          aliases: ["NEW"],
          stages: ["visual"],
        },
      ],
      sizes: base.sizes,
    });
    expect(diff.plantConfigured).toBe(true);
    expect(diff.novel.stages.map((s) => s.stageId)).toEqual(["mystery"]);
    expect(diff.novel.defects.map((d) => d.defectCode)).toEqual(["NEW1"]);
    expect(diff.matched.stageIds).toContain("visual");
  });

  it("filters merge to existing + accepted novel only", () => {
    const filtered = filterIncomingForCatalogMerge(
      base,
      {
        stages: [
          base.stages[0]!,
          {
            stageId: "mystery",
            label: "Mystery",
            effectiveFrom: null,
            effectiveTo: null,
            upstream: [],
          },
        ],
        defects: base.defects,
        sizes: base.sizes,
      },
      { stageIds: ["mystery"] },
    );
    expect(filtered.stages.map((s) => s.stageId).sort()).toEqual([
      "mystery",
      "visual",
    ]);
  });

  it("allows full bootstrap when plant empty", () => {
    const empty: CompanyCatalog = {
      stages: [],
      defects: [],
      sizes: [],
      fiscalYearStartMonth: 4,
      updatedAt: null,
      lastMergedFrom: null,
    };
    const incoming = {
      stages: base.stages,
      defects: base.defects,
      sizes: base.sizes,
    };
    expect(filterIncomingForCatalogMerge(empty, incoming, null)).toEqual(
      incoming,
    );
  });
});
