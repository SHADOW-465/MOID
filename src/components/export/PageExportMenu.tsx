"use client";

import React, { useState } from "react";
import Select from "@/components/ui/Select";
import {
  buildPageExport,
  downloadBlob,
  type ExportFormat,
  type ExportSection,
} from "@/lib/export/page-export";

export default function PageExportMenu({
  page,
  sections,
}: {
  page: string;
  sections: ExportSection[];
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [kpi, setKpi] = useState(true);
  const [table, setTable] = useState(true);
  const [chart, setChart] = useState(false);

  function run() {
    const { blob, fileName } = buildPageExport({
      page,
      sections,
      include: { kpi, table, chart },
      format,
    });
    downloadBlob(blob, fileName);
    setOpen(false);
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "var(--surface)",
          color: "var(--text)",
          border: "1px solid var(--border-strong)",
          borderRadius: 30,
          padding: "6px 14px",
          fontSize: 11.5,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
          boxShadow: "var(--shadow-sm)",
          minHeight: 32,
        }}
      >
        Export page ▾
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            marginTop: 6,
            width: 260,
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: 10,
            boxShadow: "var(--shadow-lg)",
            padding: 12,
            zIndex: 50,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-3)", marginBottom: 8 }}>
            This page only
          </div>
          <label style={lab}>
            Format
            <Select
              value={format}
              onChange={(v) => setFormat(v as ExportFormat)}
              options={[
                { value: "csv", label: "CSV", hint: "Opens in Excel" },
                { value: "json", label: "JSON", hint: "For scripts and APIs" },
              ]}
              size="sm"
              ariaLabel="Export format"
            />
          </label>
          <div style={{ fontSize: 12, fontWeight: 600, margin: "8px 0 4px", color: "var(--text-2)" }}>Include</div>
          <label style={chk}><input type="checkbox" checked={kpi} onChange={(e) => setKpi(e.target.checked)} /> KPIs</label>
          <label style={chk}><input type="checkbox" checked={table} onChange={(e) => setTable(e.target.checked)} /> Tables</label>
          <label style={chk}><input type="checkbox" checked={chart} onChange={(e) => setChart(e.target.checked)} /> Charts (metadata)</label>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" onClick={() => setOpen(false)} style={ghost}>Cancel</button>
            <button type="button" onClick={run} style={primary}>Download</button>
          </div>
        </div>
      )}
    </div>
  );
}

const lab: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--text-2)" };
const sel: React.CSSProperties = { padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border-strong)", fontFamily: "inherit", fontSize: 12, background: "var(--surface-2)", color: "var(--text)" };
const chk: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginBottom: 4, cursor: "pointer", color: "var(--text)" };
const ghost: React.CSSProperties = { flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "var(--surface)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 12 };
const primary: React.CSSProperties = { flex: 1, padding: "7px 10px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--text-invert, #fff)", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 12 };
