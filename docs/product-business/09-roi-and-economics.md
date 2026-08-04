# 09 · ROI & Unit Economics

## Sales ROI method (mandatory in pilots)

### Step 1 — Inputs (from plant)

| Input | Question |
|-------|----------|
| Throughput | Units checked / month at primary gate(s) |
| Rejection | Stage rates or agreed method |
| Unit cost | Finished catheter/device cost ₹ |
| Stage weights | Progressive value-add if known (else flat) |
| Hold/rework | ₹ labor per rework if material |
| People time | Hours/week on rejection charts + audit prep |
| Loaded rate | ₹/hour for QM engineer |
| Audit | Days/year prep × cost (optional) |

### Step 2 — Hard savings

```
annual_scrap_cost ≈ Σ (rejected_units_s × finished_cost × weight_s)
opportunity_10 = 0.10 × annual_scrap_cost
opportunity_25 = 0.25 × annual_scrap_cost
```

Use **post-baseline ledger** rates, not brochure fiction.

### Step 3 — Soft savings

```
soft_raw = eng_hours_per_year × loaded_rate (+ audit hours × rate)
soft_conservative = 0.5 × soft_raw
```

### Step 4 — Payback

```
year1_investment = annual_license + implementation (+ appliance)
annual_value = opportunity_case + soft_conservative
payback_months = year1_investment / annual_value × 12
```

**Target:** payback **&lt; 12 months** on conservative case.

---

## Worked example (template numbers)

| Item | Value |
|------|-------|
| Annual scrap cost | ₹48,00,000 |
| 25% improvement opportunity | ₹12,00,000 |
| Soft conservative | ₹4,00,000 |
| Total annual value | ₹16,00,000 |
| MOID year-1 (8L + 2.5L) | ₹10,50,000 |
| Payback | **~7.9 months** |

Replace every row with pilot baseline before customer signature on ROI letter.

---

## ROI letter fields

```
Plant: ____________________
Baseline period: __________
Method: recomputed checked/rejected (sheet % is claim only)
Annual scrap cost (₹): __________
Improvement case: ___% → ₹ __________
Soft savings conservative (₹): __________
MOID year-1 investment (₹): __________
Payback (months): __________
Signed: GM ________ QM ________ Date ________
```

---

## COPQ integrity rules

1. COPQ UI off or watermarked until cost assumptions **signed** with effective date.  
2. Always show method (flat vs stage weights).  
3. AI prose may **explain** a computed ₹; it may not invent one.  
4. Engineering target: durable `cost_config` (not local-only settings) for enterprise deals.

---

## Internal unit economics

### Standard plant (target)

| Line | Amount |
|------|--------|
| ACV list | ₹8,00,000 |
| Impl list | ₹2,50,000 |
| Year-1 TCV | ₹10,50,000 |
| Delivery | ≤ 15 eng-days |
| If eng fully loaded ₹8,000/day | ≤ ₹1,20,000 delivery cost |
| Contribution before support | strong |
| Support | ≤ 8h/mo steady state |

### Pilot only

| Line | Amount |
|------|--------|
| Fee | ₹1,25,000 |
| Effort target | ≤ 12 eng-days |
| Convert credit | full fee against impl within 30 days |

### Margin killers (avoid)

- Unscoped “make every Excel chart identical”  
- Endless ontology without package boundaries  
- Free pilots stacked without convert calendar  
- Cloud LLM costs without contract pass-through when forced  

---

## Sensitivity table (for internal)

| Scrap opportunity | Soft cons. | Year-1 invest 10.5L | Payback |
|-------------------|------------|---------------------|---------|
| ₹6L | ₹2L | 10.5L | ~15.8 mo (weak — cut price only with stronger case or walk) |
| ₹12L | ₹4L | 10.5L | ~7.9 mo |
| ₹20L | ₹5L | 10.5L | ~5.0 mo |

If payback &gt; 18 months even at floor pricing, **re-qualify** — maybe wrong ICP.
