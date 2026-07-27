/** @jest-environment node */
// Phase C: the arithmetic evidence must survive profiler → resolver → panel.
// Without this the steward sees a mapping with no way to tell if it's right.
import fs from "fs";
import path from "path";
import { buildProfilingTables } from "@/core/profiler/from-workbook";
import { profileTable } from "@/core/profiler/profile";
import { resolveWorkbook, type ResolverSheet } from "@/core/ontology/resolver/ladder";
import { GLOBAL_ONTOLOGY_SEED } from "@/core/ontology/global-ontology";

const FILE = path.join(process.env.USERPROFILE ?? "", "Desktop", "New folder", "ASSEMBLY_REJECTION_REPORT_corrected.xlsx");
const maybe = fs.existsSync(FILE) ? describe : describe.skip;

maybe("evidence reaches the verification panel", () => {
  it("attaches per-region agreement to each stage proposal", async () => {
    const fileName = "ASSEMBLY_REJECTION_REPORT_corrected.xlsx";
    const tables = buildProfilingTables(fs.readFileSync(FILE), fileName, { maxRows: 60 })
      .filter((t) => t.sheetName === "APRIL 25");

    // The profiler scored each block it chose.
    expect(tables.every((t) => (t.evidence?.applicable ?? 0) > 0 || t.regionLabel === "Final")).toBe(true);

    const sheets: ResolverSheet[] = tables.map((t) => ({
      fileName,
      sheetName: t.sheetName,
      tableId: t.tableId,
      regionLabel: t.regionLabel,
      evidence: t.evidence,
      columns: profileTable(t).columns,
    }));

    const proposals = await resolveWorkbook(sheets, {
      companyId: "test",
      exact: new Map(),
      knowledge: { lookup: async () => null } as never,
      concepts: GLOBAL_ONTOLOGY_SEED,
    });

    const stageProposals = proposals.filter((p) => p.kind === "stage" && p.evidence);
    expect(stageProposals.length).toBeGreaterThanOrEqual(3);

    // Visual balances on every row it can be checked on — that agreement is
    // the reason to trust the mapping, and it must be visible.
    const visual = stageProposals.find((p) => p.canonical === "STAGE:visual")!;
    expect(visual.evidence!.applicable).toBeGreaterThan(15);
    expect(visual.evidence!.agreement).toBe(1);

    // Valve carries the two rows the spreadsheet itself gets wrong, with the
    // row numbers a human needs to go look at.
    const valve = stageProposals.find((p) => p.canonical === "STAGE:valve-integrity")!;
    expect(valve.evidence!.agreement).toBeLessThan(1);
    expect(valve.evidence!.failingRows.length).toBe(2);
  });
});
