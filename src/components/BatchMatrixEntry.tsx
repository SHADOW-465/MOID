"use client";

// Shop-floor Data Entry Matrix — single-batch form matching
// Disposafe_Data_Entry_System_Documentation.md.
// Upload to ledger (POST /api/ingest) and keep a local shift log.
// Within the shift window operators may re-upload (supersede). After the
// window closes, pending local rows auto-upload and further edits need a GM grant.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Select from "@/components/ui/Select";
import {
  MATRIX_STAGES,
  ENTRY_ROLES,
  toEntryRole,
  SECONDARY_BINS,
  SHIFT_STORAGE_KEY,
  PRODUCT_TYPES,
  PRODUCT_TYPE_STORAGE_KEY,
  CATHETER_CATEGORIES,
  defectsFor,
  defectDisplayLabel,
  processLabel,
  resolveStageId,
  previousAssemblyStageId,
  sizesFor,
  typeIsSelectable,
  productTypeFor,
  categoryAndTypeFrom,
  type MacroId,
  type ProductType,
  type CatheterCategory,
  type CatheterType,
  type ShiftBatchRecord,
} from "@/lib/entry/disposafe-matrix";
import {
  buildBatchId,
  parseBatchId,
  formatBatchIdInput,
  frDigitsFromSize,
  toCanonicalSize,
  toDisplaySize,
} from "@/lib/entry/batch-id";
import {
  describeShiftWindow,
  isWithinShiftWindow,
  readShiftWindowConfig,
} from "@/lib/entry/shift-window";
import { entryKey, hasValidGrant } from "@/lib/entry/edit-grants";
import type { StageDayRecord } from "@/lib/ingest/emit";
import { useEvents } from "@/components/app/EventsContext";
import { usePersona } from "@/components/app/PersonaContext";
import QtyInput from "@/components/entry/QtyInput";
import ExceptionModal from "@/components/entry/ExceptionModal";
import { loadDraft, saveDraft } from "@/lib/entry/draft";
import { buildBatchProgress, progressFor } from "@/lib/analytics/batch-progress";
import type { AuditEventLike } from "@/lib/analytics/audit-sessions";
import LotProgress from "@/components/LotProgress";

const today = () => new Date().toISOString().slice(0, 10);

/** In-progress (unsubmitted) batch form — restored on return to Data Entry. */
const DRAFT_KEY = "moid_entry_draft_batch";

interface BatchDraft {
  macro: MacroId; micro: string; date: string; size: string;
  productType?: string;
  operator: string; shift: string; batchId: string; batchManual: boolean;
  checked: number; trolleys: number; bin: string;
  accept: number; hold: number; reject: number;
  defects: Record<string, number>; remarks: string;
}

/** How the operator resolved defect-sum vs Rejected before save. */
type A12Choice = "set-reject" | "keep-incomplete" | null;

function loadShift(): ShiftBatchRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SHIFT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ShiftBatchRecord[]) : [];
  } catch {
    return [];
  }
}

function persistShift(rows: ShiftBatchRecord[]) {
  localStorage.setItem(SHIFT_STORAGE_KEY, JSON.stringify(rows));
}

function sv(value: number, cell: string, header: string) {
  return { value, cell, header };
}

function qtyHeaderFor(macro: MacroId): string {
  if (macro === "primary") return "Quantity Produced";
  if (macro === "secondary") return "Quantity";
  return "Checked Qty";
}

function toStageDayRecord(rec: ShiftBatchRecord, ingestionId: string): StageDayRecord {
  const isSecondary = rec.macro === "secondary";
  const isPrimary = rec.macro === "primary";

  // Secondary has no accept/hold/reject/defects — qty only + bin metadata.
  const defects = isSecondary
    ? []
    : Object.entries(rec.defects)
        .filter(([, v]) => v > 0)
        .map(([raw, value]) => ({
          raw,
          value,
          cell: `ENTRY!defect!${raw}`,
        }));

  return {
    occurredOn: { kind: "day", start: rec.date, end: rec.date },
    stageId: rec.stageId,
    size: rec.sizeCanonical,
    source: {
      file: "Manual Entry",
      fileHash: `manual-${rec.date}-${rec.batchId}-${rec.stageId}`,
      sheet: rec.shift || "Day Shift",
      tableId: "batch-matrix",
    },
    checked: rec.checked > 0 ? sv(rec.checked, "ENTRY!checked", qtyHeaderFor(rec.macro)) : null,
    acceptedGood:
      !isSecondary && rec.accept > 0 ? sv(rec.accept, "ENTRY!accept", "Good Qty") : null,
    // Hold is Visual only — never balloon / valve / final / primary / secondary.
    rework:
      rec.stageId === "visual" && rec.hold > 0
        ? sv(rec.hold, "ENTRY!hold", "Rework Qty")
        : null,
    rejected:
      !isSecondary && rec.reject > 0 ? sv(rec.reject, "ENTRY!reject", "Rejected Qty") : null,
    defects,
    statedPct: null,
    extractedBy: "direct-entry",
    ingestionId,
    comment: rec.remarks || null,
    customFields: {
      operator: rec.operator,
      batch: rec.batchId,
      size: rec.size,
      shift: rec.shift,
      notes: rec.remarks,
      product: "FBC",
      productType: rec.productType || "2 way",
      macro: rec.macro,
      process: rec.processName,
      matrixId: rec.id,
      ...(isPrimary && rec.trolleys != null && rec.trolleys > 0
        ? { trolleysProduced: rec.trolleys, "No. of Trolleys Produced": rec.trolleys }
        : {}),
      ...(isSecondary && rec.bin
        ? { bin: rec.bin, Bin: rec.bin }
        : {}),
    },
  };
}

export default function BatchMatrixEntry({
  onSynced,
  prefillBatchId,
  onPrefillConsumed,
}: {
  onSynced?: () => void;
  /** Lot id handed over from History → Reuse. Fills the batch field once. */
  prefillBatchId?: string | null;
  onPrefillConsumed?: () => void;
}) {
  const { events, refreshEvents } = useEvents();
  const { canWrite, canConfigure, canEraseLedger, persona } = usePersona();

  const [macro, setMacro] = useState<MacroId>("assembly");
  const [micro, setMicro] = useState("p15-visual");
  const [date, setDate] = useState(today);
  const [size, setSize] = useState("14Fr");
  const [productType, setProductType] = useState<ProductType | string>("2 way");
  const [category, setCategory] = useState<CatheterCategory>("Male");
  const [catheterType, setCatheterType] = useState<CatheterType>("2 way");
  /** Load a saved/legacy `productType` string into category+type WITHOUT
   *  touching size — used when restoring a draft or an existing record, where
   *  the stored size was already valid for that category at save time. The
   *  cascade (handleCategoryChange/handleCatheterTypeChange below) is only for
   *  the operator changing the dropdowns live. */
  const applyProductType = useCallback((pt: string) => {
    setProductType(pt);
    const { category: c, type: ty } = categoryAndTypeFrom(pt);
    setCategory(c);
    setCatheterType(ty);
  }, []);
  const [typeFilter, setTypeFilter] = useState<string>("All Type");
  const [operator, setOperator] = useState<string>(ENTRY_ROLES[0]);
  const [shift, setShift] = useState("Day Shift");
  const [batchId, setBatchId] = useState(() => buildBatchId(today(), "14Fr") ?? "");
  const [batchManual, setBatchManual] = useState(false);
  const [exceptionOpen, setExceptionOpen] = useState(false);
  const [exceptionKind, setExceptionKind] = useState<"qty" | "defect" | null>(null);
  const [exceptionReason, setExceptionReason] = useState("");
  const [tick, setTick] = useState(0);
  const [requestingEdit, setRequestingEdit] = useState(false);
  const [checked, setChecked] = useState(0);
  const [trolleys, setTrolleys] = useState(0);
  const [bin, setBin] = useState("");
  const [accept, setAccept] = useState(0);
  const [hold, setHold] = useState(0);
  const [reject, setReject] = useState(0);
  const [defects, setDefects] = useState<Record<string, number>>({});
  const [remarks, setRemarks] = useState("");
  const [saved, setSaved] = useState<ShiftBatchRecord[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [prefillNote, setPrefillNote] = useState<string | null>(null);
  /** Row expanded for preview in the shift list (click the row to toggle). */
  const [previewId, setPreviewId] = useState<string | null>(null);
  /** Filter over the defect tiles — 21 codes is a lot to scan on a shop floor. */
  const [defectFilter, setDefectFilter] = useState("");

  /**
   * Row currently loaded into the form for revision. Save replaces this row in
   * place instead of appending a new one — and re-ingesting supersedes the
   * ledger event, since /api/ingest keys direct entry on date·stage·size·batch.
   */
  const [editingId, setEditingId] = useState<string | null>(null);
  /** Same value as `editingId`, readable synchronously — buildPendingRecord
   *  runs in the same tick as the "save as a separate entry" decision, so it
   *  can't wait for a state update to know which id to stamp. */
  const editingIdRef = useRef<string | null>(null);
  const setEditing = useCallback((id: string | null) => {
    editingIdRef.current = id;
    setEditingId(id);
  }, []);
  /** Defect sum ≠ Rejected — operator must choose before save (never silent). */
  const [a12, setA12] = useState<{ defectSum: number; reject: number } | null>(null);
  const [a12Choice, setA12Choice] = useState<A12Choice>(null);
  /** Once the operator edits any qty, never auto-overwrite Checked from upstream. */
  const userTouchedQty = useRef(false);
  /** Prefill key already applied for this (batch, size, station) context. */
  const prefillAppliedKey = useRef<string | null>(null);
  /** Defects per stageId from the company catalog (entry-template). Empty = built-in defaults. */
  const [templateDefects, setTemplateDefects] = useState<Record<string, { key: string; name: string }[]>>({});
  /** Capture columns per stageId — which quantity fields this station records. */
  const [templateColumns, setTemplateColumns] = useState<Record<string, string[]>>({});
  const [schemaSource, setSchemaSource] = useState<"catalog" | "builtin" | "loading">("loading");

  /** Draft restored (or confirmed absent) — gate the autosave so the empty
   *  initial render can't wipe a stored draft before it is read back. */
  const draftReady = useRef(false);

  useEffect(() => {
    setSaved(loadShift());
    const op = localStorage.getItem("rais_hdr_operator");
    if (op) setOperator(toEntryRole(op));
    const sh = localStorage.getItem("rais_hdr_shift");
    if (sh) setShift(sh);
    const pt = localStorage.getItem(PRODUCT_TYPE_STORAGE_KEY);
    if (pt) applyProductType(pt);

    const d = loadDraft<BatchDraft>(DRAFT_KEY);
    if (d) {
      setMacro(d.macro); setMicro(d.micro); setDate(d.date); setSize(d.size);
      if (d.productType) applyProductType(d.productType);
      if (d.operator) setOperator(toEntryRole(d.operator));
      if (d.shift) setShift(d.shift);
      setBatchId(d.batchId); setBatchManual(d.batchManual);
      setChecked(d.checked); setTrolleys(d.trolleys); setBin(d.bin);
      setAccept(d.accept); setHold(d.hold); setReject(d.reject);
      setDefects(d.defects ?? {}); setRemarks(d.remarks);
      // Treat a restored draft as operator-touched so upstream prefill and a
      // late entry-template response can't overwrite what they already typed.
      userTouchedQty.current = true;
    }
    draftReady.current = true;
  }, []);

  // Re-evaluate shift window every minute.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Success feedback is brief — operators should not have to dismiss it.
  useEffect(() => {
    if (!msg) return;
    const id = window.setTimeout(() => setMsg(null), 4200);
    return () => window.clearTimeout(id);
  }, [msg]);

  /** True while a shift-end auto-upload is in flight (avoid double fire). */
  const shiftEndFlushRef = useRef(false);

  // Autosave the in-progress form. Cheap (one small JSON write per keystroke)
  // and it is the only thing standing between a half-filled shift and a tab switch.
  useEffect(() => {
    if (!draftReady.current) return;
    const empty =
      !checked && !trolleys && !accept && !hold && !reject && !remarks && !bin &&
      Object.keys(defects).length === 0;
    saveDraft(
      DRAFT_KEY,
      empty
        ? null
        : { macro, micro, date, size, productType, operator, shift, batchId, batchManual,
            checked, trolleys, bin, accept, hold, reject, defects, remarks },
    );
  }, [macro, micro, date, size, productType, operator, shift, batchId, batchManual,
      checked, trolleys, bin, accept, hold, reject, defects, remarks]);

  // Schema from the company catalog (Data Schema), projected by /api/entry-template.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/entry-template", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        // The route answers { template: { stages } } — reading data.stages made
        // this always fall back to the built-in defect list, so Data Schema
        // edits never showed up here.
        const tplStages = data.template?.stages;
        if (!res.ok || !tplStages?.length) {
          if (!cancelled) setSchemaSource("builtin");
          return;
        }
        const map: Record<string, { key: string; name: string }[]> = {};
        const cols: Record<string, string[]> = {};
        let any = false;
        type TplStage = {
          stageId: string;
          defects?: { defectCode: string; label: string }[];
          columns?: { key: string }[];
        };
        for (const st of tplStages as TplStage[]) {
          cols[st.stageId] = (st.columns ?? []).map((c) => c.key);
          if (st.defects?.length) {
            any = true;
            map[st.stageId] = st.defects.map((d) => ({
              key: d.defectCode,
              name: d.label || d.defectCode,
            }));
          }
        }
        if (!cancelled) {
          setTemplateDefects(map);
          setTemplateColumns(cols);
          setSchemaSource(any ? "catalog" : "builtin");
        }
      })
      .catch(() => {
        if (!cancelled) setSchemaSource("builtin");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto lot ID from production date + size only while unlocked.
  // Once locked (manual type or first qty), date can move day-to-day without
  // rewriting the lot — batches span multiple calendar days on the floor.
  useEffect(() => {
    if (batchManual) return;
    const id = buildBatchId(date, size);
    if (id) setBatchId(id);
  }, [date, size, batchManual]);

  // Size change while lot is locked: keep date-coded prefix, update FR suffix only.
  useEffect(() => {
    if (!batchManual) return;
    setBatchId((cur) => {
      const fr = frDigitsFromSize(size);
      if (!fr) return cur;
      const p = parseBatchId(cur);
      if (!p?.year2 || !p.monthCode || !p.day) return cur;
      const next = `${p.year2}${p.monthCode}${p.day}-${fr}`;
      return next === cur.toUpperCase() ? cur : next;
    });
  }, [size, batchManual]);

  const isPrimary = macro === "primary";
  const isSecondary = macro === "secondary";
  const isAssembly = macro === "assembly";
  const stageId = resolveStageId(macro, micro);
  const resolvedDefects = useMemo(() => {
    const fromMod = templateDefects[stageId];
    if (fromMod?.length) return fromMod;
    return defectsFor(macro, micro);
  }, [templateDefects, stageId, macro, micro]);
  // Freeze the defect column set once the operator starts typing so a late
  // /api/entry-template response can't swap keys mid-entry (looks like values
  // "changed" or vanished under a different column label).
  const [activeDefects, setActiveDefects] = useState(resolvedDefects);
  useEffect(() => {
    if (userTouchedQty.current) return;
    setActiveDefects(resolvedDefects);
  }, [resolvedDefects]);
  const usingModDefects = !!(templateDefects[stageId]?.length);

  const hideDefects = MATRIX_STAGES[macro].hideDefects;
  const parsed = useMemo(() => parseBatchId(batchId), [batchId]);
  const sizeCanon = useMemo(() => toCanonicalSize(size), [size]);
  const catheterSizeOptions = useMemo(() => sizesFor(category, catheterType), [category, catheterType]);
  const prevStageId = useMemo(
    () => (isAssembly ? previousAssemblyStageId(micro) : null),
    [isAssembly, micro],
  );

  // Lot completion, read straight off the ledger — a lot spans several days, so
  // the operator needs to see which gates this batch already cleared before
  // deciding what to type. Nothing is stored; purge/correct and the bar moves.
  const lotProgress = useMemo(
    () => progressFor(buildBatchProgress((events ?? []) as AuditEventLike[]), batchId),
    [events, batchId],
  );
  const stageAlreadyDone = lotProgress?.steps.find((s) => s.stageId === stageId && s.done) ?? null;

  // Assembly chain: one-shot assist prefill of Checked from the previous
  // station's Accepted qty for the same batch + size. Never re-runs after
  // the operator has touched any quantity field, and never after the first
  // successful apply for this context key — those two guards stop the old
  // bug where events-refresh overwrote values mid-entry.
  useEffect(() => {
    setPrefillNote(null);
    if (!isAssembly || !prevStageId) return;
    if (userTouchedQty.current) return;
    if (!events || events.length === 0) return;
    const batchKey = batchId.trim().toUpperCase();
    if (!batchKey || !sizeCanon) return;
    const ctxKey = `${prevStageId}|${batchKey}|${sizeCanon}`;
    if (prefillAppliedKey.current === ctxKey) return;
    const matches = (events as any[]).filter(
      (e) =>
        e.eventType === "inspection" &&
        e.disposition === "accepted" &&
        e.stageId === prevStageId &&
        e.size === sizeCanon &&
        String(e.batchNo ?? "").toUpperCase() === batchKey,
    );
    if (matches.length === 0) return;
    matches.sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1));
    const qty = matches[0].quantity ?? 0;
    if (qty > 0) {
      setChecked(qty);
      prefillAppliedKey.current = ctxKey;
      const prevLabel =
        MATRIX_STAGES.assembly.processes.find((p) => p.stageId === prevStageId)?.name ?? prevStageId;
      setPrefillNote(`Auto-filled from ${prevLabel} accepted (${qty}) for batch ${batchKey}. Clear or edit freely — it will not overwrite again.`);
    }
  }, [isAssembly, prevStageId, batchId, sizeCanon, events]);
  const defectSum = useMemo(
    () => Object.values(defects).reduce((a, b) => a + (Number(b) || 0), 0),
    [defects],
  );

  /**
   * HOLD is Visual only (plant rule / WI). Other gates pass or reject — never
   * hold. Do not trust catalog "rework" on balloon/valve/final; those columns
   * on old sheets are legacy, not entry fields.
   */
  const capturesHold = stageId === "visual";

  // Leaving Visual must not carry a stale Hold into balloon/valve/final.
  useEffect(() => {
    if (!capturesHold) setHold((cur) => (cur === 0 ? cur : 0));
  }, [capturesHold]);

  const holdPart = capturesHold ? hold : 0;
  /**
   * Remainder implied by the quantity balance:
   *   Checked = Accept + Hold + Reject  →  Reject = Checked − Accept − Hold
   * (Primary omits Hold.)
   */
  const impliedRejectFromBalance = Math.max(0, checked - accept - holdPart);

  /**
   * Reject is auto-derived (read-only display) for Primary / Assembly:
   *  1. Defect reasons win when any defect qty is entered (sum → Rejected)
   *  2. Otherwise balance remainder from Checked − Accept (− Hold)
   * Secondary is qty-only and has no reject.
   */
  const defectsDriveReject = !isSecondary && !hideDefects && defectSum > 0;
  const rejectIsDerived = !isSecondary;
  const rejectSource: "defects" | "balance" | null = isSecondary
    ? null
    : defectsDriveReject
      ? "defects"
      : checked > 0
        ? "balance"
        : null;

  useEffect(() => {
    if (isSecondary) return;
    const next = defectsDriveReject
      ? defectSum
      : checked > 0
        ? impliedRejectFromBalance
        : 0;
    setReject((cur) => (cur === next ? cur : next));
  }, [isSecondary, defectsDriveReject, defectSum, checked, impliedRejectFromBalance]);

  /** Filtered tiles, carrying their ORIGINAL index so the numbering keeps
   *  matching the schema order the operator counts by. */
  const visibleDefects = useMemo(() => {
    const q = defectFilter.trim().toLowerCase();
    return activeDefects
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => !q || d.key.toLowerCase().includes(q) || (d.name ?? "").toLowerCase().includes(q));
  }, [activeDefects, defectFilter]);

  // Balance: Checked = Accept + Hold + Reject (Primary omits Hold; Secondary is qty-only).
  const sumParts = isSecondary
    ? checked
    : isPrimary
      ? accept + reject
      : accept + holdPart + reject;
  const qtyMismatch = !isSecondary && (checked !== sumParts || checked === 0);
  const defectMismatch =
    !hideDefects && !isSecondary && (reject > 0 || defectSum > 0) && defectSum !== reject;
  const qtyLabel = isPrimary ? "Quantity Produced" : isSecondary ? "Quantity" : "Checked";

  /** Live equation under Checked — shows the correct split, not only "mismatch". */
  const balanceHint =
    isSecondary || checked <= 0
      ? null
      : isPrimary
        ? `${checked} = Accept ${accept} + Reject ${reject}`
        : capturesHold
          ? `${checked} = Accept ${accept} + Hold ${hold} + Reject ${reject}`
          : `${checked} = Accept ${accept} + Reject ${reject}`;

  const shiftConfig = useMemo(() => readShiftWindowConfig(), [tick]);
  const withinShift = useMemo(
    () => isWithinShiftWindow(shift, new Date(), shiftConfig),
    [shift, shiftConfig, tick],
  );
  const currentEntryKey = useMemo(
    () =>
      entryKey({
        date,
        batchId: batchId.trim().toUpperCase(),
        stageId,
        size: sizeCanon ?? size,
        productType: String(productType),
      }),
    [date, batchId, stageId, sizeCanon, size, productType],
  );
  const hasGrant = useMemo(
    () => hasValidGrant(currentEntryKey),
    [currentEntryKey, tick],
  );
  // Owner: canWrite false. Operator: needs open shift window or GM grant. GM: always.
  const mayEdit =
    canWrite && (persona !== "operator" || withinShift || hasGrant);

  const identityCols = "minmax(150px, 1.1fr) minmax(110px, 0.9fr) minmax(140px, 1fr)";
  const countCols = isPrimary
    ? "repeat(4, minmax(88px, 1fr))"
    : isSecondary
      ? "minmax(100px, 1fr) minmax(120px, 1.1fr)"
      : capturesHold
        ? "repeat(4, minmax(88px, 1fr))"
        : "repeat(3, minmax(88px, 1fr))";

  const saveLabel = saving
    ? "Saving…"
    : editingId
      ? "Replace this entry"
      : "Save to plant ledger";

  const resetQtys = useCallback(() => {
    setChecked(0);
    setTrolleys(0);
    setBin("");
    setAccept(0);
    setHold(0);
    setReject(0);
    setDefects({});
    setRemarks("");
    setPrefillNote(null);
    setA12(null);
    setA12Choice(null);
    userTouchedQty.current = false;
    prefillAppliedKey.current = null;
  }, []);

  const touchQty = useCallback(() => {
    userTouchedQty.current = true;
    setPrefillNote(null);
    // Lock lot ID once quantities are entered so changing "production date"
    // for the next process day does not invent a new batch code.
    setBatchManual(true);
    // Editing after a mismatch prompt invalidates the pending A12 choice.
    setA12(null);
    setA12Choice(null);
  }, []);

  const selectMacro = (id: MacroId) => {
    setMacro(id);
    setMicro(id === "assembly" ? "p15-visual" : "");
    resetQtys();
  };

  const selectMicro = (id: string) => {
    if (macro !== "assembly") return;
    setMicro(id);
    resetQtys();
  };

  const onBatchInput = (raw: string) => {
    const formatted = formatBatchIdInput(raw);
    setBatchId(formatted);
    setBatchManual(true);
    const p = parseBatchId(formatted);
    // Size from the lot code is binding; production date is NOT — the same lot
    // is inspected across days, so we never rewrite "recorded on" from the ID.
    if (p?.sizeFr) {
      const display = toDisplaySize(p.sizeFr);
      if (display) setSize(display);
    }
  };

  // History → Reuse: adopt the lot id, locked, and leave "Recorded on" alone.
  // That is the multi-day rule — a lot carries across days, the entry date does
  // not follow it backwards.
  useEffect(() => {
    if (!prefillBatchId) return;
    onBatchInput(prefillBatchId);
    onPrefillConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillBatchId]);

  /** Explicitly re-seed lot from production date + size (opt-in after lock). */
  const rebuildBatchFromDate = () => {
    const id = buildBatchId(date, size);
    if (id) {
      setBatchId(id);
      setBatchManual(false);
    }
  };

  // Defect qty changes update local state; Reject is re-derived from defect
  // sum (when any defect > 0) or from the Checked − Accept (− Hold) remainder.
  const setDefectQty = (key: string, n: number | null) => {
    touchQty();
    setDefects((prev) => {
      const next = { ...prev };
      if (n == null || n === 0) delete next[key];
      else next[key] = n;
      return next;
    });
  };

  /**
   * Category / Type / Size cascade — same rules as the shop-floor matrix tool:
   * Type is Male-only (Female/Peadiatric default to "2 way" behind the scenes),
   * and each category+type pair has its own size range. Changing category or
   * type re-derives the size list; if the currently selected size falls outside
   * it, reset to the lowest size in the new list rather than leaving a value
   * the operator can no longer see reflected in the dropdown.
   */
  const applyCategory = (next: CatheterCategory) => {
    setBatchManual(false);
    setCategory(next);
    const nextType = typeIsSelectable(next) ? catheterType : "2 way";
    if (!typeIsSelectable(next)) setCatheterType("2 way");
    setProductType(productTypeFor(next, nextType));
    const options = sizesFor(next, nextType);
    if (!options.includes(size)) setSize(options[0]);
  };

  const applyCatheterType = (next: CatheterType) => {
    setBatchManual(false);
    setCatheterType(next);
    setProductType(productTypeFor(category, next));
    const options = sizesFor(category, next);
    if (!options.includes(size)) setSize(options[0]);
  };

  const setQty = (field: "checked" | "trolleys" | "accept" | "hold" | "reject", n: number | null) => {
    touchQty();
    const v = n ?? 0;
    if (field === "checked") setChecked(v);
    else if (field === "trolleys") setTrolleys(v);
    else if (field === "accept") setAccept(v);
    else if (field === "hold") setHold(v);
    else if (!rejectIsDerived) setReject(v);
    // When reject is derived (balance remainder or defect sum), ignore manual edits.
  };

  const clearFormKeepContext = () => {
    resetQtys();
    setBatchManual(false);
    const id = buildBatchId(date, size);
    if (id) setBatchId(id);
  };

  async function commitRecord(rec: ShiftBatchRecord): Promise<boolean> {
    const ingestionId = globalThis.crypto?.randomUUID?.() ?? `entry-${Date.now()}`;
    const payload = [toStageDayRecord(rec, ingestionId)];
    const res = await fetch("/api/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ingestionId,
        fileName: `Batch Entry ${rec.batchId}`,
        records: payload,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Ingest failed");
    }
    return true;
  }

  function buildPendingRecord(overrideReject?: number): ShiftBatchRecord {
    const stageId = resolveStageId(macro, micro);
    const stageName = MATRIX_STAGES[macro].name;
    const procName = processLabel(macro, micro);
    const canon = toCanonicalSize(size) ?? size;

    return {
      // Keep the id when revising so the row is replaced, not duplicated.
      id: editingIdRef.current ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date,
      operator: operator.trim(),
      macro,
      micro,
      stageId,
      stageName,
      processName: procName,
      size: toDisplaySize(size) ?? size,
      sizeCanonical: canon,
      productType: productType || "2 way",
      batchId: batchId.trim().toUpperCase(),
      checked,
      accept: isSecondary ? 0 : accept,
      hold: isPrimary || isSecondary ? 0 : hold,
      reject: isSecondary ? 0 : (overrideReject ?? reject),
      trolleys: isPrimary ? trolleys : undefined,
      bin: isSecondary ? bin.trim() : undefined,
      defects: isSecondary ? {} : { ...defects },
      remarks: remarks.trim(),
      shift,
      savedAt: new Date().toISOString(),
      synced: false,
    };
  }

  async function finalizeSave(rec: ShiftBatchRecord) {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const revising = saved.some((b) => b.id === rec.id);
      await commitRecord(rec);
      const withSync = { ...rec, synced: true };
      const next = revising
        ? saved.map((b) => (b.id === rec.id ? withSync : b))
        : [withSync, ...saved];
      setSaved(next);
      persistShift(next);
      localStorage.setItem("rais_hdr_operator", rec.operator);
      localStorage.setItem("rais_hdr_shift", rec.shift);
      if (rec.productType) localStorage.setItem(PRODUCT_TYPE_STORAGE_KEY, String(rec.productType));
      setEditing(null);
      clearFormKeepContext();
      setBatchManual(false);
      setMsg(
        revising
          ? `On the ledger · ${rec.batchId} · ${rec.processName} — previous row superseded.`
          : `On the ledger · ${rec.batchId} · ${rec.processName} · ${rec.size}`,
      );
      refreshEvents().catch(console.error);
      onSynced?.();
    } catch (e: any) {
      // Keep local shift buffer so shift-end can retry upload
      const next = saved.some((b) => b.id === rec.id)
        ? saved.map((b) => (b.id === rec.id ? rec : b))
        : [rec, ...saved];
      setSaved(next);
      persistShift(next);
      setEditing(null);
      clearFormKeepContext();
      setErr(
        `Saved on this device only — could not reach the ledger (${e?.message ?? "unknown error"}). Will retry when the shift ends.`,
      );
    } finally {
      setSaving(false);
      setA12(null);
      setA12Choice(null);
    }
  }

  /**
   * When the shift window closes, push any still-local batches to the ledger
   * so nothing sits only on the operator machine after lock-down.
   */
  async function flushPendingToLedger(rows: ShiftBatchRecord[]) {
    const pending = rows.filter((b) => !b.synced);
    if (pending.length === 0) return;
    setMsg(`Shift ended — saving ${pending.length} pending batch(es) to the ledger…`);
    let next = [...rows];
    let ok = 0;
    let fail = 0;
    for (const rec of pending) {
      try {
        await commitRecord(rec);
        next = next.map((b) => (b.id === rec.id ? { ...b, synced: true } : b));
        ok++;
      } catch {
        fail++;
      }
    }
    setSaved(next);
    persistShift(next);
    if (ok > 0) refreshEvents().catch(console.error);
    if (fail === 0) {
      setMsg(
        ok === 1
          ? "Shift ended — last pending batch is on the ledger. Further edits need GM permission."
          : `Shift ended — ${ok} pending batch(es) on the ledger. Further edits need GM permission.`,
      );
      setErr(null);
    } else {
      setErr(`${fail} batch(es) still not on the ledger. ${ok} saved.`);
      if (ok > 0) setMsg(null);
    }
  }

  // Auto-upload pending local rows when the operator's shift window closes.
  useEffect(() => {
    if (withinShift) {
      shiftEndFlushRef.current = false;
      return;
    }
    if (!canWrite) return;
    if (persona === "owner") return;
    if (shiftEndFlushRef.current) return;
    const pending = saved.filter((b) => !b.synced);
    if (pending.length === 0) return;
    shiftEndFlushRef.current = true;
    void flushPendingToLedger(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when window closes / pending appears after close
  }, [withinShift, canWrite, persona, saved]);

  async function postNotification(body: Record<string, unknown>) {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      /* non-blocking for save path */
    }
  }

  async function notifyException(opts: {
    kind: "qty_mismatch" | "defect_mismatch";
    reason: string;
    defectSum?: number;
    reject?: number;
    a12Choice?: "set-reject" | "keep-incomplete";
  }) {
    const rej = opts.reject ?? reject;
    const dSum = opts.defectSum;
    const balanceLine = isPrimary
      ? `${qtyLabel} ${checked} ≠ Accept ${accept} + Reject ${rej} (sum ${accept + rej})`
      : capturesHold
        ? `${qtyLabel} ${checked} ≠ Accept ${accept} + Hold ${hold} + Reject ${rej} (sum ${accept + hold + rej})`
        : `${qtyLabel} ${checked} ≠ Accept ${accept} + Reject ${rej} (sum ${accept + rej})`;
    const defectLine =
      dSum != null
        ? ` · Defects sum ${dSum}${rej !== dSum ? ` vs Rejected ${rej}` : ""}`
        : "";
    const title =
      opts.kind === "qty_mismatch"
        ? "Entry saved with quantity exception"
        : "Entry saved with defect exception";
    const body =
      `${operator.trim() || "Operator"} saved ${batchId.trim().toUpperCase() || "(no batch)"} · ` +
      `${processLabel(macro, micro)} · ${size} · ${date}. ` +
      (opts.kind === "qty_mismatch" ? balanceLine : `Defects ${dSum ?? "?"} vs Rejected ${rej}`) +
      `. Reason: ${opts.reason}`;

    await postNotification({
      type: "entry_exception",
      title,
      body,
      createdBy: operator.trim() || "operator",
      targetPersona: "gm",
      payload: {
        kind: opts.kind,
        date,
        batchId: batchId.trim().toUpperCase(),
        stageId,
        stageName: MATRIX_STAGES[macro].name,
        processName: processLabel(macro, micro),
        size,
        productType,
        operator: operator.trim(),
        shift,
        checked,
        accept,
        hold: capturesHold ? hold : 0,
        reject: rej,
        defectSum: dSum,
        reason: opts.reason,
        path: "/data-entry",
        detail: opts.kind === "qty_mismatch" ? balanceLine + defectLine : `Defects ${dSum} vs Rejected ${rej}`,
        a12Choice: opts.a12Choice,
      },
    });
  }

  async function requestEditPermission() {
    setRequestingEdit(true);
    setErr(null);
    try {
      await postNotification({
        type: "edit_request",
        title: "Edit permission requested",
        body: `${operator.trim() || "Operator"} wants to edit ${batchId} (${processLabel(macro, micro)}, ${size}) outside ${describeShiftWindow(shift, shiftConfig)}.`,
        createdBy: operator.trim() || "operator",
        targetPersona: "gm",
        payload: {
          entryKey: currentEntryKey,
          date,
          batchId: batchId.trim().toUpperCase(),
          stageId,
          stageName: MATRIX_STAGES[macro].name,
          size: sizeCanon ?? size,
          productType,
          operator: operator.trim(),
          shift,
          path: "/data-entry",
        },
      });
      setMsg("Edit request sent to GM. You can edit this entry after approval.");
    } catch (e: any) {
      setErr(e?.message ?? "Could not request edit permission");
    } finally {
      setRequestingEdit(false);
    }
  }

  async function submitForm() {
    setErr(null);
    setMsg(null);

    if (!canWrite) {
      setErr("Your role is view-only. Switch to GM or Operator to save entries.");
      return;
    }
    if (!mayEdit) {
      setErr(`Shift closed (${describeShiftWindow(shift, shiftConfig)}). Request edit permission from GM.`);
      return;
    }

    // /api/ingest supersedes direct entry by date · stage · size · batch. If a
    // revision changes any of those, the OLD ledger row keys differently and
    // survives — the edit would double-count instead of replacing. Say so.
    if (editingId) {
      const orig = saved.find((b) => b.id === editingId);
      const sid = resolveStageId(macro, micro);
      if (
        orig &&
        (orig.date !== date ||
          orig.stageId !== sid ||
          orig.sizeCanonical !== (toCanonicalSize(size) ?? size) ||
          orig.batchId !== batchId.trim().toUpperCase())
      ) {
        if (
          !confirm(
            `You changed the date, stage, size, or batch ID of a saved entry.\n\n` +
              `The original ledger row (${orig.date} · ${orig.processName} · ${orig.size} · ${orig.batchId}) ` +
              `will NOT be replaced — it stays and this becomes a second entry.\n\n` +
              `Save as a separate entry anyway?`,
          )
        ) {
          return;
        }
        setEditing(null);
      }
    }

    // Balance check — popup + mandatory reason; never rewrite fields silently.
    // qtyMismatch with checked===0 is blocked by the save button.
    if (!isSecondary && checked > 0 && checked !== sumParts) {
      setExceptionKind("qty");
      setExceptionReason("");
      setExceptionOpen(true);
      return;
    }

    // Defect vs Rejected (A12) — always present both options; never auto-apply.
    if (defectMismatch) {
      setA12({ defectSum, reject });
      setA12Choice(null);
      return;
    }

    await finalizeSave(buildPendingRecord());
  }

  async function confirmExceptionAndSave() {
    const reason = exceptionReason.trim();
    if (reason.length < 4) return;

    if (exceptionKind === "qty") {
      // After qty exception, still need A12 if defects disagree.
      if (defectMismatch) {
        setExceptionOpen(false);
        setA12({ defectSum, reject });
        setA12Choice(null);
        // Stash reason into remarks so it survives A12 path.
        setRemarks((r) => (r ? `${r} | Exception: ${reason}` : `Exception: ${reason}`));
        await notifyException({ kind: "qty_mismatch", reason });
        setExceptionKind(null);
        return;
      }
      const rec = buildPendingRecord();
      rec.remarks = (rec.remarks ? rec.remarks + " | " : "") + `Qty mismatch exception: ${reason}`;
      setExceptionOpen(false);
      setExceptionKind(null);
      await notifyException({ kind: "qty_mismatch", reason });
      await finalizeSave(rec);
      return;
    }

    if (exceptionKind === "defect" && a12 && a12Choice === "keep-incomplete") {
      const rec = buildPendingRecord();
      rec.remarks =
        (rec.remarks ? rec.remarks + " | " : "") +
        `A12: Kept Rejected=${a12.reject}; defects incomplete (sum ${a12.defectSum}). Reason: ${reason}`;
      setExceptionOpen(false);
      setExceptionKind(null);
      await notifyException({
        kind: "defect_mismatch",
        reason,
        defectSum: a12.defectSum,
        reject: a12.reject,
        a12Choice: "keep-incomplete",
      });
      await finalizeSave(rec);
    }
  }

  async function applyA12AndSave() {
    if (!a12 || !a12Choice) {
      setErr("Choose how to resolve the defect / reject mismatch.");
      return;
    }
    if (a12Choice === "keep-incomplete") {
      // Mandatory reason via modal — never save incomplete defects silently.
      setExceptionKind("defect");
      setExceptionReason("");
      setExceptionOpen(true);
      return;
    }
    let nextReject = reject;
    if (a12Choice === "set-reject") {
      nextReject = a12.defectSum;
      setReject(nextReject);
    }
    // Aligning Rejected to defect sum is a normal correction — no GM exception.
    const rec = buildPendingRecord(nextReject);
    rec.remarks =
      (rec.remarks ? rec.remarks + " | " : "") +
      `Aligned Rejected to defect sum (${a12.defectSum}) before save`;
    setMsg(`Rejected set to ${a12.defectSum} to match defect reasons — saving…`);
    await finalizeSave(rec);
  }

  /** Load a logged row back into the form above for revision. */
  function editRow(rec: ShiftBatchRecord) {
    if (!canWrite) {
      setErr("View-only role — editing is disabled.");
      return;
    }
    setMacro(rec.macro);
    setMicro(rec.micro);
    setDate(rec.date);
    setSize(rec.size);
    if (rec.productType) applyProductType(rec.productType);
    setOperator(toEntryRole(rec.operator));
    setShift(rec.shift);
    setBatchId(rec.batchId);
    setBatchManual(true);
    setChecked(rec.checked);
    setTrolleys(rec.trolleys ?? 0);
    setBin(rec.bin ?? "");
    setAccept(rec.accept);
    setHold(rec.hold);
    setReject(rec.reject);
    setDefects({ ...(rec.defects ?? {}) });
    setRemarks(rec.remarks ?? "");
    // Loaded values are the operator's own numbers — upstream prefill must not
    // overwrite them, same rule as a restored draft.
    userTouchedQty.current = true;
    prefillAppliedKey.current = null;
    setPrefillNote(null);
    setA12(null);
    setA12Choice(null);
    setEditing(rec.id);
    setPreviewId(null);
    setMsg(null);
    setErr(null);
    document.getElementById("batch-entry-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelEdit() {
    setEditing(null);
    clearFormKeepContext();
    setBatchManual(false);
  }

  /**
   * Remove a logged batch. A synced row also has to leave the LEDGER — deleting
   * it from the local shift list alone left the numbers on the dashboard with
   * no row left to explain them.
   *
   * Scope the erase by date · shift · batch · stage · size so we never wipe
   * every batch that shares the same day, and so Direct Entry is matched via
   * extractedBy / "Manual Entry" (not only provenance.is_direct_entry).
   */
  async function deleteLocal(id: string) {
    const rec = saved.find((b) => b.id === id);
    if (!rec) return;
    const synced = rec.synced;

    // Once a batch reaches the ledger it stops being the operator's to remove.
    // Un-synced rows are still just this shift's local list, so anyone who may
    // write can clear them. Guarded here rather than on the button alone so
    // every caller of deleteLocal is covered.
    if (synced && !canEraseLedger) {
      setErr(
        `Batch ${rec.batchId} is already saved to the ledger. Saved rows can only be erased by a ` +
          `GM, from the Audit trail — ask a GM, or add a correction entry instead.`,
      );
      return;
    }

    if (
      !confirm(
        synced
          ? `Permanently delete batch ${rec.batchId}?\n\n` +
              `${rec.date} · ${rec.processName} · ${rec.size}\n\n` +
              "It is already synced, so this erases it from the ledger too — the numbers leave " +
              "the dashboard and the audit trail. This cannot be undone."
          : `Remove batch ${rec.batchId} from the current shift list?`,
      )
    )
      return;

    if (id === editingId) setEditing(null);
    if (id === previewId) setPreviewId(null);

    if (synced) {
      try {
        const qs = new URLSearchParams({
          date: rec.date,
          shift: rec.shift || "Day Shift",
          source: "Direct Entry",
          batch: rec.batchId.trim().toUpperCase(),
        });
        if (rec.stageId) qs.set("stageId", rec.stageId);
        if (rec.sizeCanonical) qs.set("size", rec.sizeCanonical);

        const res = await fetch(`/api/manual-entries?${qs}`, { method: "DELETE" });
        const body = await res.json().catch(() => ({} as { error?: string; deletedCount?: number }));
        if (!res.ok) throw new Error(body.error ?? "Delete failed");
        if (!body.deletedCount) {
          throw new Error(
            "No matching ledger events found for this batch (date/shift/batch). " +
              "It may already be gone, or was saved under a different shift label.",
          );
        }
        await refreshEvents().catch(console.error);
        onSynced?.();
      } catch (e) {
        setErr(
          `Ledger delete failed — batch kept on this list: ${
            e instanceof Error ? e.message : "unknown error"
          }`,
        );
        return;
      }
    }

    const next = saved.filter((b) => b.id !== id);
    setSaved(next);
    persistShift(next);
    setMsg(synced ? `Batch ${rec.batchId} erased from the ledger.` : `Batch ${rec.batchId} removed.`);
  }

  function exportCSV() {
    if (saved.length === 0) {
      alert("No logged batches to export.");
      return;
    }
    const uniqueDefects = new Set<string>();
    saved.forEach((b) => Object.keys(b.defects || {}).forEach((d) => uniqueDefects.add(d)));
    const defectHeaders = Array.from(uniqueDefects);

    let csv =
      "Date,Operator,Stage,Process,Size,Type,Batch ID,Quantity/Checked,Trolleys,Bin,Accept,Hold,Reject,Yield %,Remarks,Synced";
    defectHeaders.forEach((dh) => {
      csv += `,Defect_${dh}`;
    });
    csv += "\r\n";

    saved.forEach((b) => {
      const isSec = b.macro === "secondary";
      const isPri = b.macro === "primary";
      const yieldPct =
        isSec || b.checked <= 0 ? "" : ((b.accept / b.checked) * 100).toFixed(2);
      const escRem = `"${String(b.remarks || "").replace(/"/g, '""')}"`;
      const trolleyVal = isPri ? (b.trolleys ?? 0) : "";
      const binVal = isSec ? `"${String(b.bin || "").replace(/"/g, '""')}"` : "";
      const acceptVal = isSec ? "" : b.accept;
      const holdVal = isPri || isSec ? "" : b.hold;
      const rejectVal = isSec ? "" : b.reject;
      const typeVal = b.productType || "2 way";
      let row = `${b.date},${b.operator},"${b.stageName}","${b.processName}",${b.size},${typeVal},${b.batchId},${b.checked},${trolleyVal},${binVal},${acceptVal},${holdVal},${rejectVal},${yieldPct},${escRem},${b.synced ? "yes" : "no"}`;
      defectHeaders.forEach((dh) => {
        row += `,${isSec ? 0 : b.defects[dh] || 0}`;
      });
      csv += row + "\r\n";
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `disposafe-session-matrix-${date || "export"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Fixed locale ("en-US"), not `undefined` (runtime default) — the SSR
  // server and the browser can default to different locales (e.g. server
  // Locale-stable date format — long locale strings differed server/client and
  // forced a full remount that wiped mid-entry quantities.
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const qtyInputStyle = (opts?: { mismatch?: boolean; emphasize?: "good" | "bad" | "warn" | null }): React.CSSProperties => ({
    ...inp,
    ...qtyInp,
    textAlign: "center",
    fontWeight: 600,
    fontFamily: "var(--font-mono)",
    borderColor: opts?.mismatch ? "var(--status-warn, #d97706)" : undefined,
    color:
      opts?.emphasize === "bad"
        ? "var(--status-bad)"
        : opts?.emphasize === "good"
          ? "var(--status-good)"
          : opts?.emphasize === "warn"
            ? "var(--status-warn, #d97706)"
            : "var(--text)",
  });

  return (
    <div style={panel} id="batch-entry-form">
      {/* Compact status row — one line of chrome, not a banner stack */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span className="small" style={{ color: "var(--text-2)", fontWeight: 600 }}>{todayLabel}</span>
        {canWrite && persona === "operator" && (
          <span
            style={
              withinShift || hasGrant
                ? statusPill("good")
                : statusPill("warn")
            }
            title={describeShiftWindow(shift, shiftConfig)}
          >
            {withinShift
              ? `Shift open · ${describeShiftWindow(shift, shiftConfig)}`
              : hasGrant
                ? "GM grant active — you may save"
                : `Shift closed · ${describeShiftWindow(shift, shiftConfig)}`}
          </span>
        )}
        {!canWrite && (
          <span style={statusPill("neutral")}>View only — switch to Operator or GM to save</span>
        )}
        {schemaSource === "loading" && (
          <span style={statusPill("neutral")}>Loading schema…</span>
        )}
        {schemaSource === "catalog" && (
          <span style={statusPill("good")} title={usingModDefects ? `${activeDefects.length} defect codes` : "Defaults for defects"}>
            Schema · plant
            {usingModDefects ? ` · ${activeDefects.length} defects` : ""}
          </span>
        )}
        {schemaSource === "builtin" && (
          <span style={statusPill("neutral")}>
            Schema · built-in
            {canConfigure && (
              <>
                {" · "}
                <a href="/schema" style={{ color: "var(--accent)", fontWeight: 600 }}>Set up plant schema</a>
              </>
            )}
          </span>
        )}
        {canConfigure && schemaSource === "catalog" && (
          <a href="/schema" className="small" style={{ color: "var(--text-3)", marginLeft: "auto", fontWeight: 500 }}>
            Edit schema
          </a>
        )}
      </div>

      {editingId && (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid var(--accent)",
            background: "var(--accent-weak)",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span>
            Revising <strong style={{ fontFamily: "var(--font-mono)" }}>{saved.find((b) => b.id === editingId)?.batchId}</strong>
            {" "}— save replaces that entry on the ledger.
          </span>
          <button type="button" onClick={cancelEdit} style={{ ...btnGhost, marginLeft: "auto" }}>
            Cancel edit
          </button>
        </div>
      )}

      {canWrite && persona === "operator" && !withinShift && !hasGrant && (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid var(--status-warn, #d97706)",
            background: "color-mix(in srgb, var(--status-warn, #d97706) 12%, var(--surface))",
            fontSize: 13,
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
          }}
        >
          <span style={{ flex: 1, lineHeight: 1.45 }}>
            <strong>Shift closed</strong> — entries on the ledger are locked. Request GM permission to change one.
          </span>
          <button type="button" onClick={requestEditPermission} disabled={requestingEdit} style={btnPrimary}>
            {requestingEdit ? "Requesting…" : "Request edit permission"}
          </button>
        </div>
      )}

      {/* Station selection — full-width steps, plant language */}
      <div style={{ marginBottom: 16 }}>
        <div style={sectionLabel}>Where is this batch?</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: isAssembly ? 10 : 0 }}>
          {(Object.keys(MATRIX_STAGES) as MacroId[]).map((id) => (
            <button key={id} type="button" onClick={() => selectMacro(id)} style={macro === id ? chipOn : chipOff}>
              {MATRIX_STAGES[id].shortLabel}
            </button>
          ))}
        </div>
        {isAssembly && (
          <>
            <div style={{ ...sectionLabel, marginTop: 4 }}>Which station?</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {MATRIX_STAGES.assembly.processes.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectMicro(p.id)}
                  style={micro === p.id ? chipOn : chipOff}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </>
        )}
        {!isAssembly && MATRIX_STAGES[macro].processes.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {MATRIX_STAGES[macro].processes.map((p) => (
              <span key={p.id} style={chipBadge}>{p.name}</span>
            ))}
          </div>
        )}
      </div>

      {/* Identity | Counts — counts carry the visual weight */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr)",
          gap: 14,
          marginBottom: 16,
        }}
        className="batch-matrix-zones"
      >
        <div style={zone}>
          <div style={zoneTitle}>Who / batch</div>
          <div
            style={{ display: "grid", gridTemplateColumns: identityCols, gap: 12, alignItems: "start" }}
            className="batch-matrix-identity"
          >
            <FieldCol label="Recorded by">
              <Select
                value={operator}
                onChange={setOperator}
                options={ENTRY_ROLES.map((o) => ({ value: o, label: o }))}
                ariaLabel="Recorded by"
              />
              <label style={subLabel}>
                Recorded on
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    // Never unlock/rewrite lot just because inspection day moved.
                    setDate(e.target.value);
                  }}
                  title="Day this station ran the lot — not the batch origin date"
                  style={{ ...inp, marginTop: 4 }}
                />
              </label>
              <label style={subLabel}>
                Shift
                <Select
                  value={shift}
                  onChange={setShift}
                  options={[
                    { value: "Day Shift", label: "Day Shift" },
                    { value: "Night Shift", label: "Night Shift" },
                  ]}
                  ariaLabel="Shift"
                  style={{ marginTop: 4 }}
                />
              </label>
            </FieldCol>

            <FieldCol label="Category">
              <Select
                value={category}
                disabled={!mayEdit}
                onChange={(v) => applyCategory(v as CatheterCategory)}
                options={CATHETER_CATEGORIES.map((c) => ({ value: c, label: c }))}
                ariaLabel="Category"
                style={{ fontWeight: 600 }}
              />
              <label style={subLabel}>
                Size
                <Select
                  value={size}
                  disabled={!mayEdit}
                  onChange={(v) => { setBatchManual(false); setSize(v); }}
                  options={catheterSizeOptions.map((s) => ({ value: s, label: s }))}
                  mono
                  ariaLabel="Size"
                  style={{ marginTop: 4, fontWeight: 600 }}
                />
              </label>
              <label
                style={{
                  ...subLabel,
                  visibility: typeIsSelectable(category) ? "visible" : "hidden",
                }}
              >
                Type
                <Select
                  value={catheterType}
                  disabled={!mayEdit || !typeIsSelectable(category)}
                  onChange={(v) => applyCatheterType(v as CatheterType)}
                  options={[
                    { value: "2 way", label: "2 way" },
                    { value: "3 way", label: "3 way" },
                  ]}
                  ariaLabel="Type"
                  style={{ marginTop: 4, fontWeight: 600 }}
                />
              </label>
            </FieldCol>

            <FieldCol label="Batch / lot ID">
              <input
                value={batchId}
                onChange={(e) => onBatchInput(e.target.value)}
                maxLength={10}
                placeholder="26F27-14"
                title="Lot identity. Auto-hyphenates as you type. Locked once you enter quantities so production date can change across days."
                style={{
                  ...inp,
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700,
                  fontSize: 15,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "var(--accent)",
                }}
              />
              {parsed ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                  <span style={badge("blue")}>Yr: {parsed.year2}</span>
                  <span style={badge("green")}>Mo: {parsed.monthName}</span>
                  <span style={badge("amber")}>Day: {parsed.day}</span>
                  {parsed.sizeFr ? (
                    <span style={badge("purple")}>Sz: {parsed.sizeFr} FR</span>
                  ) : (
                    <span style={badge("amber")}>Sz: —</span>
                  )}
                </div>
              ) : batchId.trim() ? (
                <p className="small" style={{ marginTop: 6, color: "var(--status-warn, #d97706)", fontSize: 11 }}>
                  Incomplete — format YY + month letter + DD + size (e.g. 26F27-14)
                </p>
              ) : null}
              {isAssembly && lotProgress && lotProgress.doneCount > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "7px 9px",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    background: "var(--surface-2, var(--surface))",
                  }}
                >
                  <LotProgress progress={lotProgress} activeStageId={stageId} />
                  {stageAlreadyDone && (
                    <p
                      className="small"
                      style={{ marginTop: 6, marginBottom: 0, fontSize: 11, color: "var(--status-warn, #d97706)" }}
                    >
                      {processLabel(macro, micro)} already recorded for this lot on{" "}
                      {stageAlreadyDone.date} — saving again adds a second entry.
                    </p>
                  )}
                </div>
              )}
              <div
                className="small"
                style={{
                  marginTop: 6,
                  color: "var(--text-3)",
                  lineHeight: 1.4,
                  fontSize: 11.5,
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>
                  {batchManual
                    ? "Lot locked — production date is the inspection day only."
                    : "Auto from production date + size until locked."}
                </span>
                {batchManual && (
                  <button
                    type="button"
                    onClick={rebuildBatchFromDate}
                    style={{
                      ...btnGhost,
                      padding: "2px 8px",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    Rebuild from date
                  </button>
                )}
              </div>
            </FieldCol>
          </div>
        </div>

        <div style={{ ...zone, borderColor: "var(--border-strong)", background: "var(--surface)" }}>
          <div style={zoneTitle}>Counts</div>
          <div
            style={{ display: "grid", gridTemplateColumns: countCols, gap: 12, alignItems: "start" }}
            className="batch-matrix-counts"
          >
            {isSecondary && (
              <>
                <FieldCol label="Quantity *" align="center">
                  <QtyInput
                    value={checked || null}
                    onChange={(n) => setQty("checked", n)}
                    style={qtyInputStyle()}
                    aria-label="Quantity"
                  />
                </FieldCol>
                <FieldCol label="Bin *">
                  <input
                    list="secondary-bin-options"
                    value={bin}
                    onChange={(e) => setBin(e.target.value)}
                    placeholder="e.g. Bin A"
                    style={{ ...inp, fontWeight: 600 }}
                  />
                  <datalist id="secondary-bin-options">
                    {SECONDARY_BINS.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </FieldCol>
              </>
            )}

            {isPrimary && (
              <>
                <FieldCol label={qtyLabel} align="center">
                  <QtyInput
                    value={checked || null}
                    onChange={(n) => setQty("checked", n)}
                    style={qtyInputStyle({ mismatch: qtyMismatch && checked > 0 })}
                    aria-label={qtyLabel}
                  />
                  {balanceHint && (
                    <div
                      className="small"
                      style={{
                        marginTop: 6,
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        fontWeight: 600,
                        textAlign: "center",
                        lineHeight: 1.35,
                        color: qtyMismatch ? "var(--status-warn, #d97706)" : "var(--status-good)",
                      }}
                    >
                      {balanceHint}
                      {qtyMismatch ? " · fix parts" : " · ok"}
                    </div>
                  )}
                </FieldCol>
                <FieldCol label="Trolleys" align="center">
                  <QtyInput
                    value={trolleys || null}
                    onChange={(n) => setQty("trolleys", n)}
                    style={qtyInputStyle()}
                    aria-label="Trolleys"
                  />
                </FieldCol>
                <FieldCol label="Accept" align="center">
                  <QtyInput
                    value={accept || null}
                    onChange={(n) => setQty("accept", n)}
                    style={qtyInputStyle({ emphasize: accept > 0 ? "good" : null })}
                    aria-label="Accept"
                  />
                </FieldCol>
                <FieldCol label="Reject" align="center">
                  <div
                    aria-label="Reject"
                    aria-readonly="true"
                    style={{
                      ...qtyInputStyle({ emphasize: reject > 0 ? "bad" : null }),
                      background: "var(--surface-2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title={
                      rejectSource === "defects"
                        ? "From defect reasons below"
                        : "Auto: Quantity − Accept"
                    }
                  >
                    {reject}
                  </div>
                  <div className="small" style={{ marginTop: 6, color: "var(--text-3)", textAlign: "center", fontSize: 11, lineHeight: 1.3 }}>
                    {rejectSource === "defects"
                      ? "= defect sum"
                      : checked > 0
                        ? `= ${checked} − ${accept}`
                        : "auto"}
                  </div>
                </FieldCol>
              </>
            )}

            {isAssembly && (
              <>
                <FieldCol label={qtyLabel} align="center">
                  <QtyInput
                    value={checked || null}
                    onChange={(n) => setQty("checked", n)}
                    style={qtyInputStyle({ mismatch: qtyMismatch && checked > 0 })}
                    aria-label={qtyLabel}
                  />
                  {balanceHint && (
                    <div
                      className="small"
                      style={{
                        marginTop: 6,
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        fontWeight: 600,
                        textAlign: "center",
                        lineHeight: 1.35,
                        color: qtyMismatch ? "var(--status-warn, #d97706)" : "var(--status-good)",
                      }}
                    >
                      {balanceHint}
                      {qtyMismatch ? " · fix parts" : " · ok"}
                    </div>
                  )}
                  {prefillNote && (
                    <button
                      type="button"
                      onClick={() => setPrefillNote(null)}
                      title={prefillNote}
                      style={{
                        ...badge("blue"),
                        marginTop: 6,
                        width: "100%",
                        cursor: "pointer",
                        border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                        textAlign: "left",
                        lineHeight: 1.3,
                      }}
                    >
                      From prior station · dismiss
                    </button>
                  )}
                </FieldCol>
                <FieldCol label="Accept" align="center">
                  <QtyInput
                    value={accept || null}
                    onChange={(n) => setQty("accept", n)}
                    style={qtyInputStyle({ emphasize: accept > 0 ? "good" : null })}
                    aria-label="Accept"
                  />
                </FieldCol>
                {capturesHold && (
                  <FieldCol label="Hold" align="center">
                    <QtyInput
                      value={hold || null}
                      onChange={(n) => setQty("hold", n)}
                      style={qtyInputStyle({ emphasize: hold > 0 ? "warn" : null })}
                      aria-label="Hold"
                    />
                  </FieldCol>
                )}
                <FieldCol label="Reject" align="center">
                  <div
                    aria-label="Reject"
                    aria-readonly="true"
                    style={{
                      ...qtyInputStyle({ emphasize: reject > 0 ? "bad" : null }),
                      background: "var(--surface-2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title={
                      rejectSource === "defects"
                        ? "Sum of the defect counts below"
                        : "Auto: Checked − Accept − Hold"
                    }
                  >
                    {reject}
                  </div>
                  <div className="small" style={{ marginTop: 6, color: "var(--text-3)", textAlign: "center", fontSize: 11, lineHeight: 1.3 }}>
                    {rejectSource === "defects"
                      ? "= defect sum"
                      : checked > 0
                        ? capturesHold
                          ? `= ${checked} − ${accept} − ${hold}`
                          : `= ${checked} − ${accept}`
                        : "auto"}
                  </div>
                </FieldCol>
              </>
            )}
          </div>
        </div>
        <style>{`
          @media (max-width: 900px) {
            .batch-matrix-zones {
              grid-template-columns: 1fr !important;
            }
          }
          @media (max-width: 640px) {
            .batch-matrix-identity,
            .batch-matrix-counts {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
          }
          @media (max-width: 420px) {
            .batch-matrix-identity,
            .batch-matrix-counts {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>

      {!hideDefects && (
        <div style={{ marginBottom: 16, padding: 16, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--status-bad)", display: "inline-block" }} />
                Defects
                {reject > 0 && (
                  <span style={{ fontWeight: 600, color: "var(--text-2)" }}>
                    · need {reject}
                  </span>
                )}
                {(reject > 0 || defectSum > 0) && (
                  <span
                    style={{
                      fontWeight: 600,
                      color: defectMismatch ? "var(--status-warn, #d97706)" : "var(--status-good)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                    }}
                  >
                    · sum {defectSum}
                    {defectMismatch ? " (not matched)" : reject > 0 ? " (matched)" : ""}
                  </span>
                )}
              </div>
              <div className="small" style={{ color: "var(--text-3)", fontWeight: 500, fontSize: 12 }}>
                {processLabel(macro, micro)}
              </div>
            </div>
            <input
              value={defectFilter}
              onChange={(e) => setDefectFilter(e.target.value)}
              placeholder={`Find a defect (${activeDefects.length})`}
              style={{ ...inp, width: 190, marginLeft: "auto" }}
              aria-label="Filter defect list"
            />
            <span
              style={{
                ...badge(defectMismatch ? "amber" : defectSum === reject && reject > 0 ? "green" : "blue"),
              }}
              title={
                defectMismatch
                  ? `Defect columns sum to ${defectSum} but Rejected is ${reject}`
                  : `Defect sum vs Rejected`
              }
            >
              {defectMismatch
                ? `Unreconciled (${defectSum} of ${reject})`
                : reject > 0 || defectSum > 0
                  ? `Fully reconciled (${defectSum} of ${reject})`
                  : `Defect sum: ${defectSum}`}
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))",
              gap: 12,
              alignItems: "stretch",
            }}
          >
            {visibleDefects.map(({ d, i }) => {
              const val = defects[d.key] || 0;
              const active = val > 0;
              // Schema-sourced names are shown verbatim. defectDisplayLabel
              // collapses "Coagulant" back to "COAG" (it treats the code as the
              // canonical card title), which silently undoes a Data Schema
              // rename — right for the built-in list, wrong for a schema label.
              const title = usingModDefects ? d.name || d.key : defectDisplayLabel(d);
              return (
                <div
                  key={d.key}
                  style={{
                    padding: "10px 8px",
                    borderRadius: 8,
                    border: active
                      ? "1px solid color-mix(in srgb, var(--status-bad) 40%, var(--border))"
                      : "1px solid transparent",
                    background: active ? "var(--surface-2)" : "transparent",
                    opacity: active ? 1 : 0.72,
                    display: "grid",
                    gridTemplateRows: "36px auto",
                    gap: 6,
                    minHeight: 88,
                    boxSizing: "border-box",
                    position: "relative",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 4,
                      left: 6,
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-3)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <div
                    title={`${i + 1}. ${title}${d.name && d.name !== title ? ` (${d.key})` : ""}`}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      fontWeight: active ? 700 : 500,
                      color: "var(--text)",
                      lineHeight: 1.25,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      overflow: "hidden",
                      wordBreak: "break-word",
                    }}
                  >
                    {title}
                  </div>
                  <QtyInput
                    value={val || null}
                    onChange={(n) => setDefectQty(d.key, n)}
                    aria-label={title}
                    style={{
                      ...inp,
                      textAlign: "center",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 700,
                      borderColor: active ? "var(--border-strong)" : "var(--border)",
                      height: 40,
                      background: active ? "var(--bg)" : "var(--surface)",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <div style={sectionLabel}>Remarks</div>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Optional hand-over notes for this batch…"
          style={{ ...inp, minHeight: 56, resize: "vertical", fontFamily: "inherit" }}
        />
      </div>

      {/* Live balance strip — shows the correct split, not only a mismatch flag */}
      {!isSecondary && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 8,
            border: `1px solid ${
              qtyMismatch && checked > 0
                ? "var(--status-warn, #d97706)"
                : defectMismatch
                  ? "var(--status-warn, #d97706)"
                  : "var(--border)"
            }`,
            background:
              qtyMismatch && checked > 0
                ? "color-mix(in srgb, var(--status-warn, #d97706) 10%, var(--surface))"
                : defectMismatch
                  ? "color-mix(in srgb, var(--status-warn, #d97706) 8%, var(--surface))"
                  : "var(--surface-2)",
            fontSize: 12.5,
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
            <span>
              {qtyLabel} {checked} ={" "}
              {isPrimary ? (
                <>Accept {accept} + Reject {reject}</>
              ) : capturesHold ? (
                <>Accept {accept} + Hold {hold} + Reject {reject}</>
              ) : (
                <>Accept {accept} + Reject {reject}</>
              )}{" "}
              → sum {sumParts}
            </span>
            <span
              style={{
                color:
                  checked === 0
                    ? "var(--text-3)"
                    : qtyMismatch
                      ? "var(--status-warn, #d97706)"
                      : "var(--status-good)",
              }}
            >
              {checked === 0
                ? "Enter quantities"
                : qtyMismatch
                  ? "Not balanced"
                  : "Balanced"}
            </span>
          </div>
          {checked > 0 && (
            <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-2)", fontFamily: "inherit" }}>
              Correct: Reject = {impliedRejectFromBalance}
              {capturesHold
                ? ` (${checked} − Accept ${accept} − Hold ${hold})`
                : ` (${checked} − Accept ${accept})`}
              {rejectSource === "defects" && defectSum !== impliedRejectFromBalance && (
                <span style={{ color: "var(--status-warn, #d97706)" }}>
                  {" "}
                  · defect sum is {defectSum} — adjust Accept/Hold or defect reasons
                </span>
              )}
              {!hideDefects && reject > 0 && defectSum !== reject && (
                <span style={{ color: "var(--status-warn, #d97706)" }}>
                  {" "}
                  · defect reasons should total {reject} (now {defectSum})
                </span>
              )}
              {!hideDefects && reject > 0 && defectSum === reject && (
                <span style={{ color: "var(--status-good)" }}> · defect reasons match Reject</span>
              )}
            </div>
          )}
        </div>
      )}

      {a12 && (
        <div
          style={{
            marginBottom: 16,
            padding: 14,
            borderRadius: 10,
            border: "1px solid var(--status-warn, #d97706)",
            background: "var(--surface)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            Defect counts don&apos;t add up to Rejected
          </div>
          <p className="small" style={{ color: "var(--text-2)", marginBottom: 10 }}>
            Defects sum to {a12.defectSum}, Rejected is {a12.reject}. Choose how to resolve before saving — nothing is auto-changed.
          </p>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, fontSize: 13, cursor: "pointer" }}>
            <input
              type="radio"
              name="a12"
              checked={a12Choice === "set-reject"}
              onChange={() => setA12Choice("set-reject")}
            />
            Set Rejected = {a12.defectSum} (match defect columns)
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, fontSize: 13, cursor: "pointer" }}>
            <input
              type="radio"
              name="a12"
              checked={a12Choice === "keep-incomplete"}
              onChange={() => setA12Choice("keep-incomplete")}
            />
            Keep Rejected = {a12.reject} (treat defects as incomplete)
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={applyA12AndSave} disabled={saving || !a12Choice} style={btnPrimary}>
              Apply after I confirm
            </button>
            <button
              type="button"
              onClick={() => {
                setA12(null);
                setA12Choice(null);
              }}
              style={btnGhost}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {err && (
        <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: "var(--negative-weak, #fee2e2)", color: "var(--status-bad)", fontSize: 13 }}>{err}</div>
      )}
      {msg && (
        <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: "var(--positive-weak)", color: "var(--positive)", fontSize: 13 }}>{msg}</div>
      )}

      {/* Sticky save bar */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 5,
          margin: "16px -16px -16px",
          padding: "12px 16px",
          borderTop: "1px solid var(--border-strong)",
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 13, color: "var(--text-2)" }}>
          {checked === 0 ? (
            <>Enter {qtyLabel} to save.</>
          ) : (
            <>
              <strong style={{ fontFamily: "var(--font-mono)" }}>{batchId}</strong> · {processLabel(macro, micro)} ·{" "}
              {size} · {qtyLabel} {checked}
              {!isSecondary && (
                <span style={{ color: qtyMismatch ? "var(--status-warn, #d97706)" : "var(--status-good)", fontWeight: 600 }}>
                  {" "}· {qtyMismatch ? "mismatch" : "balanced"}
                </span>
              )}
              {!isSecondary && defectMismatch && (
                <span style={{ color: "var(--status-bad)", fontWeight: 700 }}>
                  {" "}· defects {defectSum} of {reject}
                </span>
              )}
            </>
          )}
        </div>
        {editingId && (
          <button type="button" onClick={cancelEdit} style={btnGhost}>
            Cancel edit
          </button>
        )}
        <button
          type="button"
          onClick={submitForm}
          disabled={saving || !!a12 || checked === 0 || !mayEdit}
          style={{
            ...btnPrimary,
            marginLeft: "auto",
            padding: "10px 22px",
            fontSize: 14,
            fontWeight: 700,
            opacity: saving || !!a12 || checked === 0 || !mayEdit ? 0.5 : 1,
            cursor: saving || !!a12 || checked === 0 || !mayEdit ? "not-allowed" : "pointer",
          }}
        >
          {saveLabel}
        </button>
      </div>

      <ExceptionModal
        open={exceptionOpen}
        title={
          exceptionKind === "defect"
            ? "Defect sum does not match Rejected"
            : "Quantity balance mismatch"
        }
        lines={
          exceptionKind === "defect" && a12
            ? [
                { label: "Defect sum", value: String(a12.defectSum) },
                { label: "Rejected", value: String(a12.reject) },
                { label: "Batch", value: batchId },
                { label: "Type", value: String(productType) },
              ]
            : [
                { label: qtyLabel, value: String(checked) },
                { label: isPrimary ? "Accept+Reject" : "Accept+Hold+Reject", value: String(sumParts) },
                { label: "Batch", value: batchId },
                { label: "Type", value: String(productType) },
              ]
        }
        reason={exceptionReason}
        onReasonChange={setExceptionReason}
        onConfirm={() => void confirmExceptionAndSave()}
        onCancel={() => {
          setExceptionOpen(false);
          setExceptionKind(null);
        }}
        busy={saving}
      />

      {/* Shift list */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>This shift</div>
            <div className="small" style={{ color: "var(--text-3)", fontSize: 12 }}>
              Rows on the ledger stay until you delete them. Local rows save when the shift ends.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Select
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: "All Type", label: "All Type" },
                ...[...PRODUCT_TYPES, "Peadiatric"].map((t) => ({ value: t, label: t })),
              ]}
              block={false}
              size="sm"
              ariaLabel="Filter by type"
              style={{ minWidth: 118 }}
            />
            <button type="button" onClick={exportCSV} style={btnGhost}>Export Session CSV</button>
          </div>
        </div>

        {saved.length === 0 ? (
          <div style={{ textAlign: "center", padding: 28, color: "var(--text-3)", fontSize: 13, border: "1px dashed var(--border)", borderRadius: 10, lineHeight: 1.5 }}>
            No batches this shift yet.
            <br />
            <span style={{ color: "var(--text-2)" }}>Save a batch above — it will list here until the shift ends.</span>
          </div>
        ) : saved.filter((b) => typeFilter === "All Type" || (b.productType || "2 way") === typeFilter).length === 0 ? (
          <div style={{ textAlign: "center", padding: 28, color: "var(--text-3)", fontSize: 13, border: "1px dashed var(--border)", borderRadius: 10 }}>
            No batches for type &quot;{typeFilter}&quot;.
          </div>
        ) : (
          <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={thRow}>
                  <th style={th}>Operator</th>
                  <th style={th}>Stage & Process</th>
                  <th style={th}>Type</th>
                  <th style={th}>Batch ID</th>
                  <th style={{ ...th, textAlign: "center" }}>Qty</th>
                  <th style={{ ...th, textAlign: "center" }}>Trolleys</th>
                  <th style={th}>Bin</th>
                  <th style={{ ...th, textAlign: "center" }}>Accept</th>
                  <th style={{ ...th, textAlign: "center" }}>Hold</th>
                  <th style={{ ...th, textAlign: "center" }}>Reject</th>
                  <th style={{ ...th, textAlign: "center" }}>Yield</th>
                  <th style={{ ...th, textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {saved
                  .filter((b) => typeFilter === "All Type" || (b.productType || "2 way") === typeFilter)
                  .map((rec) => {
                  const primaryRow = rec.macro === "primary";
                  const secondaryRow = rec.macro === "secondary";
                  const yieldPct =
                    secondaryRow || rec.checked <= 0
                      ? "—"
                      : ((rec.accept / rec.checked) * 100).toFixed(1) + "%";
                  const defLog = Object.entries(rec.defects || {})
                    .filter(([, v]) => v > 0)
                    .map(([k, v]) => `${k}:${v}`)
                    .join(", ");
                  const open = previewId === rec.id;
                  return (
                    <React.Fragment key={rec.id}>
                    <tr
                      onClick={() => setPreviewId(open ? null : rec.id)}
                      style={{
                        borderBottom: open ? "none" : "1px solid var(--border)",
                        cursor: "pointer",
                        background: open ? "var(--surface-2)" : rec.id === editingId ? "var(--accent-weak)" : undefined,
                      }}
                      title="Click to preview this entry"
                    >
                      <td style={tdCell}>
                        {rec.operator}
                        {rec.synced ? (
                          <div className="small" style={{ color: "var(--positive)", fontSize: 11, fontWeight: 600 }}>On ledger</div>
                        ) : (
                          <div className="small" style={{ color: "var(--status-warn, #d97706)", fontSize: 11, fontWeight: 600 }}>Not on ledger yet</div>
                        )}
                      </td>
                      <td style={tdCell}>
                        <div style={{ fontWeight: 600 }}>{rec.processName}</div>
                        <div className="small" style={{ color: "var(--text-3)", fontSize: 12 }}>{rec.stageName}</div>
                      </td>
                      <td style={tdCell}>{rec.productType || "2 way"}</td>
                      <td style={{ ...tdCell, fontFamily: "var(--font-mono)", fontWeight: 700 }}>{rec.batchId}</td>
                      <td style={{ ...tdCell, textAlign: "center" }}>{rec.checked}</td>
                      <td style={{ ...tdCell, textAlign: "center" }}>{primaryRow ? (rec.trolleys ?? 0) : "—"}</td>
                      <td style={tdCell}>{secondaryRow ? (rec.bin || "—") : "—"}</td>
                      <td style={{ ...tdCell, textAlign: "center", fontWeight: 600 }}>
                        {secondaryRow ? "—" : rec.accept}
                      </td>
                      <td style={{ ...tdCell, textAlign: "center" }}>
                        {primaryRow || secondaryRow ? "—" : rec.hold}
                      </td>
                      <td style={{ ...tdCell, textAlign: "center" }}>
                        {secondaryRow ? (
                          "—"
                        ) : (
                          <>
                            <span style={{ color: rec.reject > 0 ? "var(--status-bad)" : "var(--text-2)", fontWeight: 600 }}>{rec.reject}</span>
                            {defLog && <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{defLog}</div>}
                          </>
                        )}
                      </td>
                      <td style={{ ...tdCell, textAlign: "center", fontWeight: 700 }}>{yieldPct}</td>
                      <td style={{ ...tdCell, textAlign: "right" }}>
                        {rec.synced && !canEraseLedger ? (
                          <span
                            style={{
                              fontSize: "var(--text-xs)",
                              color: "var(--text-3)",
                              whiteSpace: "nowrap",
                            }}
                            title="Saved to the ledger. Only a GM can erase it, from the Audit trail."
                          >
                            Saved · locked
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); deleteLocal(rec.id); }}
                            style={btnDanger}
                            title={rec.synced ? "Erase from the ledger too" : "Remove from this shift list"}
                          >
                            {rec.synced ? "Erase" : "Remove"}
                          </button>
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
                        <td colSpan={12} style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 10 }}>
                            <PreviewField label="Date" value={rec.date} mono />
                            <PreviewField label="Shift" value={rec.shift} />
                            <PreviewField label="Stage" value={`${rec.processName} · ${rec.stageName}`} />
                            <PreviewField label="Size" value={rec.size} />
                            <PreviewField label="Type" value={rec.productType || "2 way"} />
                            <PreviewField label="Batch ID" value={rec.batchId} mono />
                            <PreviewField label={qtyHeaderFor(rec.macro)} value={String(rec.checked)} mono />
                            {rec.macro === "primary" && (
                              <PreviewField label="Trolleys" value={String(rec.trolleys ?? 0)} mono />
                            )}
                            {rec.macro === "secondary" && <PreviewField label="Bin" value={rec.bin || "—"} />}
                            {rec.macro !== "secondary" && (
                              <>
                                <PreviewField label="Accept" value={String(rec.accept)} mono />
                                {rec.macro === "assembly" && (
                                  <PreviewField label="Hold" value={String(rec.hold)} mono />
                                )}
                                <PreviewField label="Reject" value={String(rec.reject)} mono />
                              </>
                            )}
                            <PreviewField
                              label="Saved"
                              value={new Date(rec.savedAt).toLocaleString()}
                            />
                            <PreviewField label="Ledger" value={rec.synced ? "On ledger" : "Not on ledger yet"} />
                          </div>

                          {rec.macro !== "secondary" && (
                            <div style={{ marginBottom: 10 }}>
                              <div className="small" style={{ color: "var(--text-3)", fontSize: 12, marginBottom: 4 }}>
                                Rejection log
                              </div>
                              {defLog ? (
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                                  {defLog}
                                  {" — "}
                                  <span
                                    style={{
                                      color:
                                        Object.values(rec.defects || {}).reduce((a, b) => a + b, 0) === rec.reject
                                          ? "var(--status-good)"
                                          : "var(--status-bad)",
                                      fontWeight: 700,
                                    }}
                                  >
                                    sum {Object.values(rec.defects || {}).reduce((a, b) => a + b, 0)} vs reject {rec.reject}
                                  </span>
                                </div>
                              ) : (
                                <div className="small" style={{ color: "var(--text-3)" }}>No defects logged.</div>
                              )}
                            </div>
                          )}

                          {rec.remarks && (
                            <div style={{ marginBottom: 10, fontSize: 12 }}>
                              <span className="small" style={{ color: "var(--text-3)" }}>Remarks: </span>
                              {rec.remarks}
                            </div>
                          )}

                          <button type="button" onClick={() => editRow(rec)} style={btnGhost}>
                            Edit this entry
                          </button>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="small" style={{ color: "var(--text-3)", fontSize: 12 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, fontFamily: mono ? "var(--font-mono)" : undefined }}>
        {value}
      </div>
    </div>
  );
}

/* ── styles (token-driven) ─────────────────────────────────────────────── */
function FieldCol({
  label,
  children,
  align,
}: {
  label: string;
  children: React.ReactNode;
  align?: "center" | "left";
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-2)",
          marginBottom: 6,
          textAlign: align ?? "left",
          lineHeight: 1.3,
          minHeight: 20,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: align === "center" ? "center" : "flex-start",
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function statusPill(tone: "good" | "warn" | "neutral"): React.CSSProperties {
  const map = {
    good: {
      bg: "color-mix(in srgb, var(--positive) 12%, var(--surface))",
      fg: "var(--positive)",
      bd: "color-mix(in srgb, var(--positive) 30%, var(--border))",
    },
    warn: {
      bg: "color-mix(in srgb, var(--status-warn, #d97706) 12%, var(--surface))",
      fg: "var(--status-warn, #d97706)",
      bd: "color-mix(in srgb, var(--status-warn, #d97706) 35%, var(--border))",
    },
    neutral: {
      bg: "var(--surface-2)",
      fg: "var(--text-2)",
      bd: "var(--border)",
    },
  }[tone];
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 10px",
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: 600,
    color: map.fg,
    background: map.bg,
    border: `1px solid ${map.bd}`,
    lineHeight: 1.3,
  };
}

const panel: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 20,
};

const zone: React.CSSProperties = {
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  padding: 14,
  minWidth: 0,
};

const zoneTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "var(--text)",
  marginBottom: 12,
};

const sectionLabel: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-2)",
  marginBottom: 8,
};

const subLabel: React.CSSProperties = {
  display: "block",
  marginTop: 8,
  color: "var(--text-3)",
  fontWeight: 500,
  fontSize: 12,
};

const qtyInp: React.CSSProperties = {
  height: 42,
  fontSize: 16,
  padding: "8px 10px",
};

const chipOn: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 9999,
  border: "none",
  background: "var(--accent)",
  color: "var(--text-invert)",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};

const chipOff: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 9999,
  border: "1px solid var(--border-strong)",
  background: "var(--surface-2)",
  color: "var(--text-2)",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
};

const chipBadge: React.CSSProperties = {
  ...chipOff,
  cursor: "default",
  opacity: 0.75,
  fontSize: 11,
};

const thRow: React.CSSProperties = {
  background: "var(--surface-2)",
  borderBottom: "1px solid var(--border)",
};

const th: React.CSSProperties = {
  padding: "12px 14px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-3)",
};

const tdCell: React.CSSProperties = {
  padding: "10px 12px",
  color: "var(--text-2)",
};

const inp: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const btnPrimary: React.CSSProperties = {
  background: "var(--accent)",
  color: "var(--text-invert)",
  border: "none",
  borderRadius: 9999,
  padding: "10px 24px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

/** Destructive actions must not read as ordinary links — an erase and an edit
 *  should never look the same at a glance. */
const btnDanger: React.CSSProperties = {
  background: "transparent",
  color: "var(--status-bad)",
  border: "1px solid color-mix(in srgb, var(--status-bad) 45%, transparent)",
  borderRadius: 9999,
  padding: "4px 12px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  background: "transparent",
  color: "var(--text-2)",
  border: "1px solid var(--border)",
  borderRadius: 9999,
  padding: "8px 16px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

function badge(tone: "blue" | "green" | "amber" | "purple"): React.CSSProperties {
  const map = {
    blue: { bg: "var(--accent-weak, rgba(59,130,246,.12))", fg: "var(--accent)" },
    green: { bg: "var(--positive-weak)", fg: "var(--positive)" },
    amber: { bg: "rgba(217,119,6,.12)", fg: "var(--status-warn, #d97706)" },
    purple: { bg: "rgba(139,92,246,.12)", fg: "#8b5cf6" },
  }[tone];
  return {
    padding: "3px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    background: map.bg,
    color: map.fg,
    border: `1px solid ${map.fg}33`,
  };
}
