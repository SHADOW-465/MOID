// Batch (lot) completion tracking — derived, never stored.
//
// A lot moves through the Assembly quality gates over several days:
//   Visual (P17) → Balloon (P18) → Valve Integrity (P20) → Final (P24)
// Each gate is entered on the day that station ran it, so a lot is "in progress"
// until every gate has a ledger entry. Nothing new is written for this: the
// progress IS the ledger, read back. No status column to drift, no state machine
// to keep in sync, and a purge/correction moves the bar automatically.

import { MATRIX_STAGES } from "@/lib/entry/disposafe-matrix";
import { batchOf, type AuditEventLike } from "./audit-sessions";

/** Ordered Assembly quality gates a lot must clear, from the entry matrix. */
export const ASSEMBLY_GATES: { stageId: string; label: string }[] =
  MATRIX_STAGES.assembly.processes
    .filter((p) => p.stageId && p.interactive)
    .map((p) => ({ stageId: p.stageId as string, label: p.name }));

export interface BatchGateStep {
  stageId: string;
  label: string;
  done: boolean;
  /** Earliest business date this gate was recorded on. */
  date: string | null;
  checked: number;
  accepted: number;
  rejected: number;
}

export interface BatchProgress {
  /** Uppercased lot id. */
  batch: string;
  steps: BatchGateStep[];
  doneCount: number;
  totalCount: number;
  /** 0–100, whole number. */
  pct: number;
  status: "not-started" | "in-progress" | "complete";
  /** Next gate awaiting entry, or null when complete. */
  nextGate: BatchGateStep | null;
  firstDate: string | null;
  lastDate: string | null;
  /** Calendar days between first and last gate entry (0 when single-day). */
  spanDays: number;
  /** In progress and untouched for longer than `stalledAfterDays`. */
  stalled: boolean;
  /** Stage ids seen on this lot that are not Assembly gates (primary/secondary). */
  offGateStages: string[];
}

const QTY_TYPES = new Set(["production", "inspection", "rejection"]);

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Number.isNaN(ms) ? 0 : Math.round(ms / 86_400_000);
}

/**
 * Progress for every lot in the ledger, keyed by UPPERCASE batch id.
 * `today` and `stalledAfterDays` are injectable so the check is deterministic.
 */
export function buildBatchProgress(
  events: AuditEventLike[],
  opts: { today?: string; stalledAfterDays?: number } = {},
): Map<string, BatchProgress> {
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const stalledAfterDays = opts.stalledAfterDays ?? 3;

  type Acc = {
    gates: Map<string, { date: string | null; checked: number; accepted: number; rejected: number }>;
    off: Set<string>;
  };
  const gateIds = new Set(ASSEMBLY_GATES.map((g) => g.stageId));
  const acc = new Map<string, Acc>();

  for (const e of events) {
    if (!e.eventType || !QTY_TYPES.has(e.eventType)) continue;
    const raw = batchOf(e);
    if (!raw) continue;
    const batch = raw.toUpperCase();
    const stageId = e.stageId;
    if (!stageId) continue;

    let a = acc.get(batch);
    if (!a) {
      a = { gates: new Map(), off: new Set() };
      acc.set(batch, a);
    }
    if (!gateIds.has(stageId)) {
      a.off.add(stageId);
      continue;
    }

    let g = a.gates.get(stageId);
    if (!g) {
      g = { date: null, checked: 0, accepted: 0, rejected: 0 };
      a.gates.set(stageId, g);
    }
    const day = e.occurredOn?.start ?? e.recordedAt?.slice(0, 10) ?? null;
    if (day && (!g.date || day < g.date)) g.date = day;

    const qty = Number(e.quantity ?? 0);
    if (e.eventType === "production") g.checked += qty;
    else if (e.eventType === "inspection") {
      if (e.disposition === "accepted" || e.disposition === "good") g.accepted += qty;
      else if (e.disposition === "rejected") g.rejected += qty;
    }
  }

  const out = new Map<string, BatchProgress>();
  for (const [batch, a] of acc) {
    const steps: BatchGateStep[] = ASSEMBLY_GATES.map((gate) => {
      const hit = a.gates.get(gate.stageId);
      return {
        stageId: gate.stageId,
        label: gate.label,
        done: !!hit,
        date: hit?.date ?? null,
        checked: hit?.checked ?? 0,
        accepted: hit?.accepted ?? 0,
        rejected: hit?.rejected ?? 0,
      };
    });

    const doneCount = steps.filter((s) => s.done).length;
    const dates = steps.map((s) => s.date).filter((d): d is string => !!d).sort();
    const firstDate = dates[0] ?? null;
    const lastDate = dates[dates.length - 1] ?? null;
    const status = doneCount === 0 ? "not-started" : doneCount === steps.length ? "complete" : "in-progress";

    out.set(batch, {
      batch,
      steps,
      doneCount,
      totalCount: steps.length,
      pct: steps.length ? Math.round((doneCount / steps.length) * 100) : 0,
      status,
      nextGate: steps.find((s) => !s.done) ?? null,
      firstDate,
      lastDate,
      spanDays: firstDate && lastDate ? daysBetween(firstDate, lastDate) : 0,
      stalled: status === "in-progress" && !!lastDate && daysBetween(lastDate, today) > stalledAfterDays,
      offGateStages: [...a.off].sort(),
    });
  }
  return out;
}

/** Case-insensitive lookup into the map returned by `buildBatchProgress`. */
export function progressFor(
  map: Map<string, BatchProgress>,
  batch: string | null | undefined,
): BatchProgress | null {
  const key = (batch ?? "").trim().toUpperCase();
  return key ? map.get(key) ?? null : null;
}
