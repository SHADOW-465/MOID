// Deterministic intent classification for Ask MOID task agent.

import type { TaskKind } from "./types";

/** Explicit “perform this for me” — not mere “how do I enter data”. */
const EXECUTE_RE =
  /\b(do it( for me)?|enter( it| this)? for me|log( it)? for me|save( it)?( for me)?|submit( it)?|fill( it)? in|write( it)?( for me)?|can you (do|enter|log|save|record))\b/i;

/** User is stating quantities / asking to record a row (not asking how). */
const ENTRY_ACTION_RE =
  /\b(enter|log|record|save)\b/i;

const ENTRY_SIGNAL_RE =
  /\b(checked|accepted?|reject(ed)?|defect|coag|batch\s|assembly|primary|secondary|\d+\s*fr)\b/i;

const QTY_RE = /\b(checked|accept(ed)?|reject(ed)?)\s*(value\s*)?(is|=|:)?\s*\d+/i;
const DEFECT_QTY_RE = /\b(coag|sd|bl|tt|ps|sb|pw|fp|rw|bep|dec|bm|web|bt|sf|bic|wk|bmp|tf|ph|bst|leakage|bubble)\s*[:=]?\s*\d+/i;

const REPORT_RE =
  /\b((generate|make|create|print|build)\s+(a\s+)?report|report\s+(for|on|of)|summarize.{0,40}report|report.{0,40}summar)/i;

const ANALYZE_RE =
  /\b(summarize|summary|recap|what('s| is) (my|the|our)|how (bad|high|much|many)|analyze|figures? for|numbers? for|kpi)\b/i;

const NAV_RE = /\b(take me|go to|open|navigate|bring me|jump to|switch to)\b/i;

const HOWTO_RE =
  /\b(how (do i|to|can i|do we|should i)|where (is|do i|can i|to)|show me how|guide me|help me (with|to|do)|explain|teach me|walk me)\b/i;

const CONFIRM_RE = /^(yes|y|ok|okay|confirm|do it|save|submit|go ahead|proceed|yep|yeah)[\s!.]*$/i;
const CANCEL_RE = /^(cancel|never mind|nevermind|stop|abort|nope|forget it)[\s!.]*$/i;

export function isConfirmMessage(text: string): boolean {
  return CONFIRM_RE.test(text.trim());
}

export function isCancelMessage(text: string): boolean {
  return CANCEL_RE.test(text.trim());
}

export function hasExecuteLanguage(text: string): boolean {
  return EXECUTE_RE.test(text);
}

function hasEntrySignals(text: string): boolean {
  return (
    ENTRY_SIGNAL_RE.test(text) ||
    QTY_RE.test(text) ||
    DEFECT_QTY_RE.test(text)
  );
}

/**
 * Classify a brand-new user message (no active task).
 * Execute/entry wins over pure howto when both appear *and* there is
 * substance (numbers / assembly / do-it-for-me) — not “how do I enter data?”.
 */
export function classifyTaskKind(text: string): TaskKind {
  const t = text.trim();
  if (!t) return "howto";

  // Multi-step packs (Monday GM, spike, get started) — before report/entry
  if (
    /\b(monday gm|gm pack|gm review|weekly review pack|investigate (rejection )?spike|rejection spike|get started|first[- ]time setup|setup plant)\b/i.test(
      t,
    )
  ) {
    return "workflow";
  }

  // Report before bare analyze so "summarize … report" lands on report
  if (REPORT_RE.test(t)) return "report";

  const hasQty = QTY_RE.test(t) || DEFECT_QTY_RE.test(t);
  const pureHowTo = HOWTO_RE.test(t) && !hasExecuteLanguage(t) && !hasQty;

  // Entry: do-it-for-me, or enter+quantities/defects/assembly (even if also “how do I”)
  if (!pureHowTo) {
    if (hasExecuteLanguage(t) && (hasEntrySignals(t) || ENTRY_ACTION_RE.test(t) || hasQty)) {
      return "enter_data";
    }
    if (hasQty && (ENTRY_ACTION_RE.test(t) || hasEntrySignals(t) || hasExecuteLanguage(t))) {
      return "enter_data";
    }
    if (
      ENTRY_ACTION_RE.test(t) &&
      (hasQty || /\bassembly\b/i.test(t)) &&
      !pureHowTo
    ) {
      return "enter_data";
    }
  }

  // Mixed: “how do I enter… can you do it for me checked 400” — execute + qty
  if (HOWTO_RE.test(t) && (hasExecuteLanguage(t) || hasQty) && (hasEntrySignals(t) || hasQty)) {
    return "enter_data";
  }

  if (ANALYZE_RE.test(t)) return "analyze";
  if (NAV_RE.test(t)) return "navigate";
  if (HOWTO_RE.test(t)) return "howto";

  if (hasEntrySignals(t) && hasQty) return "enter_data";

  return "howto";
}
