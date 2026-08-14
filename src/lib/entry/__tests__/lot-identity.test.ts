// The multi-day invariant, in one place.
//
// A lot is opened on one day and worked across several. The batch code encodes
// the day it was OPENED; the entry date is whichever day this station ran it.
// These two have been conflated twice now, so the rule gets a test.

import { buildBatchId, parseBatchId, formatBatchIdInput } from "../batch-id";

test("the lot code is a function of lot date + size, and nothing else", () => {
  const lotDate = "2026-06-27";
  const code = buildBatchId(lotDate, "14Fr");
  expect(code).toBe("26F27-14");

  // Whatever day the station records on, the same lot date yields the same code.
  for (const recordedOn of ["2026-06-27", "2026-06-28", "2026-07-04", "2027-01-09"]) {
    expect(buildBatchId(lotDate, "14Fr")).toBe(code);
    // and the recorded day is not derivable from the code
    expect(parseBatchId(code!)?.date).toBe(lotDate);
    expect(parseBatchId(code!)?.date).not.toBe(recordedOn === lotDate ? "" : recordedOn);
  }
});

test("size is the only other input — changing it keeps the lot's date part", () => {
  const a = buildBatchId("2026-06-27", "14Fr")!;
  const b = buildBatchId("2026-06-27", "20Fr")!;
  expect(a).toBe("26F27-14");
  expect(b).toBe("26F27-20");
  expect(parseBatchId(a)?.date).toBe(parseBatchId(b)?.date);
});

test("typing a code round-trips to the lot date the popover shows", () => {
  const typed = formatBatchIdInput("26f2714");
  expect(typed).toBe("26F27-14");
  const p = parseBatchId(typed)!;
  expect(p.date).toBe("2026-06-27");
  expect(p.sizeFr).toBe("14");
  // Feeding that date straight back must reproduce the same code.
  expect(buildBatchId(p.date, `${p.sizeFr}Fr`)).toBe(typed);
});

test("a lot opened in one month and finished in the next keeps its month letter", () => {
  const code = buildBatchId("2026-06-30", "16Fr")!;
  expect(code).toBe("26F30-16");
  // Recording it on 2 July must not turn F (June) into G (July).
  expect(parseBatchId(code)!.monthIndex).toBe(5);
  expect(buildBatchId("2026-07-02", "16Fr")).toBe("26G02-16"); // a genuinely different lot
});

// The duplicate-entry half of the same invariant: one slot, one ledger entry.
import { isValidBatchId } from "../batch-id";
import { existingLedgerEntry } from "../validate-entry";

const slot = { date: "2026-08-08", stageId: "p17-visual", size: "Fr18", batchId: "26H25-18" };
const ledger = [
  {
    eventType: "production",
    extractedBy: "direct-entry",
    occurredOn: { start: "2026-08-08" },
    stageId: "p17-visual",
    size: "Fr18",
    batchNo: "26H2518", // a spelling that folds onto the canonical code
    quantity: 1326,
    provenance: { sheet: "Day Shift" },
  },
  {
    eventType: "inspection",
    disposition: "rejected",
    extractedBy: "direct-entry",
    occurredOn: { start: "2026-08-08" },
    stageId: "p17-visual",
    size: "Fr18",
    batchNo: "26H25-18",
    quantity: 39,
    provenance: { sheet: "Day Shift" },
  },
];

test("a second save on the same lot·gate·size·day is detected before it overwrites", () => {
  expect(existingLedgerEntry(ledger, slot)).toEqual({
    checked: 1326,
    rejected: 39,
    shift: "Day Shift",
  });
});

test("a different lot, gate, size or day is a different entry — no false alarm", () => {
  expect(existingLedgerEntry(ledger, { ...slot, batchId: "26H26-18" })).toBeNull();
  expect(existingLedgerEntry(ledger, { ...slot, stageId: "p18-balloon" })).toBeNull();
  expect(existingLedgerEntry(ledger, { ...slot, size: "Fr14" })).toBeNull();
  expect(existingLedgerEntry(ledger, { ...slot, date: "2026-08-09" })).toBeNull();
});

test("an unparseable lot code is rejected at save — it can never fold onto its twin", () => {
  expect(isValidBatchId("26025-18")).toBe(false); // digit where the month letter goes
  expect(isValidBatchId("26H25-18")).toBe(true);
  // and the unparseable twin never matches the real lot's entry
  expect(existingLedgerEntry(ledger, { ...slot, batchId: "26025-18" })).toBeNull();
});
