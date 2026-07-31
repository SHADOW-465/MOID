"use client";

// Lot completion strip — the four Assembly gates a batch must clear.
// Purely a view over `buildBatchProgress`; it stores nothing.

import React from "react";
import type { BatchProgress } from "@/lib/analytics/batch-progress";

const SHORT: Record<string, string> = {
  visual: "Visual",
  balloon: "Balloon",
  "valve-integrity": "Valve",
  final: "Final",
};

function shortDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : `${d.getUTCDate()} ${d.toLocaleString("en", { month: "short", timeZone: "UTC" })}`;
}

export function lotStatusTone(p: BatchProgress): { label: string; color: string } {
  if (p.status === "complete") return { label: "Complete", color: "var(--positive)" };
  if (p.stalled) return { label: "Stalled", color: "var(--critical)" };
  if (p.status === "not-started") return { label: "Not started", color: "var(--text-3)" };
  return { label: "In progress", color: "var(--accent)" };
}

export default function LotProgress({
  progress: p,
  activeStageId,
  showLabels = true,
}: {
  progress: BatchProgress;
  /** Gate the operator is currently entering — outlined in the bar. */
  activeStageId?: string | null;
  showLabels?: boolean;
}) {
  const tone = lotStatusTone(p);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{ display: "flex", gap: 2, flex: 1, minWidth: 90 }}
          role="img"
          aria-label={`${p.doneCount} of ${p.totalCount} assembly gates recorded`}
          title={p.steps
            .map((s) => `${SHORT[s.stageId] ?? s.stageId}: ${s.done ? shortDate(s.date) : "pending"}`)
            .join(" · ")}
        >
          {p.steps.map((s) => (
            <span
              key={s.stageId}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 2,
                background: s.done ? tone.color : "var(--border)",
                outline:
                  activeStageId === s.stageId ? `1.5px solid ${tone.color}` : "none",
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
        <span
          className="small"
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            fontSize: 11.5,
            color: tone.color,
            whiteSpace: "nowrap",
          }}
        >
          {p.doneCount}/{p.totalCount} · {tone.label}
        </span>
      </div>

      {showLabels && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", fontSize: 11, color: "var(--text-3)" }}>
          {p.steps.map((s) => (
            <span
              key={s.stageId}
              style={{
                color: s.done ? "var(--text-2)" : "var(--text-3)",
                fontWeight: activeStageId === s.stageId ? 700 : 400,
              }}
            >
              {s.done ? "✓" : "○"} {SHORT[s.stageId] ?? s.stageId}
              {s.done && s.date ? ` ${shortDate(s.date)}` : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
