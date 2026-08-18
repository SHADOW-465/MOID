"use client";

// Data Entry → History.
//
// Same ledger, same collapse functions as the Audit trail (buildEntryRows →
// groupByBatchThenStage) so the two surfaces can never disagree about what a
// batch contains. The difference is job, not data:
//
//   History      — "what did I enter, and which lots are still open?"
//                  Direct entry first, newest first, read + reuse. No erase.
//   Audit trail  — "what is in the ledger, from any source, forever?"
//                  Provenance, corrections, and the erase path (GM only).
//
// Erase deliberately lives on one screen. An operator saving a batch here must
// not be able to un-save it; that is the Audit trail's job and the GM's call.

import React, { useMemo, useState } from "react";
import {
  buildEntryRows,
  filterEntryRows,
  groupByBatchThenStage,
  isDirectEntry,
  batchFiguresInconsistent,
  listRowSizes,
  type AuditBatchGroup,
  type AuditEntryRow,
  type AuditEventLike,
} from "@/lib/analytics/audit-sessions";
import { buildBatchProgress, progressFor } from "@/lib/analytics/batch-progress";
import LotProgress from "@/components/LotProgress";
import EntryRevisionHistory from "@/components/entry/EntryRevisionHistory";
import Icon from "@/components/editorial/Icon";
import { usePersona } from "@/components/app/PersonaContext";

type SourceScope = "mine" | "all";
type StatusScope = "all" | "open" | "complete";

const STAGE_LABEL: Record<string, string> = {
  visual: "Visual",
  balloon: "Balloon",
  "valve-integrity": "Valve Integrity",
  final: "Final",
  production: "Primary production",
  secondary: "Secondary production",
};

const stageLabel = (id: string) => STAGE_LABEL[id] ?? id;

/** One column template for the list header and every row, so figures align. */
/** "15–31 Jul" / "15 Jul – 2 Aug" / "15 Jul". */
function compactRange(from: string, to: string): string {
  const fmt = (iso: string, withMonth: boolean) => {
    const d = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return iso;
    const day = d.getUTCDate();
    return withMonth
      ? `${day} ${d.toLocaleString("en", { month: "short", timeZone: "UTC" })}`
      : String(day);
  };
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(from)) return from;
  if (from === to) return fmt(from, true);
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  return `${fmt(from, !sameMonth)}–${fmt(to, true)}`;
}

const HISTORY_COLS = "16px minmax(92px, 1.1fr) minmax(96px, 0.9fr) 150px 76px 76px 76px";

/** Right-aligned tabular figure; a zero reads as a dash, not a loud 0. */
function Cell({ value, tone }: { value: number; tone?: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-sm)",
        fontWeight: value > 0 ? 600 : 400,
        color: value > 0 ? (tone ?? "var(--text)") : "var(--text-3)",
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value > 0 ? value.toLocaleString() : "\u2014"}
    </span>
  );
}

function fmtDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function fmtStamp(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function EntryHistory({
  events,
  onEdit,
  onReuse,
  initialStatus = "all",
}: {
  events: AuditEventLike[];
  /** Open this station's recorded row on the entry form for correction. */
  onEdit?: (row: AuditEntryRow) => void;
  /** Copy only the lot code onto the form (next station, new quantities). */
  onReuse?: (row: AuditEntryRow) => void;
  /** Status to land on, e.g. arriving from the dashboard's WIP strip. */
  initialStatus?: StatusScope;
}) {
  const { canEraseLedger } = usePersona();
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<SourceScope>("mine");
  const [status, setStatus] = useState<StatusScope>(initialStatus);
  const [size, setSize] = useState("all");
  const [openBatch, setOpenBatch] = useState<string | null>(null);
  const [historyRow, setHistoryRow] = useState<AuditEntryRow | null>(null);

  const progressMap = useMemo(() => buildBatchProgress(events), [events]);

  /** Sizes are scoped to the current source so the list never offers a dead option. */
  const scopedRows = useMemo(() => {
    const scoped = scope === "mine" ? events.filter(isDirectEntry) : events;
    return buildEntryRows(scoped);
  }, [events, scope]);

  const sizeOptions = useMemo(() => listRowSizes(scopedRows), [scopedRows]);

  const groups = useMemo(() => {
    const rows = filterEntryRows(scopedRows, { search, size });
    const all = groupByBatchThenStage(rows);
    if (status === "all") return all;
    return all.filter((g) => {
      const p = progressFor(progressMap, g.batch);
      const complete = p?.status === "complete";
      return status === "complete" ? complete : !complete;
    });
  }, [scopedRows, search, size, status, progressMap]);

  const summary = useMemo(() => {
    let open = 0;
    let stalled = 0;
    let rows = 0;
    for (const g of groups) {
      rows += g.rowCount;
      const p = progressFor(progressMap, g.batch);
      if (p && p.status !== "complete") open += 1;
      if (p?.stalled) stalled += 1;
    }
    return { batches: groups.length, rows, open, stalled };
  }, [groups, progressMap]);

  const searching = search.trim().length > 0;

  return (
    <section
      aria-label="Entry history"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          padding: "var(--pad-card) var(--pad-card) 14px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* No section title: the active tab already reads "History", and two
            identical headings a few pixels apart is noise, not hierarchy. */}
        <div style={{ minWidth: 0 }}>
          <p
            className="muted"
            style={{ fontSize: "var(--text-sm)", margin: 0, maxWidth: "62ch", lineHeight: "var(--leading-body)" }}
          >
            Every batch you have saved, newest first. Open one to read the stages back exactly as
            they were entered.{" "}
            {canEraseLedger ? (
              <>
                Erasing a saved row lives in the{" "}
                <a href="/audit" style={{ color: "var(--accent)", fontWeight: 600 }}>
                  Audit trail
                </a>
                , where the full provenance is visible.
              </>
            ) : (
              <>Saved rows are permanent here — ask a GM if something needs erasing.</>
            )}
          </p>
        </div>

        <div style={{ width: "min(280px, 100%)", flexShrink: 0 }}>
          <input
            type="search"
            placeholder="Search batch, stage, size, defect…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search history"
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-strong)",
              background: "var(--bg)",
              color: "var(--text)",
              fontSize: "var(--text-md)",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        </div>
      </header>

      {/* Filters + counts share one band: the numbers describe the current filter. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "10px 18px",
          padding: "10px var(--pad-card)",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-2, var(--bg))",
        }}
      >
        <SegGroup
          label="Source"
          value={scope}
          onChange={(v) => setScope(v as SourceScope)}
          options={[
            { value: "mine", label: "Typed here" },
            { value: "all", label: "All sources" },
          ]}
        />
        <SegGroup
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as StatusScope)}
          options={[
            { value: "all", label: "All" },
            { value: "open", label: "In progress" },
            { value: "complete", label: "Complete" },
          ]}
        />
        {sizeOptions.length > 0 && (
          <SegGroup
            label="Size"
            value={size}
            onChange={setSize}
            mono
            options={[
              { value: "all", label: "All" },
              ...sizeOptions.map((sz) => ({ value: sz, label: sz.replace(/^Fr/i, "") })),
            ]}
          />
        )}
        <p className="muted" style={{ margin: 0, fontSize: "var(--text-sm)", marginLeft: "auto" }}>
          <Num>{summary.batches}</Num> batch{summary.batches === 1 ? "" : "es"} ·{" "}
          <Num>{summary.rows}</Num> row{summary.rows === 1 ? "" : "s"}
          {summary.open > 0 && (
            <>
              {" · "}
              <Num tone="var(--accent)">{summary.open}</Num> in progress
            </>
          )}
          {summary.stalled > 0 && (
            <>
              {" · "}
              <Num tone="var(--critical)">{summary.stalled}</Num> stalled
            </>
          )}
        </p>
      </div>

      {groups.length === 0 ? (
        <EmptyState searching={searching} query={search.trim()} scope={scope} />
      ) : (
        <div>
          <div
            aria-hidden="true"
            style={{
              display: "grid",
              gridTemplateColumns: HISTORY_COLS,
              gap: 12,
              padding: "6px var(--pad-card)",
              borderBottom: "1px solid var(--border)",
              background: "var(--surface-2)",
              fontSize: "var(--text-2xs)",
              fontWeight: 600,
              letterSpacing: "var(--tracking-label)",
              textTransform: "uppercase",
              color: "var(--text-3)",
            }}
          >
            <span />
            <span>Batch</span>
            <span>Dates</span>
            <span>Gates</span>
            <span style={{ textAlign: "right" }}>Checked</span>
            <span style={{ textAlign: "right" }}>Accepted</span>
            <span style={{ textAlign: "right" }}>Rejected</span>
          </div>
          {groups.map((g) => (
            <HistoryBatch
              key={g.batch}
              group={g}
              open={openBatch === g.batch}
              onToggle={() => setOpenBatch((b) => (b === g.batch ? null : g.batch))}
              progress={progressFor(progressMap, g.batch)}
              onEdit={onEdit}
              onReuse={onReuse}
              onHistory={setHistoryRow}
              canErase={canEraseLedger}
            />
          ))}
        </div>
      )}

      {historyRow && (
        <EntryRevisionHistory row={historyRow} onClose={() => setHistoryRow(null)} />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function HistoryBatch({
  group: g,
  open,
  onToggle,
  progress,
  onEdit,
  onReuse,
  onHistory,
  canErase,
}: {
  group: AuditBatchGroup;
  open: boolean;
  onToggle: () => void;
  progress: ReturnType<typeof progressFor>;
  onEdit?: (row: AuditEntryRow) => void;
  onReuse?: (row: AuditEntryRow) => void;
  onHistory?: (row: AuditEntryRow) => void;
  canErase: boolean;
}) {
  const noBatch = g.batch === "(no batch)";
  const dateLine = compactRange(g.dateFrom, g.dateTo);
  const impossible = batchFiguresInconsistent(g);

  return (
    <article className="audit-row" style={{ borderTop: "1px solid var(--border)" }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: HISTORY_COLS,
          alignItems: "center",
          gap: 12,
          padding: "9px var(--pad-card)",
          border: "none",
          background: open ? "var(--surface-2)" : "transparent",
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "left",
          transition: "background var(--duration-fast) var(--ease-out)",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 16,
            color: "var(--text-3)",
            fontSize: 9,
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform var(--duration-fast) var(--ease-out)",
          }}
        >
          &#9654;
        </span>

        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-md)",
            fontWeight: 700,
            letterSpacing: "0.03em",
            color: noBatch ? "var(--text-3)" : "var(--text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {noBatch ? "No batch id" : g.batch}
          {impossible && (
            <span
              title="Accepted is higher than checked — a gate is missing from this lot, so the two figures cover different lots. Open it to see which gate."
              style={{ marginLeft: 6, color: "var(--warning)", fontFamily: "var(--font-sans)" }}
            >
              &#9888;
            </span>
          )}
        </span>

        <span className="muted" style={{ fontSize: "var(--text-xs)", whiteSpace: "nowrap" }}>
          {dateLine}
        </span>

        <span style={{ minWidth: 0 }}>
          {progress && progress.doneCount > 0 && (
            <LotProgress progress={progress} showLabels={false} />
          )}
        </span>

        <Cell value={g.checkedQty} />
        <Cell value={g.acceptedQty} tone="var(--positive)" />
        <Cell value={g.rejectedQty} tone="var(--critical)" />
      </button>

      {open && (
        <div className="audit-reveal" style={{ padding: "0 var(--pad-card) 16px 46px", display: "grid", gap: 14 }}>
          {g.stages.map((st, i) => (
            <div
              key={st.stageId}
              className="fade-up"
              style={{ animationDelay: `${Math.min(i, 4) * 40}ms` }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  gap: "2px 10px",
                  marginBottom: 6,
                }}
              >
                <h3 style={{ margin: 0, fontSize: "var(--text-md)", fontWeight: 600 }}>
                  {stageLabel(st.stageId)}
                </h3>
                <span className="muted" style={{ fontSize: "var(--text-xs)" }}>
                  {st.rowCount} row{st.rowCount === 1 ? "" : "s"} · <Num>{st.checkedQty.toLocaleString()}</Num>{" "}
                  checked
                  {st.rejectedQty > 0 && (
                    <>
                      {" · "}
                      <Num tone="var(--critical)">{st.rejectedQty.toLocaleString()}</Num> rejected
                    </>
                  )}
                </span>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {st.rows.map((r) => {
                  const rate = r.checked ? (r.rejected / r.checked) * 100 : 0;
                  const edited = r.hasCorrection || r.revisionCount > 1;
                  return (
                    <article
                      key={r.id}
                      style={{
                        position: "relative",
                        border: "1px solid var(--border-strong)",
                        borderRadius: 10,
                        background: "var(--bg)",
                        padding: "12px 14px",
                        paddingRight: 44,
                      }}
                    >
                      {onHistory && (
                        <button
                          type="button"
                          onClick={() => onHistory(r)}
                          aria-label="View edit history"
                          title="Edit history"
                          style={{
                            position: "absolute",
                            top: 10,
                            right: 10,
                            width: 28,
                            height: 28,
                            padding: 0,
                            borderRadius: 8,
                            border: edited
                              ? "1px solid color-mix(in srgb, var(--accent) 45%, var(--border-strong))"
                              : "1px solid var(--border-strong)",
                            background: edited ? "var(--accent-weak)" : "var(--surface)",
                            color: edited ? "var(--accent)" : "var(--text-2)",
                            display: "grid",
                            placeItems: "center",
                            cursor: "pointer",
                          }}
                        >
                          <Icon name="history" size={14} stroke={1.8} />
                        </button>
                      )}
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "6px 14px",
                          alignItems: "baseline",
                          marginBottom: 8,
                        }}
                      >
                        <span style={{ fontWeight: 700, color: "var(--text)" }}>{fmtDate(r.date)}</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
                          {r.size ?? "—"}
                        </span>
                        <span className="muted" style={{ fontSize: 12 }}>
                          Saved {fmtStamp(r.recordedAt)}
                          {edited ? " · edited" : ""}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: r.rework > 0 ? "repeat(4, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))",
                          gap: 8,
                          marginBottom: r.defects.length ? 8 : 0,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>
                            Checked
                          </div>
                          <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                            {r.checked.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>
                            Accepted
                          </div>
                          <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--positive)" }}>
                            {r.accepted.toLocaleString()}
                          </div>
                        </div>
                        {r.rework > 0 && (
                          <div>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>
                              Hold
                            </div>
                            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--warning)" }}>
                              {r.rework.toLocaleString()}
                            </div>
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>
                            Rejected
                          </div>
                          <div
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontWeight: 700,
                              color: r.rejected > 0 ? "var(--critical)" : "var(--text-3)",
                            }}
                            title={r.checked ? `${rate.toFixed(2)}% of checked` : undefined}
                          >
                            {r.rejected.toLocaleString()}
                          </div>
                        </div>
                      </div>
                      {r.defects.length > 0 && (
                        <div style={{ display: "inline-flex", flexWrap: "wrap", gap: 4, marginBottom: onEdit || onReuse ? 8 : 0 }}>
                          {r.defects.map((d) => (
                            <span key={d.code} style={defectChip}>
                              {d.code} <b style={{ fontFamily: "var(--font-mono)" }}>{d.qty}</b>
                            </span>
                          ))}
                        </div>
                      )}
                      {(onEdit || onReuse) && (
                        <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 10 }}>
                          {onEdit && (
                            <button type="button" onClick={() => onEdit(r)} style={linkBtn}>
                              Edit
                            </button>
                          )}
                          {onReuse && (
                            <button type="button" onClick={() => onReuse(r)} style={linkBtn}>
                              Reuse lot
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          ))}

          <p className="muted" style={{ margin: 0, fontSize: "var(--text-xs)" }}>
            <a
              href={`/audit?batch=${encodeURIComponent(g.batch)}`}
              style={{ color: "var(--accent)", fontWeight: 600 }}
            >
              Open in Audit trail
            </a>{" "}
            {canErase
              ? "for provenance, comments and the erase action."
              : "for provenance and comments."}
          </p>
        </div>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */

function SegGroup({
  label,
  value,
  onChange,
  options,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  /** Mono digits for codes like French sizes, so widths stay even. */
  mono?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", fontWeight: 600 }}>{label}</span>
      <div role="group" aria-label={label} style={{ display: "flex", gap: 2 }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
              style={{
                padding: "4px 10px",
                minHeight: 28,
                border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                borderRadius: "var(--radius-pill)",
                background: on ? "var(--accent-weak)" : "transparent",
                color: on ? "var(--accent-text)" : "var(--text-2)",
                fontSize: "var(--text-xs)",
                fontWeight: on ? 700 : 500,
                cursor: "pointer",
                fontFamily: mono ? "var(--font-mono)" : "inherit",
                transition:
                  "background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out)",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ searching, query, scope }: { searching: boolean; query: string; scope: SourceScope }) {
  return (
    <div style={{ padding: "48px 24px", textAlign: "center", display: "grid", gap: 8, justifyItems: "center" }}>
      <p style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 600 }}>
        {searching ? `Nothing matches “${query}”` : "No batches saved yet"}
      </p>
      <p className="muted" style={{ margin: 0, fontSize: "var(--text-sm)", maxWidth: "44ch", lineHeight: "var(--leading-body)" }}>
        {searching
          ? "Try a batch id like 26F27-14, a stage name, or a defect code."
          : scope === "mine"
            ? "Batches you save under Log a batch appear here, with a progress bar showing which assembly gates are done."
            : "Nothing in the ledger for this filter yet — import a workbook or log a batch."}
      </p>
    </div>
  );
}

function Num({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: tone ?? "var(--text)" }}>
      {children}
    </span>
  );
}

const th: React.CSSProperties = {
  padding: "6px 10px",
  fontWeight: 600,
  whiteSpace: "nowrap",
  textTransform: "none",
};

const td: React.CSSProperties = {
  padding: "8px 10px",
  color: "var(--text-2)",
  verticalAlign: "top",
};

const numCell: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

const defectChip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  padding: "1px 7px",
  borderRadius: "var(--radius-pill)",
  border: "1px solid var(--border)",
  background: "var(--bg)",
  fontSize: "var(--text-xs)",
  color: "var(--text-2)",
  whiteSpace: "nowrap",
};

const linkBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--accent)",
  cursor: "pointer",
  fontSize: "var(--text-xs)",
  fontWeight: 700,
  fontFamily: "inherit",
  padding: "2px 4px",
};
