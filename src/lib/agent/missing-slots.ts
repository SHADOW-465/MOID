// Ordered missing-slot detection + question copy for enter_data / report.

import type { EntrySlots, ReportSlots } from "./types";
import { toCanonicalSize } from "@/lib/entry/batch-id";

export function defectSum(defects?: Record<string, number>): number {
  if (!defects) return 0;
  return Object.values(defects).reduce((a, b) => a + b, 0);
}

/**
 * Validate quantities. Returns error message or null if OK.
 * Does not invent corrections.
 */
export function validateEntryBalance(slots: EntrySlots): string | null {
  const checked = slots.checked;
  const accept = slots.acceptedGood;
  const reject =
    slots.rejected != null
      ? slots.rejected
      : slots.defects && Object.keys(slots.defects).length
        ? defectSum(slots.defects)
        : undefined;
  const hold = slots.hold ?? 0;
  const dSum = defectSum(slots.defects);

  if (checked != null && checked < 0) return "Checked cannot be negative.";
  if (accept != null && accept < 0) return "Accepted cannot be negative.";
  if (reject != null && reject < 0) return "Rejected cannot be negative.";

  if (checked != null && reject != null && reject > checked) {
    return `Rejected (${reject}) cannot exceed checked (${checked}).`;
  }

  if (slots.rejected != null && dSum > 0 && slots.rejected !== dSum) {
    return `Defects sum to ${dSum} but rejected is ${slots.rejected}. Which is correct?`;
  }

  // Soft mass balance when all three present (assembly): accept + reject + hold ≈ checked
  if (
    checked != null &&
    accept != null &&
    reject != null &&
    slots.macro === "assembly"
  ) {
    const sum = accept + reject + hold;
    if (sum !== checked) {
      return (
        `Checked (${checked}) ≠ accepted (${accept}) + rejected (${reject})` +
        (hold ? ` + hold (${hold})` : "") +
        ` = ${sum}. Fix the quantities so they balance.`
      );
    }
  }

  return null;
}

export function missingEntrySlots(slots: EntrySlots): string[] {
  const missing: string[] = [];
  if (!slots.macro) missing.push("macro");
  if (slots.macro === "assembly" && !slots.stageId) missing.push("stage");
  if (slots.checked == null) missing.push("checked");
  if (!slots.date) missing.push("date");
  if (!slots.batchId) missing.push("batchId");
  // Size required for assembly + primary (FR lot); secondary is qty/bin only
  if (slots.macro !== "secondary" && !slots.size) missing.push("size");
  // Primary may use "quantity produced" without accept — OK
  // Secondary: no defects; bin optional
  return missing;
}

export function missingReportSlots(slots: ReportSlots): string[] {
  const missing: string[] = [];
  if (!slots.from || !slots.to) missing.push("period");
  return missing;
}

export function questionForMissing(keys: string[]): string {
  const lines: string[] = [];
  for (const k of keys.slice(0, 4)) {
    switch (k) {
      case "macro":
        lines.push("• **Section** — assembly, primary, or secondary?");
        break;
      case "stage":
        lines.push("• **Assembly gate** — Visual, Balloon, Valve, or Final?");
        break;
      case "checked":
        lines.push("• **Checked qty** — how many units inspected?");
        break;
      case "date":
        lines.push("• **Date** — e.g. today or 2026-08-03");
        break;
      case "batchId":
        lines.push("• **Batch ID** — e.g. 26A01-16");
        break;
      case "size":
        lines.push("• **Size** — e.g. 16Fr");
        break;
      case "period":
        lines.push("• **Period** — e.g. this month, last week, July first week");
        break;
      default:
        lines.push(`• **${k}**`);
    }
  }
  return lines.join("\n");
}

export function chipSuggestions(missing: string[]): { label: string; text: string }[] {
  const chips: { label: string; text: string }[] = [];
  if (missing.includes("date")) chips.push({ label: "Today", text: "today" });
  if (missing.includes("size")) {
    chips.push({ label: "16Fr", text: "16Fr" });
    chips.push({ label: "18Fr", text: "18Fr" });
    chips.push({ label: "14Fr", text: "14Fr" });
  }
  if (missing.includes("stage")) {
    chips.push({ label: "Visual", text: "visual" });
    chips.push({ label: "Balloon", text: "balloon" });
    chips.push({ label: "Final", text: "final" });
  }
  if (missing.includes("macro")) {
    chips.push({ label: "Assembly", text: "assembly" });
  }
  if (missing.includes("period")) {
    chips.push({ label: "This month", text: "this month" });
    chips.push({ label: "Last week", text: "last week" });
    chips.push({ label: "July first week", text: "july first week" });
  }
  chips.push({ label: "Cancel", text: "cancel" });
  return chips.slice(0, 6);
}

export function sizeIsValid(size: string): boolean {
  return !!toCanonicalSize(size);
}
