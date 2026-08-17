import { addActionFor, canSaveNode } from "../toolbar";
import { buildSchemaTree, type SchemaTreeInput } from "../tree";

const input: SchemaTreeInput = {
  stages: [
    { stageId: "production", label: "Dipping", category: "primary", captures: ["checked"] },
    { stageId: "visual", label: "Visual", category: "assembly", captures: ["checked"] },
  ],
  defects: [{ defectCode: "AIR", label: "Air", stages: ["production"] }],
  sizes: [{ sizeId: "Fr14", label: "14Fr" }],
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

describe("addActionFor", () => {
  it("adds a section when nothing is selected", () => {
    expect(addActionFor(null, input)).toMatchObject({ kind: "section", label: "Add section" });
  });

  it("adds a stage inside a section", () => {
    expect(addActionFor(byId("cat:primary")!, input)).toMatchObject({
      kind: "stage",
      label: "Add stage",
    });
  });

  it("adds a defect on a stage or its folders", () => {
    expect(addActionFor(byId("cat:primary/stage:production")!, input).kind).toBe("defect");
    expect(addActionFor(byId("cat:primary/stage:production/defects")!, input).kind).toBe("defect");
    expect(addActionFor(byId("cat:primary/stage:production/captures")!, input).kind).toBe("defect");
  });

  it("adds a size from the sizes folder", () => {
    expect(addActionFor(byId("sizes")!, input)).toMatchObject({ kind: "size", label: "Add size" });
  });
});

describe("canSaveNode", () => {
  it("is true for things that have a draft", () => {
    expect(canSaveNode(byId("cat:primary")!)).toBe(true);
    expect(canSaveNode(byId("cat:primary/stage:production")!)).toBe(true);
    expect(canSaveNode(null)).toBe(false);
  });
});
