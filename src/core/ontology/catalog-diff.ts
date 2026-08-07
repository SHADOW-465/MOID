// Diff a MOD (or draft document catalogs) against the company plant catalog.
// When the plant schema is already configured, import should *match* existing
// entities — not silently grow the master catalog. Novel items need user OK.

import type { z } from "zod";
import type { StageDef, DefectDef, SizeDef } from "@/lib/contract/d1";
import type { CompanyCatalog } from "@/core/ontology/store/catalog-store";

export type NovelCatalog = {
  stages: z.infer<typeof StageDef>[];
  defects: z.infer<typeof DefectDef>[];
  sizes: z.infer<typeof SizeDef>[];
};

export type CatalogDiff = {
  /** Plant catalog already has stages (or was seeded). */
  plantConfigured: boolean;
  novel: NovelCatalog;
  matched: {
    stageIds: string[];
    defectCodes: string[];
    sizeIds: string[];
  };
  summary: {
    novelStageCount: number;
    novelDefectCount: number;
    novelSizeCount: number;
    matchedStageCount: number;
    matchedDefectCount: number;
    matchedSizeCount: number;
  };
};

export function isPlantConfigured(catalog: CompanyCatalog): boolean {
  return (catalog.stages?.length ?? 0) > 0;
}

/** Entities in `incoming` that are not yet in the plant catalog. */
export function diffAgainstCatalog(
  catalog: CompanyCatalog,
  incoming: {
    stages?: z.infer<typeof StageDef>[];
    defects?: z.infer<typeof DefectDef>[];
    sizes?: z.infer<typeof SizeDef>[];
  },
): CatalogDiff {
  const stageIds = new Set(catalog.stages.map((s) => s.stageId));
  const defectCodes = new Set(catalog.defects.map((d) => d.defectCode));
  const sizeIds = new Set(catalog.sizes.map((s) => s.sizeId));

  const stages = incoming.stages ?? [];
  const defects = incoming.defects ?? [];
  const sizes = incoming.sizes ?? [];

  const novelStages = stages.filter((s) => !stageIds.has(s.stageId));
  const novelDefects = defects.filter((d) => !defectCodes.has(d.defectCode));
  const novelSizes = sizes.filter((s) => !sizeIds.has(s.sizeId));

  const matchedStageIds = stages
    .filter((s) => stageIds.has(s.stageId))
    .map((s) => s.stageId);
  const matchedDefectCodes = defects
    .filter((d) => defectCodes.has(d.defectCode))
    .map((d) => d.defectCode);
  const matchedSizeIds = sizes
    .filter((s) => sizeIds.has(s.sizeId))
    .map((s) => s.sizeId);

  return {
    plantConfigured: isPlantConfigured(catalog),
    novel: {
      stages: novelStages,
      defects: novelDefects,
      sizes: novelSizes,
    },
    matched: {
      stageIds: matchedStageIds,
      defectCodes: matchedDefectCodes,
      sizeIds: matchedSizeIds,
    },
    summary: {
      novelStageCount: novelStages.length,
      novelDefectCount: novelDefects.length,
      novelSizeCount: novelSizes.length,
      matchedStageCount: matchedStageIds.length,
      matchedDefectCount: matchedDefectCodes.length,
      matchedSizeCount: matchedSizeIds.length,
    },
  };
}

/**
 * Filter MOD catalogs so merge only touches:
 *  - entities already in the plant catalog (alias/stage union safe), OR
 *  - novel entities the operator explicitly accepted.
 * When plant is empty, return incoming unchanged (bootstrap).
 */
export function filterIncomingForCatalogMerge(
  catalog: CompanyCatalog,
  incoming: {
    stages: z.infer<typeof StageDef>[];
    defects: z.infer<typeof DefectDef>[];
    sizes: z.infer<typeof SizeDef>[];
  },
  acceptNovel?: {
    stageIds?: string[];
    defectCodes?: string[];
    sizeIds?: string[];
  } | null,
): typeof incoming {
  if (!isPlantConfigured(catalog)) return incoming;

  const acceptS = new Set(acceptNovel?.stageIds ?? []);
  const acceptD = new Set(acceptNovel?.defectCodes ?? []);
  const acceptZ = new Set(acceptNovel?.sizeIds ?? []);
  const haveS = new Set(catalog.stages.map((s) => s.stageId));
  const haveD = new Set(catalog.defects.map((d) => d.defectCode));
  const haveZ = new Set(catalog.sizes.map((s) => s.sizeId));

  return {
    stages: incoming.stages.filter(
      (s) => haveS.has(s.stageId) || acceptS.has(s.stageId),
    ),
    defects: incoming.defects.filter(
      (d) => haveD.has(d.defectCode) || acceptD.has(d.defectCode),
    ),
    sizes: incoming.sizes.filter(
      (s) => haveZ.has(s.sizeId) || acceptZ.has(s.sizeId),
    ),
  };
}
