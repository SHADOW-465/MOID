---
target: sources and batches floating window
total_score: 22
p0_count: 2
p1_count: 2
timestamp: 2026-07-31T03-53-27Z
slug: src-components-app-sourcesscopepanel-tsx
---
# Critique: Sources & batches floating window

## Design Health Score: 22/40 (Acceptable)

### Heuristics
| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Active summary omits sections; topbar accent incomplete |
| 2 | Match System / Real World | 3 | Plant language good; empty=all fights multi-select mental model |
| 3 | User Control and Freedom | 3 | Escape/reset/clear exist; no undo when KPIs jump |
| 4 | Consistency and Standards | 1 | Batch empty=all vs Excel empty=all with different UI |
| 5 | Error Prevention | 2 | Can zero both channels / all sections |
| 6 | Recognition Rather Than Recall | 2 | Must remember invert rules |
| 7 | Flexibility and Efficiency | 3 | Immediate apply + select all/search |
| 8 | Aesthetic and Minimalist Design | 2 | Col1 double-duty; dense modal |
| 9 | Error Recovery | 2 | Reset good; no live impact signal |
| 10 | Help and Documentation | 2 | Helpers scattered; critical rule in 11px |

### Priority Issues
P0: Dual empty semantics + "none selected" language
P0: Sections missing from Active summary
P1: Topbar accent incomplete for section/channel-only scope
P1: Done implies commit; apply already happened
P2: Select all batches ≠ full plant
P2: Channels+Sections stacked in one column
P3: Focus trap / a11y gaps

### Detector
CLI detect.mjs: 0 findings, exit 0
Browser: skipped (no injection session)

### Strengths
Plant-true defaults and copy; immediate global scope with Reset; chip label priority encodes investigation intent
