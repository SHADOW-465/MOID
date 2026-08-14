// Infer assembly process from defect codes (or leave missing).

import { seedDefectsForStage, seedProcessLabel } from "@/lib/entry/entry-schema";
import type { MacroId } from "@/lib/entry/disposafe-matrix";
import type { EntrySlots } from "./types";

const ASSEMBLY_STAGES = ["visual", "balloon", "valve-integrity", "final"] as const;

/**
 * Given defect keys (already plant-normalized or raw aliases), find which
 * assembly process uniquely owns all of them. COAG/SD/BL → Visual.
 */
export function inferAssemblyProcessFromDefects(
  defectKeys: string[],
): { stageId: string; processName: string; note: string } | null {
  if (defectKeys.length === 0) return null;

  const keys = defectKeys.map((k) => k.toUpperCase());
  const matches: string[] = [];

  for (const stageId of ASSEMBLY_STAGES) {
    const schema = seedDefectsForStage(stageId).map((d) => d.key.toUpperCase());
    const set = new Set(schema);
    if (keys.every((k) => set.has(k))) matches.push(stageId);
  }

  if (matches.length === 1) {
    const stageId = matches[0];
    const processName = seedProcessLabel(stageId);
    return {
      stageId,
      processName,
      note: `Inferred **${processName}** from defect codes (${defectKeys.join(", ")}).`,
    };
  }

  // Prefer visual when visual is among matches and defects are classic visual codes
  if (matches.includes("visual") && matches.includes("final")) {
    return {
      stageId: "visual",
      processName: seedProcessLabel("visual"),
      note: `Inferred **Visual** (Final shares the same defect list; say “final” if you meant Final Inspection).`,
    };
  }

  return null;
}

/** Apply inference onto slots when macro is assembly and stage unknown. */
export function applyStageInference(slots: EntrySlots): {
  slots: EntrySlots;
  note?: string;
  ambiguous?: boolean;
} {
  if (slots.macro && slots.macro !== "assembly") {
    return { slots };
  }
  if (slots.stageId) return { slots };

  const macro: MacroId = slots.macro ?? "assembly";
  if (macro !== "assembly") return { slots };

  const keys = Object.keys(slots.defects ?? {});
  if (keys.length === 0) {
    return { slots: { ...slots, macro: "assembly" }, ambiguous: !slots.stageId };
  }

  const inferred = inferAssemblyProcessFromDefects(keys);
  if (!inferred) {
    return {
      slots: { ...slots, macro: "assembly" },
      ambiguous: true,
      note: "Could not tell which assembly gate from those defects.",
    };
  }

  return {
    slots: {
      ...slots,
      macro: "assembly",
      stageId: inferred.stageId,
      processName: inferred.processName,
    },
    note: inferred.note,
  };
}
