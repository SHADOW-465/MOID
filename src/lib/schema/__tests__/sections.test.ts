import { resolveSections, slugSectionId } from "../sections";

describe("resolveSections", () => {
  it("falls back to the authored three when the catalog has none", () => {
    expect(resolveSections({ sections: [], stages: [] }).map((s) => s.id)).toEqual([
      "primary",
      "secondary",
      "assembly",
    ]);
  });

  it("keeps a renamed label and surfaces unknown stage categories", () => {
    const out = resolveSections({
      sections: [{ id: "primary", label: "Dipping line" }],
      stages: [{ category: "primary" }, { category: "warehouse" }],
    });
    expect(out.find((s) => s.id === "primary")?.label).toBe("Dipping line");
    expect(out.some((s) => s.id === "warehouse")).toBe(true);
  });

  it("prefers a sectionLabel stamped on a stage when sections were not stored", () => {
    const out = resolveSections({
      sections: [],
      stages: [{ category: "primary", sectionLabel: "Dipping line" }],
    });
    expect(out.find((s) => s.id === "primary")?.label).toBe("Dipping line");
  });
});

describe("slugSectionId", () => {
  it("slugifies and avoids collisions", () => {
    expect(slugSectionId("Warehouse QC", new Set())).toBe("warehouse-qc");
    expect(slugSectionId("Warehouse QC", new Set(["warehouse-qc"]))).toBe("warehouse-qc-2");
  });
});
