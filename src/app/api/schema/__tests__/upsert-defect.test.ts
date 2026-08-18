process.env.MOID_STORE = "memory";

import { NextRequest } from "next/server";
import { authedJsonHeaders } from "@/__tests__/fixtures/auth";
import { POST } from "../route";
import { getCatalogStore } from "@/core/ontology/store/catalog-store";

async function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/schema", {
      method: "POST",
      headers: await authedJsonHeaders("gm"),
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/schema upsert-defect", () => {
  it("accepts an empty aliases array and fills the code in", async () => {
    const res = await post({
      action: "upsert-defect",
      defect: { defectCode: "AIR", label: "Air bubble", aliases: [], stages: ["production"] },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    const air = data.catalog.defects.find((d: { defectCode: string }) => d.defectCode === "AIR");
    expect(air.aliases).toEqual(["AIR"]);
    expect(air.stages).toEqual(["production"]);

    const stored = await getCatalogStore().get(process.env.MOID_COMPANY_ID || "default");
    expect(stored.defects.some((d) => d.defectCode === "AIR" && d.aliases.includes("AIR"))).toBe(true);
  });

  it("renames a section without touching stage ids", async () => {
    await post({ action: "load-plant-catalog" });
    const res = await post({
      action: "upsert-section",
      section: { id: "primary", label: "Dipping line" },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.catalog.sections.find((s: { id: string }) => s.id === "primary").label).toBe(
      "Dipping line",
    );
    expect(data.catalog.stages.find((s: { stageId: string }) => s.stageId === "production").stageId).toBe(
      "production",
    );
  });
});
