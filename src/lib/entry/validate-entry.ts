// Live clarification checks for direct entry (MOID-SPEC §5/§6).
//
// These are the deterministic checks that fire AS the user types (or as a sheet
// ingests) — the "company brain asks for clarification" seed. They never block;
// each issue becomes a Finding the user can answer now or later. Same logic the
// batch validation engine (B2) runs; here it runs point-in-time on one record.
//
// Tone: asking, never accusing. Messages are plain language.

import type { StageDayRecord } from "@/lib/ingest/emit";
import type { AuditEventLike } from "@/lib/analytics/audit-sessions";
import { canonicalBatchId } from "@/lib/entry/batch-id";

export type ClarificationSeverity = "critical" | "warning" | "info";

export interface ClarificationIssue {
  code: string;            // maps to a V-rule (V-004/V-003/etc.)
  severity: ClarificationSeverity;
  field: string;           // which input it's about
  message: string;
  stated: number | null;
  computed: number | null;
}

const EPS = 0.005;

/** Point-in-time checks on a single stage-day record. */
export function checkRecord(rec: StageDayRecord): ClarificationIssue[] {
  const issues: ClarificationIssue[] = [];
  const checked = rec.checked?.value ?? null;
  const rejected = rec.rejected?.value ?? null;

  // negatives (impossible counts)
  for (const [field, v] of [["checked", checked], ["rejected", rejected]] as const) {
    if (v != null && v < 0) {
      issues.push({ code: "V-013", severity: "critical", field, message: `${field} is negative (${v}). Counts can't be below zero — is this a back-adjustment?`, stated: v, computed: null });
    }
  }
  for (const d of rec.defects) {
    if (d.value < 0) issues.push({ code: "V-013", severity: "critical", field: `defect:${d.raw}`, message: `${d.raw} is negative (${d.value}).`, stated: d.value, computed: null });
  }

  // rejected can't exceed checked
  if (checked != null && rejected != null && rejected > checked) {
    issues.push({ code: "V-001", severity: "critical", field: "rejected", message: `Rejected (${rejected}) is more than checked (${checked}) — more pieces rejected than inspected.`, stated: rejected, computed: checked });
  }

  // defect breakdown should reconcile to the stated reject total (V-004)
  if (rejected != null && rec.defects.length > 0) {
    const sum = rec.defects.reduce((a, d) => a + d.value, 0);
    if (sum !== rejected) {
      const dir = sum < rejected ? "fewer" : "more";
      issues.push({
        code: "V-004",
        severity: Math.abs(sum - rejected) > 0.05 * Math.max(rejected, 1) ? "critical" : "warning",
        field: "defects",
        message: `The defect reasons add up to ${sum}, ${dir} than the ${rejected} rejected. Where do the other ${Math.abs(rejected - sum)} go?`,
        stated: rejected,
        computed: sum,
      });
    }
  }

  // stated % should match checked/rejected (V-003)
  if (rec.statedPct && typeof rec.statedPct.value === "number" && checked != null && rejected != null && checked > 0) {
    const computed = (rejected / checked) * 100;
    if (Math.abs(computed - rec.statedPct.value) > EPS) {
      issues.push({ code: "V-003", severity: "warning", field: "statedPct", message: `The sheet says ${rec.statedPct.value}% but ${rejected}/${checked} works out to ${computed.toFixed(2)}%.`, stated: rec.statedPct.value, computed });
    }
  }

  return issues;
}

/** The cell a direct entry owns: one lot, at one gate, in one size, on one day. */
export interface EntrySlot {
  date: string;
  stageId: string;
  size: string | null;
  batchId: string;
}

/**
 * The entry ALREADY on the ledger for this slot, if any.
 *
 * /api/ingest keys direct entry by exactly (day · stage · size · batch), so a
 * second save on the same slot supersedes the first instead of adding to it.
 * That happened silently: two rows looked saved, one existed. Callers use this
 * to say so before the overwrite, not after.
 */
export function existingLedgerEntry(
  events: AuditEventLike[],
  slot: EntrySlot,
): { checked: number; rejected: number; shift: string | null } | null {
  const batch = canonicalBatchId(slot.batchId);
  if (!batch) return null;
  let found = false;
  let checked = 0;
  let rejected = 0;
  let shift: string | null = null;
  for (const e of events) {
    const isDirect = e.extractedBy === "direct-entry" || e.isDirectEntry === true;
    if (!isDirect) continue;
    if (e.occurredOn?.start !== slot.date) continue;
    if (e.stageId !== slot.stageId) continue;
    if ((e.size ?? null) !== (slot.size ?? null)) continue;
    if (canonicalBatchId(e.batchNo ?? null) !== batch) continue;
    found = true;
    shift ??= e.provenance?.sheet ?? null;
    if (e.eventType === "production") checked += e.quantity ?? 0;
    else if (e.eventType === "inspection" && e.disposition === "rejected") rejected += e.quantity ?? 0;
  }
  return found ? { checked, rejected, shift } : null;
}

/**
 * A DIFFERENT, individually valid batch code on the same date/stage/size whose
 * checked/accepted/rejected all match the one being saved — the fingerprint of
 * a lot entered twice with the month letter or day mistyped the second time.
 *
 * `existingLedgerEntry` above only catches a re-save landing on the exact same
 * canonical batch; two syntactically valid codes (26H25-18 vs 26G25-18) are
 * different slots to the ledger and never collide there. This is the fuzzy
 * check for that case: same size, same day, same gate, same three numbers,
 * different lot code — coincidence is possible but rare enough to ask about.
 */
export function suspectedDuplicateBatch(
  events: AuditEventLike[],
  slot: EntrySlot & { checked: number; accepted: number; rejected: number },
): { batch: string } | null {
  const ownBatch = canonicalBatchId(slot.batchId);
  if (slot.checked <= 0) return null;
  const byBatch = new Map<string, { checked: number; accepted: number; rejected: number }>();
  for (const e of events) {
    const isDirect = e.extractedBy === "direct-entry" || e.isDirectEntry === true;
    if (!isDirect) continue;
    if (e.occurredOn?.start !== slot.date) continue;
    if (e.stageId !== slot.stageId) continue;
    if ((e.size ?? null) !== (slot.size ?? null)) continue;
    const batch = canonicalBatchId(e.batchNo ?? null);
    if (!batch || batch === ownBatch) continue;
    const agg = byBatch.get(batch) ?? { checked: 0, accepted: 0, rejected: 0 };
    if (e.eventType === "production") agg.checked += e.quantity ?? 0;
    else if (e.eventType === "inspection" && e.disposition === "accepted") agg.accepted += e.quantity ?? 0;
    else if (e.eventType === "inspection" && e.disposition === "rejected") agg.rejected += e.quantity ?? 0;
    byBatch.set(batch, agg);
  }
  for (const [batch, agg] of byBatch) {
    if (
      agg.checked === slot.checked &&
      agg.accepted === slot.accepted &&
      agg.rejected === slot.rejected
    ) {
      return { batch };
    }
  }
  return null;
}

/**
 * Across-collection spike check: compare this record's rejection rate against a
 * baseline mean (e.g. the period-to-date mean for the same stage). `sigmaMult`
 * of 3 ≈ "3× the average" the GM cares about.
 */
export function checkSpike(
  rec: StageDayRecord,
  baseline: { mean: number; n: number },
  sigmaMult = 3
): ClarificationIssue | null {
  const checked = rec.checked?.value ?? null;
  const rejected = rec.rejected?.value ?? null;
  if (checked == null || rejected == null || checked <= 0 || baseline.n < 3) return null;
  const rate = (rejected / checked) * 100;
  if (baseline.mean > 0 && rate > baseline.mean * sigmaMult) {
    return {
      code: "V-009",
      severity: "warning",
      field: "rejected",
      message: `Rejection here is ${rate.toFixed(1)}% — about ${(rate / baseline.mean).toFixed(1)}× the running average of ${baseline.mean.toFixed(1)}%. Real process issue, or a data entry error?`,
      stated: rate,
      computed: baseline.mean,
    };
  }
  return null;
}
