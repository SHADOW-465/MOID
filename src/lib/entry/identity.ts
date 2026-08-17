// What makes one Data Entry row *that* row, and nothing else.
//
// Ten places used to answer this question and no two agreed. `sk()` in the
// ingest route keyed on date+stage+size+batch; `sliceOf()` right beside it
// added the shift; edit grants threw in productType; the drill-down added the
// file name. Every new guard picked whichever key felt right that day, which is
// why bugs kept landing in this exact spot.
//
// The identity is (lot · station · pass):
//
//   lot      the canonical lot code. It already encodes the size, so size is
//            DERIVED here rather than stored beside it where the two can drift.
//   station  the ledger stageId.
//   pass     1 for the normal case. A lot goes through a station once, so a
//            second entry for the same (lot, station) is a CORRECTION unless
//            the operator explicitly declares another pass and says why.
//
// Everything else — the day it happened, the shift, who typed it, the product
// type, the source file — is an ATTRIBUTE OF the entry, never part of its name.
//
// That single move fixes the failure the plant reported: with the date in the
// key, the same lot re-entered at the same station on a different day looked
// like a brand-new record and was filed without complaint. Now it collides, and
// a collision is something we can show the operator.

import { canonicalBatchId, frDigitsFromSize } from "@/lib/entry/batch-id";

export interface EntryIdentity {
  /** Canonical lot code, e.g. "26H25-18". */
  lot: string;
  /** Ledger stageId, e.g. "visual". */
  station: string;
  /** 1 unless a second pass was explicitly declared. */
  pass: number;
}

/** The row's facts. None of these change which row it is. */
export interface EntryAttributes {
  /** Business day this station ran the lot. */
  date?: string | null;
  shift?: string | null;
  operator?: string | null;
  productType?: string | null;
  /** Why a pass beyond the first exists. Required when pass > 1. */
  passReason?: string | null;
}

/**
 * Size implied by a lot code. `26H25-18` is an Fr18 lot — the code carries it,
 * so nothing else needs to.
 */
export function sizeFromLot(lot: string | null | undefined): string | null {
  const canon = canonicalBatchId(lot ?? null);
  if (!canon) return null;
  const dash = canon.lastIndexOf("-");
  if (dash < 0) return null;
  const digits = frDigitsFromSize(canon.slice(dash + 1));
  return digits ? `Fr${digits}` : null;
}

/** Build an identity, normalising the lot code and clamping the pass. */
export function entryIdentity(
  lot: string | null | undefined,
  station: string,
  pass: number = 1,
): EntryIdentity | null {
  const canon = canonicalBatchId(lot ?? null);
  if (!canon || !station.trim()) return null;
  const p = Number.isInteger(pass) && pass >= 1 ? pass : 1;
  return { lot: canon, station: station.trim(), pass: p };
}

/** Stable string form, for Map keys and equality. */
export function identityKey(id: EntryIdentity): string {
  // Pass 1 omits its suffix so keys written before passes existed still match.
  return id.pass === 1 ? `${id.lot}|${id.station}` : `${id.lot}|${id.station}|${id.pass}`;
}

export function sameIdentity(a: EntryIdentity | null, b: EntryIdentity | null): boolean {
  if (!a || !b) return false;
  return identityKey(a) === identityKey(b);
}

/** A ledger event, only the fields identity cares about. */
export interface IdentifiableEvent {
  stageId?: string;
  batchNo?: string | null;
  customFields?: Record<string, unknown> | null;
  extractedBy?: string;
  isDirectEntry?: boolean;
  provenance?: { sheet?: string; is_direct_entry?: boolean } | null;
}

/** Recover the identity a stored event belongs to. */
export function identityOfEvent(e: IdentifiableEvent): EntryIdentity | null {
  const cf = e.customFields ?? {};
  const lot =
    (typeof e.batchNo === "string" && e.batchNo) ||
    (typeof cf.batch === "string" ? cf.batch : null) ||
    (typeof cf.batchId === "string" ? cf.batchId : null);
  if (!lot || !e.stageId) return null;
  const rawPass = cf.pass;
  const pass = typeof rawPass === "number" ? rawPass : 1;
  return entryIdentity(lot, e.stageId, pass);
}

export function isDirectEntryEvent(e: IdentifiableEvent): boolean {
  return (
    e.extractedBy === "direct-entry" ||
    e.isDirectEntry === true ||
    e.provenance?.is_direct_entry === true
  );
}

/**
 * The size the operator picked vs the size the lot code declares.
 *
 * The code is authoritative, so a mismatch is not something to silently
 * reconcile — it means one of the two was chosen wrongly and the operator is
 * the only one who knows which.
 */
export function sizeDisagreement(
  lot: string | null | undefined,
  selectedSize: string | null | undefined,
): { fromLot: string; selected: string } | null {
  const fromLot = sizeFromLot(lot);
  if (!fromLot || !selectedSize) return null;
  const digits = frDigitsFromSize(selectedSize);
  const selected = digits ? `Fr${digits}` : null;
  if (!selected || selected === fromLot) return null;
  return { fromLot, selected };
}
