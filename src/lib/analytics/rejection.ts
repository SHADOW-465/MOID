// Core rejection selectors (plan 02). Deterministic; the only place these
// numbers are computed. Screens import these — never recompute inline.

import type { Event } from "@/lib/store/types";
import { type Scope, scopeEvents, periodKey, periodLabel, periodsIn, policyOf } from "./scope";
import { DEFAULT_POLICY, type CalculationPolicyT } from "@/core/policy/policy";
import { STAGE_CATEGORY } from "@/core/ontology/plant-catalog";

/** Structural catalog type — the caller's MOD catalog (or a test fixture). */
export type Registry = { stages: any[]; defects: any[]; sizes: any[]; fiscalYearStartMonth: number };

/** No catalog given → derive the stage list from the events themselves
 *  (first-appearance order). Never a hardcoded company (MOD v2 Phase 5). */
export const DERIVED_REGISTRY: Registry = { stages: [], defects: [], sizes: [], fiscalYearStartMonth: 4 };

/**
 * Stage list for every metric: the catalog's stages UNION the stages that
 * actually appear in the ledger.
 *
 * The catalog only knows what a verified MOD taught it — i.e. the Excel
 * workbooks, which cover the assembly gates (Visual/Balloon/Valve/Final).
 * Direct entry also writes upstream stages ("production", "secondary") that no
 * workbook ever described. Dropping those made the dashboard disagree with the
 * report; counting them is the precise figure.
 *
 * ponytail: event-only stages are PREPENDED — anything Excel never described is
 * upstream of the gates at this plant. If a downstream stage ever arrives the
 * same way, give the catalog an explicit order instead of guessing here.
 */
export function stagesFor(events: Event[], registry: Registry = DERIVED_REGISTRY): { stageId: string; label?: string }[] {
  const known = new Set(registry.stages.map((s: any) => s.stageId));
  const seen = new Set<string>();
  const derived: { stageId: string; label: string }[] = [];
  for (const e of events) {
    const id = stageOf(e);
    if (id && !known.has(id) && !seen.has(id)) {
      seen.add(id);
      derived.push({ stageId: id, label: id.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) });
    }
  }
  return [...derived, ...registry.stages];
}

function qty(e: Event): number {
  return "quantity" in e ? (e.quantity as number) : 0;
}
const isProd = (e: Event) => e.eventType === "production";
const isRej = (e: Event) => e.eventType === "inspection" && (e as any).disposition === "rejected";
const isAcc = (e: Event) => e.eventType === "inspection" && (e as any).disposition === "accepted";
const isRew = (e: Event) => e.eventType === "inspection" && (e as any).disposition === "rework";

export interface StageAgg {
  checked: number;
  good: number;
  rework: number;
  rejected: number;
}

/** Sum the four disposition quantities over an event set. `rejected` falls back
 *  to per-defect rejection events when no stated inspection(rejected) exists.
 *
 *  A3 (`reworkCountsAs`): held/reworked units are pulled OUT of the flow at a
 *  gate, so by default they are not units that entered it. A plant that
 *  re-inspects and returns them to the same gate can count them as checked. */
export function aggregate(events: Event[], policy: CalculationPolicyT = DEFAULT_POLICY): StageAgg {
  let checked = 0, good = 0, rework = 0, rejected = 0, defectRej = 0;
  for (const e of events) {
    if (isProd(e)) checked += qty(e);
    else if (isRej(e)) rejected += qty(e);
    else if (isAcc(e)) good += qty(e);
    else if (isRew(e)) rework += qty(e);
    else if (e.eventType === "rejection") defectRej += qty(e);
  }
  if (rejected === 0 && defectRej > 0) rejected = defectRej;
  if (policy.reworkCountsAs === "checked") checked += rework;
  return { checked, good, rework, rejected };
}

export interface MetricValue {
  value: number;
  sourceEventIds: string[];
}

function ids(events: Event[], pred: (e: Event) => boolean): string[] {
  return events.filter(pred).map((e) => e.eventId);
}

const stageOf = (e: Event) => ("stageId" in e ? ((e as any).stageId as string) : null);

/**
 * Batch-aware stage aggregator with dynamic multi-stage yield input cascading.
 * If a batch's raw Stage 2 production event states initial batch lot size (e.g. 400),
 * but Stage 1 only passed forward 120 units, Stage 2's input denominator is dynamically
 * evaluated as 120 for accurate stage rejection rates.
 */
function batchCascadedAgg(
  events: Event[],
  registry: Registry = DERIVED_REGISTRY,
  policy: CalculationPolicyT = DEFAULT_POLICY,
): Map<string, StageAgg> {
  const stageList = stagesFor(events, registry).map((s) => s.stageId);
  const byStageResult = new Map<string, StageAgg>();
  for (const s of stageList) {
    byStageResult.set(s, { checked: 0, good: 0, rework: 0, rejected: 0 });
  }

  // Group events by batch
  const byBatch = new Map<string, Event[]>();
  const unbatched: Event[] = [];
  for (const e of events) {
    const b = "batchNo" in e ? (e as any).batchNo : (e as any).customFields?.batch;
    if (typeof b === "string" && b.trim()) {
      const k = b.trim();
      (byBatch.get(k) ?? byBatch.set(k, []).get(k)!).push(e);
    } else {
      unbatched.push(e);
    }
  }

  // Handle unbatched events normally
  for (const s of stageList) {
    const a = aggregate(unbatched.filter((e) => stageOf(e) === s), policy);
    const cur = byStageResult.get(s)!;
    cur.checked += a.checked;
    cur.good += a.good;
    cur.rework += a.rework;
    cur.rejected += a.rejected;
  }

  // Handle batched events with cascading yield
  for (const [, bevents] of byBatch) {
    const presentStages = stageList.filter((sid) => bevents.some((e) => stageOf(e) === sid));
    let initialBatchChecked = 0;
    let prevAccepted: number | null = null;

    for (let i = 0; i < presentStages.length; i++) {
      const sid = presentStages[i];
      const a = aggregate(bevents.filter((e) => stageOf(e) === sid), policy);
      if (i === 0) {
        initialBatchChecked = a.checked;
      }

      let checked = a.checked;
      let good = a.good > 0 ? a.good : Math.max(0, checked - a.rejected);

      if (i > 0 && prevAccepted != null && prevAccepted > 0) {
        if (checked === initialBatchChecked || checked === 0) {
          checked = prevAccepted;
          good = Math.max(0, checked - a.rejected);
        }
      }

      prevAccepted = good;

      const cur = byStageResult.get(sid);
      if (cur) {
        cur.checked += checked;
        cur.good += good;
        cur.rework += a.rework;
        cur.rejected += a.rejected;
      }
    }
  }

  return byStageResult;
}

/** Per-stage {checked, rejected, rate} in registry order, over an event set.
 *  The funnel must NOT be summed across stages — a unit inspected at Visual,
 *  Balloon, Valve and Final is the *same* unit, so a naïve Σ-checked across
 *  stages inflates the denominator ~4×. Each stage is aggregated independently
 *  here; headline metrics are composed from these per-stage numbers. */
function perStageAgg(
  events: Event[],
  registry: Registry,
  policy: CalculationPolicyT = DEFAULT_POLICY,
): { stageId: string; checked: number; rejected: number; rate: number }[] {
  const aggregatedMap = batchCascadedAgg(events, registry, policy);
  return stagesFor(events, registry).map((s) => {
    const a = aggregatedMap.get(s.stageId) ?? { checked: 0, good: 0, rework: 0, rejected: 0 };
    return { stageId: s.stageId, checked: a.checked, rejected: a.rejected, rate: a.checked > 0 ? a.rejected / a.checked : 0 };
  });
}

/**
 * Per-SECTION aggregate — the plant's real unit of computation.
 *
 * Primary, Secondary and Assembly are separate populations, not one sequential
 * line. The ledger proves it: Production checked 77,504 in a window where
 * Visual checked 176,838, and a sequential line cannot inspect more than it
 * made. Each section therefore carries its own denominator.
 *
 * Within a section:
 *   checked  = the section's ENTRY gate (first in catalog order with data).
 *              Assembly's gates ARE sequential — Visual's accepted units are
 *              what Balloon checks — so the section is measured once, at Visual.
 *   rejected = every gate in the section, summed. A unit scrapped at Visual and
 *              another at Final are two different units.
 *
 * Across sections nothing is shared: rates are computed per section and added.
 */
export interface SectionAgg {
  section: string;
  entryStageId: string | null;
  checked: number;
  rejected: number;
  rate: number;
}

export function bySection(
  events: Event[],
  scope: Scope,
  registry: Registry = DERIVED_REGISTRY,
): SectionAgg[] {
  const ev = scopeEvents(events, scope);
  const policy = policyOf(scope);
  const stages = perStageAgg(ev, registry, policy);

  const order: string[] = [];
  const acc = new Map<string, SectionAgg>();
  for (const s of stages) {
    // A stage the catalog doesn't classify is its own section — never silently
    // folded into someone else's denominator.
    const section = STAGE_CATEGORY[s.stageId] ?? s.stageId;
    let cur = acc.get(section);
    if (!cur) {
      cur = { section, entryStageId: null, checked: 0, rejected: 0, rate: 0 };
      acc.set(section, cur);
      order.push(section);
    }
    // perStageAgg is already in catalog order, so the first gate with a checked
    // qty is the section's entry.
    if (cur.entryStageId === null && s.checked > 0) {
      cur.entryStageId = s.stageId;
      cur.checked = s.checked;
    }
    cur.rejected += s.rejected;
  }

  return order.map((k) => {
    const a = acc.get(k)!;
    return { ...a, rate: a.checked > 0 ? a.rejected / a.checked : 0 };
  });
}

/** Headline "Total Rejection %". Default is the plant's rule: each section's
 *  own rejected ÷ its own checked, summed across sections. */
export function rejectionRate(events: Event[], scope: Scope, registry: Registry = DERIVED_REGISTRY): MetricValue {
  const ev = scopeEvents(events, scope);
  const policy = policyOf(scope);

  let value = 0;
  if (policy.headlineRejection === "by-section") {
    // The plant's rule. Assembly alone: 14,962 / 176,838 = 8.46%.
    // Primary + Assembly: 0.98% + 8.46% = 9.44%.
    value = bySection(events, scope, registry).reduce((sum, s) => sum + s.rate, 0);
  } else if (policy.headlineRejection === "pooled") {
    // Every rejected unit over ONE denominator. Only defensible when a single
    // section is in scope — across sections it divides Assembly's rejects by
    // Primary's checked.
    const entered = totalChecked(events, scope, registry).value;
    value = entered > 0 ? aggregate(ev, policy).rejected / entered : 0;
  } else {
    // Every gate against its own denominator, summed — the plant's older
    // REJECTION ANALYSIS / YEARLY sheet convention. Counts Assembly's funnel
    // four times over.
    value = perStageAgg(ev, registry, policy).reduce((sum, s) => sum + s.rate, 0);
  }
  return { value, sourceEventIds: ids(ev, (e) => isProd(e) || isRej(e)) };
}

/** Total rejected units across every stage (a raw count, not a rate). */
export function totalRejected(events: Event[], scope: Scope): MetricValue {
  const ev = scopeEvents(events, scope);
  return { value: aggregate(ev, policyOf(scope)).rejected, sourceEventIds: ids(ev, (e) => isRej(e) || e.eventType === "rejection") };
}

/**
 * Units that entered.
 *
 * Sections are separate populations (see `bySection`), so their entry counts
 * ADD: Primary 77,504 + Assembly 176,838 = 254,342. Within a section the gates
 * are sequential, so the section is still measured once, at its entry gate —
 * never Visual + Balloon + Valve + Final.
 *
 * "Entry" means first in catalog order (production, …, visual, balloon,
 * valve-fixing, valve-integrity, final), not first to appear in the ledger —
 * the ledger emits a batch's gates in arbitrary order.
 *
 * Total Rejected is summed unconditionally: a unit scrapped at Visual and
 * another at Final are two different units.
 */
export function totalChecked(events: Event[], scope: Scope, registry: Registry = DERIVED_REGISTRY): MetricValue {
  const ev = scopeEvents(events, scope);
  const policy = policyOf(scope);
  const stages = perStageAgg(ev, registry, policy);

  // Every gate added together. Only correct if gates inspect DIFFERENT units;
  // within a section they do not.
  if (policy.checkedMeasuredAt === "sum-of-gates") {
    return {
      value: stages.reduce((sum, s) => sum + s.checked, 0),
      sourceEventIds: ids(ev, isProd),
    };
  }

  // One denominator for the whole scope — the most upstream gate anywhere.
  // Correct only while a single section is in view.
  if (policy.checkedMeasuredAt === "most-upstream") {
    const entry = stages.find((s) => s.checked > 0);
    return {
      value: entry?.checked ?? 0,
      sourceEventIds: ids(ev, (e) => isProd(e) && stageOf(e) === (entry?.stageId ?? null)),
    };
  }

  // Default — each section measured once at its own entry gate, then added.
  const sections = bySection(events, scope, registry);
  const entryIds = new Set(sections.map((s) => s.entryStageId).filter(Boolean) as string[]);
  return {
    value: sections.reduce((sum, s) => sum + s.checked, 0),
    sourceEventIds: ids(ev, (e) => isProd(e) && entryIds.has(stageOf(e) ?? "")),
  };
}

/** First Pass Yield = rolled-throughput yield Π(1 − stageRate) across stages —
 *  the fraction of entering units that pass every stage without rejection. */
export function fpy(events: Event[], scope: Scope, registry: Registry = DERIVED_REGISTRY): MetricValue {
  const ev = scopeEvents(events, scope);
  const stages = perStageAgg(ev, registry, policyOf(scope)).filter((s) => s.checked > 0);
  if (stages.length === 0) return { value: 1, sourceEventIds: [] };
  const value = stages.reduce((y, s) => y * (1 - s.rate), 1);
  return { value, sourceEventIds: ids(ev, (e) => isProd(e) || isRej(e)) };
}

export interface StageRow extends StageAgg {
  stageId: string;
  label: string;
  rejRate: number;
  yield: number;
  contributionPct: number;
}

/** Per-stage breakdown, ordered by registry stage order. */
export function byStage(events: Event[], scope: Scope, registry: Registry = DERIVED_REGISTRY): StageRow[] {
  const ev = scopeEvents(events, scope);
  const policy = policyOf(scope);
  const total = aggregate(ev, policy).rejected;
  const aggregatedMap = batchCascadedAgg(ev, registry, policy);
  return stagesFor(ev, registry)
    .map((s: any) => {
      const a = aggregatedMap.get(s.stageId) ?? { checked: 0, good: 0, rework: 0, rejected: 0 };
      return {
        stageId: s.stageId,
        label: s.label,
        ...a,
        rejRate: a.checked > 0 ? a.rejected / a.checked : 0,
        // Stage pass-through yield = the exact complement of the stage's
        // rejection rate: (checked − rejected) / checked = 1 − rejRate.
        yield: a.checked > 0 ? (a.checked - a.rejected) / a.checked : 1,
        contributionPct: total > 0 ? (a.rejected / total) * 100 : 0,
      };
    })
    .filter((r) => r.checked > 0 || r.rejected > 0);
}

export interface SeriesPoint { period: string; label: string; value: number; rejected?: number; checked?: number }

type MetricFn = (events: Event[], scope: Scope, registry?: Registry) => MetricValue;
const METRICS: Record<string, MetricFn> = { rejectionRate, totalRejected, totalChecked, fpy };

/** A metric bucketed over time by scope.grain. */
export function trend(events: Event[], scope: Scope, metric: keyof typeof METRICS = "rejectionRate", registry: Registry = DERIVED_REGISTRY): SeriesPoint[] {
  const ev = scopeEvents(events, scope);
  const fn = METRICS[metric];
  const periods = periodsIn(ev, scope.grain, { from: scope.dateFrom, to: scope.dateTo });
  return periods.map((p) => {
    const bucket = ev.filter((e) => periodKey(e.occurredOn.start, scope.grain) === p);
    // run the metric on the bucket with an unfiltered scope (already scoped).
    // Policy must survive — without it every trend point silently reverts to
    // the shipped defaults while the KPI above it uses the plant's policy.
    const sub = { grain: scope.grain, policy: scope.policy };
    return {
      period: p,
      label: periodLabel(p),
      value: fn(bucket, sub, registry).value,
      rejected: totalRejected(bucket, sub).value,
      checked: totalChecked(bucket, sub, registry).value,
    };
  });
}

export interface StageTrendPoint { period: string; label: string; perStage: Record<string, number>; counts?: Record<string, { rejected: number; checked: number }> }

/** Per-stage rejection-rate series over time. */
export function stageTrend(events: Event[], scope: Scope, registry: Registry = DERIVED_REGISTRY): StageTrendPoint[] {
  const ev = scopeEvents(events, scope);
  const periods = periodsIn(ev, scope.grain, { from: scope.dateFrom, to: scope.dateTo });
  return periods.map((p) => {
    const bucket = ev.filter((e) => periodKey(e.occurredOn.start, scope.grain) === p);
    const perStage: Record<string, number> = {};
    const counts: Record<string, { rejected: number; checked: number }> = {};
    for (const s of registry.stages) {
      const a = aggregate(bucket.filter((e) => "stageId" in e && (e as any).stageId === s.stageId), policyOf(scope));
      perStage[s.stageId] = a.checked > 0 ? a.rejected / a.checked : 0;
      counts[s.stageId] = { rejected: a.rejected, checked: a.checked };
    }
    return { period: p, label: periodLabel(p), perStage, counts };
  });
}

/** Weekly rejection-rate trend within the scoped window (week-of-month). */
export function weeklyTrend(events: Event[], scope: Scope, registry: Registry = DERIVED_REGISTRY): SeriesPoint[] {
  return trend(events, { ...scope, grain: "week" }, "rejectionRate", registry);
}

/** Series key for the additive cumulative-total line in `cumulativeStageTrend`. */
export const CUM_TOTAL_KEY = "__total";

/**
 * The COMMULATIVE-sheet chart: per-stage rejection-rate lines PLUS an additive
 * "Total" line = the per-period SUM of the stage rates (each stage over its own
 * denominator), matching the operator's "Total Rejection %" column. Recomputed
 * from raw events — never read from the spreadsheet's % or total cells.
 */
export function cumulativeStageTrend(
  events: Event[],
  scope: Scope,
  registry: Registry = DERIVED_REGISTRY,
): StageTrendPoint[] {
  return stageTrend(events, scope, registry).map((pt) => {
    const total = registry.stages.reduce((sum, s) => sum + (pt.perStage[s.stageId] ?? 0), 0);
    const totRej = registry.stages.reduce((sum, s) => sum + (pt.counts?.[s.stageId]?.rejected ?? 0), 0);
    const totChk = registry.stages.reduce((sum, s) => sum + (pt.counts?.[s.stageId]?.checked ?? 0), 0);
    return {
      ...pt,
      perStage: { ...pt.perStage, [CUM_TOTAL_KEY]: total },
      counts: { ...(pt.counts ?? {}), [CUM_TOTAL_KEY]: { rejected: totRej, checked: totChk } },
    };
  });
}

export interface StageSizeCell { stageId: string; stageLabel: string; size: string; checked: number; rejected: number; rejRate: number }

/** Cross-tab of stage × size rejection rate ("where are problems concentrated").
 *  [] when no size-tagged events exist for a stage — callers should render an
 *  honest empty-state rather than fabricate cells. */
export function stageBySize(events: Event[], scope: Scope, registry: Registry = DERIVED_REGISTRY): StageSizeCell[] {
  const ev = scopeEvents(events, scope).filter((e) => "size" in e && (e as any).size);
  if (ev.length === 0) return [];
  const map = new Map<string, { stageId: string; size: string; checked: number; rejected: number }>();
  for (const e of ev) {
    const stageId = stageOf(e);
    const size = (e as any).size as string;
    if (!stageId) continue;
    const key = `${stageId}::${size}`;
    const cur = map.get(key) ?? { stageId, size, checked: 0, rejected: 0 };
    if (isProd(e)) cur.checked += qty(e);
    else if (isRej(e)) cur.rejected += qty(e);
    map.set(key, cur);
  }
  const labelOf = (stageId: string) => registry.stages.find((s) => s.stageId === stageId)?.label ?? stageId;
  const order = registry.stages.map((s) => s.stageId);
  return [...map.values()]
    .map((v) => ({
      stageId: v.stageId,
      stageLabel: labelOf(v.stageId),
      size: v.size,
      checked: v.checked,
      rejected: v.rejected,
      rejRate: v.checked > 0 ? v.rejected / v.checked : 0,
    }))
    .sort((a, b) => {
      const so = order.indexOf(a.stageId) - order.indexOf(b.stageId);
      return so !== 0 ? so : a.size.localeCompare(b.size);
    });
}
