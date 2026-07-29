"use client";

// Floating Sources / Scope panel — channels, batches, Excel files.
// Same modal chrome as Export report: centered card over dimmed backdrop.

import { useEffect, useMemo, useState } from "react";
import { useTweaks } from "@/components/editorial/TweaksContext";
import {
  countBySourceChannel,
  describeSourceFilter,
  listBatchIds,
  listExcelSourceFiles,
  resolveScope,
} from "@/lib/analytics/scope";
import type { Event } from "@/lib/store/types";

export default function SourcesScopePanel({
  events,
  onClose,
}: {
  events: Event[];
  onClose: () => void;
}) {
  const { t, setTweak } = useTweaks();
  const [batchSearch, setBatchSearch] = useState("");
  const [fileSearch, setFileSearch] = useState("");

  const excelFiles = useMemo(() => listExcelSourceFiles(events), [events]);
  const batchOptions = useMemo(() => listBatchIds(events), [events]);
  const sourceCounts = useMemo(() => countBySourceChannel(events), [events]);

  const filteredBatches = useMemo(() => {
    const q = batchSearch.trim().toUpperCase();
    if (!q) return batchOptions;
    return batchOptions.filter((b) => b.includes(q));
  }, [batchOptions, batchSearch]);

  const filteredFiles = useMemo(() => {
    const q = fileSearch.trim().toLowerCase();
    if (!q) return excelFiles;
    return excelFiles.filter((f) => f.toLowerCase().includes(q));
  }, [excelFiles, fileSearch]);

  const scope = useMemo(() => resolveScope(events, t), [events, t]);
  const summary = useMemo(() => describeSourceFilter(scope), [scope]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function resetAll() {
    setTweak("includeExcel", true);
    setTweak("includeDirectEntry", true);
    setTweak("excelFiles", []);
    setTweak("batchIds", []);
    setBatchSearch("");
    setFileSearch("");
  }

  /** Explicit multi-select: empty = no batch filter (full plant). */
  function toggleBatch(b: string) {
    if (t.batchIds.includes(b)) {
      setTweak("batchIds", t.batchIds.filter((x) => x !== b));
    } else {
      setTweak("batchIds", [...t.batchIds, b]);
    }
  }

  function selectAllBatches() {
    setTweak("batchIds", [...batchOptions]);
  }

  function clearBatchSelection() {
    setTweak("batchIds", []);
  }

  function toggleFile(f: string) {
    if (t.excelFiles.length === 0) {
      setTweak("excelFiles", excelFiles.filter((x) => x !== f));
    } else if (t.excelFiles.includes(f)) {
      setTweak("excelFiles", t.excelFiles.filter((x) => x !== f));
    } else {
      const next = [...t.excelFiles, f];
      setTweak("excelFiles", next.length === excelFiles.length ? [] : next);
    }
  }

  const batchSelectedCount = t.batchIds.length;
  const allBatchesSelected =
    batchOptions.length > 0 && batchSelectedCount === batchOptions.length;
  const filesActive = t.excelFiles.length > 0;

  return (
    <div
      className="no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sources-scope-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        background: "color-mix(in srgb, #000 45%, transparent)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "2vh 2vw",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(920px, 96vw)",
          height: "min(72vh, 640px)",
          maxHeight: "92vh",
          background: "var(--bg)",
          border: "1px solid var(--border-strong)",
          borderRadius: 14,
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
            background: "var(--surface)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              id="sources-scope-title"
              style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.01em" }}
            >
              Sources &amp; batches
            </div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.4 }}>
              Choose which channels, batches, and Excel files feed the dashboard.
              Filters apply immediately to every analytics screen.
            </div>
            <div
              style={{
                marginTop: 10,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 10px",
                borderRadius: 8,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-2)",
                maxWidth: "100%",
              }}
            >
              <span className="muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Active
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {summary}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "1px solid var(--border-strong)",
              background: "var(--surface-2)",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              color: "var(--text-2)",
              flexShrink: 0,
              fontFamily: "inherit",
            }}
          >
            ×
          </button>
        </div>

        {/* Body: 3 columns */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: "minmax(180px, 220px) minmax(0, 1fr) minmax(0, 1fr)",
            overflow: "hidden",
          }}
        >
          {/* Channels */}
          <section
            style={{
              ...col,
              borderRight: "1px solid var(--border)",
              background: "var(--surface-2)",
            }}
          >
            <div style={colHeader}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>Channels</div>
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                Excel vs Data Entry
              </div>
            </div>
            <div style={{ ...colScroll, padding: "12px 14px" }}>
              <label style={rowLabel}>
                <input
                  type="checkbox"
                  checked={t.includeExcel}
                  onChange={(e) => {
                    setTweak("includeExcel", e.target.checked);
                    if (!e.target.checked) setTweak("excelFiles", []);
                  }}
                />
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontWeight: 700, fontSize: 13 }}>Excel uploads</span>
                  <span className="muted" style={{ fontSize: 11 }}>Workbooks from Staging</span>
                </span>
                <span style={countBadge}>{sourceCounts.excel}</span>
              </label>
              <label style={{ ...rowLabel, marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={t.includeDirectEntry}
                  onChange={(e) => setTweak("includeDirectEntry", e.target.checked)}
                />
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontWeight: 700, fontSize: 13 }}>Data entry</span>
                  <span className="muted" style={{ fontSize: 11 }}>Batch matrix / manual</span>
                </span>
                <span style={countBadge}>{sourceCounts.directEntry}</span>
              </label>

              <div
                className="muted"
                style={{ fontSize: 11.5, lineHeight: 1.45, marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)" }}
              >
                Turn a channel off to hide it plant-wide. Batch filter still applies across whatever stays on.
              </div>
            </div>
          </section>

          {/* Batches */}
          <section style={{ ...col, borderRight: "1px solid var(--border)" }}>
            <div style={colHeader}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>Batches</div>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    color: batchSelectedCount > 0 ? "var(--accent)" : "var(--text-3)",
                  }}
                >
                  {batchSelectedCount === 0
                    ? "none selected"
                    : allBatchesSelected
                      ? `all ${batchOptions.length}`
                      : `${batchSelectedCount} selected`}
                </span>
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                Pick batches to focus the dashboard. None selected = full plant.
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={selectAllBatches}
                  disabled={batchOptions.length === 0}
                  style={chipBtn(allBatchesSelected)}
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={clearBatchSelection}
                  disabled={batchSelectedCount === 0}
                  style={chipBtn(false)}
                >
                  Clear
                </button>
                <input
                  type="search"
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                  placeholder="Search batch…"
                  style={searchInput}
                />
              </div>
            </div>
            <div style={{ ...colScroll, padding: "8px 14px 14px" }}>
              {batchOptions.length === 0 && (
                <EmptyState>
                  No batch IDs on ledger events yet. Enter batches in Data Entry (or map batch columns from Excel).
                </EmptyState>
              )}
              {batchOptions.length > 0 && filteredBatches.length === 0 && (
                <EmptyState>No batches match “{batchSearch}”.</EmptyState>
              )}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                  gap: 8,
                }}
              >
                {filteredBatches.map((b) => {
                  const selected = t.batchIds.includes(b);
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => toggleBatch(b)}
                      aria-pressed={selected}
                      title={selected ? "Selected — click to deselect" : "Click to select"}
                      style={{
                        textAlign: "left",
                        padding: "11px 12px",
                        borderRadius: 10,
                        border: selected
                          ? "1px solid var(--accent)"
                          : "1px solid var(--border-strong)",
                        background: selected ? "var(--accent)" : "var(--surface)",
                        color: selected ? "var(--text-invert, #fff)" : "var(--text)",
                        boxShadow: selected ? "var(--shadow-sm)" : "none",
                        cursor: "pointer",
                        fontFamily: "var(--font-mono)",
                        fontSize: 12.5,
                        fontWeight: 700,
                        transition: "background 0.12s ease, color 0.12s ease, border-color 0.12s ease",
                      }}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Excel files */}
          <section style={col}>
            <div style={colHeader}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>Excel files</div>
                <span className="muted" style={{ fontSize: 11 }}>
                  {!t.includeExcel
                    ? "channel off"
                    : filesActive
                      ? `${t.excelFiles.length} selected`
                      : "all"}
                </span>
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                Restrict to specific uploads
              </div>
              {t.includeExcel && excelFiles.length > 0 && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setTweak("excelFiles", [])}
                    style={chipBtn(!filesActive)}
                  >
                    All files
                  </button>
                  <input
                    type="search"
                    value={fileSearch}
                    onChange={(e) => setFileSearch(e.target.value)}
                    placeholder="Search file…"
                    style={searchInput}
                  />
                </div>
              )}
            </div>
            <div style={{ ...colScroll, padding: "8px 14px 14px" }}>
              {!t.includeExcel && (
                <EmptyState>Excel channel is off. Enable it in Channels to filter individual files.</EmptyState>
              )}
              {t.includeExcel && excelFiles.length === 0 && (
                <EmptyState>No Excel-sourced events in the ledger yet.</EmptyState>
              )}
              {t.includeExcel && excelFiles.length > 0 && filteredFiles.length === 0 && (
                <EmptyState>No files match “{fileSearch}”.</EmptyState>
              )}
              {t.includeExcel &&
                filteredFiles.map((f) => {
                  const checked = !filesActive || t.excelFiles.includes(f);
                  return (
                    <label
                      key={f}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        padding: "9px 10px",
                        marginBottom: 4,
                        borderRadius: 8,
                        border: checked ? "1px solid var(--border)" : "1px solid transparent",
                        background: checked ? "var(--surface)" : "transparent",
                        opacity: checked ? 1 : 0.55,
                        cursor: "pointer",
                        lineHeight: 1.35,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        style={{ marginTop: 2 }}
                        onChange={() => toggleFile(f)}
                      />
                      <span style={{ fontSize: 12.5, wordBreak: "break-word", fontWeight: 500 }}>
                        {f}
                      </span>
                    </label>
                  );
                })}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 20px",
            borderTop: "1px solid var(--border)",
            background: "var(--surface)",
            flexShrink: 0,
          }}
        >
          <button type="button" onClick={resetAll} style={ghostBtn}>
            Reset to all sources
          </button>
          <button type="button" onClick={onClose} style={primaryBtn}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="muted"
      style={{
        fontSize: 12.5,
        lineHeight: 1.45,
        padding: "16px 8px",
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}

const col: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  minWidth: 0,
  overflow: "hidden",
};

const colHeader: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid var(--border)",
  flexShrink: 0,
};

const colScroll: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  overflowX: "hidden",
  overscrollBehavior: "contain",
};

const rowLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: "10px 10px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  cursor: "pointer",
  fontSize: 13,
};

const countBadge: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  fontWeight: 700,
  color: "var(--text-3)",
  padding: "2px 6px",
  borderRadius: 6,
  background: "var(--surface-2)",
  flexShrink: 0,
};

const chipBtn = (active: boolean): React.CSSProperties => ({
  fontSize: 11.5,
  fontWeight: 700,
  border: active ? "1px solid var(--accent)" : "1px solid var(--border-strong)",
  borderRadius: 8,
  padding: "5px 10px",
  background: active ? "var(--accent)" : "var(--surface)",
  color: active ? "var(--text-invert, #fff)" : "var(--text)",
  cursor: "pointer",
  fontFamily: "inherit",
  flexShrink: 0,
  whiteSpace: "nowrap",
});

const searchInput: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: 12,
  padding: "5px 10px",
  border: "1px solid var(--border-strong)",
  borderRadius: 8,
  background: "var(--surface-2)",
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
};

const ghostBtn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid var(--border-strong)",
  background: "var(--surface)",
  cursor: "pointer",
  fontFamily: "inherit",
  fontWeight: 600,
  fontSize: 12.5,
  color: "var(--text-2)",
};

const primaryBtn: React.CSSProperties = {
  padding: "8px 18px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "var(--text-invert, #fff)",
  cursor: "pointer",
  fontFamily: "inherit",
  fontWeight: 700,
  fontSize: 12.5,
};
