import { buildBatchProgress, progressFor, ASSEMBLY_GATES } from "../batch-progress";
import {
  batchFiguresInconsistent,
  filterEntryRows,
  listRowSizes,
  type AuditEventLike,
} from "../audit-sessions";

const ev = (
  batch: string,
  stageId: string,
  day: string,
  extra: Partial<AuditEventLike> = {},
): AuditEventLike => ({
  eventType: "production",
  quantity: 100,
  stageId,
  batchNo: batch,
  occurredOn: { start: day, end: day },
  recordedAt: `${day}T08:00:00.000Z`,
  ...extra,
});

test("gates come from the Assembly chain, in order", () => {
  expect(ASSEMBLY_GATES.map((g) => g.stageId)).toEqual([
    "visual",
    "balloon",
    "valve-integrity",
    "final",
  ]);
});

test("a lot entered across several days keeps one identity and accrues gates", () => {
  const map = buildBatchProgress(
    [
      ev("26F27-14", "visual", "2026-06-27"),
      ev("26f27-14", "valve-integrity", "2026-06-29", { quantity: 90 }),
      ev("26F27-14", "valve-integrity", "2026-06-29", {
        eventType: "inspection",
        disposition: "rejected",
        quantity: 6,
      }),
    ],
    { today: "2026-06-30" },
  );

  const p = progressFor(map, "26f27-14")!;
  expect(p.status).toBe("in-progress");
  expect(p.doneCount).toBe(2);
  expect(p.pct).toBe(50);
  expect(p.nextGate?.stageId).toBe("balloon"); // first gap, not the last gate
  expect(p.firstDate).toBe("2026-06-27");
  expect(p.spanDays).toBe(2);
  expect(p.steps.find((s) => s.stageId === "valve-integrity")!.rejected).toBe(6);
  expect(p.stalled).toBe(false);
});

test("all four gates → complete; nothing pending", () => {
  const map = buildBatchProgress(
    ASSEMBLY_GATES.map((g, i) => ev("26F27-14", g.stageId, `2026-06-2${7 + i}`)),
    { today: "2026-07-10" },
  );
  const p = progressFor(map, "26F27-14")!;
  expect(p.status).toBe("complete");
  expect(p.pct).toBe(100);
  expect(p.nextGate).toBeNull();
  expect(p.stalled).toBe(false); // complete is never stalled
});

test("untouched in-progress lot goes stalled past the threshold", () => {
  const map = buildBatchProgress([ev("26F27-14", "visual", "2026-06-27")], {
    today: "2026-07-05",
    stalledAfterDays: 3,
  });
  expect(progressFor(map, "26F27-14")!.stalled).toBe(true);
});

test("non-assembly stages are recorded but do not count as gates", () => {
  const map = buildBatchProgress([ev("26F27-14", "production", "2026-06-27")], {
    today: "2026-06-28",
  });
  const p = progressFor(map, "26F27-14")!;
  expect(p.status).toBe("not-started");
  expect(p.offGateStages).toEqual(["production"]);
});

test("events with no batch are skipped; unknown lot returns null", () => {
  const map = buildBatchProgress([ev("", "visual", "2026-06-27")]);
  expect(map.size).toBe(0);
  expect(progressFor(map, "26F27-14")).toBeNull();
});

test("a batch whose accepted exceeds its checked is flagged, not printed as fine", () => {
  // Real shape from the ledger: a skipped gate stops the cascade, so the last
  // gate's own larger lot count lands in acceptedQty.
  expect(batchFiguresInconsistent({ checkedQty: 2330, acceptedQty: 2353 })).toBe(true);
  expect(batchFiguresInconsistent({ checkedQty: 6350, acceptedQty: 5738 })).toBe(false);
  expect(batchFiguresInconsistent({ checkedQty: 100, acceptedQty: 100 })).toBe(false);
  // No lot in yet — nothing to contradict.
  expect(batchFiguresInconsistent({ checkedQty: 0, acceptedQty: 40 })).toBe(false);
});

test("size options are offered smallest-first and only when rows exist", () => {
  const rows = [
    { size: "Fr14" },
    { size: "Fr6" },
    { size: "Fr10" },
    { size: "Fr14" },
    { size: null },
  ] as Parameters<typeof listRowSizes>[0];
  // Fr6 before Fr10 — string sort would put "Fr10" first.
  expect(listRowSizes(rows)).toEqual(["Fr6", "Fr10", "Fr14"]);
  expect(listRowSizes([] as Parameters<typeof listRowSizes>[0])).toEqual([]);
});

test("the size filter keeps only matching rows, and 'all' keeps everything", () => {
  const row = (size: string | null, batch: string) =>
    ({
      id: `${batch}-${size}`,
      date: "2026-07-15",
      batch,
      stageId: "visual",
      size,
      checked: 10,
      accepted: 9,
      rejected: 1,
      defects: [],
      source: "manual",
      fileLabel: "Data Entry",
      recordedAt: "2026-07-15T08:00:00.000Z",
      eventIds: [],
      commentCount: 0,
      hasCorrection: false,
      shifts: ["Day Shift"],
    }) as Parameters<typeof filterEntryRows>[0][number];

  const rows = [row("Fr14", "A"), row("Fr6", "B"), row(null, "C")];
  expect(filterEntryRows(rows, { size: "Fr14" }).map((r) => r.batch)).toEqual(["A"]);
  expect(filterEntryRows(rows, { size: "all" })).toHaveLength(3);
  expect(filterEntryRows(rows, {})).toHaveLength(3);
});
