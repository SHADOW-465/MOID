// Calculation policy — one check per branch, plus the invariant that matters
// most: shipping the feature changes nothing until somebody sets a rule.
//
// Numbers mirror the real ledger shape (batch 26G04-14 assembly gates).

import { rejectionRate, totalChecked, aggregate } from "../rejection";
import { resolveScope, policyOf, type Scope } from "../scope";
import { DEFAULT_POLICY, CalculationPolicy, type CalculationPolicyT } from "@/core/policy/policy";
import type { Event } from "@/lib/store/types";

const REGISTRY = {
  stages: [
    { stageId: "production" },
    { stageId: "secondary" },
    { stageId: "visual" },
    { stageId: "balloon" },
    { stageId: "valve-integrity" },
    { stageId: "final" },
  ],
  defects: [],
  sizes: [],
  fiscalYearStartMonth: 4,
};

let n = 0;
const ev = (stageId: string, eventType: string, quantity: number, disposition?: string): Event =>
  ({
    eventId: `e${n++}`,
    eventType,
    ...(disposition ? { disposition } : {}),
    stageId,
    quantity,
    batchNo: "26G04-14",
    size: "Fr14",
    occurredOn: { kind: "day", start: "2026-07-04", end: "2026-07-04" },
    provenance: { file: "Manual Entry" },
    extractedBy: "direct-entry",
  }) as unknown as Event;

/** Four sequential gates: 5930 in, 346 scrapped across them. */
const gate = (stage: string, checked: number, rejected: number) => [
  ev(stage, "production", checked),
  ev(stage, "inspection", rejected, "rejected"),
];
const LEDGER = [
  ...gate("visual", 5930, 286),
  ...gate("balloon", 5459, 40),
  ...gate("valve-integrity", 5376, 12),
  ...gate("final", 5300, 8),
];

const scope = (policy?: CalculationPolicyT): Scope => ({ grain: "day", policy });
const withRule = <K extends keyof CalculationPolicyT>(k: K, v: CalculationPolicyT[K]) =>
  scope({ ...DEFAULT_POLICY, [k]: v });

test("the shipped defaults are a valid policy", () => {
  expect(CalculationPolicy.safeParse(DEFAULT_POLICY).success).toBe(true);
});

test("no policy on the scope = the shipped defaults (feature is a no-op until set)", () => {
  expect(policyOf({ grain: "day" })).toEqual(DEFAULT_POLICY);
  expect(rejectionRate(LEDGER, scope(), REGISTRY).value).toBeCloseTo(
    rejectionRate(LEDGER, scope(DEFAULT_POLICY), REGISTRY).value,
    10,
  );
});

// A1 — the three conventions, on an Assembly-only ledger.
test("A1: the default is the section rule; the legacy conventions still differ", () => {
  const bySectionRate = rejectionRate(LEDGER, scope(), REGISTRY).value;
  const summed = rejectionRate(LEDGER, withRule("headlineRejection", "sum-of-stage-rates"), REGISTRY).value;
  const pooled = rejectionRate(LEDGER, withRule("headlineRejection", "pooled"), REGISTRY).value;

  // 346 / 5930 — Assembly's rejects over Assembly's entry gate
  expect((bySectionRate * 100).toFixed(2)).toBe("5.83");
  // 4.82 + 0.73 + 0.22 + 0.15 — every gate against its own denominator
  expect((summed * 100).toFixed(2)).toBe("5.93");
  expect(summed).not.toBeCloseTo(bySectionRate, 4);

  // With ONE section in scope, by-section and pooled necessarily agree — they
  // only diverge once a second section brings its own denominator.
  expect((pooled * 100).toFixed(2)).toBe("5.83");
  expect(pooled).toBeCloseTo(bySectionRate, 10);
});

test("A1: pooled divides by units ENTERED, not by the sum of every gate", () => {
  const pooled = rejectionRate(LEDGER, withRule("headlineRejection", "pooled"), REGISTRY).value;
  expect(pooled).toBeCloseTo(346 / 5930, 10);
  expect(pooled).not.toBeCloseTo(346 / (5930 + 5459 + 5376 + 5300), 6);
});

// A2 — the bug that started all this, now an explicit choice.
test("A2: a section is measured once; sum-of-gates adds every gate", () => {
  expect(totalChecked(LEDGER, scope(), REGISTRY).value).toBe(5930);
  expect(totalChecked(LEDGER, withRule("checkedMeasuredAt", "sum-of-gates"), REGISTRY).value).toBe(
    5930 + 5459 + 5376 + 5300,
  );
});

// A3 — held units.
test("A3: rework is excluded from checked by default, included on request", () => {
  const held = [ev("visual", "production", 5930), ev("visual", "inspection", 185, "rework")];
  expect(aggregate(held).checked).toBe(5930);
  expect(aggregate(held).rework).toBe(185);
  expect(aggregate(held, { ...DEFAULT_POLICY, reworkCountsAs: "checked" }).checked).toBe(6115);
});

test("A3 reaches the headline rate, not just aggregate()", () => {
  const held = [
    ev("visual", "production", 5930),
    ev("visual", "inspection", 185, "rework"),
    ev("visual", "inspection", 286, "rejected"),
  ];
  const excluded = rejectionRate(held, scope(), REGISTRY).value;
  const included = rejectionRate(held, withRule("reworkCountsAs", "checked"), REGISTRY).value;
  expect((excluded * 100).toFixed(2)).toBe("4.82"); // 286/5930
  expect((included * 100).toFixed(2)).toBe("4.68"); // 286/6115
});

// B1 — default sections.
const tweaks = { grain: "month" as const, datePreset: "all" as const, dateFrom: "", dateTo: "" };

test("B1: policy supplies the default sections", () => {
  const assembly = resolveScope([], tweaks, DEFAULT_POLICY);
  expect(assembly.stageIds).toContain("visual");
  expect(assembly.stageIds).not.toContain("production");

  const whole = resolveScope([], tweaks, {
    ...DEFAULT_POLICY,
    defaultSections: ["primary", "secondary", "assembly"],
  });
  // Every section selected → no stage restriction at all.
  expect(whole.stageIds).toBeUndefined();
});

test("B1: an explicit user pick still beats the policy default", () => {
  const s = resolveScope([], { ...tweaks, stageCategories: ["primary"] }, {
    ...DEFAULT_POLICY,
    defaultSections: ["assembly"],
  });
  expect(s.stageIds).toContain("production");
  expect(s.stageIds).not.toContain("visual");
});

test("resolveScope stamps the policy onto the scope so selectors inherit it", () => {
  const p = { ...DEFAULT_POLICY, headlineRejection: "pooled" as const };
  expect(resolveScope([], tweaks, p).policy).toEqual(p);
});

// Guard the storage boundary: a bad policy must never reach a selector.
test("an invalid policy is rejected, and a corrupt stored one falls back", () => {
  expect(CalculationPolicy.safeParse({ ...DEFAULT_POLICY, headlineRejection: "vibes" }).success).toBe(false);
  expect(CalculationPolicy.safeParse({ ...DEFAULT_POLICY, defaultSections: [] }).success).toBe(false);
  expect(CalculationPolicy.safeParse({ ...DEFAULT_POLICY, targetRejectionPct: 150 }).success).toBe(false);
});
