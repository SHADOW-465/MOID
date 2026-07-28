/** @jest-environment node */
import { buildPageExport, rowsToCsv } from "../page-export";

describe("page export", () => {
  it("builds CSV from KPI + table sections", () => {
    const { blob, fileName } = buildPageExport({
      page: "dashboard",
      format: "csv",
      include: { kpi: true, table: true, chart: false },
      sections: [
        {
          id: "k",
          label: "KPIs",
          kind: "kpi",
          getData: () => ({ rate: 0.1, rejected: 12 }),
        },
        {
          id: "t",
          label: "Stages",
          kind: "table",
          getData: () => [
            { stage: "Visual", rejected: 5 },
            { stage: "Final", rejected: 7 },
          ],
        },
      ],
    });
    expect(fileName).toMatch(/^moid-dashboard-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(blob.type).toContain("csv");
  });

  it("rowsToCsv escapes commas", () => {
    expect(rowsToCsv([{ a: "x,y", b: 1 }])).toContain('"x,y"');
  });
});
