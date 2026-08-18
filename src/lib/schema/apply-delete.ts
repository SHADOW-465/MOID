import { deleteIntentFor, type SchemaNode, type SchemaTreeInput } from "@/lib/schema/tree";

export function deleteLabelFor(node: SchemaNode | null, data: SchemaTreeInput): string {
  if (!node) return "Delete";
  const intent = deleteIntentFor(node, data);
  if (intent.kind === "unscope-defect") return "Remove defect";
  if (intent.kind === "remove-capture") return "Remove column";
  if (intent.kind === "delete-section") return "Delete section";
  if (intent.kind === "delete-stage") return "Delete stage";
  if (intent.kind === "delete-defect") return "Delete defect";
  if (intent.kind === "delete-size") return "Delete size";
  if (intent.kind === "delete-mapping") return "Delete";
  return "Delete";
}

export function canDeleteNode(node: SchemaNode | null, data: SchemaTreeInput): boolean {
  if (!node) return false;
  return deleteIntentFor(node, data).kind !== "not-deletable";
}

export type SchemaConfirmFn = (
  options: { title: string; description: string; confirmText?: string; variant?: "danger" | "warning" } | string,
) => Promise<boolean> | boolean;

/** Confirm + mutate. Returns an error string the panel should show, or null. */
export async function applySchemaDelete(
  node: SchemaNode,
  data: SchemaTreeInput,
  mutate: (body: Record<string, unknown>, okMsg: string) => void | Promise<void>,
  onCleared?: () => void,
  confirmFn?: SchemaConfirmFn,
): Promise<string | null> {
  const ask = async (opts: { title: string; description: string; confirmText?: string; variant?: "danger" | "warning" } | string) => {
    if (confirmFn) return await confirmFn(opts);
    const msg = typeof opts === "string" ? opts : `${opts.title}\n\n${opts.description}`;
    return typeof window !== "undefined" && typeof window.confirm === "function" ? window.confirm(msg) : true;
  };

  const intent = deleteIntentFor(node, data);
  switch (intent.kind) {
    case "not-deletable":
      return intent.reason;

    case "unscope-defect": {
      const last = intent.remaining.length === 0;
      const desc = last
        ? `Remove ${intent.defectCode} from this stage?\n\nIt is not scoped to any other stage, so it will stop appearing in Data Entry entirely. The definition stays in All defects.`
        : `Remove ${intent.defectCode} from this stage only?\n\nIt stays on: ${intent.remaining.join(", ")}.`;
      const ok = await ask({
        title: `Remove ${intent.defectCode}?`,
        description: desc,
        confirmText: "Remove Defect",
        variant: "warning",
      });
      if (!ok) return null;
      const target = data.defects.find((d) => d.defectCode === intent.defectCode);
      if (!target) return "That defect is no longer in the catalog.";
      await mutate(
        {
          action: "upsert-defect",
          defect: {
            ...target,
            aliases: target.aliases ?? [],
            stages: (target.stages ?? []).filter((s) => s !== intent.stageId),
          },
        },
        `${intent.defectCode} unscoped from ${intent.stageId}`,
      );
      onCleared?.();
      return null;
    }

    case "delete-defect": {
      const where = intent.affectedStages.length
        ? `\n\nIt will disappear from: ${intent.affectedStages.join(", ")}.`
        : "";
      const ok = await ask({
        title: `Delete defect ${intent.defectCode}?`,
        description: `Delete ${intent.defectCode} from the master schema?${where}\n\nLedger events are not deleted.`,
        confirmText: "Delete Defect",
        variant: "danger",
      });
      if (!ok) return null;
      await mutate({ action: "delete-defect", id: intent.defectCode }, `Removed defect ${intent.defectCode}`);
      onCleared?.();
      return null;
    }

    case "delete-stage": {
      const orphan = intent.orphanedDefects.length
        ? `\n\nThese defects live only on this stage and will be left scoped to nothing: ${intent.orphanedDefects.join(", ")}.`
        : "";
      const ok = await ask({
        title: `Delete stage ${intent.stageId}?`,
        description: `Delete stage ${intent.stageId} from the master schema?${orphan}\n\nLedger events are not deleted.`,
        confirmText: "Delete Stage",
        variant: "danger",
      });
      if (!ok) return null;
      await mutate({ action: "delete-stage", id: intent.stageId }, `Removed stage ${intent.stageId}`);
      onCleared?.();
      return null;
    }

    case "delete-section": {
      if (intent.stageCount > 0) {
        return `This section still has ${intent.stageCount} stage${intent.stageCount === 1 ? "" : "s"}. Move or delete them first.`;
      }
      const ok = await ask({
        title: `Delete section “${node.label}”?`,
        description: `Delete section “${node.label}” from the master schema?`,
        confirmText: "Delete Section",
        variant: "danger",
      });
      if (!ok) return null;
      await mutate({ action: "delete-section", id: intent.categoryId }, `Removed section ${intent.categoryId}`);
      onCleared?.();
      return null;
    }

    case "remove-capture": {
      const target = data.stages.find((s) => s.stageId === intent.stageId);
      if (!target) return "That stage is no longer in the catalog.";
      const next = (target.captures ?? []).filter((c) => c !== intent.capture);
      await mutate(
        { action: "upsert-stage", stage: { ...target, captures: next } },
        `Removed ${intent.capture} from ${target.label}`,
      );
      onCleared?.();
      return null;
    }

    case "delete-size": {
      const ok = await ask({
        title: `Remove size ${intent.sizeId}?`,
        description: `Remove size ${intent.sizeId} from the master schema?`,
        confirmText: "Delete Size",
        variant: "danger",
      });
      if (!ok) return null;
      await mutate({ action: "delete-size", id: intent.sizeId }, `Removed size ${intent.sizeId}`);
      onCleared?.();
      return null;
    }

    case "delete-mapping": {
      const ok = await ask({
        title: `Remove mapping rule?`,
        description: `Remove the learned spelling “${intent.mappingKey}”?\n\nThe resolver will stop using this Excel→canonical rule. Ledger facts are not deleted.`,
        confirmText: "Remove Mapping",
        variant: "warning",
      });
      if (!ok) return null;
      await mutate(
        { action: "delete-mapping", kind: intent.mappingKind, key: intent.mappingKey },
        `Removed mapping ${intent.mappingKey}`,
      );
      onCleared?.();
      return null;
    }
  }
}
