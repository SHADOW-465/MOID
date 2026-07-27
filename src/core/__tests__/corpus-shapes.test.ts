/** @jest-environment node */
// Every shape in the plant corpus still profiles the way it should. Guards the
// stage-block splitter against regressing the files it must NOT change.
import fs from "fs";
import path from "path";
import { buildProfilingTables } from "@/core/profiler/from-workbook";

const DIR = path.join(process.env.USERPROFILE ?? "", "Desktop", "New folder");
const has = (f: string) => fs.existsSync(path.join(DIR, f));
const load = (f: string) => buildProfilingTables(fs.readFileSync(path.join(DIR, f)), f, { maxRows: 40 });

const BALLOON = "BALLOON_VALVE_corrected.xlsx";
const SHOPFLOOR = "SHOPFLOOR_REJECTION_REPORT_corrected.xlsx";
const VISUAL = "VISUAL_INSPECTION_REPORT_2025_corrected.xlsx";

(has(BALLOON) ? it : it.skip)("BALLOON_VALVE keeps two gap-separated regions, defects intact", () => {
  const april = load(BALLOON).filter((t) => t.sheetName === "APRIL 25");
  expect(april).toHaveLength(2);
  // Each block keeps its own defect columns — a stage word inside a defect name
  // ("STRUCK BALLOON") must not tear the block apart.
  const left = april[0].header.join("|").toUpperCase();
  expect(left).toContain("STRUCK BALLOON");
  expect(left).toContain("LEAKAGE");
  const right = april[1].header.join("|").toUpperCase();
  expect(right).toContain("90/10");
  expect(right).toContain("BUBBLE");
});

(has(SHOPFLOOR) ? it : it.skip)("SHOPFLOOR stays a single region of defect columns", () => {
  const april = load(SHOPFLOOR).filter((t) => t.sheetName === "APRIL 25");
  expect(april).toHaveLength(1);
  expect(april[0].header.join("|").toUpperCase()).toContain("COAG");
});

(has(VISUAL) ? it : it.skip)("VISUAL per-day batch sheet stays a single region", () => {
  const day = load(VISUAL).filter((t) => t.sheetName === "4-2-25");
  expect(day).toHaveLength(1);
});
