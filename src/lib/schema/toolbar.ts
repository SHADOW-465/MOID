import type { SchemaNode, SchemaTreeInput } from "@/lib/schema/tree";

export type SchemaPendingCreate = "stage" | "defect" | "size" | "section";

export type SchemaAddAction = {
  kind: SchemaPendingCreate;
  label: string;
  /** Tree id to select before creating, so the form is pre-scoped. */
  selectId?: string;
};

/** What the single Add pill creates, given the current selection. */
export function addActionFor(
  node: SchemaNode | null,
  data: SchemaTreeInput,
): SchemaAddAction {
  if (!node) return { kind: "section", label: "Add section" };

  if (node.kind === "category" && node.ref?.categoryId) {
    return { kind: "stage", label: "Add stage", selectId: node.id };
  }

  if (
    node.kind === "stage" ||
    node.kind === "defects-folder" ||
    node.kind === "captures-folder" ||
    node.kind === "capture" ||
    node.kind === "defect"
  ) {
    const stageId = node.ref?.stageId ?? node.ref?.scopedUnderStageId;
    const cat =
      data.stages.find((s) => s.stageId === stageId)?.category ??
      node.ref?.categoryId;
    return {
      kind: "defect",
      label: "Add defect",
      selectId: stageId && cat ? `cat:${cat}/stage:${stageId}` : node.id,
    };
  }

  if (node.kind === "all-defects-folder") {
    return { kind: "defect", label: "Add defect", selectId: node.id };
  }

  if (node.kind === "sizes-folder" || node.kind === "size") {
    return { kind: "size", label: "Add size", selectId: "sizes" };
  }

  return { kind: "section", label: "Add section" };
}

export function canSaveNode(node: SchemaNode | null): boolean {
  if (!node) return false;
  return (
    node.kind === "category" ||
    node.kind === "stage" ||
    node.kind === "defect" ||
    node.kind === "size" ||
    node.kind === "captures-folder"
  );
}
