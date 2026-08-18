// Turn a History / Audit row into the payload Data Entry hydrates the form with.
// "edit" loads the recorded quantities so a correction starts from the truth.
// "reuse-lot" only copies the lot code (next station on the same lot).

import type { AuditEntryRow } from "@/lib/analytics/audit-sessions";
import { toDisplaySize } from "@/lib/entry/batch-id";

export type EntryHydrateMode = "edit" | "reuse-lot";

export type EntryHydrate = {
  mode: EntryHydrateMode;
  batchId: string;
  date: string;
  stageId: string;
  size: string | null;
  productType: string | null;
  shift: string | null;
  checked: number;
  accepted: number;
  hold: number;
  rejected: number;
  defects: Record<string, number>;
  editingId: string;
};

export function defectsFromAuditRow(row: Pick<AuditEntryRow, "defects">): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of row.defects) {
    if (d.qty > 0) out[d.code] = d.qty;
  }
  return out;
}

export function hydrateFromAuditRow(
  row: AuditEntryRow,
  mode: EntryHydrateMode = "edit",
): EntryHydrate {
  return {
    mode,
    batchId: row.batch,
    date: row.date,
    stageId: row.stageId,
    size: row.size ? toDisplaySize(row.size) ?? row.size : null,
    productType: row.productType,
    shift: row.shifts[0] ?? null,
    checked: row.checked,
    accepted: row.accepted,
    hold: row.rework,
    rejected: row.rejected,
    defects: defectsFromAuditRow(row),
    editingId: `ledger:${row.id}`,
  };
}
