// Deterministic dashboard config for a scoped period — same figures the screens show.
// AI may narrate these; it must never invent replacements.

import type { Event } from "@/lib/store/types";
import type { DashboardConfig } from "@/types/dashboard";
import type { Scope } from "@/lib/analytics/scope";
import type { InvestigationState } from "@/lib/analytics/investigation-state";
import {
  rejectionRate,
  totalRejected,
  totalChecked,
  fpy,
  byStage,
  byDefect,
  trend,
  copq,
  savingsOpportunity,
} from "@/lib/analytics";
import { DERIVED_REGISTRY, type Registry } from "@/lib/analytics/rejection";

function scopeFromInvestigation(state: InvestigationState): Scope {
  return {
    grain: state.grain ?? "month",
    dateFrom: state.from,
    dateTo: state.to,
    stageIds: state.stage ? [state.stage] : undefined,
    sizes: state.size ? [state.size] : undefined,
    batchIds: state.batch ? [state.batch] : undefined,
  };
}

export function buildScopedDashboardConfig(
  events: Event[],
  state: InvestigationState,
  registry: Registry = DERIVED_REGISTRY,
  titleSuffix?: string,
): DashboardConfig {
  const scope = scopeFromInvestigation(state);
  const period =
    state.from && state.to
      ? `${state.from} → ${state.to}`
      : state.from
        ? `from ${state.from}`
        : "all scoped data";

  const rate = rejectionRate(events, scope, registry).value;
  const rejected = totalRejected(events, scope).value;
  const checked = totalChecked(events, scope, registry).value;
  const fpyVal = fpy(events, scope, registry).value;
  const stages = byStage(events, scope, registry);
  const defects = byDefect(events, scope, registry);
  const tr = trend(events, scope, "rejectionRate", registry);
  const copqRes = copq(events, scope);
  const savings = savingsOpportunity(events, scope);

  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
  const rupee = (n: number) => `₹${(n / 100000).toFixed(2)}L`;
  const num = (n: number) => n.toLocaleString();

  const topStages = [...stages]
    .sort((a, b) => b.rejected - a.rejected)
    .slice(0, 5);
  const topDefects = [...defects]
    .sort((a, b) => b.rejected - a.rejected)
    .slice(0, 5);

  const title = titleSuffix
    ? `Scoped summary · ${titleSuffix}`
    : `Scoped summary · ${period}`;

  return {
    dashboardTitle: title,
    executiveSummary:
      checked === 0 && rejected === 0
        ? `No ledger production/rejection events found for ${period}. Enter data or widen the range.`
        : `For ${period}: rejection rate ${pct(rate)}, ${num(rejected)} rejected of ${num(checked)} checked, FPY ${pct(fpyVal)}.`,
    kpis: [
      { label: "Rejection Rate", value: pct(rate), unit: "", trend: 0, context: period },
      { label: "Total Rejections", value: num(rejected), unit: "", trend: 0, context: period },
      { label: "Total Checked", value: num(checked), unit: "", trend: 0, context: period },
      { label: "First Pass Yield (FPY)", value: pct(fpyVal), unit: "", trend: 0, context: period },
      { label: "COPQ", value: rupee(copqRes?.value ?? 0), unit: "", trend: 0, context: period },
      { label: "Savings Opportunity", value: rupee(savings ?? 0), unit: "", trend: 0, context: period },
    ],
    charts: [
      {
        title: "Rejection Rate Trend",
        type: "line",
        data: {
          labels: tr.map((p) => p.label),
          datasets: [{ label: "Rejection Rate", data: tr.map((p) => p.value) }],
        },
      },
    ],
    insights: [
      `Period: ${period}.`,
      `Checked ${num(checked)} · Rejected ${num(rejected)} · Rate ${pct(rate)} · FPY ${pct(fpyVal)}.`,
      topStages.length
        ? `Top stages by reject volume: ${topStages.map((s) => `${s.label || s.stageId} (${num(s.rejected)})`).join(", ")}.`
        : "No stage breakdown for this scope.",
      topDefects.length
        ? `Top defects: ${topDefects.map((d) => `${d.label} (${num(d.rejected)})`).join(", ")}.`
        : "No defect breakdown for this scope.",
    ],
    recommendations: [],
    alerts: [],
    sections: topStages.map((s) => ({
      id: s.stageId,
      label: s.label || s.stageId,
      kpis: [
        { label: "Rejected", value: num(s.rejected), unit: "", trend: 0, context: period },
        { label: "Rate", value: pct(s.rejRate), unit: "", trend: 0, context: period },
      ],
      charts: [],
    })),
  };
}

/** Plain-text summary when AI is unavailable — still only verified figures. */
export function formatScopedSummaryText(cfg: DashboardConfig): string {
  const lines = [
    cfg.executiveSummary,
    "",
    "Verified figures:",
    ...(cfg.kpis ?? []).map((k) => `• ${k.label}: ${k.value}${k.unit ? ` ${k.unit}` : ""}`),
  ];
  if (cfg.insights?.length) {
    lines.push("", ...cfg.insights.map((i) => `• ${i}`));
  }
  return lines.join("\n");
}
