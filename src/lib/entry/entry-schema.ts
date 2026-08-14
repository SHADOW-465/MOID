// Data Entry schema resolver.
//
// Catalog path: /api/entry-template is the only live source for stations,
// defects, and quantity columns. Builtin path: MATRIX_STAGES is projected into
// the same shape and used as a total replacement when the template is missing.
// The two never mix per-field — that silent mix is what made a station show
// the wrong defect vocabulary with a "Schema · plant" badge.
//
// `micro` (p15-visual, …) is a retired local id. Persisted drafts / shift rows
// / Ask MOID prefills may still carry it; migrateToStageId is the one reader.

import {
  MATRIX_STAGES,
  type MacroId,
  type DefectDef,
} from "@/lib/entry/disposafe-matrix";
import { STAGE_CATEGORIES, STAGE_CATEGORY } from "@/core/ontology/plant-catalog";

export type QtyKey = "checked" | "accepted" | "hold" | "rejected";
export type ExtraField = "trolleys" | "bin";

export type EntryStation = {
  stageId: string;
  label: string;
  category: MacroId;
  columns: QtyKey[];
  defects: DefectDef[];
  extras: ExtraField[];
};

export type ResolvedEntrySchema = {
  source: "catalog" | "builtin";
  stations: EntryStation[];
};

/** Minimal template shape — avoids importing the App Router module from lib. */
export type EntryTemplateLike = {
  stages: {
    stageId: string;
    label: string;
    category?: MacroId | string;
    columns?: { key: string }[];
    defects?: { defectCode: string; label: string }[];
  }[];
};

/**
 * Old local `micro` ids → ledger stageId. Also accepts a stageId written into
 * the micro slot (post-migration writes) and empty micros on department rows.
 */
const LEGACY_MICRO_TO_STAGE: Record<string, string> = {
  "p15-visual": "visual",
  "p16-balloon": "balloon",
  "p17-valve": "valve-integrity",
  "p18-final": "final",
  primary: "production",
  secondary: "secondary",
};

export function migrateToStageId(input: {
  stageId?: string | null;
  micro?: string | null;
  macro?: string | null;
}): string {
  const sid = (input.stageId ?? "").trim();
  if (sid) return sid;
  const micro = (input.micro ?? "").trim();
  if (micro && LEGACY_MICRO_TO_STAGE[micro]) return LEGACY_MICRO_TO_STAGE[micro];
  if (micro) return micro;
  if (input.macro === "primary") return "production";
  if (input.macro === "secondary") return "secondary";
  return "visual";
}

function extrasFor(stageId: string): ExtraField[] {
  if (stageId === "production") return ["trolleys"];
  if (stageId === "secondary") return ["bin"];
  return [];
}

function qtyFromTemplateKey(key: string): QtyKey | null {
  if (key === "checked") return "checked";
  if (key === "acceptedGood" || key === "accepted") return "accepted";
  if (key === "rework" || key === "hold") return "hold";
  if (key === "rejected") return "rejected";
  return null;
}

function categoryOf(stageId: string, explicit?: string): MacroId {
  if (explicit === "primary" || explicit === "secondary" || explicit === "assembly") {
    return explicit;
  }
  return (STAGE_CATEGORY[stageId] as MacroId | undefined) ?? "assembly";
}

function fromTemplate(template: EntryTemplateLike): ResolvedEntrySchema {
  const stations: EntryStation[] = template.stages.map((s) => {
    const columns: QtyKey[] = [];
    for (const col of s.columns ?? []) {
      const q = qtyFromTemplateKey(col.key);
      if (q && !columns.includes(q)) columns.push(q);
    }
    return {
      stageId: s.stageId,
      label: s.label,
      category: categoryOf(s.stageId, s.category),
      columns,
      defects: (s.defects ?? []).map((d) => ({
        key: d.defectCode,
        name: d.label || d.defectCode,
      })),
      extras: extrasFor(s.stageId),
    };
  });
  return { source: "catalog", stations };
}

function fromSeed(): ResolvedEntrySchema {
  const stations: EntryStation[] = [];

  const primaryDefs = MATRIX_STAGES.primary.defects;
  stations.push({
    stageId: "production",
    label: MATRIX_STAGES.primary.name,
    category: "primary",
    columns: ["checked", "accepted", "rejected"],
    defects: Array.isArray(primaryDefs) ? primaryDefs : [],
    extras: ["trolleys"],
  });

  stations.push({
    stageId: "secondary",
    label: MATRIX_STAGES.secondary.name,
    category: "secondary",
    columns: ["checked"],
    defects: [],
    extras: ["bin"],
  });

  for (const p of MATRIX_STAGES.assembly.processes) {
    if (!p.stageId || !p.interactive) continue;
    const defs = MATRIX_STAGES.assembly.defects;
    const list = !Array.isArray(defs) ? (defs[p.id] ?? []) : [];
    stations.push({
      stageId: p.stageId,
      label: p.name,
      category: "assembly",
      columns: p.stageId === "visual"
        ? ["checked", "accepted", "hold", "rejected"]
        : ["checked", "accepted", "rejected"],
      defects: list,
      extras: [],
    });
  }

  return { source: "builtin", stations };
}

/**
 * Resolve the schema the form will render. A non-empty template wins entirely;
 * anything else is the seed. Callers must not overlay seed defects onto a
 * catalog station that happens to have an empty list.
 */
export function resolveEntrySchema(
  template: EntryTemplateLike | null | undefined,
): ResolvedEntrySchema {
  if (template?.stages?.length) return fromTemplate(template);
  return fromSeed();
}

export function stationsIn(
  schema: ResolvedEntrySchema,
  category: MacroId,
): EntryStation[] {
  return schema.stations.filter((s) => s.category === category);
}

export function stationById(
  schema: ResolvedEntrySchema,
  stageId: string,
): EntryStation | undefined {
  return schema.stations.find((s) => s.stageId === stageId);
}

/**
 * Previous station in the same category that records an accepted qty — used
 * to prefill Checked from upstream Accepted. Walks past throughput-only
 * stations (valve-fixing has checked only) so Valve Integrity still prefills
 * from Balloon.
 */
export function previousAcceptedStageId(
  schema: ResolvedEntrySchema,
  stageId: string,
): string | null {
  const station = stationById(schema, stageId);
  if (!station) return null;
  const peers = stationsIn(schema, station.category);
  const idx = peers.findIndex((s) => s.stageId === stageId);
  for (let i = idx - 1; i >= 0; i--) {
    if (peers[i].columns.includes("accepted")) return peers[i].stageId;
  }
  return null;
}

export function schemaCategories(schema: ResolvedEntrySchema): {
  id: MacroId;
  label: string;
}[] {
  const present = new Set(schema.stations.map((s) => s.category));
  return STAGE_CATEGORIES.filter((c) => present.has(c.id)).map((c) => ({
    id: c.id,
    label: c.label,
  }));
}

export function seedDefectsForStage(stageId: string): DefectDef[] {
  return stationById(fromSeed(), stageId)?.defects ?? [];
}

export function seedProcessLabel(stageId: string): string {
  return stationById(fromSeed(), stageId)?.label ?? stageId;
}
