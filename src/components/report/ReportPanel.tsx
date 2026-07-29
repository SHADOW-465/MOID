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
import type { Scope } from "@/lib/analytics";
import type { Event } from "@/lib/store/types";
import type { Registry } from "@/lib/analytics/rejection";

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

  const shell = (
    <div
      style={{
        background: "var(--bg)",
        border: embedded ? "1px solid var(--border-strong)" : "1px solid var(--border-strong)",
        borderRadius: embedded ? 12 : 14,
        boxShadow: embedded ? "none" : "var(--shadow-lg)",
        width: embedded ? "100%" : "min(1180px, 96vw)",
        maxHeight: embedded ? "none" : "94vh",
        height: embedded ? "min(86vh, 900px)" : undefined,
        display: "grid",
        gridTemplateColumns: "280px 300px minmax(0, 1fr)",
        overflow: "hidden",
      }}
    >
      {/* ── Named presets ─────────────────────────────────────────────── */}
      <div style={{ borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", minHeight: 0, background: "var(--surface-2)" }}>
        <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 800, fontSize: 13 }}>Named presets</div>
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
            Built-in packs and your saves
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
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
      <div style={{ borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{embedded ? "Report editor" : "Build report"}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            {periodLabel}
          </div>
        </div>

        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
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

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
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

        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
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

      {/* ── Preview ───────────────────────────────────────────────────── */}
      <div style={{ overflowY: "auto", padding: 20, background: "var(--surface-2)", minHeight: 0 }}>
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
        alignItems: "flex-start",
        padding: "3vh 2vw",
      }}
    >
      <div onClick={(e) => e.stopPropagation()}>{shell}</div>
    </div>
  );
}

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
