// "Checked" = units that ENTERED, measured at the most upstream in-scope stage.
//
// Primary -> Secondary -> Assembly are sequential departments handling the same
// physical catheters. Selecting an upstream section moves the measuring point
// upstream; it never adds a second one. Same reason Visual + Balloon + Valve +
// Final are not summed within Assembly.
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

const ASSEMBLY_IDS = ["visual", "balloon", "valve-integrity", "final"];
const ASSEMBLY = [prod("visual", 5930), prod("balloon", 5459), prod("valve-integrity", 2400), prod("final", 5376)];
const PRIMARY = [prod("production", 6400)];
const SECONDARY = [prod("secondary", 6100)];

const scope = (stageIds?: string[]) => ({ grain: "day" as const, ...(stageIds ? { stageIds } : {}) });

test("assembly alone is Visual's checked — the later gates are the same units", () => {
  const v = totalChecked(ASSEMBLY, scope(ASSEMBLY_IDS), REGISTRY);
  expect(v.value).toBe(5930);
  expect(v.value).not.toBe(5930 + 5459 + 2400 + 5376);
});

test("primary alone is Production's checked", () => {
  expect(totalChecked(PRIMARY, scope(["production"]), REGISTRY).value).toBe(6400);
});

test("primary + assembly measures at Production — the same tubes, further upstream", () => {
  const both = [...PRIMARY, ...ASSEMBLY];
  const v = totalChecked(both, scope(["production", ...ASSEMBLY_IDS]), REGISTRY).value;
  expect(v).toBe(6400);
  // Never the sum: the tube dipped at Production is the tube seen at Visual.
  expect(v).not.toBe(6400 + 5930);
});

test("all three sections still measure once, at the most upstream stage", () => {
  const all = [...PRIMARY, ...SECONDARY, ...ASSEMBLY];
  expect(totalChecked(all, scope(), REGISTRY).value).toBe(6400);
});

test("secondary + assembly measures at Secondary", () => {
  const both = [...SECONDARY, ...ASSEMBLY];
  expect(totalChecked(both, scope(["secondary", ...ASSEMBLY_IDS]), REGISTRY).value).toBe(6100);
});

test("entry is chosen by catalog order, not by which event happens to be first", () => {
  // The real ledger emits valve-integrity before visual for this batch.
  const shuffled = [prod("valve-integrity", 2400), prod("visual", 5930), prod("final", 5376), prod("balloon", 5459)];
  expect(totalChecked(shuffled, scope(ASSEMBLY_IDS), REGISTRY).value).toBe(5930);
});

test("a gate with no production event of its own does not become the entry", () => {
  const noVisual = [prod("balloon", 5459), prod("final", 5376)];
  expect(totalChecked(noVisual, scope(ASSEMBLY_IDS), REGISTRY).value).toBe(5459);
});
