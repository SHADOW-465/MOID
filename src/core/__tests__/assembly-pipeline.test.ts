/** @jest-environment node */
// Full-pipeline oracle: real workbook → profile → resolve → MOD → extract.
// Proves the four stage blocks survive all the way to StageDayRecords, and
// that every record balances (Checked = Accepted + Rework + Rejected).
process.env.MOID_STORE = "memory";

import fs from "fs";
import path from "path";
import { buildProfilingTables } from "@/core/profiler/from-workbook";
import { profileTable } from "@/core/profiler/profile";
import { resolveWorkbook, type ResolverSheet } from "@/core/ontology/resolver/ladder";
import { buildModDocument, proposalToEntity, type ProfiledSheet } from "@/core/ontology/builder/build-mod";
import { GLOBAL_ONTOLOGY_SEED } from "@/core/ontology/global-ontology";
import { readWorkbookSnapshot } from "@/core/workbook/reader";
import { extractFromMod } from "@/core/ingest/extract-from-mod";
import { templateFrom } from "@/app/api/entry-template/route";
import { reviewRow } from "@/lib/ingest/review";
import type { StageDayRecord } from "@/lib/ingest/emit";

const FILE = path.join(process.env.USERPROFILE ?? "", "Desktop", "New folder", "ASSEMBLY_REJECTION_REPORT_corrected.xlsx");
const present = fs.existsSync(FILE);
const maybe = present ? describe : describe.skip;

maybe("ASSEMBLY workbook → ledger records", () => {
  const fileName = "ASSEMBLY_REJECTION_REPORT_corrected.xlsx";
  let records: StageDayRecord[] = [];
  let doc: ReturnType<typeof buildModDocument>;

  beforeAll(async () => {
    const buf = fs.readFileSync(FILE);
    const snapshot = await readWorkbookSnapshot(buf, fileName);

    const sheets: ProfiledSheet[] = buildProfilingTables(buf, fileName)
      .filter((t) => t.sheetName === "APRIL 25")
      .map((table) => ({ table, columns: profileTable(table).columns }));

    const resolverSheets: ResolverSheet[] = sheets.map((s) => ({
      fileName,
      sheetName: s.table.sheetName,
      tableId: s.table.tableId,
      regionLabel: s.table.regionLabel,
      columns: s.columns,
    }));

    const proposals = await resolveWorkbook(resolverSheets, {
      companyId: "test",
      exact: new Map(),
      knowledge: { lookup: async () => null } as never,
      concepts: GLOBAL_ONTOLOGY_SEED,
    });

    // Steward accepts every proposal, as clicking through the verify panel does.
    doc = buildModDocument({ companyId: "test", snapshot, sheets, proposals });
    doc.entities = proposals.map((p) => proposalToEntity(p, true));

    records = extractFromMod(doc, snapshot, "ing-test");
  });

  it("emits records for all four stages, not one merged stage", () => {
    const stages = [...new Set(records.map((r) => r.stageId))].sort();
    expect(stages).toEqual(["balloon", "final", "valve-integrity", "visual"]);
  });

  it("reads the 01-Apr visual row as 10982 = 9627 + 1355, not 9627 = 9627 + 1355", () => {
    const visual = records.find((r) => r.stageId === "visual" && r.occurredOn.start === "2025-04-01");
    expect(visual).toBeDefined();
    expect(visual!.checked?.value).toBe(10982);
    expect(visual!.acceptedGood?.value).toBe(9627);
    expect(visual!.rejected?.value).toBe(1355);
  });

  it("keeps the stage cascade intact — each Checked is the previous Accepted", () => {
    const on = (stageId: string) => records.find((r) => r.stageId === stageId && r.occurredOn.start === "2025-04-01");
    expect(on("balloon")!.checked?.value).toBe(on("visual")!.acceptedGood?.value);
    expect(on("valve-integrity")!.checked?.value).toBe(on("balloon")!.acceptedGood?.value);
  });

  it("flags only the two rows the spreadsheet itself gets wrong", () => {
    // Verified against the source cells: 2025-04-19 valve reads J=10794 but
    // K+L = 9967+143 = 10110, and 2025-04-26 reads J=5937 vs K+L = 5945. Those
    // are the plant's own arithmetic errors, extracted faithfully — exactly what
    // the balance check exists to surface. Every other row balances, which is
    // the proof the columns are no longer being mixed across stages.
    const violations = records
      .map((r, i) => reviewRow(r, i))
      .filter((row) => row.flags.some((f) => f.startsWith("Balance Violation")))
      .map((row) => `${row.date} ${row.stageId}`);

    expect(violations).toEqual(["2025-04-19 valve-integrity", "2025-04-26 valve-integrity"]);
    expect(records.length).toBeGreaterThan(80);
  });

  it("promotes all four blocks into the schema catalog", () => {
    expect(doc.stages.map((s) => s.stageId).sort()).toEqual([
      "balloon", "final", "valve-integrity", "visual",
    ]);
  });

  it("reaches Data Entry as four stations with their own capture columns", () => {
    // Data Entry projects the CATALOG, and publishing this MOD is what merges
    // these stages/defects into it — so this is the same shape the grid renders.
    const template = templateFrom({
      stages: doc.stages,
      defects: doc.defects,
      sizes: doc.sizes,
      fiscalYearStartMonth: 4,
      updatedAt: null,
      lastMergedFrom: "m",
    });

    const byId = new Map(template.stages.map((s) => [s.stageId, s]));
    expect([...byId.keys()].sort()).toEqual(["balloon", "final", "valve-integrity", "visual"]);

    // Visual/balloon/valve record checked+accepted+rejected; final has no
    // accepted column in this workbook, so it must not invent one.
    expect(byId.get("visual")!.columns.map((c) => c.key)).toEqual(
      expect.arrayContaining(["checked", "acceptedGood", "rejected"]),
    );
    expect(byId.get("final")!.columns.map((c) => c.key)).not.toContain("acceptedGood");
  });
});
