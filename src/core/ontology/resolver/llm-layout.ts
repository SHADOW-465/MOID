// src/core/ontology/resolver/llm-layout.ts
//
// Rung 5b: the model as a LAYOUT candidate source.
//
// The deterministic splitter reads a sheet through a fixed vocabulary of stage
// words and role words. When a plant writes its headers in a way that
// vocabulary misses, every heuristic candidate is wrong in the same way and the
// scorer has nothing good to choose between. That is the one place a language
// model genuinely helps: it can read "IInd INSPECTION" or a Hindi header and
// say where one station's columns end and the next begins.
//
// What it emphatically does NOT do:
//   · it never sees or returns a quantity — only column groupings
//   · it never wins by being the model. Its proposals go into `chooseSplit`
//     alongside the heuristic ones and are ranked by the SAME arithmetic. If
//     the model's reading doesn't make the sheet add up, it loses.
//
// So a non-deterministic component cannot make the pipeline non-deterministic:
// the model can only widen the set of readings considered, never pick one.

import { generateObject } from "ai";
import { z } from "zod";
import { tryModels } from "@/lib/ai";
import type { StageBlock } from "@/core/profiler/split-regions";

// Cross-provider rules (src/lib/schemas.ts): .nullable() not .optional(),
// plain ints, no literal unions.
const LlmBlock = z.object({
  label: z.string().nullable().describe("The station/stage this group of columns belongs to, or null if unnamed"),
  columnIndexes: z.array(z.number().int()).describe("0-based indexes of the columns in this group"),
  // Roles matter more than the grouping: on headers our vocabulary cannot read,
  // knowing WHICH column is the checked count is the whole contribution. -1
  // means "this station has no such column" (a plain int, not a nullable, for
  // cross-provider strict-mode compatibility).
  checkedIndex: z.number().int().describe("Index of this station's checked/input count column, or -1"),
  acceptedIndex: z.number().int().describe("Index of this station's accepted/good count column, or -1"),
  reworkIndex: z.number().int().describe("Index of this station's hold/rework count column, or -1"),
  rejectedIndex: z.number().int().describe("Index of this station's rejected count column, or -1"),
  percentIndex: z.number().int().describe("Index of this station's rejection % column, or -1"),
});
const LlmLayout = z.object({
  blocks: z.array(LlmBlock),
});

export interface LayoutRequest {
  sheetName: string;
  /** Header text by column index — the model never receives the data values. */
  columns: { index: number; header: string }[];
  /** Column index of the shared date axis, if the sheet has one. */
  dateIndex: number | null;
}

/**
 * Ask the model how a run of columns groups into stations. Returns candidate
 * splits for the scorer; an empty array on any failure, so a missing or
 * misbehaving backend degrades to the deterministic path rather than breaking
 * an upload.
 */
export async function llmLayout(req: LayoutRequest): Promise<StageBlock[][]> {
  const columnList = req.columns
    .map((c) => `${c.index}: ${JSON.stringify(c.header.replace(/\s+/g, " ").trim())}`)
    .join("\n");

  try {
    const { object } = await tryModels(
      (model) =>
        generateObject({
          model,
          schema: LlmLayout,
          prompt: [
            "A manufacturing quality spreadsheet lays several inspection stations side by side,",
            "one row per date. Each station has its own columns (a checked/input count, an accepted",
            "count, sometimes a hold count, a rejected count, a rejection %, and sometimes per-defect",
            "columns). Headers are often abbreviated, misspelled, or blank for columns that belong to",
            "the station named to their left.",
            "",
            `Sheet: ${req.sheetName}`,
            req.dateIndex !== null ? `Column ${req.dateIndex} is the shared date axis — leave it out of every group.` : "",
            "",
            "Columns:",
            columnList,
            "",
            "For each station, list its columns and identify which column holds its checked/input",
            "count, its accepted count, its hold count, its rejected count, and its rejection %.",
            "Use -1 for any the station does not have. Every column except the date axis must appear",
            "in exactly one group. Do not invent columns, and never report a value from the sheet —",
            "only column indexes.",
          ].join("\n"),
        }),
      { fast: true },
    );

    const valid = new Set(req.columns.map((c) => c.index));
    const blocks: StageBlock[] = [];
    const used = new Set<number>();
    for (const b of object.blocks) {
      // Trust nothing: drop hallucinated indexes, the date axis, and repeats.
      const columns = b.columnIndexes.filter(
        (i) => valid.has(i) && i !== req.dateIndex && !used.has(i),
      );
      for (const i of columns) used.add(i);
      if (columns.length === 0) continue;

      const role = (i: number) => (columns.includes(i) ? i : undefined);
      const roles = {
        checked: role(b.checkedIndex),
        accepted: role(b.acceptedIndex),
        rework: role(b.reworkIndex),
        rejected: role(b.rejectedIndex),
        pct: role(b.percentIndex),
      };
      const named = Object.values(roles).some((v) => v !== undefined);
      blocks.push({ label: b.label?.trim() || null, columns, roles: named ? roles : undefined });
    }

    // A proposal that covers almost nothing is noise, not a reading.
    const covered = used.size;
    const coverable = req.columns.filter((c) => c.index !== req.dateIndex).length;
    if (blocks.length === 0 || covered < coverable * 0.6) return [];

    return [blocks];
  } catch (err) {
    console.warn("[llm-layout] proposal failed, using deterministic split:", err instanceof Error ? err.message : err);
    return [];
  }
}
