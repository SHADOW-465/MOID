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

test("a consolidated entry row keeps held units out of its checked column", () => {
  const [entry] = consolidateEntries(VISUAL.map(asRow));
  expect(entry.checkedQty).toBe(5930);
  expect(entry.reworkQty).toBe(185);
  expect(entry.acceptedQty).toBe(5459);
  expect(entry.rejectedQty).toBe(286);
});
