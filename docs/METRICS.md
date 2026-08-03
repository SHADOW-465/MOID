# How every number on screen is computed

Every figure in MOID is deterministic JS over ledger events. No model produces a
quantity. This document is the contract: if a screen disagrees with it, the
screen is wrong.

Source of truth: [`src/lib/analytics/rejection.ts`](../src/lib/analytics/rejection.ts)
(metrics), [`src/lib/analytics/scope.ts`](../src/lib/analytics/scope.ts)
(selectors), [`src/lib/analytics/source-trace.ts`](../src/lib/analytics/source-trace.ts)
(View Source drill-down).

---

## 1. The raw material

A stage-day for one batch is stored as several events, not one row:

| Event | Field | Meaning |
| --- | --- | --- |
| `production` | `quantity` | Units that **entered** this stage |
| `inspection` · `accepted` | `quantity` | Units passed forward |
| `inspection` · `rejected` | `quantity` | Units scrapped at this stage |
| `inspection` · `rework` | `quantity` | Units **held** for rework |
| `rejection` | `quantity`, `defectCode` | Per-defect split of the rejected total |

Worked example — batch `26G04-14`, Visual, 2026-07-04:

```
production            5,930
inspection·rework       185
inspection·accepted   5,459
inspection·rejected     286
rejection ×10 (PW 3, PS 25, SD 18, FP 1, COAG 37,
               BM 56, RW 57, BEP 10, BMP 61, WK 18)   = 286
```

## 2. Per-stage aggregation

`aggregate()` sums each bucket **independently**:

```
checked  = Σ production.quantity
accepted = Σ inspection·accepted.quantity
rejected = Σ inspection·rejected.quantity
rework   = Σ inspection·rework.quantity
```

Three rules that are easy to get wrong:

- **`rework` is never added to `checked`.** Held units were pulled out of the
  flow; they did not enter it. `5,930` is checked, not `6,115`.
- **`checked` is not `accepted + rejected`.** Above, `5,459 + 286 = 5,745`,
  leaving the 185 held.
- **Defect fallback.** If a stage has no `inspection·rejected` event but does
  have per-defect `rejection` events, `rejected` falls back to their sum. This
  is why a stage never reports zero rejections while showing a defect Pareto.

**Stage rejection rate:**

```
stageRate = rejected / checked          (0 when checked = 0)
```

Visual on this batch: `286 / 5,930 = 4.82%`.

## 3. Headline metrics

| KPI | Rule | Why |
| --- | --- | --- |
| **Overall Rejection %** | `Σ stageRate` over every in-scope stage | Plant convention. Their REJECTION ANALYSIS sheet totals the column of per-stage percentages. It is a **funnel-loss** figure, *not* `total rejected ÷ total checked`. |
| **Quantity Checked** | checked of the single **most upstream in-scope stage** with data | Never a sum — see §3a. |
| **Total Rejected** | `Σ rejected` over all in-scope stages | A raw count. This one *is* a sum — a unit rejected at Visual and another at Final are two different units. |
| **First Pass Yield** | `Π (1 − stageRate)` | Rolled-throughput yield: the share of entering units clearing every gate untouched. Not `1 − overallRate`. |

Batch `26G04-14`, all five stages present:

| Stage | checked | rejected | rate |
| --- | ---: | ---: | ---: |
| production | 6,400 | 68 | 1.06% |
| visual | 5,930 | 286 | 4.82% |
| balloon | 5,459 | 18 | 0.33% |
| valve-integrity | 2,400 | 40 | 1.67% |
| final | 5,376 | 90 | 1.67% |

`Σ rates = 9.56%` · `FPY = Π(1−r) = 90.75%` · `Quantity Checked = 6,400` (Production is the most upstream stage present).

### 3a. Quantity Checked — one rule, one measuring point

**Checked is measured once, at the most upstream in-scope stage that has data.**
It is never a sum — not across the gates inside a section, and not across
sections.

Primary → Secondary → Assembly are **sequential departments handling the same
physical catheters**, not parallel lines. The tube dipped at Production is the
tube inspected at Visual. Selecting an upstream section moves the measuring
point upstream; it does not add a second one.

| Sections selected | Measured at | Quantity Checked |
| --- | --- | ---: |
| Assembly (default) | visual | **5,930** |
| Primary | production | **6,400** |
| Secondary + Assembly | secondary | **6,100** |
| Primary + Assembly | production | **6,400** |
| All three | production | **6,400** |

The same logic inside Assembly: Visual's `5,930` is the figure. Balloon's
`5,459`, Valve Integrity's `2,400` and Final's `5,376` are the same units
arriving at later gates, so adding them would count each catheter four times.

"Most upstream" means first in **catalog order** (`production … visual, balloon,
valve-fixing, valve-integrity, final`), not first to appear in the ledger — a
batch's gate events are emitted in arbitrary order. The real ledger for
`26G04-14` emits `valve-integrity` before `visual`; Assembly's entry is still
Visual.

**Total Rejected is the opposite case and IS summed.** A unit scrapped at Visual
and another scrapped at Final are two different units, so they add.

Scope the screen to Visual alone and the same rules give
`rate = 4.82%`, `checked = 5,930`, `FPY = 95.18%` — one stage, so the sum and
the product each collapse to that stage.

## 4. Primary / Secondary / Assembly

Stages carry a `category` in
[`plant-catalog.ts`](../src/core/ontology/plant-catalog.ts):

| Category | Stages | Captures |
| --- | --- | --- |
| **primary** (P1–P9) | `production` (dipping), `eye-punching`, `leaching`, `chlorination`, `hanging`, `gauge`, `trimming`, `balloon-production` | flow-through |
| **secondary** (P10–P14) | `secondary` | qty only, no defect breakdown |
| **assembly** (P15–P27) | `visual`, `balloon`, `valve-fixing`, `valve-integrity`, `final`, `primary-pack-inspection` | the quality **gates** |

**The default scope is `["assembly"]`** — `DEFAULT_STAGE_CATEGORIES`. When the
plant's own reports say "rejection %", they mean the assembly gates. Primary and
secondary are opt-in via the Sources panel, so they never silently inflate a KPI.

Consequences worth stating plainly:

- On the default dashboard, **Quantity Checked = Visual's checked**, because
  Visual is the most upstream assembly stage. Tick "Primary" in Sources and the
  measuring point moves to production — the figure is **replaced**, not added
  to. See §3a.
- `Overall Rejection %` gains a term per section you enable. Turning on Primary
  adds production's rate to the sum.
- `visual` has `captures: HELD` — it is the **only** gate that records rework.
  A held quantity anywhere else means the entry form was mis-mapped.

## 5. Source selectors

`resolveScope()` turns the header controls into a `Scope`;
`scopeEvents()` applies it. Order of filtering:

1. **Date range** — presets anchor on the data's own latest date, never on a
   hardcoded today, so "last 90 days" lands on real data.
2. **Stage** — a station view pins one stage; otherwise the section checkboxes
   resolve to a stage list. Both land in `scope.stageIds`.
3. **Size** — canonical ids (`Fr14`).
4. **Channel** — Excel and/or Direct entry. Deselecting both yields an empty
   result set, not "everything".
5. **Excel file** — only applies when the Excel channel is on.
6. **Batch** — uppercased before compare.

Then `canonicalizeEvents()` runs, and it is not a no-op:

- exact-duplicate collapse by content hash;
- per stage·day, if any event carries a size, **only sized events are kept** —
  a size-wise sheet supersedes a bare daily total for the same cell;
- per stage·day, a single **winning source file** by precedence, so
  re-uploading a corrected workbook does not double-count.

This is why enabling a second Excel file can leave a KPI unchanged: precedence
picked one of them for that stage-day.

## 6. View Source must agree

The drill-down re-derives its own totals from the same events via
`inferSourceKind()` → `rollup()`. Its classification therefore has to match
§2 exactly:

| Event | `SourceKind` |
| --- | --- |
| `production` | `checked` |
| `inspection·accepted` / `·good` | `accepted` |
| `inspection·rejected` | `rejected` |
| `inspection·rework` / `·hold` | `rework` |
| `rejection` (has defectCode) | `defect` |

> **Fixed 2026-08-03.** `inspection·rework` had no branch and fell through to
> `checked`. Batch `26G04-14` at Visual therefore showed **6,115** checked in
> View Source (`5,930 + 185`) against **5,930** on the dashboard, and implied a
> rate of `286 / 6,115 = 4.68%` beside the headline `4.82%`. Rework is now its
> own kind, surfaced as a "Held / rework" tile and a filter option.
> Pinned by [`checked-consistency.test.ts`](../src/lib/analytics/__tests__/checked-consistency.test.ts).

## 7. Batch yield cascade

`batchCascadedAgg()` corrects a real data-entry habit: an operator types the
whole lot size into every station's Checked box, even though only the previous
gate's accepted units physically arrived.

Within one batch, walking stages in order — if a stage's stated `checked` equals
the **batch's first** stage checked, or is `0`, it is replaced by the previous
stage's `accepted`.

On `26G04-14` nothing cascades: Visual states 5,930 against a first-stage 6,400,
so its own figure stands. The rule only fires on the copy-the-lot-size case.

Two consequences:

- A stage whose real checked genuinely equals the lot size will be rewritten.
  That is the accepted trade — the alternative is a denominator that is wrong
  far more often.
- The Audit trail applies the same cascade when rolling a batch up, which is why
  a batch's headline `checked` can differ from the raw number in its stage rows.
