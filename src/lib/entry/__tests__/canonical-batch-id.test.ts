// One lot, one spelling.
//
// The live ledger held these pairs as separate lots. Each pair is one physical
// batch, and the split made a completed lot read "3/4 Stalled" while the gate
// it was missing sat under the twin.

import { canonicalBatchId, isCanonicalBatchId, buildBatchId } from "../batch-id";

test("the two real collisions from the ledger fold onto one id", () => {
  // Missing hyphen — 11 events under 26G0816, 29 under 26G08-16.
  expect(canonicalBatchId("26G0816")).toBe("26G08-16");
  expect(canonicalBatchId("26G08-16")).toBe("26G08-16");

  // Zero-padded size — 7 events under 26G01-6, 29 under 26G01-06.
  expect(canonicalBatchId("26G01-06")).toBe("26G01-6");
  expect(canonicalBatchId("26G01-6")).toBe("26G01-6");
});

test("canonical form is exactly what buildBatchId writes", () => {
  for (const [date, size] of [
    ["2026-07-08", "16Fr"],
    ["2026-07-01", "6Fr"],
    ["2026-06-27", "14Fr"],
  ] as const) {
    const built = buildBatchId(date, size)!;
    expect(canonicalBatchId(built)).toBe(built);
    expect(isCanonicalBatchId(built)).toBe(true);
  }
});

test("case, whitespace, and separator variants all fold", () => {
  for (const v of ["26f27-14", " 26F27-14 ", "26F2714", "26F27_14", "26F27/14", "26F27 14"]) {
    expect(canonicalBatchId(v)).toBe("26F27-14");
  }
});

test("a single-digit day is padded, so 26G1-6 and 26G01-6 are one lot", () => {
  expect(canonicalBatchId("26G1-6")).toBe("26G01-6");
  expect(canonicalBatchId("26G01-6")).toBe("26G01-6");
});

test("a code with no size keeps its prefix rather than inventing one", () => {
  expect(canonicalBatchId("26F27")).toBe("26F27");
  expect(canonicalBatchId("26F7")).toBe("26F07");
});

test("unparseable input is preserved, never dropped", () => {
  // Grouping something odd with itself beats making its rows disappear.
  expect(canonicalBatchId("LOT-XYZ-99")).toBe("LOT-XYZ-99");
  expect(canonicalBatchId("  weird lot  ")).toBe("WEIRDLOT");
  expect(canonicalBatchId("")).toBeNull();
  expect(canonicalBatchId(null)).toBeNull();
  expect(canonicalBatchId(undefined)).toBeNull();
});

test("isCanonicalBatchId flags exactly the spellings that would split a lot", () => {
  expect(isCanonicalBatchId("26G08-16")).toBe(true);
  expect(isCanonicalBatchId("26G0816")).toBe(false);
  expect(isCanonicalBatchId("26G01-06")).toBe(false);

  // Case is NOT a collision risk — every read path uppercases already, so
  // lowercase input lands on the same lot. Warning about it would be noise.
  expect(isCanonicalBatchId("26g08-16")).toBe(true);
});
