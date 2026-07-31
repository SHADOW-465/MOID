# Disposafe plant data — structural audit and target schema

Source: `ANALYTICAL DATA/` (42 workbooks, 429 sheets, 4 SOPs, 1 annexure) and
`STATICAL DATA ANALYSIS/` (93 workbooks) — read cell by cell. Everything below is
from the files themselves; where I inferred intent rather than read it, it says so.

> **`ANALYTICAL DATA/` is a partial copy of `STATICAL DATA ANALYSIS/`.** The
> size-wise visual and balloon/valve files are duplicated verbatim between them.
> Combined, the real corpus is **1,436 data sheets in 61 distinct column layouts
> across 9 families**. Sections 1–4 below were written against the smaller copy;
> **§5 corrects them** and is the current statement of scope.

---

## 1. What is actually being collected

There is no single record. There are **five independent recording systems**, each
maintained by a different person, each with its own grain, its own column names,
and its own definition of "rejection %". Nothing links them.

### 1.1 DAILY ACTIVITY REPORT — the only full-line record
`SIZE WISE REJECTION/FINAL/DAILY ACTIVITY REPORT 2025.xlsx` (16 sheets),
`…2026.xlsx` (3 sheets). Controlled form **F/DIP/13:00**, effective 2024-11-10.

Grain: **one row per calendar date, plant-wide.** Column groups, in process order:

| Group | Fields captured |
|---|---|
| PRODUCTION | NO OF LOTS, ACTUAL, ACPT QTY, REJ |
| EYE PUNCHING | ACTUAL, ACPT QTY, REJ |
| LEACHING / CHLORINATION / HANGING / GUAGE / TRIMMNG | one throughput number each |
| VISUAL INSEPTION | CHKD QTY, ACPT QTY, HOLD, REJ |
| BALOON INSPECTION | CHKD QTY, ACPT QTY, HOLD, REJ |
| VALVE FIXING | one throughput number |
| VALVE INTEGRITY | CHKD QTY, ACPT QTY, HOLD, REJ |
| FINAL INSPECTION | CHKD QTY, ACPT QTY, HOLD, REJ |
| BALLLOON PRODUCTION | CHKD QTY, ACPT QTY, REJ |
| — | TOTAL REJ, REJ% |

**This is the file that has "production".** It is also the only place the
upstream chain (eye punching → leaching → chlorination → hanging → gauge →
trimming) is recorded at all. The dashboard currently sees none of it except
what direct entry happens to write.

The schema drifts inside the same workbook:

- `JAN25`–`APRIL 25`: 25 columns, no HOLD anywhere, **no FINAL INSPECTION**
- `MAY 25`: HOLD appears on VISUAL only
- `JUNE 2025`: FINAL INSPECTION group added
- `JULY 25` onward: HOLD on balloon/valve/final, BALLLOON PRODUCTION added
- `WEEKLY REPORT 25-26`, `JAN WEEKLY REPORT 25-26`: same columns but with
  `WEEKLY REPORT` subtotal rows interleaved between the daily rows

### 1.2 REJECTION ANALYSIS 2025-26 — the QA/GM view
12 monthly workbooks + `YEARLY ANALYSIS.xlsx`.

Per workbook: one sheet per quality gate — `VISUAL`, `BALLOON INSPECTION`,
`VALVE INTEGRITY`, `FINAL INSPECTION` — each `DATE | QUANTITY CHECKED |
REJECTION | %`. Plus a `Cummulative` sheet holding the four percentages and
`Total Rejection % = Visual% + Balloon% + Valve% + Final%`.

No defects. No sizes. No batches. No hold. This is the narrowest of the five and
it is the one the app was built against.

### 1.3 SIZE WISE REJECTION / VISUAL
12 monthly workbooks + `commulative 2026-27.xlsx`. Controlled form **F/QC/01:00**,
effective 2025-02-03.

Grain: **one sheet per size** (`6FR`…`24FR`, plus `3way 16FR`…`3way 26FR` and
`18FR 3WAY`/`20FR 3WAY` in some months), one row per date.

Columns: `DATE | BATCH NO. | REC. QTY | ACCEPT QTY | HOLD QTY | REJ. QTY | REJ %`
followed by **21 named defect columns**, numbered 1–21 in one header row and coded
in the next:

```
1 COAG  2 SD   3 TT   4 BL   5 PS   6 SB   7 PW
8 FP    9 RW  10 BEP 11 DEC 12 BM  13 WEB 14 BT
15 SF  16 BIC 17 WK  18 BMP 19 TF  20 PH  21 BST
```

A final row carries a **per-defect target** (0.5, 0.5, 0.1, 0.2, 0.2, 0.1, …).
A `COMMULATIVE` sheet rolls the sizes up. A `FORMATE` sheet holds the blank
template and the legend expanding each code. A `4-2-25` sheet is a stale sample
from Feb 2025 that has been copied into **all 12 monthly files** and never removed.

### 1.4 SIZE WISE REJECTION / VALVE INTEGRITY
12 monthly workbooks + `commulative 2026-27.xlsx`. **Two stages per sheet, side
by side**, one sheet per size:

- left block, headed `BALLOON ISPECTION REPORT - P17`: BATCH NO., CHECKED QTY,
  ACCEPT QTY, HOLD QTY, REJ. QTY, REJ. %, then defects **STRUCK BALLOON,
  BALLOOM BRUST, LEAKAGE, OTHERS**, then Remarks
- right block, headed `VALVE INTEGRITY`: its own BATCH NO., same five quantity
  columns, then defects **LEAKAGE, 90/10, BUBBLE, THIN SPOD, OTHERS**, then Remarks

### 1.5 FINAL / 05 FINAL INSPECTION WEEKLY
Controlled form **F/ASSEM/02:00**, effective 2024-12-07. One sheet per week.

`DATE | REC. QTY | ACCEPT QTY | REJ. QTY | REJ %` + the same 21 visual defect
codes, then five summary rows: `TOTAL`, `%` / `CURRENT TREND`, `OVERALL
REJECTION TARGET`, `Deviation`, `RESULTS` (OK / NOT OK per defect), a `REMARKS`
line, and a signature line — **Assembly Supervisor / Production Manager /
Verified By**.

### 1.6 What the SOPs say the data means
- `WI-PRD-25-00` — Visual Inspection is **P17**. Dispositions are Accepted /
  Hold / Rejected; rejects get a Red Tag `F-LAB-13:00` and a non-conformance
  note `F-QA-15:00`; results go to route card `F/ASSEM/01:00`. Capacity: 1500
  pcs/operator/hour, 15000 pcs/shift, 10-hour shift.
- `WI-QC-15-00` — balloon & valve integrity: inflate, hold 20–30 min, check
  leakage. Acceptance criteria include the 90/10 ratio, thin spot ("more than
  three"), slow deflation, weak balloon, dog-leg, severe collaring, eye air leak.
- `WI-PRD-30-00` — Final Inspection + siliconization is **P24 & P25**. Adds a
  **reprocess** outcome distinct from reject ("reprocessed at end of each lot and
  rechecked").
- `WI-QC-25-00` — a **sixth inspection stage that appears in no workbook**: 100%
  inspection after primary packing (dust, hair, cutting, printing, pouch
  rejection), output goes to rework.
- `DS-ANX-13 GUIDE FOR REMEDIAL ACTION` — for each of the 21 visual defect codes,
  the documented root causes and the corrective actions. This is a ready-made
  CAPA knowledge base sitting unused in a `.doc`.

### 1.7 What is never recorded, anywhere
- **Shift** — no shift column exists in any of the 429 sheets, yet the app's Data
  Entry screen asks for it.
- **Operator / machine / line** — the SOPs assign responsibility per person; the
  records never name one.
- **Batch continuity across stages** — Visual has a batch no., Balloon and Valve
  each have their own batch no. on the same row, Final and the DAR have none.
  Nothing lets you follow one physical lot through the line.
- **Product variant** — 3-way appears only as a separate *sheet name*
  (`3way 16FR`), never as a field.

---

## 2. Errors found

Automated pass over every sheet where a checked/rejected column pair could be
located (the DAR's two-level header defeats it, so its errors are **not** in
these counts):

| Class | Rows | Files |
|---|---|---|
| Stated REJ % ≠ rejected ÷ checked | 65 | 6 |
| checked ≠ accepted + hold + rejected | 62 | 9 |
| TOTAL row % is a sum of per-row percentages | 13 | 13 |
| Rejects recorded with zero checked | 5 | 2 |
| Accepted greater than checked | 5 | 3 |
| **Total** | **150** | |

### The ones that change what management sees

1. **`YEARLY ANALYSIS.xlsx` is labelled one month behind its data.** The row
   dated `2025-03-31` holds April's totals (7.778 / 0.884 / 2.849 / 2.671 /
   14.181 — identical to April's `Cummulative` row). Every row is shifted.
2. **September 2025 in that same file is `4.3766` for all four stages** and a
   17.51% total. September's own workbook says 6.169 / 0.272 / 1.739 / 1.105 /
   9.285. One cell was dragged across four columns.
3. **`SIZE WISE REJECTION/VISUAL/commulative 2026-27.xlsx`: five of twelve months
   are the same copy-pasted row.** April, May, November, December and March all
   read `55247 / 48419 / 4202 / 2626 / 4.753%` with an identical defect vector.
   They feed the 1,842,073 annual total.
4. **`SIZE WISE REJECTION/VALVE INTEGRITY/commulative 2026-27.xlsx`: April and
   June–November are all zero**, though every monthly file exists. The header
   inside says "COMMULATIVE 2025-26" in a file named 2026-27.
5. **April 2025's `Cummulative` Final-Rejection column is misaligned** against the
   `FINAL Inspe REJECTION` sheet by roughly seven rows — 13 Apr shows 2.947%
   where the source sheet says 1.351%, and 2.947% is repeated on 20 Apr. Total
   Rejection % is therefore wrong for most of the month.
6. **`05 FINAL INSPECTION WEEKLY.xlsx` records 24–30 May 2026 twice with different
   numbers.** `MAY WEEK 5` says 24 May = 13015 received / 730 rejected;
   `JUNE WEEK 3` says the same date = 8022 / 119.
7. **Every sheet in that file is titled "FINAL INSPECTION WEEKLY REPORT MAY 2026"**,
   including all the June ones, and `MONTH` says MAY on June sheets. `MAY WEEK 4`
   and `MAY WEEK 5` both carry `DURATION 17/05/26 TO 23/05/26`. `JUNE WEEK 1` is
   labelled `01/05/26 TO 07/05/26` but contains 31 May – 5 June.
8. **`RESULTS` rows are stale copies.** `JUNE WEEK 3`'s verdict row is byte-for-byte
   `MAY WEEK 5`'s numbers. `JUNE WEEK 4`, `JUNE WEEK 5` and `JUNE 2026` have no
   data at all yet still display `-0.37 / -0.19 / … / -1.12`.
9. **Row-level REJ % is broken across the whole of `VISUAL/1 APRIL 26.xlsx`** —
   14FR shows 95.9%, 104.7%, 383.8%, 216.3% where the true rates are 3.1%, 3.4%,
   12.4%, 7.0%. The TOTAL row (3.839%) is correct, so nobody noticed.
10. **`4-2-25` sums percentages across different denominators**: 2.570 + 1.134 +
    4.051 = 7.754% is presented as the batch total; the true rate is 129/6338 =
    2.035%. This sheet is duplicated into 13 workbooks.
11. **DAR typos that poison weekly and monthly totals.** 2025-12-11 eye-punching
    REJ = 13417 (accepted drops by 164 that day) → that day's REJ% = 100.76% and
    the week's total rejects = 16945. 2025-04-03 production REJ = **−736** with
    accepted (11136) above actual (10400). 2025-04-23 valve REJ = **−193**.
    2025-12-04 valve HOLD = **−10**.
12. **DAR and REJECTION ANALYSIS contradict each other on the same day.**
    2025-05-20 visual: DAR says 10437 checked / 9172 rejected; the Rejection
    Analysis says 10437 checked / 572 rejected. 2025-05-01 visual: DAR 9348
    checked, RA 4590. April totals differ by 158 units.
13. **Text sentinels in numeric columns**: `SUNDAY`, `NO PRODUCTION`, `NA`.
14. **Stage numbering collides.** The valve workbook titles balloon inspection
    "P17"; `WI-PRD-25-00` says P17 is Visual Inspection. Final is P24/P25 in the
    SOP and unnumbered in every workbook.
15. **Legend contradicts header**: column 18 is coded `BMP`, the legend defines
    `BP  BUMP`. `PS` is "Ply Separation" in the legend and "Ply Seperation" in
    the SOP.
16. **Targets are inconsistent between departments for the same defect code.**
    Visual: COAG 0.5, SD 0.5, BM 1.0. Final: COAG 0.1, SD 0.1, BM 0.1, and *zero*
    for TT/BL/SB/PW/FP/DEC/WEB/SF/BIC/BMP/TF/PH — where zero silently means "no
    target", so `RESULTS` prints `OK` for a defect with a real count. The
    `OVERALL REJECTION TARGET` cell holds `0.01` in a column whose neighbour is
    `2.86` — a fraction and a percentage in the same column.
17. **Month boundaries are ambiguous.** `1 APRIL 26.xlsx` covers 2026-03-31 to
    2026-04-29; the Rejection Analysis April file also starts 2025-03-31. The
    boundary day belongs to two months at once and is double-counted in any
    naive year total.
18. **File naming has no convention.** The same month is `10 JANUARY 27.xlsx` in
    the valve folder and `10 JANUARY 2027.xlsx` in the visual folder; `commulative
    2026-27.xlsx` says "COMMULATIVE 2025-26" inside; `~$` Excel lock files for
    `12 MARCH 2026` and `commulative 2025-26` are still sitting in the visual
    folder, meaning those workbooks were left open or crashed mid-edit.

### 2.1 Three incompatible definitions of "rejection %"

| Source | Formula |
|---|---|
| DAILY ACTIVITY REPORT | Σ(rejects at every stage) ÷ PRODUCTION `ACTUAL` |
| REJECTION ANALYSIS | Σ over the 4 gates of (stage rejects ÷ stage checked) — a sum of rates |
| SIZE WISE / FINAL WEEKLY | rejects ÷ received, per sheet |

For April 2025 these give roughly 11.07%, 14.18% and (per size) 3–6%. **All
three are "the plant's rejection rate" to whoever maintains that file.** The app
implements the middle one. That is the root of every "your number is wrong"
conversation.

---

## 3. The schema it should be

One grain, one table, everything else derived:

```
InspectionRecord
  occurredOn      date            (+ shift, when they start recording it)
  stageId         production | eye-punching | leaching | chlorination |
                  hanging | gauge | trimming | visual | balloon |
                  valve-fixing | valve-integrity | final |
                  balloon-production | primary-pack-inspection
  batchNo         string          — the SAME id at every stage
  size            6FR … 26FR
  variant         2-way | 3-way | female
  checked         int
  accepted        int
  hold            int             (rework / reprocess)
  rejected        int
  defects         { code: count } — scoped to the stage's own defect set
  remarks         string
  recordedBy      operator
  verifiedBy      supervisor / production manager   (the F/ASSEM/02 sign-off)
```

Rules that make the 150 errors impossible rather than detectable:

| Rule | Kills |
|---|---|
| `checked = accepted + hold + rejected`, hard block | the 62 mass-balance breaks |
| `Σ defects = rejected` | already implemented (A12) — keep it |
| `rejected ≤ checked`, all values `≥ 0` | negatives, accepted > checked |
| percentages are **never entered**, only derived | all 78 wrong-% rows |
| unique `(date, stage, batch, size)` | the WEEK 5 / WEEK 3 contradiction |
| a date with no record must carry an explicit `NO PRODUCTION` / `HOLIDAY` marker | blank-vs-zero ambiguity, `SUNDAY` as a number |
| `stage.checked ≤ upstream.accepted` for the same batch — **warn**, don't block | the cascade breaks the DAR shows daily |
| targets live in the catalog per `(stage, defect)`, with "no target" distinct from `0` | the false `OK` verdicts |

### 3.1 The KPI set — definitions of record

No single "rejection %" is correct, because the three in use answer three
different questions. The standard is to define each one, name it, and never print
an unlabelled percentage. These are the definitions this system uses.

| # | KPI | Formula | Grain | Answers |
|---|---|---|---|---|
| 1 | **Stage Rejection Rate** | `rejected ÷ checked`, per stage | day, batch, size | "how is this station performing" — the process-control metric |
| 2 | **Stage Yield** | `1 − stage rejection rate` | same | pass-through of one station |
| 3 | **Rolled Throughput Yield (RTY)** | `Π(stage yields)` across the line | **month or batch, never day** | "what fraction of units got through the whole line clean" |
| 4 | **Overall Reject Rate** | `Σ rejected ÷ units entering the line` | **month or batch** | material loss — the financial number |
| 5 | **Hold / Rework Rate** | `hold ÷ checked`, per stage | day, batch, size | recoverable loss — currently invisible and it is ~5.4% at Visual |
| 6 | **Defect Share (Pareto)** | `defect count ÷ total rejects` | any | which defect to attack |
| 7 | **DPU** | `Σ defects ÷ units checked` | any | severity — one unit can carry several defects |
| 8 | **Cumulative Stage Loss** *(legacy)* | `Σ of stage rejection rates` | day, month | reproduces the existing QA sheets so they still tie out |

**#1 is the default headline. #8 is kept only for continuity and must always
carry the word "legacy" or "cumulative", never "total rejection".**

#### Why Σ of stage rates is not a rate

Every stage has a different denominator, so the four fractions are not
commensurable and cannot be added. 31 March 2025:

| Stage | Checked | Rejected | Rate |
|---|---|---|---|
| Visual | 10,982 | 1,054 | 9.60% |
| Balloon | 9,627 | 15 | 0.16% |
| Valve integrity | 9,612 | 129 | 1.34% |
| Final | 6,685 | 1,448 | 21.66% |

Final's 21.66% is measured over 6,685 units and Visual's 9.60% over 10,982, yet
the QA sheet adds them at equal weight and reports **32.76%**. The same day's
RTY loss is **30.24%** and its true reject rate is 2,646 ÷ 10,982 = **24.09%**.
Three numbers, one day, all "correct" under their own definition.

Over April 2025 the gap is smaller but systematic: Σ rates = 14.18%, 1 − RTY =
13.58%. Σ always overstates, and the overstatement grows with the rates.

#### Why #3 and #4 must not be shown daily

On 31 March, Valve accepted 9,483 units but Final only checked 6,685 — 2,798
units were work in progress. Any same-day "units in vs units out" number is
measuring the WIP swing, not quality. **Per-stage rates are honest daily;
RTY and overall reject rate are only honest once WIP washes out** — i.e. over a
month, or over a single batch followed end to end. This is the concrete reason
batch identity has to survive across stages.

#### One naming fix

What the dashboard currently labels **First Pass Yield** is computed as
`Π(1 − stage rate)` — that is Rolled Throughput Yield, not FPY. FPY is a
single-stage measure of units passing without rework. Rename it to RTY and, once
hold is captured, add true FPY = `(checked − hold − rejected) ÷ checked`.

---

## 4. Landing it without breaking the running app

The good news: **almost none of this needs new code.** The architecture already
has the right shape — an append-only ledger, a MOD per workbook shape, a company
catalog, and a Data Entry screen generated from that catalog. What is missing is
*catalog content*, not machinery.

**Phase 0 — stop the bleeding (hours).**
Write the three rejection definitions into `AGENTS.md`, and surface both headline
numbers with explicit labels. Every future "your number is wrong" becomes a
one-line answer instead of a code change.

**Phase 1 — schema only, no code (a day).**
Add the missing stages to the company catalog via the Data Schema page, each
declaring its own `captures` (throughput-only stages capture `checked` alone) and
its `upstream` link. Add the balloon and valve defect sets separately from the 21
visual codes. Add per-`(stage, defect)` targets. The dashboard, analytics and
Data Entry all regenerate from this — that is what `/api/entry-template` is for.
*This is where "production" belongs*, rather than being unioned in from the ledger
as it is now.

**Phase 2 — entry hardening (small).**
`lib/entry/validate-entry.ts` becomes a declarative rule list read from the
catalog rather than hardcoded checks. Add `shift`, `operator`, `variant` and the
explicit `NO PRODUCTION` record type. Nothing else in `BatchMatrixEntry` changes,
because the grid is already generated.

**Phase 3 — ingest the history (the only real work).**
Don't map 42 workbooks. There are **five shapes**; map five MODs and every other
file is the same shape:
`DAR`, `Rejection Analysis`, `Visual size-wise`, `Balloon+Valve size-wise`,
`Final weekly`. Ingest raw, corrections as `CorrectionEvent`s — never fix a
number in the source file.

**Phase 4 — a reconciliation screen.**
For each `(date, stage)`, show what each source says and flag the delta. This is
the single highest-value screen you can build for this plant: it turns "the
systems are a mess" from a feeling into a list with 150 rows on it, and it is the
artifact that gets the company to agree on one number. It also stops *you* being
the one who discovers each contradiction by hand.

**Phase 5 — close the loop.**
`DS-ANX-13` already maps every defect code to causes and remedial actions. Load
it as the CAPA suggestion source instead of asking a model. The `RESULTS`
OK/NOT-OK logic in the weekly sheet is a decision rule — it belongs in
`core/decision/`, not in a spreadsheet formula that goes stale.

### Why this stops the churn

The reason the spec keeps moving is that **nobody has written down what one
record is.** Every correction the company sends is really them discovering a
field they forgot to mention. Once the Data Schema page *is* the contract:

- a new field is a schema edit, not a release
- a renamed defect is a schema edit
- a new stage is a schema edit
- Data Entry, the dashboard, reports and the audit trail all follow automatically

Their Excel has no such contract, which is exactly why 429 sheets drifted into
five mutually contradictory systems. Reproducing that flexibility in code is what
has been costing you the rework.

---

## 5. Corrections after reading `STATICAL DATA ANALYSIS/`

### 5.1 A claim in §1.7 was wrong

I wrote that **batch continuity across stages is never recorded**. It is —
in `6.SEC VS ASSEMBLY GTN SHORTAGE/`, which I had not seen:

```
S.No | Items Name | DIPPING Qty | EYE PUNCHING QTY | DIPPING REJ IN SEC |
EYE PUNCHING REJ IN SEC | DIPPING SHORTAGE | SECONDARY GTN Qty |
ASSEMBLY QTY. | SECONDARY SHORTAGE | TRIMMING DATE | TRIMMING QTY |
MIX- (12 FR) QTY | MIX+ (16 FR) QTY
```

One row per batch (`26D01`, `26D02`…), per size, per month. It follows a lot from
Dipping → Eye Punching → Secondary GTN → Assembly and computes the loss at each
handoff. This is the traceability spine, and it introduces two concepts nothing
else in the plant records:

- **Shortage** — material that vanished between departments without a rejection
  record. Distinct from rejection: `DIPPING SHORTAGE = -218`, `SECONDARY
  SHORTAGE = +163` on 14FR April 2026. It can be **negative or positive**.
- **Size conversion** (`MIX-` / `MIX+`) — units that changed size class between
  stages. 14FR April 2026: 332 units converted, 0.86% of the batch.

Batch is therefore a real join key, and a unit's identity is not conserved
across the line. Any RTY computed per batch must account for conversion.

### 5.2 Four domains the app does not model at all

| Domain | Source | Grain | New fields |
|---|---|---|---|
| **Production output** | `2.PRODUCTION REPORT ANALYSIS/` | date × SKU | NO. OF LOTS, cumulative lots, **MANPOWER**, S.O., PRODUCTION QTY, SHOP FLOOR REJ, working days, avg lots/day |
| **Dipping shop-floor rejection** | `SHOPFLOOR REJECTION REPORT*.xlsx` | date | **No of TROLLEYS** (a different unit of measure), 8 defect codes |
| **Inter-department material flow** | `6.SEC VS ASSEMBLY GTN SHORTAGE/` | batch × size | shortage, size conversion, trimming date |
| **Dispatch** | `SILICON` sheets | date × SKU | CHALN NO., DISPATCH QTY |

### 5.3 "Size" is a SKU, not a size

The production report's size axis is **size × balloon capacity × variant**, ~26
columns:

```
6FR/1.5CC  8FR/3-5CC  10FR/3-5CC  12FR/15CC  14FR/15CC  16FR/30CC
18FR/30CC  20FR/30CC  22FR/30CC  24FR/30CC  26FR/30CC  28FR/30CC  30FR/30CC
3-way:  16FR/50CC  18FR/50CC  20FR/50CC  22FR/50CC  24FR/50CC
female: 12FR/15CC  14FR/15CC  16FR/30CC  18FR/30CC
```

Note `12FR/15CC` appears in both the standard and female blocks — the SKU key is
`(size, capacity, variant)`, and none of the three alone is unique.

### 5.4 A third production defect vocabulary

Dipping uses 8 codes, unrelated to the 21 visual or the 4+5 balloon/valve sets:

```
COAG · Raised Wire · Surface Defect · Overlaping · Black Mark ·
Webbing · Missing Formers · Others        (+ EP = eye punching, RW/PW, OL)
```

So the plant has **four defect vocabularies**, not three: dipping (8), visual
(21), balloon (4), valve (5).

### 5.5 Two more rejection definitions — six in total

Beyond the three in §2.1:

4. **Assembly-section total** (`1.ASSEMBLY REJECTION ANALYSIS/`) — sums only
   visual + balloon + valve + final, deliberately excluding production and eye
   punching. Verified: 2025-01-02 assembly total 464 = 355+109+0, while the DAR
   reports 520 for the same day because it adds production (26) and eye
   punching (30).
5. **Shop-floor rejection** (dipping only, over trolleys).
6. **Shortage** — loss with no rejection record at all.

### 5.6 New errors in this corpus

- `SHOPFLOOR REJECTION REPORT.xlsx :: COMMULATIVE YEARLY` — the hand-typed chart
  list under the table (COAG 1730, RW 1358, SD 2120, OG 2037, BM 700, OTHERS
  8985 = **16,930**) omits Webbing (101) and Missing Formers (146); the table
  above it totals **17,177**.
- Sheet names contradict their contents: sheet `APRIL 26` has `MONTH: APRIL 25`
  in r2 and `APRIL 2026` in r9; sheet `MAY 26` contains 2025 dates.
- `ASSEMBLY REJECTION REPORT 2024-25 :: JANUARY DAILY` r24 — `0 | 0 | 0 | 2`
  (2% rejection on zero checked); r33 VALVE INT checked 6059, accepted 6641.
- Percentages hand-typed to 1–2 dp in places (`2.07`, `1.1`, `0.6`), computed to
  15 dp elsewhere — the column is a mix of typed constants and formulas.
- Weekly rollups are written **diagonally** into three spare columns at the right
  margin, offset one row below the week's first day.
- `00.YEARLY…xlsx` / `0.YEARLY…xlsx`, `COMULATIVE PRODUCTION REPORT OF 2025.xlsx`
  / `…2025 - 26.xlsx` / `…2026 - 27.xlsx` — near-duplicate files whose sheets
  (`YEAR 2025-26`, `YEARLY REJ 2025-26`) are copied into all three regardless of
  the year in the filename.

### 5.7 Effect on the plan

**The architecture holds. The scope does not.**

The group-block reader still covers every multi-stage sheet, and `PRODUCTION`
drifts exactly like the DAR — fixed head columns, summary columns sliding
AB→AD→AF as SKUs are added — so it is the same rule keyed on header names
rather than letters. But the reader count goes from 4 to **6**:

| Reader | Covers | Sheets |
|---|---|---|
| flat date × role | REJ-ANALYSIS, VISUAL/FINAL detail, SHOPFLOOR | ~900 |
| group-block multi-stage | DAR, ASSEMBLY-DAILY | 45 |
| side-by-side two-table | BALLOON+VALVE (incl. weekly) | 462 |
| weekly + footer summary rows | VISUAL/FINAL weekly | 79 |
| wide SKU matrix | PRODUCTION, SILICON dispatch | 43 |
| batch reconciliation | GTN SHORTAGE | 64 |

Six readers for 1,436 sheets is still two orders of magnitude less machinery
than a profiler + LLM resolver ladder + MOD lifecycle. The conclusion from the
smaller corpus survives contact with the larger one.

What does **not** survive is the assumption that this app is about rejection
analytics. This corpus is the whole factory: production planning, manpower,
material flow between departments, size conversion, and dispatch. That is a
scope decision, not an engineering one — see the open question in §5.8.

### 5.8 The open question

Three options, in increasing size:

- **A — Quality only.** Stages, dispositions, defects, KPIs. Ingest the GTN batch
  spine for traceability but not shortage as a metric. Roughly the current plan
  plus 2 readers.
- **B — Quality + material balance.** Adds shortage and size conversion as
  first-class. Answers "where did the units go", which is the question the GTN
  files exist to answer and which no current screen can.
- **C — Full plant.** Adds production planning, manpower, dispatch. A different
  product.

**B is the recommendation.** Shortage is already the plant's own reconciliation
mechanism, it is batch-grained (so it fits the ledger), and without it the yield
numbers have an unexplained gap that no KPI definition can close. C should wait
until B is running.
