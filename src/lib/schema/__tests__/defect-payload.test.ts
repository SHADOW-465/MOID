import { aliasesForDefect, mergeDefectForAdd } from "../defect-payload";

describe("aliasesForDefect", () => {
  it("uses the code as the first alias when none are given", () => {
    expect(aliasesForDefect("AIR")).toEqual(["AIR"]);
    expect(aliasesForDefect("AIR", [])).toEqual(["AIR"]);
  });

  it("keeps extra aliases and does not duplicate the code", () => {
    expect(aliasesForDefect("AIR", ["air bubble", "AIR"])).toEqual(["air bubble", "AIR"]);
  });
});

describe("mergeDefectForAdd", () => {
  it("unions stages so adding a code to Production does not unscope Visual", () => {
    const merged = mergeDefectForAdd(
      { defectCode: "COAG", label: "Coagulum", aliases: ["COAG"], stages: ["visual", "final"] },
      { defectCode: "COAG", label: "Coagulum", stages: ["production"] },
    );
    expect(merged.stages.sort()).toEqual(["final", "production", "visual"]);
    expect(merged.label).toBe("Coagulum");
  });

  it("creates a new defect when the code is unknown", () => {
    const merged = mergeDefectForAdd(undefined, {
      defectCode: "ZZ",
      label: "New nick",
      stages: ["production"],
    });
    expect(merged).toEqual({
      defectCode: "ZZ",
      label: "New nick",
      aliases: ["ZZ"],
      stages: ["production"],
    });
  });
});
