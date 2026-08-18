// The 3588% dashboard.
//
// With no verified MOD the registry is empty, so every stage is derived from the
// ledger. `stagesFor` prepended them in first-APPEARANCE order, and `bySection`
// took "the first gate with checked > 0" as the section's denominator. Primary
// Pack Inspection (2,550 checked) sorted ahead of Visual (681,945), so all
// 91,496 assembly rejections divided by 2,550:
//
//     91,496 / 2,550 = 3588.08%
//
// Two things now make that unreachable: derived stages are ordered by authored
// process order, and the entry gate is chosen by `pickEntryGate`, which cannot
// return a gate holding fewer units than one downstream of it.

import { bySection, byStage, rejectionRate, totalChecked, stagesFor } from "../rejection";
import { pickEntryGate } from "@/core/ontology/plant-catalog";
import { EMPTY_REGISTRY } from "@/core/ontology/empty-registry";
import type { Scope } from "../scope";
import { DEFAULT_POLICY } from "@/core/policy/policy";
import type { Event } from "@/lib/store/types";

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

const gate = (stage: string, checked: number, rejected: number) => [
  ev(stage, "production", checked),
  ev(stage, "inspection", rejected, "rejected"),
];

const scope: Scope = { grain: "day", policy: DEFAULT_POLICY };
const pct = (v: number) => (v * 100).toFixed(2);

// The plant's real shape: the tiny gate is recorded FIRST, as it was in the
// ledger that produced the screenshot.
const PLANT = [
  ...gate("primary-pack-inspection", 2_550, 50),
  ...gate("final", 109_761, 2_401),
  ...gate("visual", 681_945, 37_655),
  ...gate("balloon", 143_269, 650),
  ...gate("valve-integrity", 143_052, 2_668),
];

test("a 2,550-unit gate cannot become the denominator for a 681,945-unit section", () => {
  const [assembly] = bySection(PLANT, scope, EMPTY_REGISTRY);
  expect(assembly.entryStageId).toBe("visual");
  expect(assembly.checked).toBe(681_945);
  expect(assembly.rejected).toBe(50 + 2_401 + 37_655 + 650 + 2_668);
});

test("the headline is a rejection rate, not 3588%", () => {
  const rate = rejectionRate(PLANT, scope, EMPTY_REGISTRY).value;
  // 43,424 rejected ÷ 681,945 checked
  expect(pct(rate)).toBe("6.37");
  expect(rate).toBeLessThan(1);
  expect(totalChecked(PLANT, scope, EMPTY_REGISTRY).value).toBe(681_945);
});

test("the answer does not depend on the order events arrive in", () => {
  const shuffled = [...PLANT.slice(6), ...PLANT.slice(0, 6)];
  const reversed = [...PLANT].reverse();
  const rate = (e: Event[]) => pct(rejectionRate(e, scope, EMPTY_REGISTRY).value);
  expect(rate(shuffled)).toBe(rate(PLANT));
  expect(rate(reversed)).toBe(rate(PLANT));
});

test("derived stages come out in process order, not first-appearance order", () => {
  // Ledger order here is deliberately backwards.
  const ids = stagesFor(PLANT, EMPTY_REGISTRY).map((s) => s.stageId);
  expect(ids).toEqual(["visual", "balloon", "valve-integrity", "final", "primary-pack-inspection"]);
});

test("no section can report a denominator smaller than one of its own gates", () => {
  // The invariant, asserted directly: a gate only ever sees what the previous
  // one passed, so nothing inside a section may exceed its entry count.
  for (const s of bySection(PLANT, scope, EMPTY_REGISTRY)) {
    expect(s.rate).toBeLessThanOrEqual(1);
  }
});

// The aggregate caches are keyed on (events, registry, policy). A key that
// missed one of those would serve another view's numbers — the failure mode is
// silent, so it gets its own check.
describe("memoization never serves the wrong answer", () => {
  // EMPTY_REGISTRY derives all 5 stages; LABELLED knows 1 and derives 4. Both
  // yield a 5-stage list, so a cache keyed on stage COUNT would collide.
  const LABELLED = {
    stages: [{ stageId: "visual", label: "Visual Inspection (P17)" }],
    defects: [],
    sizes: [],
    fiscalYearStartMonth: 4,
  };
  const visualLabel = (registry: Parameters<typeof byStage>[2]) =>
    byStage(PLANT, scope, registry).find((r) => r.stageId === "visual")?.label;

  test("a different registry recomputes", () => {
    expect(stagesFor(PLANT, EMPTY_REGISTRY)).toHaveLength(5);
    expect(stagesFor(PLANT, LABELLED)).toHaveLength(5);

    expect(visualLabel(EMPTY_REGISTRY)).toBe("Visual");
    expect(visualLabel(LABELLED)).toBe("Visual Inspection (P17)");
    // …and back, so the second call did not evict into a wrong shared slot.
    expect(visualLabel(EMPTY_REGISTRY)).toBe("Visual");
  });

  test("a different policy recomputes", () => {
    const held = [...gate("visual", 1_000, 100), ev("visual", "inspection", 200, "rework")];
    const base: Scope = { grain: "day", policy: DEFAULT_POLICY };
    const withRework: Scope = {
      grain: "day",
      policy: { ...DEFAULT_POLICY, reworkCountsAs: "checked" },
    };
    // 100/1000 vs 100/1200
    expect(pct(rejectionRate(held, base, EMPTY_REGISTRY).value)).toBe("10.00");
    expect(pct(rejectionRate(held, withRework, EMPTY_REGISTRY).value)).toBe("8.33");
    expect(pct(rejectionRate(held, base, EMPTY_REGISTRY).value)).toBe("10.00");
  });
});

describe("pickEntryGate", () => {
  test("picks the gate holding the most units", () => {
    expect(
      pickEntryGate([
        ["primary-pack-inspection", 2_550],
        ["visual", 681_945],
        ["final", 109_761],
      ]),
    ).toBe("visual");
  });

  test("ignores gates with no recorded units", () => {
    expect(
      pickEntryGate([
        ["visual", 0],
        ["balloon", 143_269],
      ]),
    ).toBe("balloon");
  });

  test("breaks ties on process order, so it never depends on iteration order", () => {
    expect(pickEntryGate([["final", 100], ["visual", 100]])).toBe("visual");
    expect(pickEntryGate([["visual", 100], ["final", 100]])).toBe("visual");
  });

  test("returns null when nothing recorded units", () => {
    expect(pickEntryGate([["visual", 0]])).toBeNull();
    expect(pickEntryGate([])).toBeNull();
  });
});
