import { previewCatalogAction } from "../catalog-preview";

const catalog = {
  stages: [
    { stageId: "production", label: "Dipping", category: "primary", captures: ["checked", "rejected"] },
    { stageId: "visual", label: "Visual", category: "assembly", captures: ["checked"] },
  ],
  defects: [
    { defectCode: "AIR", label: "Air", stages: ["production", "visual"] },
    { defectCode: "PH", label: "Pin Hole", stages: ["visual"] },
  ],
  sizes: [{ sizeId: "Fr16", label: "16 FR" }],
  sections: [
    { id: "primary", label: "Production Dipping" },
    { id: "empty", label: "Empty" },
  ],
};

describe("previewCatalogAction", () => {
  it("removes a deleted stage and unscopes defects", () => {
    const next = previewCatalogAction(catalog, { action: "delete-stage", id: "visual" });
    expect(next?.stages.map((s) => s.stageId)).toEqual(["production"]);
    expect(next?.defects.find((d) => d.defectCode === "AIR")?.stages).toEqual(["production"]);
    expect(next?.defects.find((d) => d.defectCode === "PH")?.stages).toEqual([]);
  });

  it("removes a deleted defect", () => {
    const next = previewCatalogAction(catalog, { action: "delete-defect", id: "AIR" });
    expect(next?.defects.map((d) => d.defectCode)).toEqual(["PH"]);
  });

  it("unscope via upsert-defect updates stages in place", () => {
    const next = previewCatalogAction(catalog, {
      action: "upsert-defect",
      defect: { defectCode: "AIR", label: "Air", stages: ["production"] },
    });
    expect(next?.defects.find((d) => d.defectCode === "AIR")?.stages).toEqual(["production"]);
  });

  it("drops a capture via upsert-stage", () => {
    const next = previewCatalogAction(catalog, {
      action: "upsert-stage",
      stage: {
        stageId: "production",
        label: "Dipping",
        category: "primary",
        captures: ["checked"],
      },
    });
    expect(next?.stages.find((s) => s.stageId === "production")?.captures).toEqual(["checked"]);
  });

  it("returns null for mapping edits so the caller keeps the last catalog", () => {
    expect(previewCatalogAction(catalog, { action: "delete-mapping", key: "x" })).toBeNull();
  });
});
