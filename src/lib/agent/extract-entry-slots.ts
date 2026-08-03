// Pure slot extraction from free text for enter_data tasks.

import {
  MATRIX_STAGES,
  defectsFor,
  type MacroId,
} from "@/lib/entry/disposafe-matrix";
import { toDisplaySize, frDigitsFromSize } from "@/lib/entry/batch-id";
import type { EntrySlots } from "./types";

const KNOWN_DEFECT_ALIASES: Record<string, string> = {
  coag: "COAG",
  sd: "SD",
  bl: "BL",
  tt: "TT",
  ps: "PS",
  sb: "SB",
  pw: "PW",
  fp: "FP",
  rw: "RW",
  bep: "BEP",
  dec: "DEC",
  bm: "BM",
  web: "WEB",
  bt: "BT",
  sf: "SF",
  bic: "BIC",
  wk: "WK",
  bmp: "BMP",
  tf: "TF",
  ph: "PH",
  bst: "BST",
  leakage: "LEAKAGE",
  bubble: "BUBBLE",
  "struck balloon": "STRUCK BALLOON",
  "balloon burst": "BALLOOM BRUST",
  "balloon brust": "BALLOOM BRUST",
  "thin spod": "THIN SPOD",
  others: "OTHERS",
  "90/10": "90/10",
};

function localToday(todayIso: string): string {
  return todayIso;
}

/** Parse entry date phrases using wall-clock today (not dataMax). */
function parseEntryDate(text: string, todayIso: string): string | undefined {
  const t = text.toLowerCase();
  if (/\btoday\b/.test(t)) return localToday(todayIso);
  if (/\byesterday\b/.test(t)) {
    const d = new Date(`${todayIso}T00:00:00`);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  const iso = t.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  // 3 Aug 2026 / Aug 3 2026 / 03/08/2026 loose
  const dmy = t.match(
    /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})\b/,
  );
  if (dmy) {
    const a = Number(dmy[1]);
    const b = Number(dmy[2]);
    const y = dmy[3];
    // prefer DD/MM when first > 12
    if (a > 12) return `${y}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
    if (b > 12) return `${y}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
    // ambiguous — assume ISO-ish MM/DD only if first is month
    return `${y}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
  }
  return undefined;
}

function pickMacro(t: string): MacroId | undefined {
  if (/\bassembly\b/.test(t)) return "assembly";
  if (/\bprimary\b/.test(t)) return "primary";
  if (/\bsecondary\b/.test(t)) return "secondary";
  return undefined;
}

function pickQty(t: string, labels: string[]): number | undefined {
  for (const label of labels) {
    const re = new RegExp(
      `\\b${label}\\s*(?:value\\s*)?(?:is|=|:)?\\s*(\\d{1,7})\\b`,
      "i",
    );
    const m = t.match(re);
    if (m) return Number(m[1]);
  }
  return undefined;
}

function extractDefects(t: string): Record<string, number> {
  const out: Record<string, number> = {};
  // "coag 5" / "COAG: 5" / "coag=5"
  for (const [alias, key] of Object.entries(KNOWN_DEFECT_ALIASES)) {
    const re = new RegExp(
      `\\b${alias.replace(/[/*]/g, "\\$&")}\\s*[:=]?\\s*(\\d{1,6})\\b`,
      "i",
    );
    const m = t.match(re);
    if (m) out[key] = Number(m[1]);
  }
  // "rejected reasons coag 5 sd 3" already covered
  // Generic "DEFECT N" for uppercase plant codes
  const generic = t.matchAll(/\b([A-Z]{2,6})\s*[:=]?\s*(\d{1,6})\b/g);
  for (const m of generic) {
    const code = m[1];
    if (["FR", "ISO", "PDF", "CAPA", "FY"].includes(code)) continue;
    if (!(code in out)) {
      const known = Object.values(KNOWN_DEFECT_ALIASES).includes(code);
      if (known) out[code] = Number(m[2]);
    }
  }
  return out;
}

function extractSize(t: string): string | undefined {
  const m =
    t.match(/\b(\d{1,2})\s*[Ff][Rr]\b/) ||
    t.match(/\b[Ff][Rr]\s*(\d{1,2})\b/) ||
    t.match(/\bsize\s*[:=]?\s*(\d{1,2})\b/);
  if (!m) return undefined;
  return toDisplaySize(m[1]) ?? undefined;
}

function extractBatch(t: string): string | undefined {
  const m =
    t.match(/\bbatch(?:\s*id)?\s*[:=]?\s*([A-Za-z0-9][A-Za-z0-9\-]{2,20})\b/i) ||
    t.match(/\b([0-9]{2}[A-La-l][0-9]{2}-\d{1,2})\b/); // plant batch form 26A01-16
  if (!m) return undefined;
  return m[1].toUpperCase();
}

function extractProductType(t: string): string | undefined {
  if (/\bfemale\b/i.test(t)) return "Female";
  if (/\bpeadiatric\b|\bpediatric\b/i.test(t)) return "Peadiatric";
  if (/\b3\s*way\b/i.test(t)) return "3 way";
  if (/\b2\s*way\b/i.test(t)) return "2 way";
  return undefined;
}

function extractProcessHint(t: string): { micro?: string; stageId?: string } {
  if (/\bvisual\b/i.test(t)) return { micro: "p15-visual", stageId: "visual" };
  if (/\bballoon\b/i.test(t)) return { micro: "p16-balloon", stageId: "balloon" };
  if (/\bvalve\b/i.test(t)) return { micro: "p17-valve", stageId: "valve-integrity" };
  if (/\bfinal\b/i.test(t)) return { micro: "p18-final", stageId: "final" };
  return {};
}

/**
 * Extract whatever entry slots are present in free text.
 * Does not invent values. Stage inference is a separate step.
 */
export function extractEntrySlots(text: string, todayIso: string): EntrySlots {
  const t = text.trim();
  const slots: EntrySlots = {};

  const macro = pickMacro(t);
  if (macro) slots.macro = macro;

  const checked = pickQty(t, ["checked", "check", "qty produced", "quantity produced", "quantity"]);
  if (checked != null) slots.checked = checked;

  const accepted = pickQty(t, ["accepted", "accept", "good qty", "good"]);
  if (accepted != null) slots.acceptedGood = accepted;

  const rejected = pickQty(t, ["rejected", "reject", "rejection"]);
  // avoid matching "rejected reasons" without a number at end of phrase only
  if (rejected != null) slots.rejected = rejected;

  const hold = pickQty(t, ["hold", "rework"]);
  if (hold != null) slots.hold = hold;

  const defects = extractDefects(t);
  if (Object.keys(defects).length) slots.defects = defects;

  const date = parseEntryDate(t, todayIso);
  if (date) slots.date = date;

  const size = extractSize(t);
  if (size) slots.size = size;

  const batchId = extractBatch(t);
  if (batchId) slots.batchId = batchId;

  const productType = extractProductType(t);
  if (productType) slots.productType = productType;

  const proc = extractProcessHint(t);
  if (proc.micro) {
    slots.micro = proc.micro;
    slots.stageId = proc.stageId;
    if (proc.micro) {
      const p = MATRIX_STAGES.assembly.processes.find((x) => x.id === proc.micro);
      if (p) slots.processName = p.name;
    }
  }

  if (/\bday\s*shift\b/i.test(t)) slots.shift = "Day Shift";
  if (/\bnight\s*shift\b/i.test(t)) slots.shift = "Night Shift";

  // Loose "today, 26A01-16, 16Fr" style: bare batch-like token without "batch" word
  if (!slots.batchId) {
    const bare = t.match(/\b([0-9]{2}[A-La-l][0-9]{2}-\d{1,2})\b/);
    if (bare) slots.batchId = bare[1].toUpperCase();
  }

  // Bare FR size in a short follow-up ("16Fr" alone)
  if (!slots.size && frDigitsFromSize(t.trim())) {
    slots.size = toDisplaySize(t.trim()) ?? undefined;
  }

  return slots;
}

/** Normalize defect keys to plant schema for a given process. */
export function normalizeDefectKeys(
  defects: Record<string, number>,
  macro: MacroId,
  micro: string,
): { defects: Record<string, number>; unknown: string[] } {
  const schema = defectsFor(macro, micro);
  const allowed = new Map(schema.map((d) => [d.key.toUpperCase(), d.key]));
  const out: Record<string, number> = {};
  const unknown: string[] = [];
  for (const [k, v] of Object.entries(defects)) {
    const up = k.toUpperCase();
    const canon = allowed.get(up);
    if (canon) out[canon] = v;
    else unknown.push(k);
  }
  return { defects: out, unknown };
}
