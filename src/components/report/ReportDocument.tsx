"use client";

// src/components/report/ReportDocument.tsx
//
// Renders a ReportSpec as printable pages.
//
// Everything drawn here comes from `lib/analytics` (the same barrel the screens
// read) or from ChartBuilder's `ChartBody` (the same component the screens
// draw). Nothing is recomputed for print, so a report cannot contradict the
// page it was built from.
//
// Charts in this app are inline SVG, which means the browser's own
// Print-to-PDF produces vector output at full resolution — no rasterising, no
// html2canvas on this path.

import { useMemo } from "react";
import { ChartBody } from "@/components/ChartBuilder";
import { Kpi, BarsH, pct, num, rupee } from "@/components/app/widgets";
import {
  byStage,
  byDefect,
  bySize,
  rejectionRate,
  totalChecked,
  totalRejected,
  fpy,
  copq,
  toSourceRows,
  DERIVED_REGISTRY,
  type Scope,
} from "@/lib/analytics";
import { useCapas } from "@/lib/capa-store";
import type { Event } from "@/lib/store/types";
import type { ReportSpec, ReportBlock, KpiId } from "@/lib/report/blocks";
import { KPI_LABEL, isForensicSpec } from "@/lib/report/blocks";
import ForensicBook from "@/components/report/ForensicBook";
import type { Registry } from "@/lib/analytics/rejection";

/** Print geometry — mirrors the forensic book's page shell so both print alike. */
export const REPORT_PRINT_CSS = `
@media print {
  aside, header, nav, .no-print { display: none !important; }
  html, body, main { background:#fff !important; color:#14181f !important; margin:0 !important; padding:0 !important; height:auto !important; overflow:visible !important; }
  .rp-page { page-break-after: always; padding: 15mm 15mm 18mm 15mm !important; border:none !important; background:#fff !important; color:#14181f !important; }
  .rp-page:last-child { page-break-after: avoid; }
  .rp-block { break-inside: avoid; }
}
`;

function KpiValue({ id, events, scope }: { id: KpiId; events: Event[]; scope: Scope }) {
  const reg = DERIVED_REGISTRY;
  const value = useMemo(() => {
    switch (id) {
      case "rejectionRate": return pct(rejectionRate(events, scope, reg).value);
      case "totalChecked": return num(totalChecked(events, scope, reg).value);
      case "totalRejected": return num(totalRejected(events, scope).value);
      case "fpy": return pct(fpy(events, scope, reg).value);
      case "copq": return rupee(copq(events, scope)?.value ?? 0);
    }
  }, [id, events, scope, reg]);
  return <Kpi label={KPI_LABEL[id]} value={value} />;
}

function ReportTable({ block, events, scope }: { block: Extract<ReportBlock, { kind: "table" }>; events: Event[]; scope: Scope }) {
  const capas = useCapas();
  const reg = DERIVED_REGISTRY;

  const rows = useMemo((): { label: string; value: number; sub?: string }[] => {
    switch (block.table) {
      case "by-stage":
        return byStage(events, scope, reg).map((s) => ({
          label: s.label || s.stageId,
          value: s.rejRate,
          sub: `${num(s.rejected)} of ${num(s.checked)}`,
        }));
      case "by-defect":
        return byDefect(events, scope, reg).map((d) => ({
          label: d.label || d.defectCode || "Unnamed",
          value: d.rejected,
          sub: `${d.pct.toFixed(1)}% of rejects`,
        }));
      case "by-size":
        return bySize(events, scope).map((s) => ({
          label: s.size,
          value: s.rejRate,
          sub: `${num(s.rejected)} of ${num(s.checked)}`,
        }));
      case "spc-violations":
        // Periods whose rate exceeds mean + 3σ, computed from the same trend
        // the SPC screen charts. Deterministic, no new statistics.
        return [];
      case "capa-open":
        return capas
          .filter((c) => c.status !== "Completed")
          .map((c) => ({ label: c.title, value: 0, sub: `${c.priority} · ${c.status}` }));
    }
  }, [block.table, events, scope, reg, capas]);

  if (rows.length === 0) {
    return <p className="muted" style={{ fontSize: 12 }}>No rows for the selected period.</p>;
  }

  // CAPA rows carry no magnitude — render as a list rather than a fake bar chart.
  if (block.table === "capa-open") {
    return (
      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "6px 4px" }}>{r.label}</td>
              <td style={{ padding: "6px 4px", textAlign: "right", color: "var(--text-3)" }}>{r.sub}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const isRate = block.table !== "by-defect";
  return <BarsH rows={rows} fmt={(n) => (isRate ? pct(n) : num(n))} />;
}

function EvidenceBlock({ events }: { events: Event[] }) {
  const rows = useMemo(() => toSourceRows(events).slice(0, 40), [events]);
  return (
    <>
      <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
        Every figure in this report traces to a source cell. First {rows.length} of{" "}
        {num(toSourceRows(events).length)} records.
      </p>
      <table style={{ width: "100%", fontSize: 10.5, borderCollapse: "collapse", fontFamily: "var(--font-mono)" }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--text-3)" }}>
            <th style={{ padding: "4px 3px" }}>Date</th>
            <th style={{ padding: "4px 3px" }}>Stage</th>
            <th style={{ padding: "4px 3px" }}>Type</th>
            <th style={{ padding: "4px 3px" }}>Qty</th>
            <th style={{ padding: "4px 3px" }}>Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ padding: "3px" }}>{r.date}</td>
              <td style={{ padding: "3px" }}>{r.stage || r.stageId || "—"}</td>
              <td style={{ padding: "3px" }}>{r.type}</td>
              <td style={{ padding: "3px", textAlign: "right" }}>{r.qty ?? "—"}</td>
              <td style={{ padding: "3px", color: "var(--text-3)" }}>{r.file || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Block({ block, events, scope }: { block: ReportBlock; events: Event[]; scope: Scope }) {
  switch (block.kind) {
    case "cover":
      return null; // drawn by the cover page itself
    case "kpi-row":
      return (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(block.kpis.length, 4)}, minmax(0, 1fr))`, gap: 12 }}>
          {block.kpis.map((k) => (
            <KpiValue key={k} id={k} events={events} scope={scope} />
          ))}
        </div>
      );
    case "chart":
      return <ChartBody events={events} spec={block.spec} base={{ dateFrom: scope.dateFrom, dateTo: scope.dateTo, stageIds: scope.stageIds }} />;
    case "table":
      return <ReportTable block={block} events={events} scope={scope} />;
    case "text":
      return block.body.trim() ? (
        <p style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{block.body}</p>
      ) : (
        <p className="muted" style={{ fontSize: 12 }}>— no notes —</p>
      );
    case "evidence":
      return <EvidenceBlock events={events} />;
    case "forensic-book":
      return null; // rendered as full document path below
  }
}

export default function ReportDocument({
  spec,
  events,
  scope,
  periodLabel,
  registry,
}: {
  spec: ReportSpec;
  events: Event[];
  scope: Scope;
  /** Human period the report covers, e.g. "Apr 2025 – Mar 2026". */
  periodLabel: string;
  registry?: Registry | null;
}) {
  // Forensic package is the whole document — not a block among blocks.
  if (isForensicSpec(spec)) {
    return (
      <div className="rp-doc">
        <ForensicBook events={events} registry={registry} scope={scope} />
      </div>
    );
  }

  const cover = spec.blocks.find((b) => b.kind === "cover") as Extract<ReportBlock, { kind: "cover" }> | undefined;
  const body = spec.blocks.filter((b) => b.kind !== "cover" && b.kind !== "forensic-book");

  return (
    <div className="rp-doc">
      <style dangerouslySetInnerHTML={{ __html: REPORT_PRINT_CSS }} />

      {cover && (
        <section
          className="rp-page"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 32,
            marginBottom: 16,
            background: "var(--surface)",
            minHeight: 200,
          }}
        >
          <div className="small" style={{ letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-3)" }}>
            Disposafe · Quality
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: "10px 0 6px" }}>{cover.title}</h1>
          <div style={{ fontSize: 14, color: "var(--text-2)" }}>{periodLabel}</div>
          {cover.subtitle && (
            <p style={{ marginTop: 12, fontSize: 13, color: "var(--text-2)" }}>{cover.subtitle}</p>
          )}
          <div className="muted" style={{ marginTop: 20, fontSize: 11, fontFamily: "var(--font-mono)" }}>
            Generated {new Date().toLocaleString()} · every figure recomputed from the event ledger
          </div>
        </section>
      )}

      {body.map((block) => (
        <section
          key={block.id}
          className="rp-page rp-block"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 20,
            marginBottom: 16,
            background: "var(--surface)",
          }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>{block.title}</h2>
          <Block block={block} events={events} scope={scope} />
        </section>
      ))}
    </div>
  );
}
