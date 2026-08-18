/** Apply a /api/schema POST body to a local catalog so the tree can update
 *  before the round-trip. Returns null when the action is not a catalog edit
 *  we can preview (mappings, fiscal year, load-plant-catalog). */

type StageLike = { stageId: string; category?: string; captures?: string[] };
type DefectLike = { defectCode: string; stages?: string[] };
type SizeLike = { sizeId: string };
type SectionLike = { id: string; label: string };

export type PreviewCatalog = {
  stages: StageLike[];
  defects: DefectLike[];
  sizes: SizeLike[];
  sections?: SectionLike[];
};

export function previewCatalogAction<T extends PreviewCatalog>(
  catalog: T,
  body: Record<string, unknown>,
): T | null {
  const action = body.action;
  if (typeof action !== "string") return null;

  if (action === "delete-stage" && typeof body.id === "string") {
    const id = body.id;
    return {
      ...catalog,
      stages: catalog.stages.filter((s) => s.stageId !== id),
      defects: catalog.defects.map((d) => ({
        ...d,
        stages: (d.stages ?? []).filter((s) => s !== id),
      })),
    };
  }

  if (action === "delete-defect" && typeof body.id === "string") {
    return {
      ...catalog,
      defects: catalog.defects.filter((d) => d.defectCode !== body.id),
    };
  }

  if (action === "delete-size" && typeof body.id === "string") {
    return {
      ...catalog,
      sizes: catalog.sizes.filter((s) => s.sizeId !== body.id),
    };
  }

  if (action === "delete-section" && typeof body.id === "string") {
    const id = body.id;
    return {
      ...catalog,
      sections: (catalog.sections ?? []).filter((s) => s.id !== id),
      stages: catalog.stages.filter(
        (s) => s.category !== id || !s.stageId.startsWith("__sec:"),
      ),
    };
  }

  if (action === "upsert-defect" && body.defect && typeof body.defect === "object") {
    const defect = body.defect as T["defects"][number];
    const i = catalog.defects.findIndex((d) => d.defectCode === defect.defectCode);
    const defects = catalog.defects.slice();
    if (i === -1) defects.push(defect);
    else defects[i] = { ...defects[i], ...defect };
    return { ...catalog, defects };
  }

  if (action === "upsert-stage" && body.stage && typeof body.stage === "object") {
    const stage = body.stage as T["stages"][number];
    const i = catalog.stages.findIndex((s) => s.stageId === stage.stageId);
    const stages = catalog.stages.slice();
    if (i === -1) stages.push(stage);
    else stages[i] = { ...stages[i], ...stage };
    return { ...catalog, stages };
  }

  if (action === "upsert-size" && body.size && typeof body.size === "object") {
    const size = body.size as T["sizes"][number];
    const i = catalog.sizes.findIndex((s) => s.sizeId === size.sizeId);
    const sizes = catalog.sizes.slice();
    if (i === -1) sizes.push(size);
    else sizes[i] = { ...sizes[i], ...size };
    return { ...catalog, sizes };
  }

  if (action === "upsert-section" && body.section && typeof body.section === "object") {
    const section = body.section as { id?: string; label: string };
    const id = (section.id ?? "").trim();
    if (!id) return null;
    const sections = (catalog.sections ?? []).slice();
    const i = sections.findIndex((s) => s.id === id);
    if (i === -1) sections.push({ id, label: section.label });
    else sections[i] = { id, label: section.label };
    return { ...catalog, sections };
  }

  return null;
}
