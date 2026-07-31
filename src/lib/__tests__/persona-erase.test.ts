import { PERSONA_ORDER, canEraseLedger, canWrite } from "../persona";
import { buildEntryRows, type AuditEventLike } from "../analytics/audit-sessions";

test("only the GM may erase ledger rows", () => {
  expect(canEraseLedger("gm")).toBe(true);
  expect(canEraseLedger("owner")).toBe(false);
  expect(canEraseLedger("operator")).toBe(false);
});

test("an operator can save but not un-save — erase is not implied by write", () => {
  expect(canWrite("operator")).toBe(true);
  expect(canEraseLedger("operator")).toBe(false);
  // No role may erase without also being able to write.
  for (const p of PERSONA_ORDER) {
    if (canEraseLedger(p)) expect(canWrite(p)).toBe(true);
  }
});

test("entry rows carry their shift so an erase can be scoped to one row", () => {
  const ev = (shift: string): AuditEventLike => ({
    eventType: "production",
    quantity: 50,
    stageId: "visual",
    batchNo: "26F27-14",
    size: "Fr14",
    occurredOn: { start: "2026-06-27", end: "2026-06-27" },
    recordedAt: "2026-06-27T08:00:00.000Z",
    provenance: { file: "Manual Entry", sheet: shift },
  });

  const [row] = buildEntryRows([ev("Night Shift"), ev("Night Shift")]);
  expect(row.shifts).toEqual(["Night Shift"]);

  // Missing provenance.sheet falls back to the same default the API matches on.
  const [bare] = buildEntryRows([{ ...ev("Day Shift"), provenance: { file: "Manual Entry" } }]);
  expect(bare.shifts).toEqual(["Day Shift"]);
});
