// Reasons an operator wrote down when saving over a data-entry error.
// These become GM notification messages and are also folded into the row remarks.

export type ReasonNote = {
  kind: string;
  reason: string;
  warningMessage?: string;
};

export function collectEntryReasons(opts: {
  warnings: { code: string; message: string }[];
  ackReasons: Record<string, string>;
  pass?: number;
  passReason?: string | null;
}): ReasonNote[] {
  const out: ReasonNote[] = [];
  const seen = new Set<string>();

  if ((opts.pass ?? 1) > 1) {
    const reason = (opts.passReason ?? "").trim();
    if (reason) {
      out.push({ kind: "repeat-pass", reason });
      seen.add("repeat-pass");
    }
  }

  for (const w of opts.warnings) {
    const typed = (opts.ackReasons[w.code] ?? "").trim();
    if (!typed) continue;
    if (seen.has(w.code)) continue;
    seen.add(w.code);
    out.push({ kind: w.code, reason: typed, warningMessage: w.message });
  }

  return out;
}

/**
 * Warnings that are a true exception the GM should see a typed note for.
 * A correction ("replace the existing row") is the normal rewrite path —
 * ticking it is enough. A stray pass-2 on a new station is a form bug, not
 * something the operator should write an essay about.
 */
export const WARNINGS_NEEDING_REASON = new Set([
  "rejected-not-fully-explained",
  "same-counts-different-lot",
]);

export function warningNeedsReason(code: string): boolean {
  return WARNINGS_NEEDING_REASON.has(code);
}

export function remarksFromReasons(notes: ReasonNote[], existing?: string): string {
  const extra = notes.map((n) => `${n.kind}: ${n.reason}`).join(" | ");
  const prior = (existing ?? "").trim();
  if (!extra) return prior;
  if (!prior) return extra;
  return `${prior} | ${extra}`;
}
