"use client";

// src/components/MonthlyEntryGrid.tsx
// Spreadsheet-style entry surface for /data-entry — one row per calendar day
// of a selected period, for a chosen Stage (+ Size for size-wise stages).
//
// Grid definition comes from GET /api/entry-template (verified MOD layout +
// per-stage capture/defect columns). Never from a company-wide hardcoded
// defect catalog or /api/schema registry shim.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StageDayRecord } from "@/lib/ingest/emit";
import { buildReviewRows, applyEdit, defectMatches } from "@/lib/ingest/review";
import { useEvents } from "@/components/app/EventsContext";
import { loadDraft, saveDraft } from "@/lib/entry/draft";
import { type EntryGrain, resolvePeriod, stepPeriod, periodLabel } from "@/lib/entry/period";
import QtyInput from "@/components/entry/QtyInput";

type TemplateColumn = { key: string; label: string; type: "number"; required: boolean };
type TemplateDefect = { defectCode: string; label: string; sources?: string[] };
type TemplateStage = {
  stageId: string;
  label: string;
  sizeWise: boolean;
  isQualityGate: boolean;
  columns: TemplateColumn[];
  defects: TemplateDefect[];
  layout: {
    sheet: string;
    tableId: string;
    headerRows: (string | number | null)[][];
    merges: unknown[];
  } | null;
};
type EntryTemplate = {
  stages: TemplateStage[];
  sizes: { sizeId: string; label: string }[];
  generatedFrom?: { modId: string; version: number; fileName: string }[];
};

/** Record field keyed by entry-template column key. */
const COL_TO_RECORD: Record<string, "checked" | "acceptedGood" | "rework" | "rejected"> = {
  checked: "checked",
  acceptedGood: "acceptedGood",
  rework: "rework",
  rejected: "rejected",
};

export default function MonthlyEntryGrid({
  onDirtyChange,
  customFields,
  grain,
  anchorDate,
  onAnchorChange,
  blockedReason,
}: {
  onDirtyChange?: (dirty: boolean) => void;
  customFields?: Record<string, any>;
  grain: EntryGrain;
  anchorDate: string;
  onAnchorChange?: (next: string) => void;
  blockedReason?: string | null;
}) {
  const { refreshEvents } = useEvents();
  const [template, setTemplate] = useState<EntryTemplate | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [activeSize, setActiveSize] = useState<string | null>(null);
  const { from, to } = useMemo(() => resolvePeriod(grain, anchorDate), [grain, anchorDate]);

  const [records, setRecords] = useState<StageDayRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;
  useEffect(() => {
    onDirtyChangeRef.current?.(dirty);
  }, [dirty]);

  const loadTemplate = useCallback(async () => {
    setTemplateLoading(true);
    setTemplateError(null);
    try {
      const res = await fetch("/api/entry-template", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTemplate(null);
        setTemplateError(data.error ?? "No entry template — upload and verify a workbook first.");
        return;
      }
      setTemplate(data.template ?? null);
      if (!data.template?.stages?.length) {
        setTemplateError("No stages in the verified ontology yet.");
      }
    } catch {
      setTemplate(null);
      setTemplateError("Failed to load entry template.");
    } finally {
      setTemplateLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplate();
    // Verifying a workbook in another tab must reshape this grid without a
    // hard reload — the schema is learned live, so refetch when we regain focus.
    const onFocus = () => loadTemplate();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadTemplate]);

  const stages = template?.stages ?? [];
  const sizes = template?.sizes ?? [];

  useEffect(() => {
    if (activeStageId && stages.some((s) => s.stageId === activeStageId)) return;
    setActiveStageId(stages[0]?.stageId ?? null);
  }, [stages, activeStageId]);

  const activeStage = useMemo(
    () => stages.find((s) => s.stageId === activeStageId) ?? null,
    [stages, activeStageId],
  );

  const isSizeWise = !!activeStage?.sizeWise && sizes.length > 0;

  useEffect(() => {
    if (!isSizeWise) {
      setActiveSize(null);
      return;
    }
    if (activeSize && sizes.some((s) => s.sizeId === activeSize)) return;
    setActiveSize(sizes[0]?.sizeId ?? null);
  }, [isSizeWise, sizes, activeSize]);

  /** Capture columns from the MOD stage (checked / good / rework / rejected). */
  const captureCols: TemplateColumn[] = activeStage?.columns ?? [];
  /**
   * Defect columns for THIS stage only — from the workbook MOD that defined the
   * stage (entity columns preferred). Never the merged company catalog.
   */
  const defectCols: TemplateDefect[] = activeStage?.defects ?? [];

  const rowKey = isSizeWise ? activeSize : "__line__";
  const rowId = (date: string) => `${date}|${rowKey}`;

  /**
   * Rows whose Rejected total was *stated* — typed by the operator, or loaded
   * from an already-saved record. Auto-fill from defects writes Rejected only
   * for rows NOT in this set, so a number a human entered is never rewritten
   * by a later defect keystroke. That rewrite was the old chaos.
   *
   * A ref, not state, on purpose: it is read and written inside the same
   * synchronous setRecords updater as the edit it governs, so there is no
   * render between "user typed" and "auto-fill decides" for a stale value to
   * leak through. Cleared and re-seeded by loadRange when the slice changes.
   */
  const rejectedStated = useRef<Set<string>>(new Set());

  const blankRecord = (date: string): StageDayRecord => ({
    occurredOn: { kind: "day", start: date, end: date },
    stageId: activeStageId!,
    size: rowKey === "__line__" ? null : rowKey,
    source: { file: "Manual Entry", fileHash: `manual-${date}`, sheet: "Data Entry", tableId: "entry" },
    checked: null,
    acceptedGood: null,
    rework: null,
    rejected: null,
    defects: [],
    statedPct: null,
    extractedBy: "direct-entry",
    ingestionId: "pending",
  });

  /** Commit a capture column. null clears the field. Never rewrites other columns. */
  const updateCapture = (date: string, colKey: string, num: number | null) => {
    const prop = COL_TO_RECORD[colKey];
    if (!prop) return;
    if (prop === "rejected") {
      // Typing it makes it stated; clearing it hands the row back to auto-fill.
      if (num == null) rejectedStated.current.delete(rowId(date));
      else rejectedStated.current.add(rowId(date));
    }
    setDirty(true);
    setRecords((prev) => {
      let idx = prev.findIndex((r) => r.occurredOn.start === date && (r.size ?? "__line__") === rowKey);
      let next = prev;
      if (idx < 0) {
        if (num == null) return prev;
        next = [...prev, blankRecord(date)];
        idx = next.length - 1;
      }
      if (num == null) {
        return next.map((r, i) => (i !== idx ? r : { ...r, [prop]: null, extractedBy: "direct-entry" }));
      }
      return applyEdit(next, idx, prop, num);
    });
  };

  /**
   * Commit a defect count. null/0 removes that defect.
   *
   * Rejected is DERIVED here, never negotiated: if the operator logged defects
   * before stating a Rejected total, Rejected mirrors the defect sum. Once the
   * operator states Rejected themselves, this stops writing and the row is
   * reconciled by comparison instead (see `mismatches`).
   */
  const updateDefect = (date: string, defectCode: string, num: number | null) => {
    setDirty(true);
    const label = defectCols.find((d) => d.defectCode === defectCode)?.label;
    setRecords((prev) => {
      let idx = prev.findIndex((r) => r.occurredOn.start === date && (r.size ?? "__line__") === rowKey);
      let next = prev;
      if (idx < 0) {
        if (num == null || num === 0) return prev;
        next = [...prev, blankRecord(date)];
        idx = next.length - 1;
      }
      if (num == null || num === 0) {
        next = next.map((r, i) =>
          i !== idx
            ? r
            : {
                ...r,
                defects: r.defects.filter((d) => !defectMatches(d.raw, defectCode, label)),
                extractedBy: "direct-entry",
              },
        );
      } else {
        // Edit the existing entry under ITS OWN raw spelling (which may be the
        // Excel header, not the code) so applyEdit updates rather than inserts
        // a second entry for the same physical column.
        const existing = next[idx].defects.find((d) => defectMatches(d.raw, defectCode, label));
        next = applyEdit(next, idx, existing?.raw ?? defectCode, num);
      }

      if (rejectedStated.current.has(rowId(date))) return next;
      const sum = next[idx].defects.reduce((s, d) => s + d.value, 0);
      return next.map((r, i) =>
        i !== idx
          ? r
          : {
              ...r,
              rejected:
                sum === 0
                  ? null
                  : { ...(r.rejected ?? { cell: "ENTRY!rejected", header: "Rejected" }), value: sum },
              extractedBy: "direct-entry",
            },
      );
    });
  };

  /** Draft key is per period + stage + size — editing another slice must not
   *  resurrect unsaved numbers from a different one. */
  const draftKey = `moid_entry_draft_grid:${grain}|${from}|${to}|${activeStageId}|${activeSize ?? ""}`;

  const loadRange = useCallback(async () => {
    if (!activeStageId) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ from, to, stageId: activeStageId });
    if (isSizeWise && activeSize) params.set("size", activeSize);
    try {
      const res = await fetch(`/api/day-records?${params.toString()}`);
      const data = await res.json();
      // Unsaved edits win over the server copy — that is the whole point of the
      // draft. Saving (or discarding) clears it, so this can't shadow real data.
      const draft = loadDraft<StageDayRecord[]>(draftKey);
      const loaded: StageDayRecord[] = draft ?? data.records ?? [];
      // A Rejected total that already exists (saved, or restored from a draft)
      // was stated by a human once — auto-fill must not claim it back.
      rejectedStated.current = new Set(
        loaded
          .filter((r) => r.rejected?.value != null)
          .map((r) => `${r.occurredOn.start}|${r.size ?? "__line__"}`),
      );
      setRecords(loaded);
      setDirty(!!draft);
    } catch (err) {
      console.error("Error loading range:", err);
      setError("Failed to load this period's data.");
      rejectedStated.current = new Set();
      setRecords([]);
      setDirty(false);
    } finally {
      setLoading(false);
    }
  }, [activeStageId, activeSize, from, to, isSizeWise, draftKey]);

  useEffect(() => {
    loadRange();
  }, [loadRange]);

  // Autosave unsaved edits so navigating away (or a reload) doesn't lose them.
  useEffect(() => {
    if (dirty) saveDraft(draftKey, records);
  }, [dirty, records, draftKey]);

  const days = useMemo(() => {
    const out: string[] = [];
    const start = new Date(`${from}T00:00:00Z`).getTime();
    const end = new Date(`${to}T00:00:00Z`).getTime();
    for (let t = start; t <= end; t += 86400000) {
      out.push(new Date(t).toISOString().slice(0, 10));
    }
    return out;
  }, [from, to]);

  const reviewByDate = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildReviewRows>[number]>();
    records.forEach((r, i) => {
      const [row] = buildReviewRows([r]);
      if (row) map.set(`${r.occurredOn.start}|${r.size ?? "__line__"}`, { ...row, recordIndex: i });
    });
    return map;
  }, [records]);

  const recordFor = (date: string): StageDayRecord | undefined =>
    records.find((r) => r.occurredOn.start === date && (r.size ?? "__line__") === rowKey);

  const rangeLabel = periodLabel(grain, anchorDate);

  const confirmDiscardIfDirty = (actionLabel: string): boolean => {
    if (!dirty) return true;
    const ok = confirm(
      `You have unsaved changes for ${rangeLabel} that haven't been submitted yet. ${actionLabel} will discard them. Continue?`,
    );
    if (ok) saveDraft(draftKey, null);
    return ok;
  };

  const goToPeriod = (delta: number) => {
    const label =
      grain === "day" ? "Changing the day" : grain === "week" ? "Changing the week" : "Changing the month";
    if (!confirmDiscardIfDirty(label)) return;
    onAnchorChange?.(stepPeriod(grain, anchorDate, delta));
  };

  /**
   * Rows where the operator's stated Rejected disagrees with the defects they
   * logged. Not a blocker — a real one is common (a reject with no defect code
   * yet, a defect counted twice). It must be *stated and explained*, not
   * silently reconciled by the app.
   */
  const mismatches = useMemo(() => {
    const out: { date: string; rejected: number; defectSum: number; delta: number }[] = [];
    for (const rec of records) {
      if ((rec.size ?? "__line__") !== rowKey) continue;
      const rejected = rec.rejected?.value ?? null;
      if (rejected == null || rec.defects.length === 0) continue;
      const defectSum = rec.defects.reduce((s, d) => s + d.value, 0);
      if (defectSum !== rejected) {
        out.push({ date: rec.occurredOn.start, rejected, defectSum, delta: defectSum - rejected });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [records, rowKey]);

  const mismatchByDate = useMemo(
    () => new Map(mismatches.map((m) => [m.date, m])),
    [mismatches],
  );

  // ponytail: a defect/rejected disagreement is matched by flag text, the one
  // marker reviewRow exposes. Blocking invalids (negatives, rejected > checked,
  // balance violations) are anything else — those stay un-saveable.
  const isReconcileOnly = (flags: string[]) =>
    flags.length > 0 && flags.every((f) => f.startsWith("Defect Mismatch"));

  const invalidCount = Array.from(reviewByDate.values()).filter(
    (r) => r.status === "invalid" && !isReconcileOnly(r.flags),
  ).length;

  const [reconcileReason, setReconcileReason] = useState("");
  const needsReason = mismatches.length > 0 && reconcileReason.trim().length < 4;

  async function saveMonth() {
    if (blockedReason) {
      setError(blockedReason);
      return;
    }
    if (needsReason) {
      setError(
        `${mismatches.length} day(s) don't reconcile — give a reason (at least 4 characters) before saving.`,
      );
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    const ingestionId = globalThis.crypto?.randomUUID?.() ?? `entry-${Date.now()}`;
    const reason = reconcileReason.trim();
    const payload = records
      .filter((r) => r.checked || r.acceptedGood || r.rework || r.rejected || r.defects.length > 0)
      .map((r) => {
        const mm = (r.size ?? "__line__") === rowKey ? mismatchByDate.get(r.occurredOn.start) : undefined;
        return {
          ...r,
          ingestionId,
          // The unreconciled row carries its own explanation into the ledger as
          // an AnnotationEvent, so the audit trail shows the gap AND the why.
          comment: mm
            ? `Unreconciled: defects sum ${mm.defectSum} vs rejected ${mm.rejected} (${mm.delta > 0 ? "+" : ""}${mm.delta}). Reason: ${reason}`
            : r.comment ?? null,
          customFields: { ...r.customFields, ...customFields, size: r.size ?? customFields?.size },
        };
      });

    if (payload.length === 0) {
      setError("Enter quantities for at least one day before saving.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingestionId, fileName: `Data Entry ${rangeLabel}`, records: payload }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Save failed");
      if (mismatches.length > 0 && reason.trim().length >= 4) {
        // Alert GM for each unreconciled day so they can intervene.
        for (const m of mismatches) {
          fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "entry_exception",
              title: "Monthly entry reconcile exception",
              body: `${rangeLabel} · ${m.date}: defects ${m.defectSum} vs rejected ${m.rejected}. ${reason}`,
              createdBy: "data-entry",
              targetPersona: "gm",
              payload: {
                kind: "reconcile",
                date: m.date,
                defectSum: m.defectSum,
                reject: m.rejected,
                reason,
                path: "/data-entry",
              },
            }),
          }).catch(() => {});
        }
      }
      setSuccess(
        `${payload.length} day(s) saved for ${rangeLabel}.` +
          (mismatches.length ? ` ${mismatches.length} logged as unreconciled with your reason.` : ""),
      );
      setReconcileReason("");
      setDirty(false);
      saveDraft(draftKey, null);
      await loadRange();
      refreshEvents().catch(console.error);
    } catch (e: any) {
      setError(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const defectValue = (rec: StageDayRecord | undefined, d: TemplateDefect): number | null => {
    if (!rec) return null;
    const hit = rec.defects.find((x) => defectMatches(x.raw, d.defectCode, d.label));
    return hit != null ? hit.value : null;
  };

  if (templateLoading) {
    return <div className="muted" style={{ padding: 48, textAlign: "center" }}>Loading entry template…</div>;
  }

  if (templateError || !template || stages.length === 0) {
    return (
      <div
        style={{
          padding: 48,
          textAlign: "center",
          background: "var(--surface)",
          border: "1px dashed var(--border)",
          borderRadius: 12,
          color: "var(--text-2)",
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>
          No entry template yet
        </h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
          {templateError ??
            "Upload a workbook in Staging, verify column mappings, and publish a MOD. The data-entry grid is generated from that verified ontology — not a hardcoded defect list."}
        </p>
        <a
          href="/staging"
          style={{
            display: "inline-block",
            padding: "8px 16px",
            borderRadius: 6,
            background: "var(--accent)",
            color: "var(--text-invert)",
            fontWeight: 700,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          Go to Staging
        </a>
      </div>
    );
  }

  const sourceHint =
    template.generatedFrom?.length
      ? template.generatedFrom.map((g) => g.fileName).slice(0, 3).join(", ")
      : null;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          padding: 16,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
        }}
      >
        <button onClick={() => goToPeriod(-1)} style={ghost} aria-label="Previous period">
          ‹ Prev
        </button>
        <div style={{ fontWeight: 700, minWidth: 160, textAlign: "center" }}>{rangeLabel}</div>
        <button onClick={() => goToPeriod(1)} style={ghost} aria-label="Next period">
          Next ›
        </button>
        {isSizeWise && (
          <select
            value={activeSize ?? ""}
            onChange={(e) => {
              if (confirmDiscardIfDirty("Switching size")) setActiveSize(e.target.value);
            }}
            style={{ ...inp, width: 100, marginLeft: 12 }}
          >
            {sizes.map((s) => (
              <option key={s.sizeId} value={s.sizeId}>
                {s.label}
              </option>
            ))}
          </select>
        )}
        {loading && (
          <span className="muted" style={{ fontSize: 12 }}>
            Loading…
          </span>
        )}
        <button
          onClick={saveMonth}
          disabled={saving || invalidCount > 0 || !!blockedReason || needsReason}
          style={{
            marginLeft: "auto",
            background: "var(--status-good)",
            color: "#fff",
            border: "none",
            borderRadius: 9999,
            padding: "8px 20px",
            fontSize: 13,
            fontWeight: 700,
            cursor: saving || invalidCount > 0 || blockedReason || needsReason ? "not-allowed" : "pointer",
            opacity: saving || invalidCount > 0 || blockedReason || needsReason ? 0.6 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {saving
            ? "Saving…"
            : grain === "day"
              ? "Save Day"
              : grain === "week"
                ? "Save Week"
                : "Save Month"}
        </button>
        {sourceHint && (
          <span className="muted" style={{ fontSize: 11, maxWidth: 220, textAlign: "right" }} title={sourceHint}>
            From: {sourceHint}
          </span>
        )}
      </div>

      {error && (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 14px",
            borderRadius: 9,
            background: "color-mix(in srgb, var(--status-bad) 12%, transparent)",
            color: "var(--status-bad)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {mismatches.length > 0 && (
        <div
          style={{
            marginBottom: 14,
            padding: "12px 14px",
            borderRadius: 9,
            border: "1px solid var(--status-warn, var(--border-strong))",
            background: "color-mix(in srgb, var(--status-warn, var(--accent)) 10%, transparent)",
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            {mismatches.length} day(s) don&apos;t reconcile
          </div>
          <ul style={{ margin: "0 0 10px 0", paddingLeft: 18, fontFamily: "var(--font-mono)", fontSize: 12 }}>
            {mismatches.map((m) => (
              <li key={m.date}>
                {m.date} — defects sum {m.defectSum}, rejected {m.rejected} ({m.delta > 0 ? "+" : ""}
                {m.delta} {m.delta > 0 ? "more defects than rejects" : "rejects with no defect logged"})
              </li>
            ))}
          </ul>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
            Reason (required — stored in the audit trail with the row)
          </label>
          <textarea
            value={reconcileReason}
            onChange={(e) => setReconcileReason(e.target.value)}
            rows={2}
            placeholder="e.g. 3 rejects held for defect classification by QA"
            style={{ ...inp, width: "100%", padding: "6px 8px", resize: "vertical" }}
          />
        </div>
      )}

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
        {stages.map((s) => {
          const on = s.stageId === activeStageId;
          return (
            <button
              key={s.stageId}
              onClick={() => {
                if (confirmDiscardIfDirty("Switching stages")) setActiveStageId(s.stageId);
              }}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-strong)",
                background: on ? "var(--accent)" : "var(--surface-2)",
                color: on ? "var(--text-invert)" : "var(--text-2)",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)" }}>
        <table
          style={{
            width: "max-content",
            minWidth: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            fontSize: 13,
          }}
        >
          <thead>
            <tr
              style={{
                color: "var(--text-3)",
                background: "var(--surface-2)",
                fontSize: 10,
                textTransform: "uppercase",
                borderBottom: "1.5px solid var(--border-strong)",
              }}
            >
              <th
                style={{
                  ...eth,
                  textAlign: "left",
                  minWidth: 90,
                  position: "sticky",
                  left: 0,
                  zIndex: 2,
                  background: "var(--surface-2)",
                }}
              >
                Date
              </th>
              {captureCols.map((c) => (
                <th key={c.key} style={eth} title={c.label}>
                  {c.label}
                </th>
              ))}
              {defectCols.map((d, i) => (
                <th
                  key={d.defectCode}
                  style={eth}
                  title={
                    `${i + 1}. ${d.label} (${d.defectCode})` +
                    (d.sources?.length ? ` — from ${d.sources.join(", ")}` : "")
                  }
                >
                  {/* Schema label, not the code — a rename on Data Schema has to
                      be visible here, and the ordinal matches the sheet order. */}
                  <span style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>{i + 1}. </span>
                  {d.label}
                </th>
              ))}
              {defectCols.length > 0 && <th style={eth}>Recon</th>}
            </tr>
          </thead>
          <tbody>
            {days.map((date) => {
              const rec = recordFor(date);
              const review = reviewByDate.get(`${date}|${rowKey}`);
              return (
                <tr key={date} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td
                    style={{
                      ...etd,
                      textAlign: "left",
                      fontWeight: 700,
                      background: "var(--surface)",
                      position: "sticky",
                      left: 0,
                      zIndex: 1,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {date}
                  </td>
                  {captureCols.map((c) => {
                    const field = COL_TO_RECORD[c.key];
                    const sv = field ? rec?.[field] : null;
                    const val = sv != null ? sv.value : null;
                    const isCulprit =
                      !!field &&
                      (review?.invalidFields.includes(field) ||
                        review?.invalidFields.includes(field === "acceptedGood" ? "acceptedGood" : field));
                    return (
                      <td key={c.key} style={{ ...etd, padding: "3px 4px" }}>
                        <QtyInput
                          value={val}
                          onChange={(n) => updateCapture(date, c.key, n)}
                          aria-label={`${date} ${c.label}`}
                          style={{
                            ...inp,
                            width: 84,
                            padding: "4px 8px",
                            height: 30,
                            fontFamily: "var(--font-mono)",
                            textAlign: "right",
                            borderColor: isCulprit ? "var(--status-bad)" : "var(--border-strong)",
                          }}
                        />
                      </td>
                    );
                  })}
                  {defectCols.map((d) => {
                    const isCulprit =
                      !!review?.invalidFields.includes(d.defectCode) ||
                      !!review?.invalidFields.includes(d.label);
                    return (
                      <td key={d.defectCode} style={{ ...etd, padding: "3px 4px" }}>
                        <QtyInput
                          value={defectValue(rec, d)}
                          onChange={(n) => updateDefect(date, d.defectCode, n)}
                          title={d.label}
                          aria-label={`${date} ${d.label}`}
                          style={{
                            ...inp,
                            width: 64,
                            padding: "4px 8px",
                            height: 30,
                            fontFamily: "var(--font-mono)",
                            textAlign: "right",
                            borderColor: isCulprit ? "var(--status-bad)" : "var(--border-strong)",
                          }}
                        />
                      </td>
                    );
                  })}
                  {defectCols.length > 0 && (
                    <td style={{ ...etd, fontFamily: "var(--font-mono)", fontSize: 11, whiteSpace: "nowrap" }}>
                      {(() => {
                        const mm = mismatchByDate.get(date);
                        if (mm) {
                          return (
                            <span
                              style={{ color: "var(--status-bad)", fontWeight: 700 }}
                              title={`Defects sum ${mm.defectSum} vs rejected ${mm.rejected}`}
                            >
                              unreconciled {mm.defectSum} of {mm.rejected}
                            </span>
                          );
                        }
                        if (!rec || rec.defects.length === 0) return null;
                        return (
                          <span className="muted" title="Defects match the rejected total">
                            ✓ {rec.rejected?.value ?? 0}
                          </span>
                        );
                      })()}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {defectCols.length === 0 && captureCols.length > 0 && (
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          This stage has no defect columns in the verified workbook — only capture measures (
          {captureCols.map((c) => c.label).join(", ")}).
        </p>
      )}

      {invalidCount > 0 && (
        <p style={{ fontSize: 12, color: "var(--status-bad)", marginTop: 8 }}>
          {invalidCount} of {reviewByDate.size} entered day{reviewByDate.size === 1 ? "" : "s"} need
          {invalidCount === 1 ? "s" : ""} fixing before you can save.
        </p>
      )}

      {blockedReason && (
        <p style={{ fontSize: 12, color: "var(--status-bad)", marginTop: 8 }}>{blockedReason}</p>
      )}

      {success && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 14px",
            borderRadius: 9,
            background: "var(--positive-weak)",
            border: "1px solid var(--positive)",
            color: "var(--positive)",
            fontSize: 13,
          }}
        >
          {success}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
        <button
          onClick={saveMonth}
          disabled={saving || invalidCount > 0 || !!blockedReason || needsReason}
          style={{
            background: "var(--status-good)",
            color: "#fff",
            border: "none",
            borderRadius: 9,
            padding: "10px 22px",
            fontSize: 14,
            fontWeight: 700,
            cursor: saving || invalidCount > 0 || blockedReason || needsReason ? "not-allowed" : "pointer",
            opacity: saving || invalidCount > 0 || blockedReason || needsReason ? 0.6 : 1,
          }}
        >
          {saving
            ? "Saving…"
            : grain === "day"
              ? "Save Day"
              : grain === "week"
                ? "Save Week"
                : "Save Month"}
        </button>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
};
const ghost: React.CSSProperties = {
  background: "transparent",
  color: "var(--text-2)",
  border: "1px solid var(--border)",
  borderRadius: 9999,
  padding: "8px 16px",
  fontSize: 13,
  cursor: "pointer",
};
const eth: React.CSSProperties = {
  padding: "8px 8px",
  textAlign: "center",
  fontWeight: 600,
  borderRight: "1px solid var(--border)",
};
const etd: React.CSSProperties = {
  padding: "6px 8px",
  textAlign: "center",
  color: "var(--text)",
  borderRight: "1px solid var(--border)",
};
