// Calculation policy — the conventions behind every number, owned by the GM
// instead of buried in a code comment. See docs/CALCULATION-POLICY-PLAN.md.
//
// Not a rules engine: a fixed list of named decisions, each an enum or a
// number. Zod-validated, so no screen ever has to defend against a bad policy.
//
// Policy is a READ-TIME LENS. Changing it never touches the ledger — every
// screen just recomputes the same append-only events a different way.

import { z } from "zod";

/** Phase 1 rules only. Add a key here + a card in /settings/rules to ship more. */
export const CalculationPolicy = z.object({
  /**
   * A1 — what "the plant's rejection rate" means.
   *  sum-of-stage-rates: Visual% + Balloon% + Valve% + Final% (the plant's own
   *    REJECTION ANALYSIS / YEARLY sheets work this way)
   *  pooled: total rejected ÷ units entered
   */
  headlineRejection: z.enum(["sum-of-stage-rates", "pooled"]),

  /**
   * A2 — where "checked / entered" is measured.
   *  most-upstream: once, at the first gate in scope. Correct when gates are
   *    sequential (this plant: Visual's accepted units are Balloon's input).
   *  sum-of-gates: add every gate's checked. Only correct if gates inspect
   *    DIFFERENT units; double-counts otherwise.
   */
  checkedMeasuredAt: z.enum(["most-upstream", "sum-of-gates"]),

  /** A3 — units pulled out at a gate for rework/hold. */
  reworkCountsAs: z.enum(["excluded", "checked"]),

  /** B1 — shop-floor sections in scope before the user narrows anything. */
  defaultSections: z.array(z.enum(["primary", "secondary", "assembly"])).min(1),

  /** D1 — plant target rejection %, as a percentage (10 = 10%). */
  targetRejectionPct: z.number().min(0).max(100),

  /** D2 — the "watch" line below target, as a percentage. */
  watchRejectionPct: z.number().min(0).max(100),

  /** E1 — cost of one finished unit, INR. */
  unitCostInr: z.number().min(0),

  /** E2 — share of unit cost already sunk by each gate. stageId → 0..1. */
  stageCostWeights: z.record(z.string(), z.number().min(0).max(1)),
});

export type CalculationPolicyT = z.infer<typeof CalculationPolicy>;

/**
 * Today's hardcoded behaviour, exactly. Seeding from this is what makes
 * shipping the feature a no-op until somebody deliberately changes a rule.
 */
export const DEFAULT_POLICY: CalculationPolicyT = {
  headlineRejection: "sum-of-stage-rates", // rejection.ts rejectionRate()
  checkedMeasuredAt: "most-upstream",      // rejection.ts totalChecked()
  reworkCountsAs: "excluded",              // rejection.ts aggregate()
  defaultSections: ["assembly"],           // plant-catalog DEFAULT_STAGE_CATEGORIES
  targetRejectionPct: 10,                  // was localStorage rais_settings_target_rejection
  watchRejectionPct: 5,                    // was localStorage rais_settings_watch_rejection
  unitCostInr: 20,                         // was localStorage rais_settings_finished_cost
  stageCostWeights: {                      // was localStorage rais_settings_weight_*
    visual: 0.6,
    "eye-punching": 0.7,
    balloon: 0.8,
    "valve-integrity": 0.9,
    final: 1.0,
  },
};

/** One stored version. Latest version wins — revert = save the old values again. */
export interface PolicyVersion {
  version: number;
  policy: CalculationPolicyT;
  changedBy: string;
  changedAt: string;
  /** Why. Required on save so history is readable a year later. */
  note: string;
}

/** Never throw at a read: a malformed stored policy falls back to defaults. */
export function parsePolicy(raw: unknown): CalculationPolicyT {
  const r = CalculationPolicy.safeParse(raw);
  return r.success ? r.data : DEFAULT_POLICY;
}
