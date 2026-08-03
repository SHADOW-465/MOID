// Infer assembly process from defect codes (or leave missing).

import { MATRIX_STAGES, defectsFor, type MacroId } from "@/lib/entry/disposafe-matrix";
import type { EntrySlots } from "./types";

const ASSEMBLY_MICROS = ["p15-visual", "p16-balloon", "p17-valve", "p18-final"] as const;

/**
 * Given defect keys (already plant-normalized or raw aliases), find which
 * assembly process uniquely owns all of them. COAG/SD/BL → Visual.
 */
export function inferAssemblyProcessFromDefects(
  defectKeys: string[],
): { micro: string; stageId: string; processName: string; note: string } | null {
  if (defectKeys.length === 0) return null;

  const keys = defectKeys.map((k) => k.toUpperCase());
  const matches: string[] = [];

  for (const micro of ASSEMBLY_MICROS) {
    const schema = defectsFor("assembly", micro).map((d) => d.key.toUpperCase());
    const set = new Set(schema);
    if (keys.every((k) => set.has(k))) matches.push(micro);
  }

  if (matches.length === 1) {
    const micro = matches[0];
    const p = MATRIX_STAGES.assembly.processes.find((x) => x.id === micro)!;
    return {
      micro,
      stageId: p.stageId!,
      processName: p.name,
      note: `Inferred **${p.name}** from defect codes (${defectKeys.join(", ")}).`,
    };
  }

  // Prefer visual when visual is among matches and defects are classic visual codes
  if (matches.includes("p15-visual") && matches.includes("p18-final")) {
    // Final shares visual list — prefer Visual for entry unless user said final
    const p = MATRIX_STAGES.assembly.processes.find((x) => x.id === "p15-visual")!;
    return {
      micro: "p15-visual",
      stageId: "visual",
      processName: p.name,
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
  if (slots.stageId && slots.micro) return { slots };

  const macro: MacroId = slots.macro ?? "assembly";
  if (macro !== "assembly") return { slots };

  const keys = Object.keys(slots.defects ?? {});
  if (keys.length === 0) {
    // default nothing — missing will ask
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
      micro: inferred.micro,
      stageId: inferred.stageId,
      processName: inferred.processName,
    },
    note: inferred.note,
  };
}
