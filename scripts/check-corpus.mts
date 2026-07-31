// npm run check:corpus — the gate for re-ingesting the plant's history.
//
// Two SEPARATE questions, never conflated:
//   A. READER FIDELITY  — does the reader read every data row that is there?
//      Checked against an independent naive sum of the same column's data rows.
//   B. SOURCE INTEGRITY — does the sheet's own TOTAL row match its own rows?
//      Failures here are the plant's arithmetic, not ours.
import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { readSheet, detectLayout, toIsoDate, type Grid } from "../src/core/ingest/read-sheet";

const ROOTS = ["ANALYTICAL DATA", "STATICAL DATA ANALYSIS"];
function walk(d: string, a: string[] = []): string[] {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, a);
    else if (/\.xlsx$/i.test(e.name) && !e.name.startsWith("~$")) a.push(p);
  }
  return a;
}
const K = (v: unknown) => String(v ?? "").trim().toUpperCase();
const FOOTER = /^(TOTAL|TOTAL IN %|WEEKLY REPORT|GRAND TOTAL|%|IN %|OVERALL REJECTION|TARGET|DEVIATION|RESULTS?|CURRENT TREND|REMARKS?|SUPERVISOR|ASSEMBLY SUPERVISOR)/i;

function defaultStage(rel: string): string | null {
  const l = rel.toLowerCase();
  if (/visual/.test(l)) return "visual";
  if (/final/.test(l)) return "final";
  return null;
}

let sheets = 0, parsed = 0, noLayout = 0, records = 0;
const noLayoutByKind: Record<string, number> = {};
const stageHist: Record<string, number> = {};
let fidChecks = 0, fidMatch = 0; const fidBad: string[] = [];
let srcChecks = 0, srcMatch = 0; const srcBad: string[] = [];

for (const root of ROOTS)
  for (const f of walk(root)) {
    const rel = path.relative(root, f).replace(/\\/g, "/");
    const wb = XLSX.readFile(f, { cellDates: true });
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      if (!ws || !ws["!ref"]) continue;
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true }) as Grid;
      // FORMATE / 4-2-25 are blank templates and a stale Feb-25 sample copied
      // into 13 workbooks — not data, and excluded from the fidelity baseline.
      if (/^(FORMATE|4-2-25)$/i.test(name.trim())) continue;
      sheets++;
      const layout = detectLayout(rows);
      if (!layout) {
        noLayout++;
        const kind = /gtn/i.test(rel) ? "GTN (own grammar)"
          : /c[ou]mm?ulative|yearly|chart|graph|sheet\d/i.test(name + rel) ? "rollup / chart"
          : "OTHER";
        noLayoutByKind[kind] = (noLayoutByKind[kind] ?? 0) + 1;
        continue;
      }
      parsed++;
      const { records: recs } = readSheet(rows, {
        file: rel, fileHash: "h", sheet: name, ingestionId: "corpus", defaultStageId: defaultStage(rel),
      });
      records += recs.length;
      for (const r of recs) stageHist[r.stageId] = (stageHist[r.stageId] ?? 0) + 1;

      const totalRow = rows.findIndex((row) => /^TOTAL$/i.test(K(row?.[0])));
      const firstData = Math.max(layout.headerRow, layout.defectRow ?? layout.headerRow) + 1;

      for (const b of layout.blocks) {
        const bi = layout.blocks.indexOf(b);
        const stageId = b.stageId ?? (layout.blocks.length === 1 ? defaultStage(rel) : null);
        if (!stageId) continue;
        const dcol = b.cols.date ?? layout.dateCol ?? undefined;
        if (dcol === undefined) continue; // rollup sheet (rows are sizes/months), not daily records
        for (const role of ["checked", "rejected"] as const) {
          const col = b.cols[role];
          if (col === undefined) continue;

          // A. fidelity — naive sum of data rows, computed independently here
          const dateCol = dcol;
          let naive = 0;
          for (let r = firstData; r < rows.length; r++) {
            if (FOOTER.test(K(rows[r]?.[0]))) continue;
            if (dateCol !== undefined && !toIsoDate(rows[r]?.[dateCol])) continue;
            const v = Number(rows[r]?.[col]);
            if (Number.isFinite(v)) naive += v;
          }
          const got = recs.filter((r) => r.source.tableId === `b${bi + 1}`)
            .reduce((s, r) => s + ((role === "checked" ? r.checked : r.rejected)?.value ?? 0), 0);
          if (naive !== 0 || got !== 0) {
            fidChecks++;
            if (Math.abs(got - naive) < 0.5) fidMatch++;
            else if (fidBad.length < 15) fidBad.push(`${rel}::${name} [${b.label || stageId}] ${role}: reader ${got} vs rows ${naive}`);
          }

          // B. source integrity — the sheet's own TOTAL vs its own rows
          if (totalRow >= 0) {
            const stated = Number(rows[totalRow]?.[col]);
            if (Number.isFinite(stated) && stated !== 0) {
              srcChecks++;
              if (Math.abs(naive - stated) < 0.5) srcMatch++;
              else if (srcBad.length < 12) srcBad.push(`${rel}::${name} [${b.label || stageId}] ${role}: rows ${naive} vs stated TOTAL ${stated} (Δ${naive - stated})`);
            }
          }
        }
      }
    }
  }

console.log(`sheets            ${sheets}`);
console.log(`  layout found    ${parsed}  (${((parsed / sheets) * 100).toFixed(1)}%)`);
console.log(`  no layout       ${noLayout} →`, noLayoutByKind);
console.log(`records           ${records}`);
console.log(`\nA. READER FIDELITY   ${fidMatch}/${fidChecks}  (${((fidMatch / fidChecks) * 100).toFixed(2)}%)`);
console.log(`B. SOURCE INTEGRITY  ${srcMatch}/${srcChecks}  (${((srcMatch / srcChecks) * 100).toFixed(2)}%)  ← the plant's own arithmetic`);
console.log(`\nrecords per stage:`);
for (const [k, v] of Object.entries(stageHist).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(22)} ${v}`);
if (fidBad.length) { console.log(`\nREADER mismatches:`); fidBad.forEach((s) => console.log("  " + s)); }
if (srcBad.length) { console.log(`\nSOURCE errors (sample):`); srcBad.forEach((s) => console.log("  " + s)); }

process.exit(fidMatch === fidChecks ? 0 : 1);
