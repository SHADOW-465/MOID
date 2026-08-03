// Parse a natural period phrase into {from,to,grain}. Pure. Anchored on the
// data's latest date so "last 90 days" lands on real data (never a wall clock).
import type { Grain } from "./scope";

export interface DatePhrase {
  from: string;
  to: string;
  grain: Grain;
  matchedText: string;
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const ORDINAL_WEEK: Record<string, number> = {
  first: 1, "1st": 1, "1": 1, one: 1,
  second: 2, "2nd": 2, "2": 2, two: 2,
  third: 3, "3rd": 3, "3": 3, three: 3,
  fourth: 4, "4th": 4, "4": 4, four: 4,
  fifth: 5, "5th": 5, "5": 5, five: 5,
  last: -1,
};

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate();

/** Calendar week-of-month: 1→1–7, 2→8–14, …, last→final 7 days of the month. */
function weekOfMonth(year: number, monthNo: number, week: number): { from: string; to: string } {
  const endDay = lastDay(year, monthNo);
  if (week === -1) {
    const start = Math.max(1, endDay - 6);
    return { from: iso(year, monthNo, start), to: iso(year, monthNo, endDay) };
  }
  const start = (week - 1) * 7 + 1;
  if (start > endDay) {
    // e.g. "5th week" of a 30-day month → clamp to last partial week
    const s = Math.max(1, endDay - 6);
    return { from: iso(year, monthNo, s), to: iso(year, monthNo, endDay) };
  }
  const end = Math.min(start + 6, endDay);
  return { from: iso(year, monthNo, start), to: iso(year, monthNo, end) };
}

function yearForMonth(monthNo: number, dataYear: number, dataMonth: number): number {
  return monthNo <= dataMonth ? dataYear : dataYear - 1;
}

function findMonthIndex(t: string): number {
  for (let i = 0; i < MONTHS.length; i++) {
    if (new RegExp(`\\b${MONTHS[i]}\\b`).test(t)) return i;
  }
  return -1;
}

/**
 * Match "first week of july", "july first week", "july week 1", "week 2 of july".
 * Returns null when no week-of-month phrase is present.
 */
function parseWeekOfMonth(t: string, dataMaxIso: string): DatePhrase | null {
  const [my, mm] = dataMaxIso.split("-").map(Number);

  // "first week of july" / "2nd week of july" / "last week of july"
  let m = t.match(
    /\b(first|second|third|fourth|fifth|last|1st|2nd|3rd|4th|5th|[1-5])\s+week\s+of\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/,
  );
  if (m) {
    const week = ORDINAL_WEEK[m[1]] ?? 1;
    const monthNo = MONTHS.indexOf(m[2]) + 1;
    const year = yearForMonth(monthNo, my, mm);
    const range = weekOfMonth(year, monthNo, week);
    return { ...range, grain: "week", matchedText: m[0] };
  }

  // "july first week" / "july 1st week"
  m = t.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(first|second|third|fourth|fifth|last|1st|2nd|3rd|4th|5th)\s+week\b/,
  );
  if (m) {
    const monthNo = MONTHS.indexOf(m[1]) + 1;
    const week = ORDINAL_WEEK[m[2]] ?? 1;
    const year = yearForMonth(monthNo, my, mm);
    const range = weekOfMonth(year, monthNo, week);
    return { ...range, grain: "week", matchedText: m[0] };
  }

  // "july week 1" / "week 1 july"
  m = t.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+week\s*([1-5])\b/,
  );
  if (m) {
    const monthNo = MONTHS.indexOf(m[1]) + 1;
    const week = Number(m[2]);
    const year = yearForMonth(monthNo, my, mm);
    const range = weekOfMonth(year, monthNo, week);
    return { ...range, grain: "week", matchedText: m[0] };
  }
  m = t.match(
    /\bweek\s*([1-5])\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)\b/,
  );
  if (m) {
    const week = Number(m[1]);
    const monthNo = MONTHS.indexOf(m[2]) + 1;
    const year = yearForMonth(monthNo, my, mm);
    const range = weekOfMonth(year, monthNo, week);
    return { ...range, grain: "week", matchedText: m[0] };
  }

  return null;
}

export function parseDatePhrase(text: string, dataMaxIso: string): DatePhrase | null {
  const t = text.toLowerCase();
  const [my, mm] = dataMaxIso.split("-").map(Number);

  // Week-of-month before bare month so "july first week" is not swallowed as full July
  const weekPhrase = parseWeekOfMonth(t, dataMaxIso);
  if (weekPhrase) return weekPhrase;

  // "this fy" / "this financial year" / "this fiscal year" / "this year"
  if (/\bthis (fy|financial year|fiscal year|year)\b/.test(t)) {
    const startYear = mm >= 4 ? my : my - 1;
    return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31`, grain: "fy", matchedText: "this fy" };
  }

  // "last N days"
  const days = t.match(/\blast (\d{1,3}) days?\b/);
  if (days) {
    const n = Number(days[1]);
    const end = new Date(`${dataMaxIso}T00:00:00Z`);
    const start = new Date(end.getTime() - n * 86_400_000);
    return {
      from: start.toISOString().slice(0, 10),
      to: dataMaxIso,
      grain: "day",
      matchedText: days[0],
    };
  }

  // "this week" / "last week" relative to dataMax (Mon–Sun ISO-ish rolling 7 days)
  if (/\bthis week\b/.test(t)) {
    const end = new Date(`${dataMaxIso}T00:00:00Z`);
    const dow = end.getUTCDay(); // 0=Sun
    const monOffset = dow === 0 ? 6 : dow - 1;
    const start = new Date(end.getTime() - monOffset * 86_400_000);
    return {
      from: start.toISOString().slice(0, 10),
      to: dataMaxIso,
      grain: "week",
      matchedText: "this week",
    };
  }
  if (/\blast week\b/.test(t)) {
    const end = new Date(`${dataMaxIso}T00:00:00Z`);
    const dow = end.getUTCDay();
    const monOffset = dow === 0 ? 6 : dow - 1;
    const thisMon = new Date(end.getTime() - monOffset * 86_400_000);
    const lastSun = new Date(thisMon.getTime() - 86_400_000);
    const lastMon = new Date(lastSun.getTime() - 6 * 86_400_000);
    return {
      from: lastMon.toISOString().slice(0, 10),
      to: lastSun.toISOString().slice(0, 10),
      grain: "week",
      matchedText: "last week",
    };
  }

  // "last month" / "this month"
  if (/\blast month\b/.test(t)) {
    const y = mm === 1 ? my - 1 : my;
    const m = mm === 1 ? 12 : mm - 1;
    return { from: iso(y, m, 1), to: iso(y, m, lastDay(y, m)), grain: "month", matchedText: "last month" };
  }
  if (/\bthis month\b/.test(t)) {
    return { from: iso(my, mm, 1), to: iso(my, mm, lastDay(my, mm)), grain: "month", matchedText: "this month" };
  }

  // "last quarter" — the previous complete calendar quarter relative to dataMax
  if (/\blast quarter\b/.test(t)) {
    const currentQ = Math.ceil(mm / 3);
    let prevQ = currentQ - 1;
    let year = my;
    if (prevQ === 0) { prevQ = 4; year = my - 1; }
    const startM = (prevQ - 1) * 3 + 1;
    const endM = prevQ * 3;
    return { from: iso(year, startM, 1), to: iso(year, endM, lastDay(year, endM)), grain: "month", matchedText: "last quarter" };
  }

  // Bare month name → most recent occurrence at/before dataMax
  const mi = findMonthIndex(t);
  if (mi >= 0) {
    const monthNo = mi + 1;
    const year = yearForMonth(monthNo, my, mm);
    return {
      from: iso(year, monthNo, 1),
      to: iso(year, monthNo, lastDay(year, monthNo)),
      grain: "month",
      matchedText: MONTHS[mi],
    };
  }

  return null;
}
