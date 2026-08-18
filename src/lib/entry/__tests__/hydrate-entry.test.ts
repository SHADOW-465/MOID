import { defectsFromAuditRow, hydrateFromAuditRow } from "../hydrate-entry";
import type { AuditEntryRow } from "@/lib/analytics/audit-sessions";

function row(over: Partial<AuditEntryRow> = {}): AuditEntryRow {
  return {
    id: "2026-08-17|26H17-14|visual|Fr14",
    date: "2026-08-17",
    batch: "26H17-14",
    stageId: "visual",
    size: "Fr14",
    checked: 500,
    accepted: 470,
    rejected: 20,
    rework: 10,
    defects: [
      { code: "AIR", qty: 12 },
      { code: "PH", qty: 8 },
      { code: "ZERO", qty: 0 },
    ],
    source: "manual",
    fileLabel: "Data Entry",
    recordedAt: "2026-08-17T10:00:00.000Z",
    eventIds: ["e1"],
    commentCount: 0,
    hasCorrection: false,
    revisionCount: 1,
    shifts: ["Day Shift"],
    productType: "2 way",
    ...over,
  };
}

test("hydrateFromAuditRow for edit carries the recorded quantities", () => {
  const h = hydrateFromAuditRow(row(), "edit");
  expect(h.mode).toBe("edit");
  expect(h.batchId).toBe("26H17-14");
  expect(h.date).toBe("2026-08-17");
  expect(h.stageId).toBe("visual");
  expect(h.size).toBe("14Fr");
  expect(h.checked).toBe(500);
  expect(h.accepted).toBe(470);
  expect(h.hold).toBe(10);
  expect(h.rejected).toBe(20);
  expect(h.defects).toEqual({ AIR: 12, PH: 8 });
  expect(h.shift).toBe("Day Shift");
  expect(h.editingId).toBe("ledger:2026-08-17|26H17-14|visual|Fr14");
});

test("reuse-lot still keeps the row figures so the caller can ignore them", () => {
  const h = hydrateFromAuditRow(row(), "reuse-lot");
  expect(h.mode).toBe("reuse-lot");
  expect(h.batchId).toBe("26H17-14");
  expect(h.checked).toBe(500);
});

test("defectsFromAuditRow drops zero quantities", () => {
  expect(defectsFromAuditRow({ defects: [{ code: "AIR", qty: 0 }] })).toEqual({});
});
