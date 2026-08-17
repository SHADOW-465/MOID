import { canDeleteNode, deleteLabelFor } from "../apply-delete";
import { buildSchemaTree, type SchemaTreeInput } from "../tree";

const input: SchemaTreeInput = {
  stages: [
    { stageId: "production", label: "Dipping", category: "primary", captures: ["checked"] },
    { stageId: "visual", label: "Visual", category: "assembly", captures: ["checked"] },
  ],
  defects: [{ defectCode: "AIR", label: "Air", stages: ["production"] }],
  sizes: [],
};

const tree = buildSchemaTree(input);
const byId = (id: string) => {
  const walk = (nodes: typeof tree): (typeof tree)[number] | undefined => {
    for (const n of nodes) {
      if (n.id === id) return n;
      const hit = walk(n.children);
      if (hit) return hit;
    }
  };
  return walk(tree);
};

describe("canDeleteNode / deleteLabelFor", () => {
  it("deletes a selected stage", () => {
    const node = byId("cat:primary/stage:production")!;
    expect(canDeleteNode(node, input)).toBe(true);
    expect(deleteLabelFor(node, input)).toBe("Delete stage");
  });

  it("deletes an empty-looking section (still a section)", () => {
    const node = byId("cat:primary")!;
    expect(canDeleteNode(node, input)).toBe(true);
    expect(deleteLabelFor(node, input)).toBe("Delete section");
  });

  it("is off when nothing is selected", () => {
    expect(canDeleteNode(null, input)).toBe(false);
    expect(deleteLabelFor(null, input)).toBe("Delete");
  });
});
