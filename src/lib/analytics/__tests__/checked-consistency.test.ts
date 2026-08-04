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

import { inferSourceKind, summarizeSource, consolidateEntries, type SourceRow } from "../source-trace";
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

test("adding an upstream section moves the measuring point, never adds one", () => {
  const withPrimary = [...gate("production", "Production", 6400, 0), ...ASSEMBLY];
  expect(summarizeSource(withPrimary, "rejection_rate").checkedQty).toBe(6400);

  const withSecondary = [...gate("secondary", "Secondary Production", 6100, 0), ...ASSEMBLY];
  expect(summarizeSource(withSecondary, "rejection_rate").checkedQty).toBe(6100);
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
