// "Checked" = units that ENTERED, measured once per SECTION at that section's
// entry gate, then added across sections.
//
// Within Assembly the gates ARE sequential — Visual's accepted units are what
// Balloon checks — so Visual + Balloon + Valve + Final is never summed.
// Across sections nothing is shared: Primary and Assembly are separate
// populations (the live ledger shows Production 77,504 against Visual 176,838
// in one window, which a single sequential line cannot do), so their entry
// counts add.
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

test("primary + assembly adds the two sections' entry counts", () => {
  const both = [...PRIMARY, ...ASSEMBLY];
  const v = totalChecked(both, scope(["production", ...ASSEMBLY_IDS]), REGISTRY).value;
  expect(v).toBe(6400 + 5930);
  // Not one section's denominator standing in for both.
  expect(v).not.toBe(6400);
});

test("all three sections add, each measured once at its own entry", () => {
  const all = [...PRIMARY, ...SECONDARY, ...ASSEMBLY];
  expect(totalChecked(all, scope(), REGISTRY).value).toBe(6400 + 6100 + 5930);
});

test("secondary + assembly adds Secondary's entry to Assembly's", () => {
  const both = [...SECONDARY, ...ASSEMBLY];
  expect(totalChecked(both, scope(["secondary", ...ASSEMBLY_IDS]), REGISTRY).value).toBe(6100 + 5930);
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
