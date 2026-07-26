// The builder must never widen what the host page already narrowed: a chart
// under a Dashboard filtered to "visual" cannot show "final".
import { scopeFor, bestGrain, describeSpec, type ChartSpec } from "@/components/ChartBuilder";
import type { Event } from "@/lib/store/types";

const spec = (over: Partial<ChartSpec> = {}): ChartSpec => ({
  id: "s",
  metric: "rejectionRate",
  group: "stage",
  grain: "day",
  stageIds: [],
  sizes: [],
  ...over,
});

describe("ChartBuilder scope inheritance", () => {
  test("inherits the host page's date range", () => {
    const s = scopeFor(spec(), { dateFrom: "2026-01-01", dateTo: "2026-01-31" });
    expect(s.dateFrom).toBe("2026-01-01");
    expect(s.dateTo).toBe("2026-01-31");
  });

  test("own stage picks intersect the inherited View, never widen it", () => {
    const base = { stageIds: ["visual"] };
    expect(scopeFor(spec({ stageIds: ["visual", "final"] }), base).stageIds).toEqual(["visual"]);
    // A pick outside the inherited View yields nothing rather than smuggling it in.
    expect(scopeFor(spec({ stageIds: ["final"] }), base).stageIds).toEqual([]);
  });

  test("no picks falls back to whichever side is set", () => {
    expect(scopeFor(spec(), { stageIds: ["visual"] }).stageIds).toEqual(["visual"]);
    expect(scopeFor(spec({ stageIds: ["final"] }), {}).stageIds).toEqual(["final"]);
    expect(scopeFor(spec(), {}).stageIds).toBeUndefined();
  });

  test("grain only applies to time charts", () => {
    expect(scopeFor(spec({ group: "time", grain: "week" })).grain).toBe("week");
    expect(scopeFor(spec({ group: "stage", grain: "week" })).grain).toBe("month");
  });
});

describe("bestGrain", () => {
  const ev = (d: string): Event =>
    ({ eventId: d, eventType: "production", occurredOn: { kind: "day", start: d, end: d } }) as unknown as Event;

  test("picks daily when a single month holds several days", () => {
    expect(bestGrain([ev("2026-03-01"), ev("2026-03-02"), ev("2026-03-03")])).toBe("day");
  });

  test("a single day is still charted daily rather than empty", () => {
    expect(bestGrain([ev("2026-03-01")])).toBe("day");
  });
});

test("describeSpec names the chart in plain words", () => {
  expect(describeSpec(spec({ group: "time", grain: "week" }))).toBe("Rejection rate · weekly");
  expect(describeSpec(spec({ metric: "totalRejected", group: "defect" }))).toBe("Rejected qty · by defect");
});
