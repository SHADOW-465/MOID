// npm run check:reingest — step 4 gate. Runs on the only two workbooks that
// were ever ingested by the old MOD pipeline:
// does the new reader reproduce what the OLD MOD pipeline put in the ledger?
// Read-only.
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import fs from "fs";
import { readSheet, type Grid } from "../src/core/ingest/read-sheet";

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n")
  .filter((l) => l.includes("=") && !l.startsWith("#"))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

const FILES = [
  "ANALYTICAL DATA/REJECTION ANALYSIS 2025-26/09 REJECTION ANALYSIS-DECEMBER 2025.xlsx",
  "ANALYTICAL DATA/REJECTION ANALYSIS 2025-26/06 REJECTION ANALYSIS-SEPTEMBER 2025.xlsx",
];

// ── what the OLD pipeline stored ────────────────────────────────────────────
let all: any[] = [], from = 0;
for (;;) {
  const { data, error } = await db.from("events").select("event_type,provenance,payload,occurred_on").range(from, from + 999);
  if (error) throw error;
  all = all.concat(data); if (data.length < 1000) break; from += 1000;
}
type Key = string;
const old = new Map<Key, { checked: number; rejected: number }>();
for (const e of all) {
  const f = e.provenance?.file ?? "";
  if (!/REJECTION ANALYSIS-(DECEMBER 2025|SEPTEMBER 2025)/.test(f)) continue;
  const stage = e.payload?.stageId;
  const day = e.occurred_on?.start;
  if (!stage || !day) continue;
  const k = `${f.slice(0, 2)}|${stage}|${day}`;
  const cur = old.get(k) ?? { checked: 0, rejected: 0 };
  if (e.event_type === "production") cur.checked += Number(e.payload?.quantity ?? 0);
  else if (e.event_type === "inspection" && e.payload?.disposition === "rejected") cur.rejected += Number(e.payload?.quantity ?? 0);
  old.set(k, cur);
}

// ── what the NEW reader produces from the same bytes ────────────────────────
const fresh = new Map<Key, { checked: number; rejected: number }>();
const STAGE_BY_SHEET: Record<string, string> = {
  VISUAL: "visual", "BALLOON INSPECTION": "balloon", "VALVE INTEGRITY": "valve-integrity",
  "FINAL INSPECTION": "final", "FINAL INSPECTION REJECTION": "final", "FINAL Inspe  REJECTION": "final",
};
for (const path of FILES) {
  const prefix = path.match(/\/(\d\d) REJECTION/)![1];
  const wb = XLSX.readFile(path, { cellDates: true });
  for (const name of wb.SheetNames) {
    const stage = STAGE_BY_SHEET[name.trim().toUpperCase()] ?? STAGE_BY_SHEET[name];
    if (!stage) continue; // Cummulative sheets are rollups — correctly not ingested
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: true }) as Grid;
    const { records } = readSheet(rows, { file: path, fileHash: "h", sheet: name, ingestionId: "diff", defaultStageId: stage });
    for (const r of records) {
      const k = `${prefix}|${r.stageId}|${r.occurredOn.start}`;
      const cur = fresh.get(k) ?? { checked: 0, rejected: 0 };
      cur.checked += r.checked?.value ?? 0;
      cur.rejected += r.rejected?.value ?? 0;
      fresh.set(k, cur);
    }
  }
}

const keys = [...new Set([...old.keys(), ...fresh.keys()])].sort();
let same = 0; const onlyOld: string[] = [], onlyNew: string[] = [], diff: string[] = [];
for (const k of keys) {
  const a = old.get(k), b = fresh.get(k);
  if (a && !b) { onlyOld.push(k); continue; }
  if (!a && b) { onlyNew.push(`${k}  chk=${b.checked} rej=${b.rejected}`); continue; }
  if (a!.checked === b!.checked && a!.rejected === b!.rejected) same++;
  else diff.push(`${k}  old chk=${a!.checked} rej=${a!.rejected} | new chk=${b!.checked} rej=${b!.rejected}`);
}
console.log(`(stage,day) keys: old ${old.size}, new ${fresh.size}`);
console.log(`  identical      ${same}`);
console.log(`  differing      ${diff.length}`);
console.log(`  only in old    ${onlyOld.length}`);
console.log(`  only in new    ${onlyNew.length}`);
if (diff.length) { console.log("\ndiffering:"); diff.slice(0, 12).forEach((s) => console.log("  " + s)); }
if (onlyOld.length) { console.log("\nonly in old ledger:"); onlyOld.slice(0, 12).forEach((s) => console.log("  " + s)); }
if (onlyNew.length) { console.log("\nonly from new reader:"); onlyNew.slice(0, 12).forEach((s) => console.log("  " + s)); }
