// Build confirm drafts from complete slots.

import {
  processLabel,
  resolveStageId,
  type MacroId,
  type ShiftBatchRecord,
} from "@/lib/entry/disposafe-matrix";
import { toCanonicalSize, toDisplaySize } from "@/lib/entry/batch-id";
import { ENTRY_ROLES } from "@/lib/entry/disposafe-matrix";
import type { EntryDraft, EntrySlots, ReportDraft, ReportSlots } from "./types";
import { defectSum } from "./missing-slots";
import { hrefForNav } from "@/lib/analytics/intent";
import type { InvestigationState } from "@/lib/analytics/investigation-state";

export function finalizeEntrySlots(slots: EntrySlots): EntrySlots {
  const next = { ...slots };
  const dSum = defectSum(next.defects);

  // Infer rejected from defects when not stated
  if (next.rejected == null && dSum > 0) {
    next.rejected = dSum;
  }

  // Infer accept from checked - reject - hold when accept missing
  if (
    next.acceptedGood == null &&
    next.checked != null &&
    next.rejected != null
  ) {
    const hold = next.hold ?? 0;
    const accept = next.checked - next.rejected - hold;
    if (accept >= 0) next.acceptedGood = accept;
  }

  if (!next.shift) next.shift = "Day Shift";
  if (!next.operator) next.operator = ENTRY_ROLES[0];
  if (!next.productType) next.productType = "2 way";
  if (!next.hold) next.hold = 0;

  if (next.macro === "assembly" && next.micro && !next.stageId) {
    next.stageId = resolveStageId("assembly", next.micro);
  }
  if (next.macro === "assembly" && next.micro && !next.processName) {
    next.processName = processLabel("assembly", next.micro);
  }
  if (next.macro === "primary") {
    next.micro = next.micro ?? "primary";
    next.stageId = next.stageId ?? "production";
    next.processName = next.processName ?? "Primary Production";
  }
  if (next.macro === "secondary") {
    next.micro = next.micro ?? "secondary";
    next.stageId = next.stageId ?? "secondary";
    next.processName = next.processName ?? "Secondary Production";
  }

  if (next.size) {
    next.size = toDisplaySize(next.size) ?? next.size;
  }

  return next;
}

export function buildEntryDraft(slots: EntrySlots): EntryDraft | null {
  const s = finalizeEntrySlots(slots);
  const sizeOk = s.macro === "secondary" || !!s.size;
  if (
    !s.macro ||
    !s.stageId ||
    !s.micro ||
    s.checked == null ||
    !s.date ||
    !s.batchId ||
    !sizeOk
  ) {
    return null;
  }

  const sizeDisp = s.size ? (toDisplaySize(s.size) ?? s.size) : "—";
  const dSum = defectSum(s.defects);
  const reject = s.rejected ?? dSum;
  const defectLine =
    s.defects && Object.keys(s.defects).length
      ? Object.entries(s.defects)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${k} ${v}`)
          .join(" · ")
      : "—";

  const summaryRows = [
    { label: "Section", value: `${s.macro} · ${s.processName ?? s.stageId}` },
    { label: "Date", value: s.date },
    { label: "Batch", value: s.batchId },
    { label: "Size", value: sizeDisp },
    { label: "Checked", value: String(s.checked) },
    { label: "Accepted", value: String(s.acceptedGood ?? 0) },
    {
      label: "Rejected",
      value:
        String(reject) +
        (s.rejected == null && dSum > 0 ? " (from defects)" : ""),
    },
    { label: "Defects", value: defectLine },
    { label: "Shift", value: s.shift ?? "Day Shift" },
  ];

  const warnings: string[] = [];
  if (s.acceptedGood == null) warnings.push("Accepted qty not set.");

  return {
    kind: "enter_data",
    slots: {
      ...s,
      macro: s.macro,
      micro: s.micro,
      stageId: s.stageId,
      processName: s.processName ?? s.stageId,
      checked: s.checked,
      date: s.date,
      batchId: s.batchId,
      size: sizeDisp === "—" ? (s.size ?? "") : sizeDisp,
    },
    summaryRows,
    warnings,
  };
}

export function draftToShiftRecord(draft: EntryDraft): ShiftBatchRecord {
  const s = draft.slots;
  const sizeDisp = s.size ? (toDisplaySize(s.size) ?? s.size) : "";
  const sizeCanonical = s.size
    ? (toCanonicalSize(s.size) ?? (sizeDisp ? `Fr${sizeDisp.replace(/\D/g, "")}` : ""))
    : "";
  const reject = s.rejected ?? defectSum(s.defects);
  const id = `agent-${s.date}-${s.batchId}-${s.stageId}-${Date.now()}`;

  return {
    id,
    date: s.date!,
    operator: s.operator ?? ENTRY_ROLES[0],
    macro: s.macro as MacroId,
    micro: s.micro!,
    stageId: s.stageId!,
    stageName: s.processName ?? s.stageId!,
    processName: s.processName ?? s.stageId!,
    size: sizeDisp || "—",
    sizeCanonical: sizeCanonical || "—",
    productType: s.productType ?? "2 way",
    batchId: s.batchId!,
    checked: s.checked!,
    accept: s.acceptedGood ?? 0,
    hold: s.hold ?? 0,
    reject,
    defects: s.defects ?? {},
    remarks: s.remarks ?? "Entered via Ask MOID",
    shift: s.shift ?? "Day Shift",
    savedAt: new Date().toISOString(),
  };
}

export function buildReportDraft(
  slots: ReportSlots,
  kind: "report" | "analyze",
): ReportDraft | null {
  if (!slots.from || !slots.to) return null;
  const state: InvestigationState = {
    grain: slots.grain ?? "week",
    from: slots.from,
    to: slots.to,
    stage: slots.stageView && slots.stageView !== "cumulative" ? slots.stageView : undefined,
    label: slots.periodLabel,
  };
  const navKey = kind === "report" ? "reports" : "dashboard";
  return {
    kind,
    state,
    periodLabel: slots.periodLabel ?? `${slots.from} → ${slots.to}`,
    presetId: slots.presetId ?? "builtin:gm-monthly",
    navKey,
    href: hrefForNav(navKey),
  };
}
