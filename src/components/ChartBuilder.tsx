"use client";

// Chart builder — shared by Imported Files (one workbook) and the Dashboard
// (the whole ledger).
//
// The GM's ask was "let me pick the columns I care about and get a graph for
// those". Excel row/column selection doesn't translate — by the time a sheet is
// on the ledger it's events, not cells — so the equivalent question is asked in
// the plant's own terms instead: WHAT number, broken down BY what, filtered to
// which stages/sizes. Every combination is answered by the same deterministic
// selectors the KPI tiles use; nothing new is computed here, so a built chart
// can never disagree with the numbers above it.
//
// On the Dashboard the topbar's date range and stage View are inherited as a
// `baseScope`, so a built chart always answers the same question the rest of
// the page is answering. Pinned charts are remembered per surface.

import { useEffect, useMemo, useState } from "react";
import { Card, Empty, BarsH, LineChart, Donut } from "@/components/app/widgets";
import {
  byStage,
  byDefect,
  bySize,
  trend,
  periodsIn,
  DERIVED_REGISTRY,
  type Grain,
} from "@/lib/analytics";
import type { Event } from "@/lib/store/types";

type MetricId = "rejectionRate" | "totalRejected" | "totalChecked" | "fpy";
type GroupId = "time" | "stage" | "size" | "defect";

export interface ChartSpec {
  id: string;
  metric: MetricId;
  group: GroupId;
  /** Only for group === "time". */
  grain: Grain;
  stageIds: string[];
  sizes: string[];
}

const METRICS: { id: MetricId; label: string; pct: boolean }[] = [
  { id: "rejectionRate", label: "Rejection rate", pct: true },
  { id: "totalRejected", label: "Rejected qty", pct: false },
  { id: "totalChecked", label: "Checked qty", pct: false },
  { id: "fpy", label: "First-pass yield", pct: true },
];

const GROUPS: { id: GroupId; label: string }[] = [
  { id: "time", label: "Over time" },
  { id: "stage", label: "By stage" },
  { id: "size", label: "By size" },
  { id: "defect", label: "By defect" },
];

const GRAINS: { id: Grain; label: string }[] = [
  { id: "day", label: "Daily" },
  { id: "week", label: "Weekly" },
  { id: "month", label: "Monthly" },
];

const isPct = (m: MetricId) => METRICS.find((x) => x.id === m)!.pct;
const fmtValue = (m: MetricId) => (n: number) =>
  isPct(m) ? `${(n * 100).toFixed(2)}%` : Math.round(n).toLocaleString("en-IN");

export function describeSpec(spec: ChartSpec): string {
  const metric = METRICS.find((m) => m.id === spec.metric)?.label ?? spec.metric;
  const group =
    spec.group === "time"
      ? GRAINS.find((g) => g.id === spec.grain)?.label.toLowerCase()
      : GROUPS.find((g) => g.id === spec.group)?.label.toLowerCase();
  return `${metric} · ${group}`;
}

/** Scope filters the host page already applies (Dashboard topbar range/View). */
export interface BaseScope {
  dateFrom?: string;
  dateTo?: string;
  stageIds?: string[];
}

export function scopeFor(spec: ChartSpec, base?: BaseScope) {
  // The builder's own stage picks NARROW the inherited View; they never widen
  // it, or a chart could show a stage the page above it has filtered out.
  const own = spec.stageIds.length ? spec.stageIds : undefined;
  const inherited = base?.stageIds?.length ? base.stageIds : undefined;
  const stageIds =
    own && inherited ? own.filter((s) => inherited.includes(s)) : (own ?? inherited);

  return {
    grain: spec.group === "time" ? spec.grain : ("month" as Grain),
    dateFrom: base?.dateFrom,
    dateTo: base?.dateTo,
    stageIds,
    sizes: spec.sizes.length ? spec.sizes : undefined,
  };
}

/**
 * Finest time grain that actually yields more than one point for these events.
 * A single month of daily rows charted monthly is one dot — which is what the
 * old fixed `grain: "month"` produced, and why this panel looked broken.
 */
export function bestGrain(events: Event[]): Grain {
  for (const g of ["day", "week", "month"] as Grain[]) {
    if (periodsIn(events, g).length > 1) return g;
  }
  return "day";
}

function ChartBody({ events, spec, base }: { events: Event[]; spec: ChartSpec; base?: BaseScope }) {
  const scope = scopeFor(spec, base);
  const fmt = fmtValue(spec.metric);
  const reg = DERIVED_REGISTRY;

  if (spec.group === "time") {
    const points = trend(events, scope, spec.metric, reg);
    if (points.length < 2) {
      return <Empty label="Only one period in this file — pick a finer interval, or a breakdown instead of Over time." />;
    }
    return <LineChart points={points} fmt={fmt} height={240} />;
  }

  const pick = (checked: number, rejected: number) => {
    switch (spec.metric) {
      case "totalChecked": return checked;
      case "totalRejected": return rejected;
      case "fpy": return checked > 0 ? (checked - rejected) / checked : 0;
      default: return checked > 0 ? rejected / checked : 0;
    }
  };

  let rows: { label: string; value: number; sub?: string }[] = [];

  if (spec.group === "stage") {
    rows = byStage(events, scope, reg).map((s) => ({
      // Files that never named their stages leave `label` empty — fall back to
      // the id, or the bar (and the filter chip) renders with no name at all.
      label: s.label || s.stageId,
      value: pick(s.checked, s.rejected),
      sub: `${s.rejected.toLocaleString("en-IN")} of ${s.checked.toLocaleString("en-IN")}`,
    }));
  } else if (spec.group === "size") {
    rows = bySize(events, scope).map((s) => ({
      label: s.size,
      value: pick(s.checked, s.rejected),
      sub: `${s.rejected.toLocaleString("en-IN")} of ${s.checked.toLocaleString("en-IN")}`,
    }));
  } else {
    // Defects are counts of rejects — a rate or a yield has no denominator here.
    rows = byDefect(events, scope, reg).map((d) => ({
      label: d.label || d.defectCode || "Unnamed",
      value: d.rejected,
      sub: `${d.pct.toFixed(1)}% of rejects`,
    }));
  }

  rows = rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value);

  if (rows.length === 0) {
    return (
      <Empty
        label={
          spec.group === "defect"
            ? "This file has no defect columns — its sheets record totals only. Import a file with per-defect columns, or log defects on Data Entry."
            : spec.group === "size"
              ? "No size-tagged rows in this file."
              : "No stage rows in this file."
        }
      />
    );
  }

  if (spec.group === "defect" && rows.length > 2 && rows.length <= 8) {
    return <Donut data={rows.map((r) => ({ label: r.label, value: r.value }))} fmt={(n) => Math.round(n).toLocaleString("en-IN")} />;
  }

  return <BarsH rows={rows.slice(0, 12)} fmt={spec.group === "defect" ? (n) => Math.round(n).toLocaleString("en-IN") : fmt} />;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "4px 10px",
        borderRadius: 9999,
        border: `1px solid ${on ? "var(--accent)" : "var(--border-strong)"}`,
        background: on ? "var(--accent)" : "var(--surface-2)",
        color: on ? "var(--text-invert)" : "var(--text-2)",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

export default function ChartBuilder({
  events,
  storageId,
  base,
  title = "Build your own chart",
  sub = "Pick what you want to see. Pin the ones you want to keep.",
}: {
  events: Event[];
  /** Namespaces the pinned charts — one workbook, or the whole dashboard. */
  storageId: string;
  base?: BaseScope;
  title?: string;
  sub?: string;
}) {
  const storageKey = `moid_charts:${storageId}`;

  /** Options come from the events AS THE HOST PAGE SCOPED THEM, so the chips
   *  can't offer a stage or size the current range has nothing for. */
  const optionScope = useMemo(
    () => ({ grain: "month" as Grain, dateFrom: base?.dateFrom, dateTo: base?.dateTo, stageIds: base?.stageIds }),
    [base?.dateFrom, base?.dateTo, base?.stageIds],
  );
  const stageOptions = useMemo(
    () => byStage(events, optionScope, DERIVED_REGISTRY).filter((s) => s.checked > 0 || s.rejected > 0),
    [events, optionScope],
  );
  const sizeOptions = useMemo(() => bySize(events, optionScope), [events, optionScope]);
  const defaultGrain = useMemo(() => bestGrain(events), [events]);

  const [draft, setDraft] = useState<ChartSpec>(() => ({
    id: "draft",
    metric: "rejectionRate",
    group: "time",
    grain: defaultGrain,
    stageIds: [],
    sizes: [],
  }));
  const [pinned, setPinned] = useState<ChartSpec[]>([]);

  useEffect(() => {
    setDraft((d) => ({ ...d, grain: defaultGrain }));
  }, [defaultGrain]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setPinned(raw ? (JSON.parse(raw) as ChartSpec[]) : []);
    } catch {
      setPinned([]);
    }
  }, [storageKey]);

  const persist = (next: ChartSpec[]) => {
    setPinned(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* storage full or blocked — the chart still renders this session */
    }
  };

  const toggle = (key: "stageIds" | "sizes", value: string) =>
    setDraft((d) => ({
      ...d,
      [key]: d[key].includes(value) ? d[key].filter((v) => v !== value) : [...d[key], value],
    }));

  const filterSummary = [
    draft.stageIds.length ? `${draft.stageIds.length} stage${draft.stageIds.length > 1 ? "s" : ""}` : null,
    draft.sizes.length ? `${draft.sizes.length} size${draft.sizes.length > 1 ? "s" : ""}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Card title={title} sub={sub}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Row label="Show me">
            {METRICS.map((m) => (
              <Chip key={m.id} on={draft.metric === m.id} onClick={() => setDraft((d) => ({ ...d, metric: m.id }))}>
                {m.label}
              </Chip>
            ))}
          </Row>

          <Row label="Broken down">
            {GROUPS.map((g) => (
              <Chip key={g.id} on={draft.group === g.id} onClick={() => setDraft((d) => ({ ...d, group: g.id }))}>
                {g.label}
              </Chip>
            ))}
            {draft.group === "time" && (
              <>
                <span style={{ width: 1, height: 18, background: "var(--border)", margin: "0 4px" }} />
                {GRAINS.map((g) => (
                  <Chip key={g.id} on={draft.grain === g.id} onClick={() => setDraft((d) => ({ ...d, grain: g.id }))}>
                    {g.label}
                  </Chip>
                ))}
              </>
            )}
          </Row>

          {stageOptions.length > 1 && (
            <Row label="Only these stages">
              <Chip on={draft.stageIds.length === 0} onClick={() => setDraft((d) => ({ ...d, stageIds: [] }))}>
                All
              </Chip>
              {stageOptions.map((s) => (
                <Chip key={s.stageId} on={draft.stageIds.includes(s.stageId)} onClick={() => toggle("stageIds", s.stageId)}>
                  {s.label || s.stageId}
                </Chip>
              ))}
            </Row>
          )}

          {sizeOptions.length > 1 && (
            <Row label="Only these sizes">
              <Chip on={draft.sizes.length === 0} onClick={() => setDraft((d) => ({ ...d, sizes: [] }))}>
                All
              </Chip>
              {sizeOptions.map((s) => (
                <Chip key={s.size} on={draft.sizes.includes(s.size)} onClick={() => toggle("sizes", s.size)}>
                  {s.size}
                </Chip>
              ))}
            </Row>
          )}

          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 14,
              background: "var(--bg)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 13 }}>{describeSpec(draft)}</strong>
              {filterSummary && (
                <span className="muted" style={{ fontSize: 12 }}>
                  filtered to {filterSummary}
                </span>
              )}
              <button
                type="button"
                onClick={() => persist([...pinned, { ...draft, id: `${Date.now()}` }])}
                style={{
                  marginLeft: "auto",
                  padding: "6px 14px",
                  borderRadius: 9999,
                  border: "1px solid var(--accent)",
                  background: "var(--accent)",
                  color: "var(--text-invert)",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Pin this chart
              </button>
            </div>
            <ChartBody events={events} spec={draft} base={base} />
          </div>
        </div>
      </Card>

      {pinned.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 14, marginTop: 14 }}>
          {pinned.map((spec) => (
            <Card
              key={spec.id}
              title={describeSpec(spec)}
              sub={
                [
                  spec.stageIds.length ? `${spec.stageIds.length} stage(s)` : null,
                  spec.sizes.length ? `${spec.sizes.length} size(s)` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "All stages and sizes"
              }
            >
              <ChartBody events={events} spec={spec} base={base} />
              <button
                type="button"
                onClick={() => persist(pinned.filter((p) => p.id !== spec.id))}
                style={{
                  marginTop: 10,
                  padding: "3px 12px",
                  borderRadius: 9999,
                  border: "1px solid var(--border-strong)",
                  background: "transparent",
                  color: "var(--text-3)",
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <span
        className="muted"
        style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, minWidth: 116 }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}
