"use client";

// src/components/report/ReportPanel.tsx
//
// "Build report" — the surface behind the Export button (analysis pages) and
// the core of the Reports page editor.
//
// Phase 2: named presets (built-in + user-saved). Load a preset, edit sections,
// Save as… for next time. The full forensic book is one built-in preset.

import { useEffect, useMemo, useState } from "react";
import ReportDocument from "./ReportDocument";
import {
  presetFor,
  availableBlocks,
  moveBlock,
  BLOCK_LABEL,
  cloneSpec,
  isForensicSpec,
  type ReportSpec,
  type ReportBlock,
} from "@/lib/report/blocks";
import {
  listNamedPresets,
  saveNamedPreset,
  deleteNamedPreset,
  getNamedPreset,
  type NamedReportPreset,
} from "@/lib/report/presets-store";
import type { NavKey } from "@/lib/nav-keys";
import {
  describeSourceFilter,
  listExcelSourceFiles,
  listBatchIds,
  type Scope,
} from "@/lib/analytics/scope";
import type { Event } from "@/lib/store/types";
import type { Registry } from "@/lib/analytics/rejection";
import { useTweaks } from "@/components/editorial/TweaksContext";

export default function ReportPanel({
  page,
  events,
  scope,
  periodLabel,
  onClose,
  onDownloadData,
  /** When true, panel is embedded full-page (Reports editor) — no modal chrome. */
  embedded = false,
  registry,
  initialPresetId,
}: {
  page: NavKey;
  events: Event[];
  scope: Scope;
  periodLabel: string;
  onClose?: () => void;
  /** The legacy audit ZIP — kept, but as a side door. */
  onDownloadData?: () => void;
  embedded?: boolean;
  registry?: Registry | null;
  initialPresetId?: string;
}) {
  const { t, setTweak } = useTweaks();
  const [presets, setPresets] = useState<NamedReportPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(initialPresetId ?? null);
  const [spec, setSpec] = useState<ReportSpec | null>(() => {
    if (initialPresetId) {
      const p = getNamedPreset(initialPresetId);
      if (p) return cloneSpec(p.spec);
    }
    return presetFor(page);
  });
  const [saveName, setSaveName] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refreshPresets = () => setPresets(listNamedPresets());

  useEffect(() => {
    refreshPresets();
  }, []);

  const shelf = useMemo(() => availableBlocks(page), [page]);
  const forensic = spec ? isForensicSpec(spec) : false;
  const excelFiles = useMemo(() => listExcelSourceFiles(events), [events]);
  const batchIds = useMemo(() => listBatchIds(events), [events]);
  const sourcesSummary = useMemo(() => describeSourceFilter(scope), [scope]);

  if (!spec) return null;

  const setBlocks = (blocks: ReportBlock[]) => setSpec({ ...spec, blocks });
  const remove = (id: string) => setBlocks(spec.blocks.filter((b) => b.id !== id));
  const add = (block: ReportBlock) =>
    setBlocks([
      ...spec.blocks,
      {
        ...block,
        id: `${block.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      },
    ]);

  function loadPreset(id: string) {
    const p = getNamedPreset(id) ?? listNamedPresets().find((x) => x.id === id);
    if (!p) return;
    setSpec(cloneSpec(p.spec));
    setActivePresetId(p.id);
    setSaveName(p.builtIn ? `${p.name} (copy)` : p.name);
    setMsg(null);
  }

  function handleSave() {
    const name = saveName.trim() || spec!.title;
    const existing =
      activePresetId && !activePresetId.startsWith("builtin:") ? activePresetId : undefined;
    const saved = saveNamedPreset(name, spec!, existing);
    setActivePresetId(saved.id);
    setSaveName(saved.name);
    setShowSave(false);
    refreshPresets();
    setMsg(`Saved “${saved.name}”`);
  }

  function handleDelete() {
    if (!activePresetId || activePresetId.startsWith("builtin:")) return;
    if (!confirm("Delete this saved preset?")) return;
    deleteNamedPreset(activePresetId);
    setActivePresetId(null);
    refreshPresets();
    const fresh = presetFor(page);
    if (fresh) setSpec(cloneSpec(fresh));
    setMsg("Preset deleted");
  }

  // Fixed panel height is what makes overflow:auto actually work on the columns.
  // Without an explicit height, the grid grows with content and nothing scrolls.
  const panelHeight = embedded ? "min(86vh, 920px)" : "min(92vh, 920px)";

  const shell = (
    <div
      style={{
        background: "var(--bg)",
        border: "1px solid var(--border-strong)",
        borderRadius: embedded ? 12 : 14,
        boxShadow: embedded ? "none" : "var(--shadow-lg)",
        width: embedded ? "100%" : "min(1180px, 96vw)",
        height: panelHeight,
        maxHeight: panelHeight,
        display: "grid",
        gridTemplateColumns: "minmax(220px, 280px) minmax(240px, 300px) minmax(0, 1fr)",
        gridTemplateRows: "minmax(0, 1fr)",
        overflow: "hidden",
      }}
    >
      {/* ── Named presets ─────────────────────────────────────────────── */}
      <div style={{ ...col, borderRight: "1px solid var(--border)", background: "var(--surface-2)" }}>
        <div style={colHeader}>
          <div style={{ fontWeight: 800, fontSize: 13 }}>Named presets</div>
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
            Built-in packs and your saves
          </div>
        </div>
        <div style={colScroll}>
          {presets.map((p) => {
            const on = p.id === activePresetId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => loadPreset(p.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 10px",
                  marginBottom: 6,
                  borderRadius: 8,
                  border: on ? "1px solid var(--accent)" : "1px solid var(--border)",
                  background: on ? "var(--accent-weak)" : "var(--surface)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>{p.name}</div>
                {p.description && (
                  <div className="muted" style={{ fontSize: 10.5, marginTop: 3, lineHeight: 1.35 }}>
                    {p.description}
                  </div>
                )}
                {p.builtIn && (
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-3)" }}>
                    Built-in
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Sections editor ───────────────────────────────────────────── */}
      <div style={{ ...col, borderRight: "1px solid var(--border)" }}>
        <div style={colHeader}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{embedded ? "Report editor" : "Build report"}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            {periodLabel}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4, lineHeight: 1.35 }}>
            Preview uses: {sourcesSummary}
          </div>
        </div>

        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <label className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
            Report title
          </label>
          <input
            value={spec.title}
            onChange={(e) => setSpec({ ...spec, title: e.target.value })}
            style={{
              width: "100%",
              marginTop: 5,
              padding: "6px 9px",
              borderRadius: 7,
              border: "1px solid var(--border-strong)",
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: 13,
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Sources — same filter as the header Sources control; drives the live preview */}
        <div
          style={{
            padding: "10px 16px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
            background: "var(--surface-2)",
          }}
        >
          <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, marginBottom: 6 }}>
            Sources in this report
          </div>
          <div className="muted" style={{ fontSize: 11, marginBottom: 8, lineHeight: 1.35 }}>
            {sourcesSummary}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 6, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={t.includeExcel}
              onChange={(e) => {
                setTweak("includeExcel", e.target.checked);
                if (!e.target.checked) setTweak("excelFiles", []);
              }}
            />
            Excel uploads
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={t.includeDirectEntry}
              onChange={(e) => setTweak("includeDirectEntry", e.target.checked)}
            />
            Data entry
          </label>
          {batchIds.length > 0 && (
            <div style={{ maxHeight: 120, overflowY: "auto", marginTop: 4, marginBottom: 6, paddingRight: 4 }}>
              <div className="muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                Batches {t.batchIds.length === 0 ? "(none — full plant)" : `(${t.batchIds.length} selected)`}
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setTweak("batchIds", [...batchIds])}
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    border: "1px solid var(--border-strong)",
                    borderRadius: 6,
                    padding: "2px 8px",
                    background:
                      t.batchIds.length === batchIds.length ? "var(--accent)" : "var(--surface)",
                    color:
                      t.batchIds.length === batchIds.length
                        ? "var(--text-invert, #fff)"
                        : "var(--text)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setTweak("batchIds", [])}
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: "2px 8px",
                    background: "var(--surface)",
                    cursor: t.batchIds.length === 0 ? "default" : "pointer",
                    fontFamily: "inherit",
                    opacity: t.batchIds.length === 0 ? 0.5 : 1,
                  }}
                >
                  Clear
                </button>
              </div>
              {batchIds.map((b) => {
                const selected = t.batchIds.includes(b);
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => {
                      if (selected) {
                        setTweak("batchIds", t.batchIds.filter((x) => x !== b));
                      } else {
                        setTweak("batchIds", [...t.batchIds, b]);
                      }
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      fontSize: 11,
                      marginBottom: 4,
                      padding: "5px 8px",
                      borderRadius: 6,
                      border: selected ? "1px solid var(--accent)" : "1px solid var(--border)",
                      background: selected ? "var(--accent)" : "var(--surface)",
                      color: selected ? "var(--text-invert, #fff)" : "var(--text)",
                      cursor: "pointer",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 700,
                    }}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
          )}
          {t.includeExcel && excelFiles.length > 0 && (
            <div style={{ maxHeight: 120, overflowY: "auto", marginTop: 4, paddingRight: 4 }}>
              <button
                type="button"
                onClick={() => setTweak("excelFiles", [])}
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  marginBottom: 6,
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "2px 8px",
                  background: t.excelFiles.length === 0 ? "var(--accent-weak)" : "var(--surface)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                All Excel files
              </button>
              {excelFiles.map((f) => {
                const checked = t.excelFiles.length === 0 || t.excelFiles.includes(f);
                return (
                  <label
                    key={f}
                    style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 11, marginBottom: 4, cursor: "pointer", lineHeight: 1.3 }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      style={{ marginTop: 2 }}
                      onChange={() => {
                        if (t.excelFiles.length === 0) {
                          setTweak("excelFiles", excelFiles.filter((x) => x !== f));
                        } else if (t.excelFiles.includes(f)) {
                          setTweak("excelFiles", t.excelFiles.filter((x) => x !== f));
                        } else {
                          const next = [...t.excelFiles, f];
                          setTweak("excelFiles", next.length === excelFiles.length ? [] : next);
                        }
                      }}
                    />
                    <span style={{ wordBreak: "break-word" }}>{f}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ ...colScroll, padding: "12px 16px" }}>
          {forensic ? (
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                fontSize: 12.5,
                lineHeight: 1.45,
                color: "var(--text-2)",
              }}
            >
              <strong style={{ color: "var(--text)" }}>Full forensic package</strong>
              <p style={{ margin: "8px 0 0" }}>
                This preset is the complete audit book (stage run charts, matrices, CAPA, sign-off).
                It is not edited section-by-section — load another preset (e.g. GM monthly) to customize blocks.
              </p>
            </div>
          ) : (
            <>
              <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, marginBottom: 8 }}>
                Sections ({spec.blocks.length})
              </div>
              {spec.blocks.map((b, i) => (
                <div
                  key={b.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 8px",
                    marginBottom: 6,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {b.title}
                    </div>
                    <div className="muted" style={{ fontSize: 10.5 }}>{BLOCK_LABEL[b.kind]}</div>
                  </div>
                  <button type="button" onClick={() => setBlocks(moveBlock(spec.blocks, i, -1))} disabled={i === 0} title="Move up" style={iconBtn(i === 0)}>↑</button>
                  <button type="button" onClick={() => setBlocks(moveBlock(spec.blocks, i, 1))} disabled={i === spec.blocks.length - 1} title="Move down" style={iconBtn(i === spec.blocks.length - 1)}>↓</button>
                  <button type="button" onClick={() => remove(b.id)} title="Remove" style={{ ...iconBtn(false), color: "var(--status-bad)" }}>×</button>
                </div>
              ))}

              <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, margin: "16px 0 8px" }}>
                Add a section
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {shelf.map((b, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => add(b)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 9999,
                      border: "1px dashed var(--border-strong)",
                      background: "transparent",
                      color: "var(--text-2)",
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    + {b.title}
                  </button>
                ))}
              </div>
            </>
          )}

          {msg && (
            <div style={{ marginTop: 12, fontSize: 12, color: "var(--positive)", fontWeight: 600 }}>{msg}</div>
          )}
        </div>

        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
          {showSave ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Preset name"
                style={{
                  padding: "7px 10px",
                  borderRadius: 7,
                  border: "1px solid var(--border-strong)",
                  background: "var(--surface)",
                  color: "var(--text)",
                  fontSize: 13,
                }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={handleSave} style={primaryBtn}>Save</button>
                <button type="button" onClick={() => setShowSave(false)} style={ghostBtn}>Cancel</button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSaveName(spec.title);
                setShowSave(true);
              }}
              style={ghostBtn}
            >
              Save as named preset…
            </button>
          )}
          {activePresetId && !activePresetId.startsWith("builtin:") && (
            <button type="button" onClick={handleDelete} style={{ ...ghostBtn, color: "var(--status-bad)" }}>
              Delete this preset
            </button>
          )}
          <button type="button" onClick={() => window.print()} style={primaryBtn}>
            Print / Save as PDF
          </button>
          {onDownloadData && (
            <button type="button" onClick={onDownloadData} style={ghostBtn}>
              Download raw data (CSV/ZIP)
            </button>
          )}
          {onClose && !embedded && (
            <button type="button" onClick={onClose} style={{ ...ghostBtn, border: "none" }}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* ── Preview (own scrollbar) ───────────────────────────────────── */}
      <div style={{ ...col, background: "var(--surface-2)" }}>
        <div style={{ ...colHeader, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13 }}>Preview</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
              Scroll to review the full report
            </div>
          </div>
        </div>
        <div style={{ ...colScroll, padding: 20 }}>
          {events.length === 0 ? (
            <div className="muted" style={{ padding: 40, textAlign: "center", fontSize: 13 }}>
              No data in this period yet — the report has nothing to show.
            </div>
          ) : (
            <ReportDocument
              spec={spec}
              events={events}
              scope={scope}
              periodLabel={periodLabel}
              registry={registry}
            />
          )}
        </div>
      </div>
    </div>
  );

  if (embedded) return shell;

  return (
    <div
      className="no-print"
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
      {/* stopPropagation wrapper must not expand with content — shell owns the height */}
      <div onClick={(e) => e.stopPropagation()} style={{ maxHeight: "96vh", minHeight: 0 }}>
        {shell}
      </div>
    </div>
  );
}

/** Column shell: fills grid cell, never grows past panel height. */
const col: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  minWidth: 0,
  height: "100%",
  overflow: "hidden",
};

const colHeader: React.CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid var(--border)",
  flexShrink: 0,
};

/** Dedicated scrollbar region inside a column. */
const colScroll: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  overflowX: "hidden",
  overscrollBehavior: "contain",
  padding: 10,
  WebkitOverflowScrolling: "touch",
};

const iconBtn = (disabled: boolean): React.CSSProperties => ({
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 6,
  width: 22,
  height: 22,
  lineHeight: 1,
  fontSize: 12,
  color: "var(--text-2)",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.35 : 1,
  flexShrink: 0,
});

const ghostBtn: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 9999,
  border: "1px solid var(--border-strong)",
  background: "transparent",
  color: "var(--text-2)",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 9999,
  border: "none",
  background: "var(--accent)",
  color: "var(--text-invert, #fff)",
  fontWeight: 700,
  fontSize: 13.5,
  cursor: "pointer",
  fontFamily: "inherit",
};
