// The plant's rule, in the plant's own numbers (Jul–Aug 2026 ledger).
//
//   Primary / Secondary / Assembly are SEPARATE populations. Production checked
//   77,504 in a window where Visual checked 176,838 — a sequential line cannot
//   inspect more than it made, so they do not share a denominator.
//
//   Within a section: total rejected ÷ the section's ENTRY checked.
//   Across sections: each section's rate, added.
//
// The two figures this replaces, both wrong:
//   20.28% = 15,719 / 77,504        (everything ÷ Primary's checked)
//   10.71% = Σ each gate's own rate (Assembly's funnel counted four times)

import {
  rejectionRate,
  totalChecked,
  totalRejected,
  bySection,
  legacySumOfGateRates,
} from "../rejection";
import type { Scope } from "../scope";
import { DEFAULT_POLICY, type CalculationPolicyT } from "@/core/policy/policy";
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
const ev = (stageId: string, type: string, quantity: number, disposition?: string): Event =>
  ({
    eventId: `e${n++}`,
    eventType: type,
    ...(disposition ? { disposition } : {}),
    stageId,
    quantity,
    occurredOn: { kind: "day", start: "2026-07-15", end: "2026-07-15" },
    provenance: { file: "Manual Entry" },
    extractedBy: "direct-entry",
  }) as unknown as Event;

/** Unbatched so the cascade doesn't rewrite denominators — these are period
 *  totals, which is how the drill-down aggregates them. */
const gate = (stage: string, checked: number, rejected: number) => [
  ev(stage, "production", checked),
  ev(stage, "inspection", rejected, "rejected"),
];

const PRIMARY = gate("production", 77_504, 757);
const ASSEMBLY = [
  ...gate("visual", 176_838, 9_243),
  ...gate("balloon", 143_269, 650),
  ...gate("valve-integrity", 143_052, 2_668),
  ...gate("final", 109_761, 2_401),
];

const scope = (policy?: Partial<CalculationPolicyT>): Scope => ({
  grain: "day",
  policy: { ...DEFAULT_POLICY, ...policy },
});

const pct = (v: number) => (v * 100).toFixed(2);

test("assembly alone: total rejected over the ENTRY gate, not per-gate rates", () => {
  expect(pct(rejectionRate(ASSEMBLY, scope(), REGISTRY).value)).toBe("8.46");
  expect(totalChecked(ASSEMBLY, scope(), REGISTRY).value).toBe(176_838);
  expect(totalRejected(ASSEMBLY, scope()).value).toBe(14_962);
});

test("primary alone uses its own checked", () => {
  expect(pct(rejectionRate(PRIMARY, scope(), REGISTRY).value)).toBe("0.98");
  expect(totalChecked(PRIMARY, scope(), REGISTRY).value).toBe(77_504);
});

test("primary + assembly: section rates ADD, denominators never mix", () => {
  const all = [...PRIMARY, ...ASSEMBLY];
  // 0.98% + 8.46%
  expect(pct(rejectionRate(all, scope(), REGISTRY).value)).toBe("9.44");
  // Separate populations, so entry counts add.
  expect(totalChecked(all, scope(), REGISTRY).value).toBe(77_504 + 176_838);
  expect(totalRejected(all, scope()).value).toBe(757 + 14_962);
});

test("the two wrong answers are NOT produced by the default", () => {
  const all = [...PRIMARY, ...ASSEMBLY];
  const v = rejectionRate(all, scope(), REGISTRY).value;
  // 15,719 / 77,504 — everything over Primary's checked
  expect(pct(v)).not.toBe("20.28");
  // Σ of the five gate rates
  expect(pct(v)).not.toBe("10.71");
});

test("bySection exposes each section's own numerator and denominator", () => {
  const rows = bySection([...PRIMARY, ...ASSEMBLY], scope(), REGISTRY);
  const byKey = Object.fromEntries(rows.map((r) => [r.section, r]));

  expect(byKey.primary.entryStageId).toBe("production");
  expect(byKey.primary.checked).toBe(77_504);
  expect(byKey.primary.rejected).toBe(757);

  expect(byKey.assembly.entryStageId).toBe("visual");
  expect(byKey.assembly.checked).toBe(176_838);
  // every assembly gate, summed
  expect(byKey.assembly.rejected).toBe(14_962);
  expect(pct(byKey.assembly.rate)).toBe("8.46");
});

test("the legacy sheet figure stays reachable for comparison only", () => {
  const all = [...PRIMARY, ...ASSEMBLY];
  // What the plant rule says…
  expect(pct(rejectionRate(all, scope(), REGISTRY).value)).toBe("9.44");
  // …vs what the old YEARLY sheet printed. Never wired to a KPI.
  expect(pct(legacySumOfGateRates(all, scope(), REGISTRY))).toBe("10.71");
});

test("an unclassified stage becomes its own section rather than joining another's denominator", () => {
  const odd = [...gate("packing", 1_000, 50), ...ASSEMBLY];
  const rows = bySection(odd, scope(), REGISTRY);
  const packing = rows.find((r) => r.section === "packing");
  expect(packing?.checked).toBe(1_000);
  expect(packing?.rejected).toBe(50);
  // 5.00% + 8.46%
  expect(pct(rejectionRate(odd, scope(), REGISTRY).value)).toBe("13.46");
});
