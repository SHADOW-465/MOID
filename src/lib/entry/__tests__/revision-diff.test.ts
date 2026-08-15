import { buildRevisions, formatGap, type RevisionEventLike } from "../revision-diff";

/** One save writes several atoms under one ingestionId. */
function save(
  ingestionId: string,
  at: string,
  vals: { checked?: number; accepted?: number; rework?: number; rejected?: number; defects?: Record<string, number> },
  meta: Partial<RevisionEventLike> = {},
): RevisionEventLike[] {
  const base = { ingestionId, recordedAt: at, extractedBy: "direct-entry", ...meta };
  const out: RevisionEventLike[] = [];
  if (vals.checked != null)
    out.push({ ...base, eventId: `${ingestionId}-c`, eventType: "production", quantity: vals.checked });
  if (vals.accepted != null)
    out.push({ ...base, eventId: `${ingestionId}-a`, eventType: "inspection", disposition: "accepted", quantity: vals.accepted });
  if (vals.rework != null)
    out.push({ ...base, eventId: `${ingestionId}-h`, eventType: "inspection", disposition: "rework", quantity: vals.rework });
  if (vals.rejected != null)
    out.push({ ...base, eventId: `${ingestionId}-r`, eventType: "inspection", disposition: "rejected", quantity: vals.rejected });
  for (const [code, qty] of Object.entries(vals.defects ?? {}))
    out.push({ ...base, eventId: `${ingestionId}-d-${code}`, eventType: "rejection", defect: code, quantity: qty });
  return out;
}

test("a single entry is one revision with nothing to diff", () => {
  const revs = buildRevisions(
    save("i1", "2026-08-14T10:00:00Z", { checked: 1326, accepted: 1163, rework: 124, rejected: 39 }, { operator: "Operator A", productType: "Male 2 way" }),
  );
  expect(revs).toHaveLength(1);
  expect(revs[0].index).toBe(1);
  expect(revs[0].changes).toEqual([]);
  expect(revs[0].snapshot).toMatchObject({ checked: 1326, accepted: 1163, rework: 124, rejected: 39 });
  // productType was stored on every event and shown nowhere until now.
  expect(revs[0].productType).toBe("Male 2 way");
  expect(revs[0].operator).toBe("Operator A");
});

test("an edit reports field-level before → after with the delta", () => {
  const revs = buildRevisions([
    ...save("i1", "2026-08-14T10:00:00Z", { checked: 1326, accepted: 1163, rejected: 39 }, { isSuperseded: true }),
    ...save("i2", "2026-08-14T16:02:00Z", { checked: 1326, accepted: 1158, rejected: 44 }),
  ]);
  expect(revs).toHaveLength(2);
  expect(revs[0].isSuperseded).toBe(true);
  expect(revs[1].changes).toEqual([
    { label: "Accepted", kind: "quantity", from: 1163, to: 1158, delta: -5 },
    { label: "Rejected", kind: "quantity", from: 39, to: 44, delta: 5 },
  ]);
  // Checked did not move, so it is not noise in the diff.
  expect(revs[1].changes.some((c) => c.label === "Checked")).toBe(false);
});

test("defect counts diff by code, including one that was cleared", () => {
  const revs = buildRevisions([
    ...save("i1", "2026-08-14T10:00:00Z", { rejected: 39, defects: { BM: 9, COAG: 11, SD: 6 } }),
    ...save("i2", "2026-08-14T11:00:00Z", { rejected: 39, defects: { BM: 14, COAG: 11 } }),
  ]);
  expect(revs[1].changes).toEqual([
    { label: "BM", kind: "defect", from: 9, to: 14, delta: 5 },
    { label: "SD", kind: "defect", from: 6, to: 0, delta: -6 },
  ]);
});

test("a newly added defect shows as from-nothing", () => {
  const revs = buildRevisions([
    ...save("i1", "2026-08-14T10:00:00Z", { rejected: 10, defects: { BM: 10 } }),
    ...save("i2", "2026-08-14T11:00:00Z", { rejected: 10, defects: { BM: 10, RW: 3 } }),
  ]);
  expect(revs[1].changes).toEqual([{ label: "RW", kind: "defect", from: null, to: 3, delta: null }]);
});

test("corrections supply the reason but are not revisions themselves", () => {
  const revs = buildRevisions([
    ...save("i1", "2026-08-14T10:00:00Z", { checked: 100 }, { isSuperseded: true }),
    {
      eventId: "corr", eventType: "correction", ingestionId: "i1",
      recordedAt: "2026-08-14T11:00:00Z", reason: "Re-ingest updated this value",
    },
    ...save("i2", "2026-08-14T11:00:00Z", { checked: 120 }),
  ]);
  expect(revs).toHaveLength(2);
  expect(revs[0].supersededReason).toBe("Re-ingest updated this value");
  expect(revs[1].changes).toEqual([
    { label: "Checked", kind: "quantity", from: 100, to: 120, delta: 20 },
  ]);
});

test("revisions come back oldest first, numbered", () => {
  const revs = buildRevisions([
    ...save("i2", "2026-08-14T16:00:00Z", { checked: 2 }),
    ...save("i1", "2026-08-14T09:00:00Z", { checked: 1 }),
  ]);
  expect(revs.map((r) => r.index)).toEqual([1, 2]);
  expect(revs.map((r) => r.snapshot.checked)).toEqual([1, 2]);
});

test("the gap between revisions reads the way a person says it", () => {
  expect(formatGap("2026-08-14T10:00:00Z", "2026-08-14T10:03:00Z")).toBe("3 minutes later");
  expect(formatGap("2026-08-14T10:00:00Z", "2026-08-14T14:00:00Z")).toBe("4 hours later");
  expect(formatGap("2026-08-14T10:00:00Z", "2026-08-16T10:00:00Z")).toBe("2 days later");
  expect(formatGap(null, "2026-08-14T10:00:00Z")).toBeNull();
});
