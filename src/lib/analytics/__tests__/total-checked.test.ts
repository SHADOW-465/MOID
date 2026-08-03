// "Checked" has two rules and they must not be confused:
//   within a section -> the ENTRY stage only (units flow through the gates)
//   across sections  -> SUM the section entries (separate departments)
//
// Numbers are the real ledger for batch 26G04-14 on 2026-07-04.

import { totalChecked } from "../rejection";
import type { Event } from "@/lib/store/types";

const REGISTRY = {
  // Catalog order, as /api/schema actually returns it.
  stages: [
    { stageId: "production" },
    { stageId: "secondary" },
    { stageId: "visual" },
    { stageId: "balloon" },
    { stageId: "valve-fixing" },
    { stageId: "valve-integrity" },
    { stageId: "final" },
  ],
  defects: [],
  sizes: [],
  fiscalYearStartMonth: 4,
};

let n = 0;
const prod = (stageId: string, quantity: number): Event =>
  ({
    eventId: `p${n++}`,
    eventType: "production",
    stageId,
    quantity,
    batchNo: "26G04-14",
    size: "Fr14",
    occurredOn: { kind: "day", start: "2026-07-04", end: "2026-07-04" },
    provenance: { file: "Manual Entry", sheet: "Day Shift" },
    extractedBy: "direct-entry",
  }) as unknown as Event;

const ASSEMBLY = [prod("visual", 5930), prod("balloon", 5459), prod("valve-integrity", 2400), prod("final", 5376)];
const PRIMARY = [prod("production", 6400)];
const SECONDARY = [prod("secondary", 6100)];

const scope = (stageIds?: string[]) => ({ grain: "day" as const, ...(stageIds ? { stageIds } : {}) });

test("assembly alone is Visual's checked — the later gates are the same units", () => {
  const v = totalChecked(ASSEMBLY, scope(["visual", "balloon", "valve-integrity", "final"]), REGISTRY);
  expect(v.value).toBe(5930);
  // Explicitly NOT the sum of every gate.
  expect(v.value).not.toBe(5930 + 5459 + 2400 + 5376);
});

test("primary alone is Production's checked", () => {
  expect(totalChecked(PRIMARY, scope(["production"]), REGISTRY).value).toBe(6400);
});

test("all three sections sum their entry stages", () => {
  const all = [...PRIMARY, ...SECONDARY, ...ASSEMBLY];
  // 6,400 dipped + 6,100 into secondary + 5,930 into assembly.
  expect(totalChecked(all, scope(), REGISTRY).value).toBe(6400 + 6100 + 5930);
});

test("primary + assembly sums two entries, not the earliest one alone", () => {
  const both = [...PRIMARY, ...ASSEMBLY];
  expect(totalChecked(both, scope(["production", "visual", "balloon", "valve-integrity", "final"]), REGISTRY).value)
    .toBe(6400 + 5930);
});

test("entry is chosen by catalog order, not by which event happens to be first", () => {
  // The real ledger emits valve-integrity before visual for this batch. Entry
  // must still be Visual.
  const shuffled = [prod("valve-integrity", 2400), prod("visual", 5930), prod("final", 5376), prod("balloon", 5459)];
  expect(totalChecked(shuffled, scope(["visual", "balloon", "valve-integrity", "final"]), REGISTRY).value).toBe(5930);
});

test("a gate with no production event of its own does not become the entry", () => {
  // Visual missing entirely: assembly's entry falls to the next gate that has data.
  const noVisual = [prod("balloon", 5459), prod("final", 5376)];
  expect(totalChecked(noVisual, scope(["visual", "balloon", "valve-integrity", "final"]), REGISTRY).value).toBe(5459);
});

test("unclassified stages share one bucket, so they cannot multiply the total", () => {
  const odd = [...ASSEMBLY, prod("custom-a", 999), prod("custom-b", 888)];
  // 5,930 (assembly entry) + 999 (first unclassified) — never + 888 as well.
  expect(totalChecked(odd, scope(), REGISTRY).value).toBe(5930 + 999);
});
