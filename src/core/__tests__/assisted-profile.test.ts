/** @jest-environment node */
// Phase D: the model widens the candidate set; the arithmetic still decides.
// These cases pin the two properties that make an LLM safe to have here —
// it is not consulted when the numbers already settle the reading, and its
// proposal is adopted only when it reads the sheet better.
import fs from "fs";
import path from "path";
import {
  buildProfilingTablesAssisted,
  unconvincingSheets,
  type LayoutAssist,
} from "@/core/profiler/assisted-profile";
import { buildProfilingTables } from "@/core/profiler/from-workbook";
import { chooseSplit } from "@/core/profiler/split-regions";

const FILE = path.join(process.env.USERPROFILE ?? "", "Desktop", "New folder", "ASSEMBLY_REJECTION_REPORT_corrected.xlsx");
const maybe = fs.existsSync(FILE) ? describe : describe.skip;

describe("chooseSplit — an assisted candidate competes, it does not win by default", () => {
  const rows: unknown[][] = [
    ["2025-04-01", 10982, 9627, 1355, 9627, 9612, 15],
    ["2025-04-02", 11054, 9907, 1147, 9907, 9858, 49],
    ["2025-04-04", 11041, 9573, 1468, 9573, 9555, 18],
    ["2025-04-07", 5230, 4553, 677, 4553, 4498, 55],
    ["2025-04-08", 10167, 9400, 767, 9400, 9326, 74],
    ["2025-04-09", 9455, 8912, 543, 8912, 8886, 26],
  ];
  const headers = ["DATE", "VISUAL QTY", "VISUAL ACPT QTY", "REJ QTY", "BALLOON CHKD QTY", "BALLOON ACPT QTY", "REJ QTY"];
  const input = headers.map((header, index) => ({ index, header, hasNumericData: index > 0 }));

  it("rejects a model proposal that makes the arithmetic worse", () => {
    // A plausible-sounding but wrong grouping: visual's accepted put with
    // balloon's columns. It must lose to the heuristic reading.
    const bad = [[
      { label: "Visual", columns: [1, 3], roles: { checked: 1, rejected: 3 } },
      { label: "Balloon", columns: [2, 4, 5, 6], roles: { checked: 4, accepted: 2, rejected: 6 } },
    ]];
    const chosen = chooseSplit(input, rows, { dateIndex: 0, extraCandidates: bad });
    expect(chosen.strategy).not.toBe("assisted");
    expect(chosen.blocks.map((b) => b.label)).toEqual(["Visual", "Balloon"]);
  });

  it("adopts a model proposal that reads the sheet better", () => {
    // Headers stripped of every stage word — no heuristic can name the blocks,
    // and role-cycle is the only structural signal left. The model supplies the
    // grouping AND the names; the arithmetic confirms it.
    const blind = ["DATE", "COL A", "COL B", "COL C", "COL D", "COL E", "COL F"];
    const blindInput = blind.map((header, index) => ({ index, header, hasNumericData: index > 0 }));
    const good = [[
      { label: "Visual", columns: [1, 2, 3], roles: { checked: 1, accepted: 2, rejected: 3 } },
      { label: "Balloon", columns: [4, 5, 6], roles: { checked: 4, accepted: 5, rejected: 6 } },
    ]];
    const chosen = chooseSplit(blindInput, rows, { dateIndex: 0, extraCandidates: good });
    expect(chosen.strategy).toBe("assisted");
    expect(chosen.blocks.map((b) => b.label)).toEqual(["Visual", "Balloon"]);
    expect(chosen.agreement).toBeGreaterThan(0.9);
  });
});

maybe("buildProfilingTablesAssisted", () => {
  const buf = () => fs.readFileSync(FILE);

  it("never consults the model when the arithmetic already settles the sheet", async () => {
    const tables = buildProfilingTables(buf(), "a.xlsx", { maxRows: 60 }).filter((t) => t.sheetName === "APRIL 25");
    expect(unconvincingSheets(tables)).not.toContain("APRIL 25");

    let called = 0;
    const assist: LayoutAssist = async () => { called++; return []; };
    const { assistedSheets } = await buildProfilingTablesAssisted(buf(), "a.xlsx", { maxRows: 60, assist });

    expect(assistedSheets).not.toContain("APRIL 25");
    // Some other sheet in the book may legitimately be unconvincing; what must
    // never happen is paying for a call on the sheet that already works.
    expect(called).toBe(unconvincingSheets(buildProfilingTables(buf(), "a.xlsx", { maxRows: 60 })).length);
  });

  it("falls back to the deterministic reading when the assist throws", async () => {
    const assist: LayoutAssist = async () => { throw new Error("backend down"); };
    const { tables, assistedSheets } = await buildProfilingTablesAssisted(buf(), "a.xlsx", { maxRows: 60, assist });
    expect(assistedSheets).toEqual([]);
    expect(tables.filter((t) => t.sheetName === "APRIL 25").map((t) => t.regionLabel)).toEqual([
      "Visual", "Balloon", "Valve Integrity", "Final",
    ]);
  });

  it("is a no-op with no assist configured", async () => {
    const { tables, assistedSheets } = await buildProfilingTablesAssisted(buf(), "a.xlsx", { maxRows: 60 });
    expect(assistedSheets).toEqual([]);
    expect(tables.length).toBe(buildProfilingTables(buf(), "a.xlsx", { maxRows: 60 }).length);
  });
});
