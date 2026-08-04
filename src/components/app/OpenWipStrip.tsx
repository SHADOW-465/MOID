"use client";

// Work in progress — lots that entered the line and have not cleared Final.
//
// This was computable from the day batch-progress landed and visible nowhere:
// ~25 of 66 lots sit mid-line at any time, the oldest idle over a month, and
// the only surface was a small count inside a filter bar on a tab nobody opens
// first. It is a worklist, not a rate, so it gets its own band rather than a
// sixth executive KPI — and it names the actual lots, because "3 stalled" sends
// you hunting while "26G01-6, idle 38 days" is something you can act on.

import React from "react";
import { openWip, type BatchProgress } from "@/lib/analytics/batch-progress";
import type { AuditEventLike } from "@/lib/analytics/audit-sessions";

const NAMED = 3;

export default function OpenWipStrip({ events }: { events: AuditEventLike[] }) {
  const wip = React.useMemo(() => openWip(events), [events]);

  // Nothing open is genuinely good news on a shop floor, and an empty band
  // every day would train people to stop reading this row.
  if (wip.openCount === 0) return null;

  const worst = wip.lots.filter((l) => l.stalled).slice(0, NAMED);

  return (
    <section
      aria-label="Work in progress"
      style={{
        marginTop: "var(--gap-grid)",
        padding: "12px var(--pad-card)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "10px 22px",
      }}
    >
      <Figure label="Lots open" value={wip.openCount} />
      <Figure
        label="Stalled"
        value={wip.stalledCount}
        tone={wip.stalledCount > 0 ? "var(--warning)" : undefined}
        hint={wip.stalledCount > 0 ? "no gate in 3+ days" : undefined}
      />
      <Figure label="Units waiting" value={wip.unitsWaiting.toLocaleString()} />

      {worst.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
            flex: "1 1 260px",
          }}
        >
          {worst.map((l) => (
            <LotChip key={l.batch} lot={l} />
          ))}
        </div>
      )}

      <a
        href="/data-entry?status=open"
        style={{
          marginLeft: "auto",
          fontSize: "var(--text-xs)",
          fontWeight: 600,
          color: "var(--accent-text)",
          whiteSpace: "nowrap",
        }}
      >
        Review open lots →
      </a>
    </section>
  );
}

function Figure({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number | string;
  tone?: string;
  hint?: string;
}) {
  return (
    <div style={{ display: "grid", gap: 1, minWidth: 0 }}>
      <span
        style={{
          fontSize: "var(--text-2xs)",
          fontWeight: 600,
          letterSpacing: "var(--tracking-label)",
          textTransform: "uppercase",
          color: "var(--text-3)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-lg)",
          fontWeight: 700,
          lineHeight: 1.1,
          color: tone ?? "var(--text)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
      {hint && (
        <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-3)" }}>{hint}</span>
      )}
    </div>
  );
}

/** One stalled lot, named, with where it stopped and for how long. */
function LotChip({ lot }: { lot: BatchProgress }) {
  return (
    <a
      href={`/audit?batch=${encodeURIComponent(lot.batch)}`}
      title={`${lot.doneCount}/${lot.totalCount} gates · waiting on ${lot.nextGate?.label ?? "next gate"}`}
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
        padding: "3px 9px",
        borderRadius: "var(--radius-pill)",
        border: "1px solid color-mix(in srgb, var(--warning) 35%, transparent)",
        background: "var(--warning-weak)",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-xs)",
          fontWeight: 700,
          color: "var(--text)",
        }}
      >
        {lot.batch}
      </span>
      <span style={{ fontSize: "var(--text-2xs)", color: "var(--warning)" }}>
        idle {lot.daysIdle}d
      </span>
    </a>
  );
}
