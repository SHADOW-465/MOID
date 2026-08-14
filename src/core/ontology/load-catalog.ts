// Single place that answers "what is this company's catalog right now?".
//
// Both /api/schema and /api/entry-template read through here, so the schema you
// edit and the grid you type into can never disagree.
//
// TRANSITIONAL: the authored plant catalog is the base; anything already-verified
// workbooks taught is merged on top so nothing that used to appear vanishes
// mid-migration. When the MOD pipeline is deleted this collapses to:
//
//     const c = await store.get(company);
//     return c.stages.length ? c : store.put(company, plantCatalog());

import { getCatalogStore, type CompanyCatalog } from "@/core/ontology/store/catalog-store";
import { getModStore } from "@/core/ontology/store/mod-store";
import { plantCatalog, mergePlantCatalog, STAGE_CATEGORY } from "@/core/ontology/plant-catalog";

/**
 * Bump when the authored catalog gains (or repairs) a stage that already-seeded
 * plants must pick up. The backfill runs ONCE per tag, so a stage deleted on
 * Data Schema after that stays deleted — the catalog still outlives the code.
 */
const SEED_TAG = "plant-catalog@secondary-production";

/**
 * Teach a stored catalog the authored stages it has never seen.
 *
 * `loadCatalog` seeds only when the catalog is completely empty, so a plant
 * that configured its schema before a stage was authored never gained it — and
 * a stage stored with no `captures` is filtered out of /api/entry-template
 * (it would render as an untypeable station). Between them, Secondary
 * Production existed in the plant config but was absent from Data Entry.
 *
 * Conservative on purpose: existing stages keep their label, capture columns
 * and order; only genuinely missing stages are inserted (in authored process
 * order) and only empty `captures` / `category` are repaired.
 */
async function backfillAuthoredStages(
  company: string,
  catalog: CompanyCatalog,
): Promise<CompanyCatalog> {
  if (catalog.lastMergedFrom === SEED_TAG) return catalog;

  const authored = plantCatalog().stages;
  const authoredById = new Map(authored.map((s) => [s.stageId, s]));
  const stored = new Map(catalog.stages.map((s) => [s.stageId, s]));

  let changed = false;
  const repaired = catalog.stages.map((s) => {
    const a = authoredById.get(s.stageId);
    if (!a) return s;
    const needsCaptures = (s.captures ?? []).length === 0 && (a.captures ?? []).length > 0;
    const needsCategory = !s.category && !!(a.category ?? STAGE_CATEGORY[s.stageId]);
    if (!needsCaptures && !needsCategory) return s;
    changed = true;
    return {
      ...s,
      captures: needsCaptures ? a.captures : s.captures,
      category: needsCategory ? (a.category ?? STAGE_CATEGORY[s.stageId]) : s.category,
    };
  });

  // Insert missing authored stages at their authored position, so Data Entry
  // tabs still read down the process line instead of appending to the end.
  const out: CompanyCatalog["stages"] = [];
  for (const a of authored) {
    if (stored.has(a.stageId)) continue;
    out.push(a);
    changed = true;
  }
  const merged = changed
    ? [...repaired, ...out].sort((x, y) => {
        const ix = authored.findIndex((a) => a.stageId === x.stageId);
        const iy = authored.findIndex((a) => a.stageId === y.stageId);
        // Hand-added stages (not authored) keep their relative place at the end.
        return (ix === -1 ? authored.length : ix) - (iy === -1 ? authored.length : iy);
      })
    : catalog.stages;

  return getCatalogStore().put(company, {
    ...catalog,
    stages: merged,
    lastMergedFrom: SEED_TAG,
  });
}

/** Load the catalog, seeding it on first use. Persists the seed. */
export async function loadCatalog(company: string): Promise<CompanyCatalog> {
  const store = getCatalogStore();
  const catalog = await store.get(company);
  if (catalog.stages.length > 0 || catalog.defects.length > 0 || catalog.sizes.length > 0) {
    return backfillAuthoredStages(company, catalog);
  }

  const verified = await getModStore().verified(company).catch(() => []);
  const stages = new Map<string, CompanyCatalog["stages"][number]>();
  const defects = new Map<string, CompanyCatalog["defects"][number]>();
  const sizes = new Map<string, CompanyCatalog["sizes"][number]>();
  for (const mod of verified) {
    for (const s of mod.document.stages ?? []) if (!stages.has(s.stageId)) stages.set(s.stageId, s);
    for (const d of mod.document.defects ?? []) if (!defects.has(d.defectCode)) defects.set(d.defectCode, d);
    for (const s of mod.document.sizes ?? []) if (!sizes.has(s.sizeId)) sizes.set(s.sizeId, s);
  }

  return store.put(company, {
    ...mergePlantCatalog({
      ...catalog,
      stages: [...stages.values()],
      defects: [...defects.values()],
      sizes: [...sizes.values()],
    }),
    // A fresh seed is already at the authored floor — tag it so the backfill
    // above never second-guesses a later deletion on Data Schema.
    lastMergedFrom: SEED_TAG,
  });
}

/** Read-only variant for surfaces that must not write (never persists a seed). */
export async function peekCatalog(company: string): Promise<{ catalog: CompanyCatalog; configured: boolean }> {
  const stored = await getCatalogStore()
    .get(company)
    .catch(() => null);
  const configured = !!stored && stored.stages.length > 0;
  return { catalog: configured ? stored! : plantCatalog(), configured };
}
