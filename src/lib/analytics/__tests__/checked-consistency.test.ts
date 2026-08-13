// The drill-down must report the same "checked" the dashboard computes.
//
// Real case, batch 26G04-14 at Visual on 2026-07-04:
//   production            5,930   units that entered the gate
//   inspection·rework       185   units pulled out and held
//   inspection·accepted   5,459
//   inspection·rejected     286
//
// View Source classified the rework event as "checked" and reported 6,115,
// making the rate read 286/6,115 = 4.68% against the dashboard's
// 286/5,930 = 4.82%. rejection.ts has always kept rework in its own bucket.

import {
  inferSourceKind,
  summarizeSource,
  consolidateEntries,
  rejectionRateFromSummary,
  resolvedRejectedQty,
  type SourceRow,
} from "../source-trace";
import { aggregate } from "../rejection";
import type { Event } from "@/lib/store/types";

const VISUAL = [
  { eventType: "production", quantity: 5930 },
  { eventType: "inspection", disposition: "rework", quantity: 185 },
  { eventType: "inspection", disposition: "accepted", quantity: 5459 },
  { eventType: "inspection", disposition: "rejected", quantity: 286 },
];

const asRow = (e: (typeof VISUAL)[number], i: number): SourceRow => ({
  date: "2026-07-04",
  stage: "Visual",
  stageId: "visual",
  size: "Fr14",
  type: e.eventType + (e.disposition ? `·${e.disposition}` : ""),
  kind: inferSourceKind({ eventType: e.eventType, disposition: e.disposition, defectCode: null }),
  defectCode: null,
  batch: "26G04-14",
  qty: e.quantity,
  file: "Manual Entry",
  fileHash: null,
  sheet: "Day Shift",
  cell: `ENTRY${i}`,
  isDirect: true,
});

test("a rework event is classified as rework, never as checked", () => {
  expect(inferSourceKind({ eventType: "inspection", disposition: "rework" })).toBe("rework");
  expect(inferSourceKind({ eventType: "inspection", disposition: "hold" })).toBe("rework");
  expect(inferSourceKind({ type: "inspection·rework" })).toBe("rework");
  // The three that were already right stay right.
  expect(inferSourceKind({ eventType: "production" })).toBe("checked");
  expect(inferSourceKind({ eventType: "inspection", disposition: "accepted" })).toBe("accepted");
  expect(inferSourceKind({ eventType: "inspection", disposition: "rejected" })).toBe("rejected");
});

test("View Source and the analytics engine agree on checked, accepted and rejected", () => {
  const rows = VISUAL.map(asRow);
  const summary = summarizeSource(rows, "rejection_rate");
  const engine = aggregate(VISUAL as unknown as Event[]);

  expect(summary.checkedQty).toBe(engine.checked);
  expect(summary.acceptedQty).toBe(engine.good);
  expect(summary.rejectedQty).toBe(engine.rejected);
  expect(summary.reworkQty).toBe(engine.rework);

  // The specific numbers from the reported screenshot.
  expect(summary.checkedQty).toBe(5930); // was 6115
  expect(summary.reworkQty).toBe(185);
});

test("the stage rate matches the dashboard's 4.82%, not the inflated 4.68%", () => {
  const summary = summarizeSource(VISUAL.map(asRow), "rejection_rate");
  const rate = summary.rejectedQty / summary.checkedQty;
  expect((rate * 100).toFixed(2)).toBe("4.82");
});

// View Source summed `checked` over every stage in the slice: Visual + Balloon
// + Valve + Final counted one catheter four times (572,920 against the
// dashboard's 176,838). Assembly's gates are sequential — Visual's accepted
// units are what Balloon checks — so entry is Visual's checked, once.
const gate = (stageId: string, stage: string, checked: number, rejected: number): SourceRow[] => [
  { ...asRow({ eventType: "production", quantity: checked }, 0), stageId, stage, qty: checked },
  {
    ...asRow({ eventType: "inspection", disposition: "rejected", quantity: rejected }, 1),
    stageId,
    stage,
    qty: rejected,
  },
];

const ASSEMBLY = [
  ...gate("visual", "Visual Inspection", 5930, 286),
  ...gate("balloon", "Balloon Inspection", 5459, 40),
  ...gate("valve-integrity", "Valve Integrity", 5376, 12),
  ...gate("final", "Final Inspection", 5300, 8),
];

test("checked is the entry gate's, not the sum of every gate in the slice", () => {
  const s = summarizeSource(ASSEMBLY, "rejection_rate");
  expect(s.checkedQty).toBe(5930);
  expect(s.checkedQty).not.toBe(5930 + 5459 + 5376 + 5300);
  // Rejected IS summed — four different scrapped units.
  expect(s.rejectedQty).toBe(286 + 40 + 12 + 8);
});

test("adding a section ADDS its entry count — sections are separate populations", () => {
  const withPrimary = [...gate("production", "Production", 6400, 0), ...ASSEMBLY];
  expect(summarizeSource(withPrimary, "rejection_rate").checkedQty).toBe(6400 + 5930);

  const withSecondary = [...gate("secondary", "Secondary Production", 6100, 0), ...ASSEMBLY];
  expect(summarizeSource(withSecondary, "rejection_rate").checkedQty).toBe(6100 + 5930);
});

test("sectionBreakdown gives each section its own numerator and denominator", () => {
  const withPrimary = [...gate("production", "Production", 6400, 64), ...ASSEMBLY];
  const secs = summarizeSource(withPrimary, "rejection_rate").sectionBreakdown;
  const byKey = Object.fromEntries(secs.map((x) => [x.key, x]));

  expect(byKey.primary.checkedQty).toBe(6400);
  expect(byKey.primary.rejectedQty).toBe(64);
  expect(byKey.primary.entryLabel).toBe("Production");

  expect(byKey.assembly.checkedQty).toBe(5930);
  expect(byKey.assembly.rejectedQty).toBe(286 + 40 + 12 + 8);
  expect(byKey.assembly.entryLabel).toBe("Visual Inspection");

  // 1.00% + 5.83%
  expect((secs.reduce((t, x) => t + x.rate, 0) * 100).toFixed(2)).toBe("6.83");
});

// The headline is Σ(per-gate rate), NOT rejectedQty ÷ checkedQty. With the real
// ledger those differ by more than a point (9.73% vs 8.46%), which is what made
// the panel look wrong when it showed only the two aggregates.
test("stageBreakdown carries each gate's OWN denominator and rate", () => {
  const s = summarizeSource(ASSEMBLY, "rejection_rate");
  const byKey = Object.fromEntries(s.stageBreakdown.map((g) => [g.key, g]));

  expect(byKey.visual.checkedQty).toBe(5930);
  expect(byKey.balloon.checkedQty).toBe(5459);
  expect(byKey["valve-integrity"].checkedQty).toBe(5376);
  expect(byKey.final.checkedQty).toBe(5300);

  const summed = s.stageBreakdown.reduce((t, g) => t + g.rate, 0);
  const flat = s.rejectedQty / s.checkedQty;
  // 4.82 + 0.73 + 0.22 + 0.15
  expect((summed * 100).toFixed(2)).toBe("5.93");
  expect((flat * 100).toFixed(2)).toBe("5.83");
  expect(summed).not.toBeCloseTo(flat, 4);
});

test("the entry stage is named while one section is in view, null once several are", () => {
  expect(summarizeSource(ASSEMBLY, "rejection_rate").entryStage).toBe("Visual Inspection");
  // Two sections, two denominators — no single stage can label the figure, so
  // the UI has to read sectionBreakdown instead of mislabelling it.
  const withPrimary = [...gate("production", "Production", 6400, 0), ...ASSEMBLY];
  expect(summarizeSource(withPrimary, "rejection_rate").entryStage).toBeNull();
});

test("disposition rejects and defect codes for the same units are not double-counted", () => {
  // Gate logs 286 rejected AND 286 defect-coded rows explaining them.
  const rows: SourceRow[] = [
    ...gate("visual", "Visual Inspection", 5930, 286),
    {
      ...asRow({ eventType: "inspection", disposition: "rejected", quantity: 286 }, 9),
      stageId: "visual",
      stage: "Visual Inspection",
      kind: "defect",
      defectCode: "PINHOLE",
      type: "rejection PINHOLE",
      qty: 200,
    },
    {
      ...asRow({ eventType: "inspection", disposition: "rejected", quantity: 286 }, 10),
      stageId: "visual",
      stage: "Visual Inspection",
      kind: "defect",
      defectCode: "FLASH",
      type: "rejection FLASH",
      qty: 86,
    },
  ];
  const s = summarizeSource(rows, "rejection_rate");
  expect(s.rejectedQty).toBe(286);
  expect(s.defectQty).toBe(286);
  // Mini-stat and rate numerators must use 286, not 572.
  expect(resolvedRejectedQty(s.rejectedQty, s.defectQty)).toBe(286);
  expect(s.stageBreakdown.find((g) => g.key === "visual")?.rejectedQty).toBe(286);
  expect(s.sectionBreakdown.find((g) => g.key === "assembly")?.rejectedQty).toBe(286);
});

test("rejectionRateFromSummary: COMPUTED and HOW IT ADDS UP share one formula", () => {
  // Primary 77,504 / 757 + Assembly rejects over Visual checked — plant numbers.
  const plant = [
    ...gate("production", "Production", 77_504, 757),
    ...gate("visual", "Visual Inspection", 176_838, 9_243),
    ...gate("balloon", "Balloon Inspection", 143_269, 650),
    ...gate("valve-integrity", "Valve Integrity", 143_052, 2_668),
    ...gate("final", "Final Inspection", 109_761, 2_401),
  ];
  const s = summarizeSource(plant, "rejection_rate");

  const proof = rejectionRateFromSummary(s);
  expect((proof.value * 100).toFixed(2)).toBe("9.44");
  // The displayed rows use the same unrounded sum as the headline value.
  expect(proof.sections.reduce((t, r) => t + r.rate, 0)).toBeCloseTo(proof.value, 12);

  // The legacy comparison line: every gate's own rate, added.
  expect(((proof.legacySumOfGateRates ?? 0) * 100).toFixed(2)).toBe("10.71");
});

test("the gate rows in the proof panel actually sum to the numerator", () => {
  // The old panel listed contributing gates in prose that did NOT add up to the
  // rate's numerator. Every gate shown must now account for it exactly.
  const plant = [
    ...gate("production", "Production", 77_504, 757),
    ...gate("visual", "Visual Inspection", 176_838, 9_243),
    ...gate("balloon", "Balloon Inspection", 143_269, 650),
    ...gate("valve-integrity", "Valve Integrity", 143_052, 2_668),
    ...gate("final", "Final Inspection", 109_761, 2_401),
  ];
  const { sections } = rejectionRateFromSummary(summarizeSource(plant, "rejection_rate"));

  const assembly = sections.find((s) => s.key === "assembly")!;
  expect(assembly.gates.map((g) => g.key)).toEqual([
    "visual",
    "balloon",
    "valve-integrity",
    "final",
  ]);
  expect(assembly.gates.reduce((t, g) => t + g.rejectedQty, 0)).toBe(assembly.rejectedQty);
  expect(assembly.rejectedQty).toBe(9_243 + 650 + 2_668 + 2_401);
  // …and the division shown under them is the rate shown beside them.
  expect(assembly.rejectedQty / assembly.checkedQty).toBeCloseTo(assembly.rate, 12);

  for (const sec of sections) {
    expect(sec.gates.reduce((t, g) => t + g.rejectedQty, 0)).toBe(sec.rejectedQty);
  }
});

test("stageBreakdown is in process order, not by size", () => {
  const s = summarizeSource(ASSEMBLY, "rejection_rate");
  expect(s.stageBreakdown.map((g) => g.key)).toEqual([
    "visual",
    "balloon",
    "valve-integrity",
    "final",
  ]);
});

test("entry is catalog order, not ledger order", () => {
  const shuffled = [...ASSEMBLY.slice(4), ...ASSEMBLY.slice(0, 4)];
  expect(summarizeSource(shuffled, "rejection_rate").checkedQty).toBe(5930);
});

test("a consolidated entry row keeps held units out of its checked column", () => {
  const [entry] = consolidateEntries(VISUAL.map(asRow));
  expect(entry.checkedQty).toBe(5930);
  expect(entry.reworkQty).toBe(185);
  expect(entry.acceptedQty).toBe(5459);
  expect(entry.rejectedQty).toBe(286);
});
