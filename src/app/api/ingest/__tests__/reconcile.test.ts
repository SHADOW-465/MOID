// Re-ingest reconcile: totals must UPDATE, never double, never hard-delete.
// These cases are what the old Supabase DELETE block was standing in for.
process.env.MOID_STORE = "memory";

import { POST } from "../route";
import { NextRequest } from "next/server";
import { getStores } from "@/lib/store";
import type { StageDayRecord } from "@/lib/ingest/emit";

function rec(overrides: Partial<StageDayRecord> = {}): StageDayRecord {
  return {
    occurredOn: { kind: "day", start: "2026-05-04", end: "2026-05-04" },
    stageId: "visual",
    size: "Fr8",
    source: { file: "Manual Entry", fileHash: "manual", sheet: "Data Entry", tableId: "entry" },
    checked: { value: 100, cell: "ENTRY!checked", header: "Checked Qty" },
    acceptedGood: null,
    rework: null,
    rejected: { value: 10, cell: "ENTRY!rejected", header: "Rejected Qty" },
    defects: [],
    statedPct: null,
    extractedBy: "direct-entry",
    ingestionId: "ing-1",
    ...overrides,
  };
}

function post(records: StageDayRecord[], ingestionId: string) {
  return POST(
    new NextRequest("http://localhost/api/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingestionId, fileName: "test", records }),
    }),
  );
}

/** Effective (non-superseded) primary events, by type. */
async function effective(type: string) {
  const { events } = getStores();
  const all = await events.effective({});
  return all.filter((e) => e.eventType === type);
}

describe("/api/ingest reconcile", () => {
  it("updates instead of doubling when a value changes", async () => {
    await post([rec()], "ing-1");
    await post([rec({ rejected: { value: 25, cell: "ENTRY!rejected", header: "Rejected Qty" } })], "ing-2");

    const rejections = await effective("inspection");
    const rejected = rejections.filter((e) => (e as any).disposition === "rejected");
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as any).quantity).toBe(25);
  });

  it("supersedes an event the operator cleared, with no replacement", async () => {
    await post([rec({ defects: [{ raw: "COAG", value: 10, cell: "ENTRY!defect!COAG" }] })], "ing-3");
    expect(await effective("rejection")).toHaveLength(1);

    // Same slice, defect removed → the stale rejection must not survive.
    await post([rec({ defects: [] })], "ing-4");
    expect(await effective("rejection")).toHaveLength(0);
  });

  it("the removal sweep never touches workbook-extracted events", async () => {
    const day = { kind: "day" as const, start: "2026-07-10", end: "2026-07-10" };
    await post(
      [
        rec({
          occurredOn: day,
          extractedBy: "mod",
          source: { file: "sept.xlsx", fileHash: "h", sheet: "VISUAL", tableId: "t1" },
          defects: [{ raw: "PS", value: 5, cell: "F4" }],
        }),
      ],
      "ing-5",
    );
    expect(await effective("rejection")).toHaveLength(1);

    // Direct entry for the same day/stage/size, logging no defects. The PS
    // rejection is absent from this payload but belongs to the workbook's
    // slice, so it must survive.
    await post([rec({ occurredOn: day, defects: [] })], "ing-6");

    const survivors = await effective("rejection");
    expect(survivors).toHaveLength(1);
    expect(survivors[0].extractedBy).toBe("mod");
  });

  it("reconciles every date in a multi-day payload, not just the first", async () => {
    const days = ["2026-06-01", "2026-06-02", "2026-06-03"];
    await post(
      days.map((d) => rec({ occurredOn: { kind: "day", start: d, end: d } })),
      "ing-7",
    );
    await post(
      days.map((d) =>
        rec({
          occurredOn: { kind: "day", start: d, end: d },
          rejected: { value: 3, cell: "ENTRY!rejected", header: "Rejected Qty" },
        }),
      ),
      "ing-8",
    );

    const rejected = (await effective("inspection")).filter(
      (e) => (e as any).disposition === "rejected" && days.includes(e.occurredOn.start),
    );
    expect(rejected).toHaveLength(3);
    expect(rejected.every((e) => (e as any).quantity === 3)).toBe(true);
  });
});

describe("/api/manual-entries DELETE — beta erase", () => {
  it("purges an entry's events and its corrections, leaving nothing behind", async () => {
    const { DELETE } = await import("@/app/api/manual-entries/route");
    const day = { kind: "day" as const, start: "2026-08-01", end: "2026-08-01" };

    await post([rec({ occurredOn: day })], "del-1");
    // A second save produces a CorrectionEvent pointing at the first events.
    await post([rec({ occurredOn: day, rejected: { value: 2, cell: "ENTRY!rejected", header: "Rejected Qty" } })], "del-2");

    const { events } = getStores();
    const before = (await events.all({})).filter((e) => e.occurredOn.start === "2026-08-01");
    expect(before.length).toBeGreaterThan(2);

    const res = await DELETE(
      new NextRequest(
        "http://localhost/api/manual-entries?date=2026-08-01&shift=Data%20Entry&source=Direct%20Entry",
        { method: "DELETE" },
      ),
    );
    expect(res.status).toBe(200);

    const after = (await events.all({})).filter((e) => e.occurredOn.start === "2026-08-01");
    expect(after).toHaveLength(0);
  });

  it("does not touch other days", async () => {
    const { DELETE } = await import("@/app/api/manual-entries/route");
    await post([rec({ occurredOn: { kind: "day", start: "2026-08-05", end: "2026-08-05" } })], "del-3");
    await post([rec({ occurredOn: { kind: "day", start: "2026-08-06", end: "2026-08-06" } })], "del-4");

    await DELETE(
      new NextRequest(
        "http://localhost/api/manual-entries?date=2026-08-05&shift=Data%20Entry&source=Direct%20Entry",
        { method: "DELETE" },
      ),
    );

    const { events } = getStores();
    const all = await events.all({});
    expect(all.filter((e) => e.occurredOn.start === "2026-08-05")).toHaveLength(0);
    expect(all.filter((e) => e.occurredOn.start === "2026-08-06").length).toBeGreaterThan(0);
  });

  it("matches Direct Entry even when file is Manual Entry (batch matrix)", async () => {
    const { DELETE } = await import("@/app/api/manual-entries/route");
    await post(
      [
        rec({
          occurredOn: { kind: "day", start: "2026-08-10", end: "2026-08-10" },
          source: { file: "Manual Entry", fileHash: "manual", sheet: "Day Shift", tableId: "batch-matrix" },
          customFields: { batch: "26G27-14", operator: "op" },
        }),
      ],
      "del-batch-1",
    );

    const res = await DELETE(
      new NextRequest(
        "http://localhost/api/manual-entries?date=2026-08-10&shift=Day%20Shift&source=Direct%20Entry&batch=26G27-14",
        { method: "DELETE" },
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deletedCount).toBeGreaterThan(0);

    const { events } = getStores();
    const left = (await events.all({})).filter((e) => (e as any).batchNo === "26G27-14" || (e as any).customFields?.batch === "26G27-14");
    expect(left).toHaveLength(0);
  });

  it("purges an orphan batch by batch id alone", async () => {
    const { DELETE } = await import("@/app/api/manual-entries/route");
    await post(
      [
        rec({
          occurredOn: { kind: "day", start: "2026-08-11", end: "2026-08-11" },
          source: { file: "Manual Entry", fileHash: "m", sheet: "A", tableId: "batch-matrix" },
          customFields: { batch: "26G27-14" },
        }),
      ],
      "del-orphan-1",
    );

    const res = await DELETE(
      new NextRequest(
        "http://localhost/api/manual-entries?batch=26G27-14&source=Direct%20Entry",
        { method: "DELETE" },
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deletedCount).toBeGreaterThan(0);

    const { events } = getStores();
    const left = (await events.effective({})).filter(
      (e) => String((e as any).batchNo ?? (e as any).customFields?.batch ?? "").toUpperCase() === "26G27-14",
    );
    expect(left).toHaveLength(0);
  });

  it("deletes only the targeted batch when two share a day", async () => {
    const { DELETE } = await import("@/app/api/manual-entries/route");
    await post(
      [
        rec({
          occurredOn: { kind: "day", start: "2026-08-12", end: "2026-08-12" },
          source: { file: "Manual Entry", fileHash: "m1", sheet: "Day Shift", tableId: "batch-matrix" },
          customFields: { batch: "26G27-14" },
        }),
      ],
      "two-a",
    );
    await post(
      [
        rec({
          occurredOn: { kind: "day", start: "2026-08-12", end: "2026-08-12" },
          stageId: "balloon",
          source: { file: "Manual Entry", fileHash: "m2", sheet: "Day Shift", tableId: "batch-matrix" },
          customFields: { batch: "26G28-16" },
        }),
      ],
      "two-b",
    );

    await DELETE(
      new NextRequest(
        "http://localhost/api/manual-entries?date=2026-08-12&shift=Day%20Shift&source=Direct%20Entry&batch=26G27-14",
        { method: "DELETE" },
      ),
    );

    const { events } = getStores();
    const all = await events.effective({});
    const batches = new Set(
      all
        .map((e) => String((e as any).batchNo ?? (e as any).customFields?.batch ?? "").toUpperCase())
        .filter(Boolean),
    );
    expect(batches.has("26G27-14")).toBe(false);
    expect(batches.has("26G28-16")).toBe(true);
  });
});
