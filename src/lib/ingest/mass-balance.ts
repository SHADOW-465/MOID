// Cross-stage mass-balance verification (Disposafe diagnostic requirement #1).
//
// Units flow forward through the gate chain (Visual → Balloon → Valve → Final):
// a stage's Checked qty cannot exceed what the previous stage made available
// (acceptedGood when stated, else checked − rejected). A violation means units
// appeared from nowhere — under-reported rejections upstream or a mis-keyed
// count — and must be surfaced as a data-integrity question, never silently
// accepted or auto-fixed.
//
// Pure and deterministic, same policy as validate-entry: surfaced, never
// blocking. Emitted as V-014 ClarificationIssues alongside checkRecord's.

import type { StageDayRecord } from "@/lib/ingest/emit";
import type { ClarificationIssue } from "@/lib/entry/validate-entry";

/** Canonical assembly gate chain (Grain Contract A16). */
export const GATE_CHAIN = ["visual", "balloon", "valve-integrity", "final"] as const;

export interface MassBalanceIssue extends ClarificationIssue {
  stageId: string;   // the receiving stage (where the impossible Checked was entered)
  date: string;
}

/** Units the stage made available to the next gate. Null when not derivable. */
function available(rec: StageDayRecord): number | null {
  if (rec.acceptedGood?.value != null) return rec.acceptedGood.value;
  const checked = rec.checked?.value ?? null;
  const rejected = rec.rejected?.value ?? null;
  if (checked == null) return null;
  return checked - (rejected ?? 0);
}

/**
 * Compare consecutive gates within each date · size · batch group and flag
 * every hop where checked(N+1) > available(N). Records for stages outside
 * `stageOrder`, or groups missing either side of a hop, are skipped — we only
 * ever compare numbers that were actually stated.
 */
/**
 * What a stage already passed forward, read back from the ledger.
 *
 * Direct entry saves ONE station per submission, so comparing only within a
 * payload meant the check never had two gates to compare and silently passed
 * every manual entry — precisely the path where a mis-keyed count is most
 * likely. Callers supply the previous gate's stored numbers through this so the
 * hop can be checked against what is actually on the ledger.
 */
export interface PriorGateQty {
  stageId: string;
  date: string;
  size: string | null;
  batch: string;
  /** Units this gate made available downstream (accepted, else checked − rejected). */
  available: number;
}

export function massBalanceIssues(
  records: StageDayRecord[],
  stageOrder: readonly string[] = GATE_CHAIN,
  priors: PriorGateQty[] = [],
): MassBalanceIssue[] {
  const rank = new Map(stageOrder.map((s, i) => [s, i]));
  // Group by the physical flow identity: same day, same size, same batch/lot.
  const groups = new Map<string, StageDayRecord[]>();
  for (const r of records) {
    if (!rank.has(r.stageId)) continue;
    const batch = String(r.customFields?.batch ?? r.customFields?.batchId ?? "").trim();
    const key = `${r.occurredOn.start}|${r.size ?? ""}|${batch}`;
    const arr = groups.get(key);
    if (arr) arr.push(r); else groups.set(key, [r]);
  }

  // Index what the ledger already holds, by the same flow identity.
  const priorsByGroup = new Map<string, PriorGateQty[]>();
  for (const p of priors) {
    if (!rank.has(p.stageId)) continue;
    const key = `${p.date}|${p.size ?? ""}|${p.batch}`;
    const arr = priorsByGroup.get(key);
    if (arr) arr.push(p); else priorsByGroup.set(key, [p]);
  }

  const issues: MassBalanceIssue[] = [];
  for (const [groupKey, group] of groups) {
    // One aggregate per stage in this group (a stage can appear as several
    // rows, e.g. multiple sheets covering the same day·size·batch).
    const byStage = new Map<string, { avail: number; checked: number; hasAvail: boolean; hasChecked: boolean }>();
    for (const r of group) {
      const s = byStage.get(r.stageId) ?? { avail: 0, checked: 0, hasAvail: false, hasChecked: false };
      const a = available(r);
      if (a != null) { s.avail += a; s.hasAvail = true; }
      if (r.checked?.value != null) { s.checked += r.checked.value; s.hasChecked = true; }
      byStage.set(r.stageId, s);
    }

    // Fold in gates already on the ledger for this lot. A stage in the payload
    // always wins — it is the newer statement of the same fact.
    for (const p of priorsByGroup.get(groupKey) ?? []) {
      if (byStage.has(p.stageId)) continue;
      byStage.set(p.stageId, {
        avail: p.available,
        checked: 0,
        hasAvail: true,
        hasChecked: false,
      });
    }

    const present = [...byStage.keys()].sort((a, b) => rank.get(a)! - rank.get(b)!);
    for (let i = 1; i < present.length; i++) {
      // Compare against the nearest UPSTREAM gate present in the data — a
      // missing middle gate (data gap) must not suppress the check entirely.
      const prev = byStage.get(present[i - 1])!;
      const cur = byStage.get(present[i])!;
      if (!prev.hasAvail || !cur.hasChecked) continue;
      if (cur.checked > prev.avail) {
        const rec = group.find((r) => r.stageId === present[i])!;
        issues.push({
          code: "V-014",
          severity: "critical",
          field: "checked",
          stageId: present[i],
          date: rec.occurredOn.start,
          message:
            `Mass balance: ${present[i]} checked ${cur.checked} units, but ${present[i - 1]} ` +
            `only passed forward ${prev.avail}. Where did the extra ${cur.checked - prev.avail} come from?`,
          stated: cur.checked,
          computed: prev.avail,
        });
      }
    }
  }
  return issues;
}
