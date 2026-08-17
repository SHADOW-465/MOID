import { STAGE_CATEGORIES, type CatalogSection } from "@/core/ontology/plant-catalog";

export type { CatalogSection };

export function isSectionMarker(stageId: string): boolean {
  return stageId.startsWith("__sec:");
}

export function sectionMarkerStage(id: string, label: string) {
  return {
    stageId: `__sec:${id}`,
    label,
    category: id,
    captures: [] as Array<"checked" | "accepted" | "hold" | "rejected">,
    upstream: [] as string[],
    effectiveFrom: null as string | null,
    effectiveTo: null as string | null,
  };
}

export function resolveSections(input: {
  sections?: CatalogSection[] | null;
  stages?: { category?: string | null; sectionLabel?: string | null; stageId?: string }[];
}): CatalogSection[] {
  const seed = input.sections?.length ? input.sections : STAGE_CATEGORIES;
  const seen = new Map(seed.map((s) => [s.id, { id: s.id, label: s.label.trim() || s.id }]));
  for (const st of input.stages ?? []) {
    const id = (st.category ?? "").trim();
    if (!id) continue;
    const named = (st.sectionLabel ?? "").trim();
    if (named) seen.set(id, { id, label: named });
    else if (!seen.has(id)) seen.set(id, { id, label: isSectionMarker(st.stageId ?? "") ? (st as { label?: string }).label || id : id });
  }
  return [...seen.values()];
}

export function slugSectionId(label: string, taken: Set<string>): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
