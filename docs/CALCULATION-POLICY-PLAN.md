# Calculation Policy ("Rules") — plan

**Status:** draft for review. Nothing built yet.
**Problem it solves:** the 9.73% vs 8.46% argument, permanently — and every
future instance of it.

---

## 1. What actually went wrong

The headline rejection % is the **sum of each gate's own rate**
([`rejection.ts:177`](../src/lib/analytics/rejection.ts)). A reasonable person
reading the drill-down divides total rejected by total checked and gets a
different number. Neither party is wrong: the plant's REJECTION ANALYSIS sheets
really do sum per-stage rates, and `rejected ÷ entered` really is the other
common convention.

The defect was never the arithmetic. It was that **the convention was a decision
made in a code comment**, invisible to the person accountable for the number.

There are ~22 more decisions exactly like it in this codebase right now. Every
one is a future argument. The fix is to name them, surface them, and let the GM
own them.

### The second, quieter problem

Some policy is *already* user-settable — target rejection %, unit cost, stage
cost weights — via `localStorage`
([`cost.ts:19-50`](../src/lib/analytics/cost.ts),
[`settings/page.tsx:124`](../src/app/settings/page.tsx)). That is worse than
hardcoding for a medical-device plant:

- **Per-device.** The GM's laptop and the QM's laptop compute different COPQ.
  Neither knows.
- **Invisible to the server.** `getFinishedCost()` is guarded by
  `typeof window !== "undefined"`, so any server-rendered or API-computed number
  silently uses the default while the browser uses the override.
- **Unversioned and unauditable.** A report exported in March can't be
  reproduced in June, because nothing records which cost basis produced it.
- **Wiped by a browser clear.** Plant policy should not have the durability of a
  cookie.

Whatever we build must move these into the same versioned, server-side store as
the new rules. This is not scope creep — it's the same bug.

---

## 2. Design position (what NOT to build)

Being explicit, because this is the kind of feature that grows a DSL:

**Do not build a rules engine.** Calculation policy is not `IF x THEN y`. It is
a fixed list of ~22 named decisions, each with 2–4 valid answers. That is a
**form with dropdowns**, backed by one versioned JSON document. Enum choices,
not free-form logic.

**Do not extend `src/core/decision/`.** That engine
([`engine.ts`](../src/core/decision/engine.ts)) evaluates predicates over
metrics to produce CAPA *advice text*. It consumes metrics; policy *defines*
metrics. Merging them creates a circular dependency and one confusing concept
where there are two clear ones. Its versioned draft→active→retire store is the
right **pattern to copy**, not the right thing to reuse.

**Do not let policy be free text or LLM-authored.** Ask MOID may *propose* a
change; only the enum-validated form may *commit* one. Hard invariant #1 (the
model never does maths) extends to: the model never silently redefines maths.

**Do not make everything settable.** Some things are correctness, not
preference. See §8.

**Corollary — policy is a read-time lens, never a rewrite.** Changing a rule
must never touch the ledger. Every screen recomputes from the same append-only
events under the new policy. This keeps invariant #2 intact and makes every rule
change trivially reversible.

---

## 3. The complete rule inventory

Every calculation convention currently hardcoded, with where it lives and what
the alternatives are. **Blast radius** = what visibly changes when it changes.

### A. Rate composition & denominators — *the ones that cause arguments*

| # | Rule | Today | Alternatives | Blast radius |
|---|---|---|---|---|
| A1 | **Headline rejection %** | Σ of each gate's own rate ([`rejection.ts:177`](../src/lib/analytics/rejection.ts)) | Pooled `rejected ÷ entered`; worst single gate | Every KPI, trend, report, target comparison |
| A2 | **Where "entered/checked" is measured** | Most upstream in-scope stage, once ([`rejection.ts:214`](../src/lib/analytics/rejection.ts)) | Each gate's own; sum of all gates *(the old bug)* | Checked everywhere, all rate denominators |
| A3 | **Rework / hold units** | Excluded from checked ([`rejection.ts:59`](../src/lib/analytics/rejection.ts)) | Counted as checked; counted as rejected | Checked, all rates, mass balance |
| A4 | **Rejected when no explicit `inspection·rejected`** | Fall back to Σ per-defect events ([`rejection.ts:68`](../src/lib/analytics/rejection.ts)) | Treat as zero; flag as a gap | Rejected counts on defect-only sheets |
| A5 | **Stage denominator cascade** | Use previous gate's accepted when a stage restates lot size ([`rejection.ts:135`](../src/lib/analytics/rejection.ts)) | Always the stage's own stated qty; always cascade | Per-stage rates, FPY, bottleneck ranking |
| A6 | **First Pass Yield** | `Π(1 − stageRate)` ([`rejection.ts:226`](../src/lib/analytics/rejection.ts)) | `1 − Σ rates`; final accepted ÷ entered | FPY KPI, trend |

A1 and A2 together are the 9.73/8.46 argument. They are the two highest-value
entries in this whole document.

### B. Default scope

| # | Rule | Today | Alternatives | Blast radius |
|---|---|---|---|---|
| B1 | **Sections in scope by default** | Assembly only ([`plant-catalog.ts:104`](../src/core/ontology/plant-catalog.ts)) | All three; Primary+Assembly | Every screen's baseline numbers |
| B2 | **Default date preset & grain** | `all` / month ([`scope.ts:56`](../src/lib/analytics/scope.ts)) | Last 90 days; this FY | What you see on open |
| B3 | **Source channels by default** | Excel + Data Entry ([`scope.ts:542`](../src/lib/analytics/scope.ts)) | Either alone | Record counts, source mix |
| B4 | **Same-day Excel vs direct-entry precedence** | Table in [`precedence.ts:13`](../src/core/ingest/precedence.ts) | Reorder; prefer newest | Which row wins on a conflict |

### C. Calendar

| # | Rule | Today | Alternatives | Blast radius |
|---|---|---|---|---|
| C1 | **Fiscal year start** | April ([`plant-catalog.ts:280`](../src/core/ontology/plant-catalog.ts)) | Any month | FY buckets, YTD, annual reports |
| C2 | **What "week" means** | Fixed 7-day chunks from the 1st — *not* Mon–Sun ([`scope.ts:284`](../src/lib/analytics/scope.ts)) | ISO Mon–Sun; Sun–Sat | Every weekly chart and comparison |
| C3 | **Shift / day boundary attribution** | Date as recorded | Night shift rolls to previous day | Daily buckets |

C2 is a silent landmine — a weekly chart that doesn't match anyone's calendar
week and never says so.

### D. Targets & thresholds

| # | Rule | Today | Alternatives | Blast radius |
|---|---|---|---|---|
| D1 | **Plant target rejection %** | 10%, **localStorage** ([`cost.ts:30`](../src/lib/analytics/cost.ts)) | Any; per-section | Target lines, savings, RAG status |
| D2 | **Watch / alert threshold** | **localStorage** ([`settings/page.tsx:125`](../src/app/settings/page.tsx)) | Any | Alerts, notifications |
| D3 | **Per-defect per-stage targets** | Authored, not editable in UI ([`plant-catalog.ts:195`](../src/core/ontology/plant-catalog.ts)) | Editable per defect × stage | Defect RAG, Pareto flags |
| D4 | **Stalled-lot threshold** | "no gate in 3+ days" ([`batch-progress.ts`](../src/lib/analytics/batch-progress.ts)) | Any day count | Open-lots banner |

### E. Cost of rejection

| # | Rule | Today | Alternatives | Blast radius |
|---|---|---|---|---|
| E1 | **Finished unit cost** | ₹20, **localStorage** ([`cost.ts:19`](../src/lib/analytics/cost.ts)) | Any; per size | COPQ, savings |
| E2 | **Per-stage cost weights** | 0.6→1.0, **localStorage** ([`cost.ts:11`](../src/lib/analytics/cost.ts)) | Any per stage; flat | COPQ split by stage |
| E3 | **Improvement recovery fraction** | 25% ([`cost.ts:85`](../src/lib/analytics/cost.ts)) | Any; disable | Savings opportunity |
| E4 | **Currency & scale** | ₹ Lakhs | Crores; plain | Every money display |

### F. Data integrity

| # | Rule | Today | Alternatives | Blast radius |
|---|---|---|---|---|
| F1 | **Accepted > checked** | Flagged inconsistent ([`batch-progress.ts:96`](../src/lib/analytics/batch-progress.ts)) | Tolerance band; ignore | Integrity warnings |
| F2 | **Mass-balance tolerance** | *Confirm during implementation* ([`mass-balance.ts`](../src/lib/ingest/mass-balance.ts)) | ± units or % | Ingest rejections |
| F3 | **Batch-ID folding** | `26G0816` ≡ `26G08-16` ([`batch-id.ts`](../src/lib/entry/batch-id.ts)) | Strict; custom pattern | Lot grouping everywhere |

**22 rules.** Not all are worth shipping — see §7.

---

## 4. Storage & shape

One versioned document, same lifecycle as the decision-rule store
([`rule-store.ts`](../src/core/decision/rule-store.ts)): Supabase when
configured, memory otherwise, seeded from today's hardcoded values so **day one
behaviour is byte-identical**.

```ts
// src/core/policy/types.ts
export interface CalculationPolicy {
  version: number;                    // monotonic
  status: "draft" | "active" | "retired";
  rules: {
    headlineRejection: "sum-of-stage-rates" | "pooled" | "worst-gate";
    checkedMeasuredAt: "most-upstream" | "per-stage" | "sum-all-stages";
    reworkCountsAs: "excluded" | "checked" | "rejected";
    // … one key per row in §3, all enums or numbers, never free text
    fiscalYearStartMonth: number;
    weekDefinition: "chunks-from-1st" | "iso-mon-sun" | "sun-sat";
    targetRejectionPct: number;
    unitCostInr: number;
    stageCostWeights: Record<string, number>;
  };
  changedBy: string;                  // persona / user
  changedAt: string;                  // ISO
  note: string | null;                // why — required on activate
}
```

Guardrails:

- **Zod-validated**, enums only. An invalid policy cannot be stored, so no
  screen ever has to defend against one.
- **Append-only versions.** Activating v4 retires v3; v3 stays readable so any
  historical report can be reproduced.
- **Reports stamp the policy version** they were computed under. This is the
  audit story and the reason localStorage can't stay.
- **Seed = today's constants.** Shipping this changes zero numbers until
  somebody deliberately changes one.

### Threading it through

`scopeEvents`/selectors already take a `Scope`. Policy is a sibling parameter,
resolved once per render and passed with it:

```ts
rejectionRate(events, scope, registry, policy)
```

Defaulted to the seed policy so every existing call site and test keeps
compiling. Migrating the ~22 call sites is mechanical; the risk is in A1/A2/A5
where the branch is real logic, and each gets a test per branch.

**One resolver, one path.** No screen reads policy directly — same discipline as
hard rule "don't add a second path for something `lib/analytics/` already
computes."

---

## 5. The Rules page

`/settings/rules`. The whole point is that a GM who does not read code can tell
what a setting does **before** committing to it.

Each rule renders as a card:

1. **Plain-English question**, not a variable name.
   > "When we say the plant's rejection rate, do we mean…"
2. **The choices as sentences**, with the current one marked *(current)*.
   > ○ Add up each gate's own rate — Visual 5.23% + Balloon 0.45% + Valve 1.87%
   >   + Final 2.19% = **9.73%** *(current — matches your REJECTION ANALYSIS sheet)*
   > ○ Divide total rejected by units entered — 14,962 ÷ 176,838 = **8.46%**
3. **Live worked example against the real ledger.** Computed with the actual
   selectors over the current scope, both ways. This is the feature. It is the
   difference between a settings page and an argument.
4. **Impact preview before saving** — "Overall rejection 9.73% → 8.46%; FPY
   90.56% → 91.54%; 3 defects move out of target." Computed by running the
   selectors twice, not estimated.
5. **Where it shows up** — the screens this rule touches.

Plus, page-level:

- **Diff + confirm** on save, with a required note ("why").
- **History** — every version, who, when, why, with one-click revert.
- **Preview mode** — apply a draft policy to the live dashboard for the session
  without committing.

Ordering matters: A-group first (the arguments), then targets and cost (the ones
people actually want to tune), then calendar, then integrity. Not alphabetical,
not source order.

---

## 6. Setting rules from Ask MOID

The agent already has the exact shape needed — `ToolIntent` and `AgentAction`
with `navigate` and `spotlight`, and a propose→confirm precedent in
`confirm_ingest` ([`types.ts:87`](../src/lib/agent/types.ts)). No new
confirmation machinery.

Flow:

> **GM:** "count rejection as total rejected over total checked"

1. `classify.ts` gains a `set_rule` task kind.
2. The model maps the utterance to **`{ ruleId, proposedValue }`** — the *only*
   thing it produces. It never computes a number and never writes the policy.
   Unmappable phrasing → the agent says which rules exist and asks; it never
   guesses.
3. The agent replies with the deterministic before/after, computed by the
   selectors:
   > "That's **Headline rejection %** → *Divide total rejected by units entered*.
   > Today's figure would move **9.73% → 8.46%**. This affects the dashboard,
   > stage analysis and every report. Review and confirm →"
4. New intent `{ type: "propose_rule", ruleId, value }` emits a `navigate`
   action to `/settings/rules?propose=headlineRejection&value=pooled`, with
   `spotlight` on the card.
5. The Rules page opens **with that card focused and the change staged but not
   saved**. The GM sees the same worked example and clicks Save. The commit
   happens in the form, under Zod validation, with the note captured.

The chat can propose and explain. Only the page commits. That boundary is what
makes it safe to let the model interpret natural language here at all.

---

## 7. Phasing — what I'd actually ship

The full 22 is the map, not the first sprint. Shipping all of it at once means
22 branches through the metric layer before anyone has confirmed the page is
useful.

**Phase 1 — the arguments (highest value, ~40% of the work).**
Policy store + resolver + Rules page shell, wired to **A1, A2, A3, B1** only,
plus **migrating D1/E1/E2 out of localStorage** (correctness fix, not a
feature). Four rules is enough to prove the worked-example UI, and A1+A2 close
the dispute that started this.

**Phase 2 — the dials people ask for.** D2–D4, E3–E4, C1–C2. Mostly numbers and
enums with no branching in the metric layer; cheap once the frame exists.

**Phase 3 — Ask MOID propose→confirm.** Deliberately last. It's the demo
feature, but it's worthless until there are rules worth setting and a page worth
landing on.

**Phase 4 — the specialist rules.** A4–A6, B2–B4, F1–F3. Real branching, low
demand. Do them when someone asks, not before.

Deferred on purpose: per-size cost, per-section targets, scheduled policy
changes ("target drops to 8% next FY"), role-scoped defaults. All plausible,
none requested.

---

## 8. What must stay locked

Offering these as settings would be a bug, not flexibility:

- **The append-only ledger.** No "recalculate history" or hard-delete. Policy is
  a read-time lens (§2).
- **Content-addressed dedup** ([`hash.ts`](../src/lib/contract/hash.ts)).
- **"The model never does maths"** — invariant #1. Ask MOID proposes enum
  values; it never authors a formula.
- **MOD-only ingestion** — invariant #3.
- **Provenance and event lineage.**

The Rules page should say so, briefly, rather than staying silent about it —
"these are fixed by design" is itself useful information to the person who
wondered.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| A GM flips A1 and every historical report silently changes meaning | Reports stamp policy version; history shows what changed and when; one-click revert |
| Two plants/roles want different conventions | Out of scope for v1 — one plant, one policy. Revisit only if asked; do not pre-build multi-tenancy |
| Branching bloats the metric layer | Enums only, resolved once at the top; one test per branch; no branch without a UI control that reaches it |
| The model mis-maps a phrase to the wrong rule | It can only propose; the page shows the worked example and requires an explicit save |
| localStorage migration changes numbers for existing users | Seed from current defaults; on first load, if a localStorage override exists, show it as a proposed draft rather than applying silently |

---

## 10. Open questions for you

1. **A1 default** — keep Σ-of-stage-rates (matches the plant's sheets), or
   switch the default to pooled and let the sheets be the option?
2. **Who may change rules** — GM only, or QM too? The persona system
   ([`persona.ts`](../src/lib/persona.ts)) can gate it either way.
3. **Historical reports** — when policy changes, should an old report re-render
   under its original policy (reproducible) or the current one (consistent)? I'd
   argue reproducible, with a banner.
4. **Phase 1 scope** — are A1/A2/A3/B1 + the localStorage migration the right
   four to start with, or is there a rule from §3 that's biting you more?
