import { collectEntryReasons, remarksFromReasons, warningNeedsReason } from "../exception-reasons";

describe("collectEntryReasons", () => {
  it("sends a typed warning reason and a second-pass reason", () => {
    const notes = collectEntryReasons({
      warnings: [
        { code: "rejected-not-fully-explained", message: "3 pieces have no defect reason." },
        { code: "station-already-recorded", message: "Already recorded." },
      ],
      ackReasons: { "rejected-not-fully-explained": "Waiting on QC to classify" },
      pass: 2,
      passReason: "Re-inspected after hold release",
    });
    expect(notes).toEqual([
      { kind: "repeat-pass", reason: "Re-inspected after hold release" },
      {
        kind: "rejected-not-fully-explained",
        reason: "Waiting on QC to classify",
        warningMessage: "3 pieces have no defect reason.",
      },
    ]);
  });

  it("ignores blank reasons", () => {
    expect(
      collectEntryReasons({
        warnings: [{ code: "rejected-not-fully-explained", message: "gap" }],
        ackReasons: { "rejected-not-fully-explained": "  " },
        pass: 1,
        passReason: "",
      }),
    ).toEqual([]);
  });
});

describe("warningNeedsReason", () => {
  it("asks for a note only on genuine exceptions, not on a rewrite", () => {
    expect(warningNeedsReason("rejected-not-fully-explained")).toBe(true);
    expect(warningNeedsReason("station-already-recorded")).toBe(false);
    expect(warningNeedsReason("pass-without-first")).toBe(false);
  });
});

describe("remarksFromReasons", () => {
  it("appends to an existing remark", () => {
    expect(
      remarksFromReasons([{ kind: "repeat-pass", reason: "rework" }], "operator note"),
    ).toBe("operator note | repeat-pass: rework");
  });
});
