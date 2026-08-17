# Data Entry — full blueprint

**Date:** 2026-08-17
**Surface:** `/data-entry` (`BatchMatrixEntry.tsx`) and everything it calls

This is the as-built reference for how manual data entry actually works today,
after the identity/validation rework. It exists so the next bug in this area
gets fixed by reading this document, not by re-deriving the system from a
2,600-line component under deadline.

## One-paragraph model

An operator picks **where** (section → station), **what lot** (a code that
encodes the day the lot started and its size), types **counts**, and the form
computes **Rejected** as a balance, never lets the operator type it directly.
Before save, one pure function (`checkEntry`) judges the draft against
whatever schema and ledger state apply and returns blocks / warnings / notes.
On save, the record is turned into canonical ledger events and posted to
`/api/ingest`, which supersedes whatever the same **identity** (lot · station
· pass) already held. Every screen downstream — dashboard, audit, history —
reads the ledger, never the form's memory of what happened.

## The pieces, and who owns what

```
BatchMatrixEntry.tsx (UI, ~2,700 lines)
  ├─ entry-schema.ts       which stations/columns/defects exist (schema-driven)
  ├─ disposafe-matrix.ts   offline seed + ShiftBatchRecord type + constants
  ├─ batch-id.ts           lot code parse/build/canonicalize
  ├─ identity.ts           what makes one row THAT row (lot · station · pass)
  ├─ check-entry.ts        the one place every save-time rule lives
  ├─ shift-window.ts       when an operator may write without a GM grant
  ├─ edit-grants.ts        temporary out-of-window write permission
  ├─ to-stage-day-record.ts ShiftBatchRecord → StageDayRecord (ledger shape)
  └─ revision-diff.ts      ledger events → human-readable edit history

/api/ingest/route.ts       StageDayRecord[] → canonical events → append/supersede
  ├─ emit.ts                StageDayRecord → ProductionEvent/InspectionEvent/...
  ├─ mass-balance.ts        cross-stage V-014 check
  └─ validate-entry.ts      per-record V-001/V-004/V-013 checks

audit-sessions.ts          ledger events → AuditEntryRow (what audit/history show)
batch-progress.ts          ledger events → lot completion (assembly gates only)
```

Nothing here mutates the ledger in place. Every "edit" is a new save whose
events **supersede** the old ones via a `CorrectionEvent`. The ledger is
append-only; what changes is which events count as *effective*.

## 1. What identifies an entry

**File:** `src/lib/entry/identity.ts`

```
EntryIdentity = { lot, station, pass }
```

- **lot** — the canonicalized lot code (`26H25-18`). Spelling variants
  (`26H2518`, `26h25-18`) fold onto the same canonical form via
  `canonicalBatchId`.
- **station** — the ledger `stageId` (`"visual"`, `"balloon"`, …).
- **pass** — `1` unless the operator explicitly declared a repeat. Keyed
  without a suffix when `pass === 1`, so it matches rows written before passes
  existed.

**Deliberately NOT part of identity:** the date, the shift, the operator, the
product type. These are *attributes recorded on* the entry, not part of its
name. This is the single most important design decision in the system —
see "Why date is not identity" below.

**Size is derived, not stored separately.** `sizeFromLot("26H25-18")` returns
`"Fr18"`. The lot code is authoritative; a selected size that disagrees with
it is a **block**, not a field the system tries to reconcile.

### Why date is not identity

The lot code already encodes the day the lot *started* (`batchDate`). The
`date` field on an entry ("Recorded on") is the day a *station ran* the lot —
a lot spans several days on the floor, so these are genuinely different facts.

If date were part of identity, the same lot re-entered at the same station on
a different day would look like a brand-new record and get filed silently —
which is exactly the mismatch the plant reported. With date removed, that
re-entry **collides** with the first one and `checkEntry` surfaces it as the
`station-already-recorded` warning.

## 2. The UI flow

### 2.1 Where (section → station)

- Three fixed sections: Production Dipping, Secondary, Assembly (locked in
  `plant-catalog.ts`, rendered as the schema-tree's category folders — see the
  separate schema-tree blueprint).
- Stations inside a section come from `/api/entry-template`, which projects
  the live company catalog (`entry-schema.ts: resolveEntrySchema`). If the
  catalog has no stages, `fromSeed()` in the same file provides a hardcoded
  fallback so Data Entry works before any schema is configured.
- Switching section or station used to call `resetQtys()` unconditionally,
  silently discarding typed counts. It now:
  - **keeps the counts** (they're the operator's transcription of the paper,
    not station-specific),
  - **clears only the defect list** (station-specific vocabulary),
  - **asks for confirmation first** via `confirmDiscard()`.

### 2.2 Which lot (`BatchIdField.tsx` + `batch-id.ts`)

- `batchDate` (when the lot started) + `size` → the lot code, via
  `buildBatchId`. This composition is one-directional and automatic — nothing
  else may write the code except typing it directly.
- **`date` ("Recorded on") is never part of this composition.** That
  separation is itself the fix for a previous bug where moving "Recorded on"
  silently renamed the lot.
- Typing a code parses it back into `batchDate` + `size` (`onBatchInput` →
  `parseBatchId`), so typing and picking stay in sync both directions.
- After a save, `clearFormKeepContext()` clears quantities but **keeps**
  `batchDate`/`size` — intentional, because the same lot is usually the next
  entry (next station, or next day of the same lot). This is what makes the
  code "sticky" across saves; it is a feature for the multi-day case and the
  raw material for the mismatch bug when the *next physical lot* inherits it
  unnoticed. `checkEntry`'s `station-already-recorded` warning is the backstop
  for exactly that.

### 2.3 Counts

- **Checked** — typed directly (or auto-filled once from the previous
  station's Accepted, for Assembly chains — see 2.5).
- **Accepted / Hold** — typed directly, only for stations whose schema
  `columns` include them.
- **Rejected — never typed. Always the balance:**
  `Rejected = Checked − Accepted − Hold`.
  This used to switch to "sum of defect counts" the instant any defect was
  typed, which made the number visibly climb as the operator itemised and,
  if only some reasons were itemised, silently redefined Rejected as that
  partial sum. It is now one definition, always, matching what the plant's
  own sheet computes.
- **Defects** *explain* Rejected, they never define it. The UI shows
  `defectCoverage`: `"15 of 39 explained"`, with a warning badge for the gap
  and a block if defects ever sum to *more* than Rejected (which can only mean
  Accepted/Hold is wrong).

### 2.4 Lot progress (`batch-progress.ts` + `LotProgress.tsx`)

- Derived, never stored: reads the ledger for this lot's assembly-gate events
  (Visual → Balloon → Valve Integrity → Final) and computes `doneCount`,
  `pct`, `status: "not-started" | "in-progress" | "complete"`.
- **`status === "complete"` means only those four gates are done.** It says
  nothing about Valve Fixing, Primary Pack Inspection, or any
  primary/secondary station. A prior version of the "finished lot" warning was
  keyed on this status and blocked saves at *every* station once the four
  gates were done — a real regression, fixed by keying the warning on
  `stageAlreadyDone` (does *this* station already have an entry for *this*
  lot) instead.

### 2.5 Assembly auto-fill

For Assembly stations, Checked is pre-filled once from the previous station's
Accepted for the same lot+size, read live from `events`. Guarded so it never
re-fires after the operator has touched any quantity, and never after its
first successful apply for that `(prevStage, batch, size)` context — this is
what stops an events-refresh from overwriting a value mid-entry.

## 3. Validation — `checkEntry`

**File:** `src/lib/entry/check-entry.ts`. Pure function, no I/O, no clock
(`today` is passed in). This is the single place every save-time rule lives —
it replaced a chain of `confirm()` dialogs that lived directly in `submitForm`
and could not be unit tested.

```ts
checkEntry(draft: EntryDraft, ledger: Map<string, LedgerEntrySummary>, today: string)
  → { blocks: EntryProblem[], warnings: EntryProblem[], notes: EntryProblem[], canSave, identity }
```

**Severities:**
- **block** — cannot save. Rendered in the verdict panel, disables the Save
  button, shown *while typing* (recomputed on every keystroke via `useMemo`),
  not as a dialog after the click.
- **warn** — may save once explicitly acknowledged. Each warning has its own
  `code` and needs its **own** checkbox — one blanket confirm cannot double as
  consent to a different problem.
- **note** — informational, no decision required (e.g. "this will be recorded
  against a past date").

**Every rule, in order of appearance in the code:**

| code | severity | fires when |
|---|---|---|
| `lot-code-invalid` | block | the lot code doesn't parse (`isValidBatchId`) |
| `size-disagrees-with-lot` | block | selected size ≠ size the lot code encodes |
| `date-invalid` | block | Recorded-on isn't a real ISO date |
| `date-in-future` | block | Recorded-on is after today |
| `date-backdated` | note | Recorded-on is before today (GM backfill) |
| `nothing-checked` | block | Checked is 0 or unset |
| `negative-count` | block | any of Checked/Accepted/Hold/Rejected < 0 |
| `counts-do-not-balance` | block | Accepted+Hold+Rejected ≠ Checked |
| `defects-exceed-rejected` | block | defect sum > Rejected |
| `rejected-not-fully-explained` | warn | defect sum < Rejected (partial itemisation) |
| `station-already-recorded` | warn | this (lot, station) already has a ledger entry, and this isn't an edit |
| `pass-needs-reason` | block | `pass > 1` with no `passReason` |
| `pass-without-first` | warn | `pass > 1` declared but no pass-1 entry exists for this identity |
| `same-counts-different-lot` | warn | another lot, same station, same day, identical checked/accepted/rejected — almost always one lot typed twice with the code mistyped |

`summariseLedger(events)` folds **direct-entry events only** into
`Map<identityKey, LedgerEntrySummary>` — Excel-sourced events are excluded on
purpose, so a typed row can never be treated as "already recorded" against an
imported one.

## 4. The escape hatch (repeat passes)

A lot goes through a station once — that's the default, strict rule. But
blocking every repeat unconditionally would corner an operator whose lot
*genuinely* came through twice (re-inspection after rework, a big lot split
across days) into inventing a fake lot code just to get the work saved, which
would be worse than the problem it prevents.

So `station-already-recorded` is a **warning**, not a block, and next to its
acknowledgement checkbox is a second option: *"No — this lot came through
\[station\] again (keep both)"*. Checking it sets `pass = 2+` and demands a
reason (`pass-needs-reason` blocks until one is given). The reason is sent to
the GM as a notification (`notifyException`) and stored in `customFields.pass`
/ `passReason` on the ledger event, so it's auditable after the fact — the
plant can look at how often this fires and decide, from real data, whether
day-splits are a genuine workflow.

## 5. Save pipeline

```
buildPendingRecord()                    form state → ShiftBatchRecord
  → toStageDayRecord(rec, ingestionId)  ShiftBatchRecord → StageDayRecord
  → POST /api/ingest { records: [StageDayRecord] }
       → checkRecord() + massBalanceIssues()   (server-side re-check, see §6)
       → emitMany()                            StageDayRecord → Event[]
       → supersede logic                       identity-keyed, see §7
       → store.append(events)
       → issues persisted as Findings
  ← { issues: EntryProblem[] }
finalizeSave()
  → commitRecord() returns issues → shown in a sticky "things to check" panel
  → shift list updated, draft cleared, events refreshed
```

`buildPendingRecord` reads every piece of form state into a `ShiftBatchRecord`
(`disposafe-matrix.ts`), stamping `duplicateConfirmedOf` (badge for a
confirmed-distinct coincidence) and `pass`/`passReason` when applicable.

`toStageDayRecord` (`to-stage-day-record.ts`) is the **only** place that maps
`ShiftBatchRecord` → the ledger's `StageDayRecord` shape. What a station
captures is entirely the schema's call — the form already zeroes fields a
station doesn't render, and `emit.ts` skips zeros, so there is no
`isSecondary`-style hardcoded suppression left in this file.

## 6. Server-side checks (independent of `checkEntry`)

`checkEntry` runs client-side, at typing time, using client-visible state.
`/api/ingest` runs its **own** checks server-side, against authoritative
ledger state, on every POST — belt and suspenders, not redundant:

- **`checkRecord`** (`validate-entry.ts`) — rejected > checked, defect-sum
  mismatch, negatives. (V-001, V-004, V-013)
- **`massBalanceIssues`** (`mass-balance.ts`) — cross-stage: a gate's Checked
  cannot exceed what the previous gate passed forward. (V-014)
  Data Entry submits **one station per save**, so this check is given the
  previous gate's numbers **read back from the ledger** (`priors`, computed
  in the route from `existingEvents`) rather than relying on multiple records
  in one payload — otherwise it would never have anything to compare against
  for manual entry, which was true until this fix.

Both sets of issues are:
1. Returned in the response body (`{ issues }`), read by `commitRecord` and
   shown in a sticky panel on the entry screen — previously computed and
   discarded unread on every successful save.
2. **Persisted as Findings** (`Finding.parse` + `findingsStore.upsert`), keyed
   by content so re-saving the same bad row doesn't pile up duplicates — so a
   QM can review them later even if the operator dismissed the toast.

## 7. Supersede / ingest identity

`/api/ingest` decides which stored events a new save replaces. Two keys used
to disagree (`sk` omitted shift, `sliceOf` beside it included shift — that
mismatch is why a night-shift save silently replaced a day-shift one). Both
now derive from **one** function:

```ts
idOf(event) = identityKey(identityOfEvent(event))   // "26H25-18|visual" (pass 1)
            ?? `nolot|${date}|${stage}|${size}|${sheet}`   // legacy fallback
```

- Events **with** a lot code key on `(lot · station · pass)` — the same
  identity `checkEntry` uses. No date, no shift.
- Events **without** a lot code (workbook imports, rows written before lot
  codes existed) fall back to the old day-based slice, so nothing already on
  the ledger changes meaning.
- Only `extractedBy === "direct-entry"` rows can supersede — a typed row can
  never silently replace what a workbook import stated, and vice versa.
- A row whose value was cleared to nothing emits no event but still **owns**
  its identity slot; that ownership is what lets a cleared field supersede the
  old value with a null replacement (`CorrectionEvent`) instead of leaving a
  stale number behind.

## 8. Permissions and time windows

- **`shift-window.ts`** — one plant shift, `Day Shift 08:00–20:00
  Asia/Kolkata`. An operator may write freely inside the window;
  outside it, only with a GM grant.
- **`edit-grants.ts`** — a GM-approved, time-boxed (`DEFAULT_GRANT_TTL_MS` =
  2h) permission to write outside the shift window, keyed by `entryKey(date,
  batchId, stageId, size, productType)`. *(Note: this key still includes date
  and productType — it predates the identity rework and governs UI
  permission, not ledger identity, so it wasn't in scope for that change; see
  "Open items" below.)*
- **Roles:** GM (`canWrite` always true, may set a past date), Owner
  (`canWrite` false — view only), Operator (`canWrite` true, gated by shift
  window / grant).

## 9. History and audit — what changed, by whom, when

- **`/api/entries/revisions`** returns the raw event timeline for one
  `(date, batch, stageId, size)` slice, now including `operator`,
  `productType`, `shift`, `remarks` read off `customFields` — these were
  written to every event from day one and displayed nowhere until this pass.
- **`revision-diff.ts: buildRevisions()`** groups that timeline by
  `ingestionId` (one save = one revision, since one save restates the whole
  row) and diffs each revision's snapshot against the one before it —
  field-by-field, with the delta:
  ```
  Edit 1 · 14 Aug 2026, 16:02 · 4 hours later    [Current]
    Accepted   1163 → 1158    -5
    Rejected     39 →   44    +5
  ```
  Replaces a raw list of ledger atoms ("Checked qty 1326 · Effective") that
  required mentally reconstructing what changed.
- **`audit-sessions.ts: buildEntryRows()`** folds ledger events into one row
  per `(date, batch, stageId, size)` — this is what the Audit page and
  `EntryHistory.tsx` render. Notably includes `rework` (Hold) now — it was
  collected into the internal aggregation but never copied onto the emitted
  row, so Checked never visibly summed to Accepted+Hold+Rejected even though
  the ledger had the held units the whole time.

## 10. Data shapes, end to end

```
ShiftBatchRecord (form state, disposafe-matrix.ts)
  { id, date, operator, macro, stageId, size, sizeCanonical, productType,
    batchId, checked, accept, hold, reject, defects, remarks, shift,
    pass?, passReason?, duplicateConfirmedOf? }

        ↓ toStageDayRecord()

StageDayRecord (ledger-shape input, ingest/emit.ts)
  { occurredOn, stageId, size, source, checked, acceptedGood, rework,
    rejected, defects[], extractedBy: "direct-entry", customFields: {
      operator, batch, size, shift, notes, productType, macro, process,
      matrixId, pass?, passReason?, confirmedDistinctFrom? } }

        ↓ emitStageDay() in emit.ts

Event[] (canonical ledger events)
  ProductionEvent      (checked)
  InspectionEvent × N  (accepted / rework / rejected, one per disposition)
  RejectionEvent × N   (one per defect code)
  AnnotationEvent?      (remarks, if any)
```

## 11. Known open items (not yet built)

- **`edit-grants.ts`'s `entryKey`** still includes `date` and `productType`
  and predates the identity rework — it governs *write permission*, not
  ledger identity, so a grant issued for one date/productType combination
  won't carry to a corrected one. Worth revisiting if GM edit-grant friction
  shows up in practice.
- **Excel bulk import** does not go through `checkEntry` at all — it has its
  own reconciliation path (`reconcileConflicts`) that predates this work.
  `massBalanceIssues` does apply there (multi-row payloads always did have
  something to compare).
- **No UI has been visually verified.** Every claim above is backed by tests
  (`identity.test.ts`, `check-entry.test.ts`, `revision-diff.test.ts`,
  `audit-sessions.test.ts` — 601 tests total) and `tsc`/`next build`, not by
  a rendered screenshot. The verdict panel, pass checkbox, and history diff
  view in particular are worth a human look before an operator meets them.
