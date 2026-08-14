// Shared StageDayRecord builder for Data Entry matrix + Ask MOID agent.
// Keep this the only place that maps ShiftBatchRecord → ledger shape.

import type { MacroId, ShiftBatchRecord } from "@/lib/entry/disposafe-matrix";
import type { StageDayRecord } from "@/lib/ingest/emit";

function sv(value: number, cell: string, header: string) {
  return { value, cell, header };
}

export function qtyHeaderFor(macro: MacroId): string {
  if (macro === "primary") return "Quantity Produced";
  if (macro === "secondary") return "Quantity";
  return "Checked Qty";
}

export function toStageDayRecord(rec: ShiftBatchRecord, ingestionId: string): StageDayRecord {
  const isSecondary = rec.macro === "secondary";
  const isPrimary = rec.macro === "primary";

  // What a station captures is the schema's call, not this file's. The form
  // already zeroes every field its station doesn't render (buildPendingRecord),
  // and emit skips zeros — so a Secondary station whose catalog `captures` list
  // accepted/rejected now reaches the ledger instead of being dropped here.
  const defects = Object.entries(rec.defects)
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
    acceptedGood: rec.accept > 0 ? sv(rec.accept, "ENTRY!accept", "Good Qty") : null,
    // Hold is whatever the form captured. The form only shows Hold when the
    // catalog (or builtin seed) lists it on this stage — do not re-gate here
    // with a stageId literal.
    rework: rec.hold > 0 ? sv(rec.hold, "ENTRY!hold", "Rework Qty") : null,
    rejected: rec.reject > 0 ? sv(rec.reject, "ENTRY!reject", "Rejected Qty") : null,
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
      ...(rec.duplicateConfirmedOf
        ? { confirmedDistinctFrom: rec.duplicateConfirmedOf }
        : {}),
      ...(isPrimary && rec.trolleys != null && rec.trolleys > 0
        ? { trolleysProduced: rec.trolleys, "No. of Trolleys Produced": rec.trolleys }
        : {}),
      ...(isSecondary && rec.bin
        ? { bin: rec.bin, Bin: rec.bin }
        : {}),
    },
  };
}
