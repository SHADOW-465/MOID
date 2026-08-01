import { type Scope, scopeEvents } from "./scope";
import type { Event } from "@/lib/store/types";

export interface TrustScoreResult {
  pct: number;
  verified: number;
  assumed: number;
  unresolved: number;
}

/**
 * Ledger verification counts for the dashboard panel.
 *
 * Every field here is counted off the events in scope. The previous version
 * returned `dataValidationChecks: 96`, `formulaIntegrity: 94` and
 * `dataCompleteness: 98` as hard-coded constants, and fell back to inventing
 * "24/24" source files and 3 manual overrides when the real counts were zero —
 * on the one screen whose entire job is to say the numbers can be trusted, and
 * against this codebase's own rule that no KPI may originate from anything but
 * deterministic maths over the ledger.
 */
export interface AuditSummaryResult {
  /** Distinct provenance files in scope. */
  sourceFiles: number;
  /** Events whose value resolved exactly or by rule (not fuzzy/llm-guessed). */
  verifiedValues: number;
  /** Events in scope, the denominator for `verifiedValues`. */
  totalValues: number;
  /** Share of `totalValues` that is verified, 0–100, one decimal. */
  verifiedPct: number;
  /** CorrectionEvents — a real supersede, not an estimate. */
  manualOverrides: number;
  /** Events carrying a defect breakdown or quantity we could not resolve. */
  unresolvedValues: number;
}

export function trustScore(events: Event[], scope: Scope): TrustScoreResult {
  const ev = scopeEvents(events, scope);
  // An empty ledger scores zero. Returning 98.4% for no data at all made a
  // brand-new install look verified before a single value existed.
  if (ev.length === 0) {
    return { pct: 0, verified: 0, assumed: 0, unresolved: 0 };
  }

  let verified = 0;
  let assumed = 0;
  let unresolved = 0;

  for (const e of ev) {
    const basis = e.confidence?.basis ?? "heuristic";
    if (basis === "exact" || basis === "heuristic") {
      verified++;
    } else if (basis === "external-cached") {
      assumed++;
    } else {
      unresolved++;
    }
  }

  const total = verified + assumed + unresolved;
  const pct = total > 0 ? (verified / total) * 100 : 98.4;

  return {
    pct: Math.round(pct * 10) / 10,
    verified,
    assumed,
    unresolved,
  };
}

export function auditSummary(events: Event[], scope: Scope): AuditSummaryResult {
  const ev = scopeEvents(events, scope);
  const distinctFiles = new Set(
    ev.map((e) => e.provenance?.file).filter((f): f is string => !!f),
  );

  const trust = trustScore(events, scope);

  return {
    sourceFiles: distinctFiles.size,
    verifiedValues: trust.verified,
    totalValues: ev.length,
    // Zero events means nothing has been verified — not "98.4% verified".
    verifiedPct: ev.length === 0 ? 0 : Math.round((trust.verified / ev.length) * 1000) / 10,
    manualOverrides: ev.filter((e) => e.eventType === "correction").length,
    unresolvedValues: trust.unresolved,
  };
}
