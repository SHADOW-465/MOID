/** @jest-environment node */
import {
  isWithinShiftWindow,
  parseHm,
  DEFAULT_SHIFT_WINDOWS,
  type ShiftWindowConfig,
} from "../shift-window";
import {
  entryKey,
  hasValidGrant,
  issueGrant,
  __resetGrantsForTests,
} from "../edit-grants";

describe("parseHm", () => {
  it("parses HH:MM", () => {
    expect(parseHm("08:00")).toBe(8 * 60);
    expect(parseHm("20:00")).toBe(20 * 60);
    expect(parseHm("00:30")).toBe(30);
  });
});

describe("isWithinShiftWindow", () => {
  const cfg: ShiftWindowConfig = {
    timezone: "UTC",
    windows: { "Day Shift": { start: "08:00", end: "20:00" } },
  };

  it("is open at 08:00 UTC and closed at 20:00 UTC", () => {
    // 2026-07-28T08:00:00Z
    expect(isWithinShiftWindow("Day Shift", new Date("2026-07-28T08:00:00.000Z"), cfg)).toBe(true);
    expect(isWithinShiftWindow("Day Shift", new Date("2026-07-28T19:59:00.000Z"), cfg)).toBe(true);
    expect(isWithinShiftWindow("Day Shift", new Date("2026-07-28T20:00:00.000Z"), cfg)).toBe(false);
    expect(isWithinShiftWindow("Day Shift", new Date("2026-07-28T07:59:00.000Z"), cfg)).toBe(false);
  });

  it("unknown shift is closed", () => {
    expect(isWithinShiftWindow("Night Shift", new Date("2026-07-28T12:00:00.000Z"), cfg)).toBe(false);
  });

  it("default config includes Day Shift 08-20 Asia/Kolkata", () => {
    expect(DEFAULT_SHIFT_WINDOWS.windows["Day Shift"]).toEqual({ start: "08:00", end: "20:00" });
  });
});

describe("edit grants", () => {
  beforeEach(() => __resetGrantsForTests());

  it("issues a grant that validates until expiry", () => {
    const key = entryKey({
      date: "2026-07-28",
      batchId: "26G28-14",
      stageId: "visual",
      size: "Fr14",
      productType: "2 way",
    });
    const now = new Date("2026-07-28T21:00:00.000Z");
    expect(hasValidGrant(key, now)).toBe(false);
    issueGrant({ entryKey: key, approvedBy: "gm", now, ttlMs: 60_000 });
    expect(hasValidGrant(key, now)).toBe(true);
    expect(hasValidGrant(key, new Date(now.getTime() + 120_000))).toBe(false);
  });
});
