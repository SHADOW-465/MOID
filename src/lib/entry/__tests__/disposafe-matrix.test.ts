import {
  defectDisplayLabel,
  defectsFor,
  MATRIX_STAGES,
  previousAssemblyStageId,
  sizesFor,
  typeIsSelectable,
  productTypeFor,
  categoryAndTypeFrom,
  ENTRY_ROLES,
  toEntryRole,
} from "@/lib/entry/disposafe-matrix";

describe("Primary Production matrix UX helpers", () => {
  test("primary defects expose a single clean title (no dual labels)", () => {
    const defs = defectsFor("primary", "");
    expect(defs.length).toBe(8);
    for (const d of defs) {
      const title = defectDisplayLabel(d);
      expect(title.length).toBeGreaterThan(0);
      // Must not look like "Name (CODE)" dual display
      expect(title).not.toMatch(/\([A-Z0-9 /-]+\)$/);
    }
    expect(defectDisplayLabel(defs.find((d) => d.key === "COAG")!)).toBe("COAG");
    expect(defectDisplayLabel(defs.find((d) => d.key === "Overlaping")!)).toBe("Overlapping");
  });

  test("assembly balloon/valve titles are single-line without parenthetical codes", () => {
    for (const d of defectsFor("assembly", "p16-balloon")) {
      expect(defectDisplayLabel(d)).not.toMatch(/\([A-Z0-9 /-]+\)$/);
    }
    for (const d of defectsFor("assembly", "p17-valve")) {
      expect(defectDisplayLabel(d)).not.toMatch(/\([A-Z0-9 /-]+\)$/);
    }
  });

  test("primary still has defects; secondary hides them", () => {
    expect(MATRIX_STAGES.primary.hideDefects).toBe(false);
    expect(MATRIX_STAGES.secondary.hideDefects).toBe(true);
    expect(defectsFor("secondary", "")).toEqual([]);
  });

  test("secondary workflow is qty+bin only (no defect schema)", () => {
    expect(MATRIX_STAGES.secondary.defects).toEqual([]);
    expect(MATRIX_STAGES.secondary.processes.length).toBeGreaterThan(0);
  });
});

describe("previousAssemblyStageId — chain order (Visual → Balloon → Valve → Final)", () => {
  test("first stage (Visual) has no predecessor", () => {
    expect(previousAssemblyStageId("p15-visual")).toBeNull();
  });

  test("Balloon's predecessor is Visual", () => {
    expect(previousAssemblyStageId("p16-balloon")).toBe("visual");
  });

  test("Valve's predecessor is Balloon", () => {
    expect(previousAssemblyStageId("p17-valve")).toBe("balloon");
  });

  test("Final's predecessor is Valve", () => {
    expect(previousAssemblyStageId("p18-final")).toBe("valve-integrity");
  });

  test("unknown micro id has no predecessor", () => {
    expect(previousAssemblyStageId("not-a-stage")).toBeNull();
  });

  test("chain matches the declared process order exactly", () => {
    const ids = MATRIX_STAGES.assembly.processes.map((p) => p.id);
    for (let i = 1; i < ids.length; i++) {
      const expected = MATRIX_STAGES.assembly.processes[i - 1].stageId;
      expect(previousAssemblyStageId(ids[i])).toBe(expected);
    }
  });
});


describe("catheter category / type / size cascade (matches the shop-floor matrix tool)", () => {
  test("Type is selectable for Male only", () => {
    expect(typeIsSelectable("Male")).toBe(true);
    expect(typeIsSelectable("Female")).toBe(false);
    expect(typeIsSelectable("Peadiatric")).toBe(false);
  });

  test("size ranges match the spec exactly", () => {
    expect(sizesFor("Male", "2 way")).toEqual([
      "6Fr", "8Fr", "10Fr", "12Fr", "14Fr", "16Fr", "18Fr", "20Fr", "22Fr", "24Fr", "26Fr", "28Fr", "30Fr",
    ]);
    expect(sizesFor("Male", "3 way")).toEqual([
      "16Fr", "18Fr", "20Fr", "22Fr", "24Fr", "26Fr", "28Fr", "30Fr",
    ]);
    expect(sizesFor("Female", "2 way")).toEqual([
      "12Fr", "14Fr", "16Fr", "18Fr", "20Fr", "22Fr", "24Fr", "26Fr", "28Fr", "30Fr",
    ]);
    expect(sizesFor("Peadiatric", "2 way")).toEqual(["6Fr", "8Fr", "10Fr"]);
  });

  test("Female/Peadiatric ignore the type argument (always the 2-way range)", () => {
    expect(sizesFor("Female", "3 way")).toEqual(sizesFor("Female", "2 way"));
    expect(sizesFor("Peadiatric", "3 way")).toEqual(sizesFor("Peadiatric", "2 way"));
  });

  test("category+type round-trip through the legacy productType string", () => {
    expect(productTypeFor("Male", "2 way")).toBe("2 way");
    expect(productTypeFor("Male", "3 way")).toBe("3 way");
    expect(productTypeFor("Female", "2 way")).toBe("Female");
    expect(productTypeFor("Peadiatric", "2 way")).toBe("Peadiatric");

    expect(categoryAndTypeFrom("3 way")).toEqual({ category: "Male", type: "3 way" });
    expect(categoryAndTypeFrom("Female")).toEqual({ category: "Female", type: "2 way" });
    expect(categoryAndTypeFrom("Peadiatric")).toEqual({ category: "Peadiatric", type: "2 way" });
    expect(categoryAndTypeFrom(undefined)).toEqual({ category: "Male", type: "2 way" });
    expect(categoryAndTypeFrom("2 way")).toEqual({ category: "Male", type: "2 way" });
  });
});

describe("entry roles", () => {
  test("the dropdown carries roles, not names", () => {
    expect(ENTRY_ROLES).toEqual(["Data Entry Operator", "Supervisor", "Production Manager", "GM"]);
  });

  test("legacy names stored on old rows coerce to the default role", () => {
    // Rows saved before this was a role list carry a person's name. Leaving one
    // in state would show a value that is not in the dropdown.
    expect(toEntryRole("MB Lakshun")).toBe("Data Entry Operator");
    expect(toEntryRole("Operator 2")).toBe("Data Entry Operator");
    expect(toEntryRole(null)).toBe("Data Entry Operator");
    expect(toEntryRole(undefined)).toBe("Data Entry Operator");
    expect(toEntryRole("")).toBe("Data Entry Operator");
  });

  test("valid roles pass through untouched", () => {
    for (const r of ENTRY_ROLES) expect(toEntryRole(r)).toBe(r);
  });
});
