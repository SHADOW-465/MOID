---
target: src/app/capa/page.tsx
total_score: 22
p0_count: 2
p1_count: 2
timestamp: 2026-07-31T08-59-34Z
slug: src-app-capa-page-tsx
---
# CAPA & Actions critique

**Target:** `src/app/capa/page.tsx` (+ `CapaComposerModal`)
**Method:** dual-agent (A: 019fb761-a044-76b3-ad2d-f651a02619f6 · B: 019fb761-c400-7170-98ee-48f03f88e7d7)
**Detector:** `[]` (0 findings)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Engine load OK; browser-local persistence was silent |
| 2 | Match System / Real World | 2 | CAPA vocabulary fits; store ≠ plant QMS |
| 3 | User Control and Freedom | 2 | Cancel edit OK; unguarded complete/delete/modal |
| 4 | Consistency and Standards | 2 | Create≠edit surfaces; glass modal vs flat page |
| 5 | Error Prevention | 1 | One-click complete; delete unconfirmed |
| 6 | Recognition Rather Than Recall | 3 | Filters + CAPA exists good; status cycle order |
| 7 | Flexibility and Efficiency | 2 | Lazy engine good; no bulk/keyboard |
| 8 | Aesthetic and Minimalist Design | 3 | Register distilled; modal busier |
| 9 | Error Recovery | 2 | Engine retry; silent storage fail |
| 10 | Help and Documentation | 3 | Lineage disclosure strong |
| **Total** | | **22/40** | **Acceptable** |

## Anti-Patterns

- **LLM:** Page body disciplined (filters-as-KPIs, deferred engine). Modal had glass blur + accent brand chip + side-stripe brief.
- **Detector:** clean (`[]`).

## Strengths

1. Filters replace KPI cards; default Active; overdue-first sort.
2. Evidence-preserving promote path (ruleId, vars, CAPA exists).
3. Lazy `/api/decide` until engine opened.

## Priority issues (pre-fix)

- **P0** localStorage-only store presented as plant register
- **P0** unguarded status complete / delete / dirty modal dismiss
- **P1** shell range unused by decide payload
- **P1** create vs edit IA split
- **P2** modal glass + side-stripe
- **P2** filter a11y (aria-pressed), small hit targets

## Applied (distill + optimize this run)

- Wire decide to Tweaks date range; re-fetch on range change; Refresh hits
- Confirm complete + delete; dirty modal dismiss
- Empty state opens engine; clear filters link
- aria-pressed chips, larger status/edit targets, landmarks
- Stage + lineage on inline edit; priority in meta row
- Browser-only honesty line
- Modal: no blur, no side-stripe, quieter brand chip, dialog a11y

## Not in this pass

- Server-backed CAPA store / multi-user QMS
- Full effectiveness-check CAPA lifecycle
- Focus trap library-level modal
