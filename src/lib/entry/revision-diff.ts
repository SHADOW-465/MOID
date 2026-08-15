// Turn a raw ledger timeline into "what changed, when, and by whom".
//
// The ledger stores atoms: one event per quantity, one per defect. A person
// does not think in atoms — they think "on 14 Aug at 16:02 Rejected went from
// 39 to 44 and BM went 9 → 14". The history panel used to list the atoms, so
// reading an edit meant reconstructing it in your head from a stack of cards.
//
// One SAVE writes all of a row's events under a single ingestionId, and each
// save restates the whole row. So a revision is an ingestionId group, and the
// diff between two revisions is a plain field-by-field comparison of the two
// snapshots. Pure — no React, no fetch.

export interface RevisionEventLike {
  eventId: string;
  eventType: string;
  recordedAt?: string | null;
  ingestionId?: string | null;
  quantity?: number | null;
  disposition?: string | null;
  defect?: string | null;
  operator?: string | null;
  productType?: string | null;
  shift?: string | null;
  remarks?: string | null;
  reason?: string | null;
  isSuperseded?: boolean;
  extractedBy?: string | null;
}

/** The row as one save stated it. */
export interface RevisionSnapshot {
  checked: number | null;
  accepted: number | null;
  rework: number | null;
  rejected: number | null;
  /** defect code → qty, only codes this save actually stated. */
  defects: Record<string, number>;
}

export interface RevisionChange {
  /** "Checked", "Accepted", "Rejected", "Rework", or a defect code. */
  label: string;
  kind: "quantity" | "defect";
  from: number | null;
  to: number | null;
  delta: number | null;
}

export interface Revision {
  id: string;
  /** 1-based; 1 is the original entry. */
  index: number;
  recordedAt: string | null;
  operator: string | null;
  productType: string | null;
  shift: string | null;
  remarks: string | null;
  extractedBy: string | null;
  snapshot: RevisionSnapshot;
  /** Empty for the first revision — nothing to compare against. */
  changes: RevisionChange[];
  /** True once a later save has replaced this one. */
  isSuperseded: boolean;
  /** Reason carried by the correction that retired this revision, when any. */
  supersededReason: string | null;
}

const QTY_LABEL: Record<string, string> = {
  checked: "Checked",
  accepted: "Accepted",
  rework: "Rework / hold",
  rejected: "Rejected",
};

function emptySnapshot(): RevisionSnapshot {
  return { checked: null, accepted: null, rework: null, rejected: null, defects: {} };
}

/** Which slot an event fills in the snapshot. */
function slotOf(e: RevisionEventLike): keyof Omit<RevisionSnapshot, "defects"> | null {
  if (e.eventType === "production") return "checked";
  if (e.eventType !== "inspection") return null;
  const d = (e.disposition ?? "").toLowerCase();
  if (d === "accepted" || d === "good") return "accepted";
  if (d === "rework" || d === "hold") return "rework";
  if (d === "rejected") return "rejected";
  return null;
}

function diffSnapshots(prev: RevisionSnapshot, next: RevisionSnapshot): RevisionChange[] {
  const out: RevisionChange[] = [];

  for (const key of ["checked", "accepted", "rework", "rejected"] as const) {
    const a = prev[key];
    const b = next[key];
    if (a === b) continue;
    // A field the new save simply did not restate is not a change to zero.
    if (b === null) continue;
    out.push({
      label: QTY_LABEL[key],
      kind: "quantity",
      from: a,
      to: b,
      delta: a == null ? null : b - a,
    });
  }

  const codes = new Set([...Object.keys(prev.defects), ...Object.keys(next.defects)]);
  for (const code of [...codes].sort()) {
    const a = prev.defects[code] ?? null;
    const b = next.defects[code] ?? null;
    if (a === b) continue;
    out.push({
      label: code,
      kind: "defect",
      from: a,
      // A defect present before and absent now was cleared — that IS a change to 0.
      to: b ?? 0,
      delta: a == null ? null : (b ?? 0) - a,
    });
  }

  return out;
}

/**
 * Group a timeline into revisions, newest last, each carrying the field-level
 * diff against the one before it.
 */
export function buildRevisions(timeline: RevisionEventLike[]): Revision[] {
  // Corrections are bookkeeping, not a revision of their own — they carry the
  // reason the previous save was retired.
  const reasonFor = new Map<string, string>();
  for (const e of timeline) {
    if (e.eventType === "correction" && e.reason && e.ingestionId) {
      reasonFor.set(e.ingestionId, e.reason);
    }
  }

  const groups = new Map<string, RevisionEventLike[]>();
  for (const e of timeline) {
    if (e.eventType === "correction" || e.eventType === "annotation") continue;
    // Events written before ingestionId was carried still group by timestamp.
    const key = e.ingestionId || e.recordedAt || e.eventId;
    const arr = groups.get(key);
    if (arr) arr.push(e);
    else groups.set(key, [e]);
  }

  const ordered = [...groups.entries()].sort(([, a], [, b]) =>
    (a[0]?.recordedAt ?? "").localeCompare(b[0]?.recordedAt ?? ""),
  );

  const revisions: Revision[] = [];
  let prev = emptySnapshot();

  ordered.forEach(([id, events], i) => {
    const snapshot = emptySnapshot();
    let operator: string | null = null;
    let productType: string | null = null;
    let shift: string | null = null;
    let remarks: string | null = null;
    let extractedBy: string | null = null;
    let recordedAt: string | null = null;

    for (const e of events) {
      operator ??= e.operator ?? null;
      productType ??= e.productType ?? null;
      shift ??= e.shift ?? null;
      remarks ??= e.remarks ?? null;
      extractedBy ??= e.extractedBy ?? null;
      if (!recordedAt || (e.recordedAt ?? "") < recordedAt) recordedAt = e.recordedAt ?? recordedAt;

      if (e.eventType === "rejection") {
        const code = e.defect || "UNKNOWN";
        snapshot.defects[code] = (snapshot.defects[code] ?? 0) + (e.quantity ?? 0);
        continue;
      }
      const slot = slotOf(e);
      if (slot) snapshot[slot] = (snapshot[slot] ?? 0) + (e.quantity ?? 0);
    }

    revisions.push({
      id,
      index: i + 1,
      recordedAt,
      operator,
      productType,
      shift,
      remarks,
      extractedBy,
      snapshot,
      changes: i === 0 ? [] : diffSnapshots(prev, snapshot),
      // Every event of this save superseded ⇒ the save itself was replaced.
      isSuperseded: events.length > 0 && events.every((e) => e.isSuperseded === true),
      supersededReason: reasonFor.get(id) ?? null,
    });

    prev = snapshot;
  });

  return revisions;
}

/** "14 Aug 2026, 16:02" — how a person says a timestamp. */
export function formatStamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** "3 minutes later", "2 days later" — the gap between two revisions. */
export function formatGap(fromIso: string | null, toIso: string | null): string | null {
  if (!fromIso || !toIso) return null;
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null;
  const mins = Math.round((b - a) / 60000);
  if (mins < 1) return "seconds later";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} later`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} later`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} later`;
}
