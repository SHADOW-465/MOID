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
import { plantCatalog, mergePlantCatalog } from "@/core/ontology/plant-catalog";

/** Load the catalog, seeding it on first use. Persists the seed. */
export async function loadCatalog(company: string): Promise<CompanyCatalog> {
  const store = getCatalogStore();
  const catalog = await store.get(company);
  if (catalog.stages.length > 0 || catalog.defects.length > 0 || catalog.sizes.length > 0) {
    return catalog;
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

  return store.put(
    company,
    mergePlantCatalog({
      ...catalog,
      stages: [...stages.values()],
      defects: [...defects.values()],
      sizes: [...sizes.values()],
    }),
  );
}

/** Read-only variant for surfaces that must not write (never persists a seed). */
export async function peekCatalog(company: string): Promise<{ catalog: CompanyCatalog; configured: boolean }> {
  const stored = await getCatalogStore()
    .get(company)
    .catch(() => null);
  const configured = !!stored && stored.stages.length > 0;
  return { catalog: configured ? stored! : plantCatalog(), configured };
}
