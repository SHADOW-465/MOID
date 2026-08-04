# 02 · Problem & Value

## Jobs to be done

| Who | Job statement | Trigger |
|-----|---------------|---------|
| GM | When scrap or audit pressure rises, I need one trustworthy picture of rejection and money so I can decide actions this month | Monthly review, spike week, board ask |
| QM | When rates move, I need stage/defect/size evidence and a trail so I can fix process and defend numbers | Daily/weekly quality meeting |
| Operator / PA | When the shift ends, I need to record counts in familiar columns without fighting formulas | End of shift / week |
| IT / security | When software touches plant data, I need on-prem and no uncontrolled egress | Vendor evaluation |
| Auditor (indirect) | When inspected, plant must produce integrity evidence quickly | Inspection notice |

## Problem layers

### Executive
- Scrap tracked in **pieces**, not **rupees** → COPQ invisible on the P&L conversation.  
- ISO 13485 / CDSCO-style audits turn into weeks of file archaeology.  
- Full MES is too costly/complex for many MSME plants → Excel forever.

### Managerial
- Incentive to under-report or misclassify scrap.  
- Mass-balance and defect-sum errors go undetected.  
- Root cause stays opinion without structured history.

### Process (Disposafe FBC narrative — example, not universal)
- Visual Inspection historically high scrap (~8.1%).  
- Valve Integrity high hold (~9.1%).  
- Rolled throughput yield ~79% → large cumulative loss/rework.

### Spreadsheet pathologies
- Negative rejections, blank critical columns, unexplained spikes.  
- Totals that **sum percentages** instead of recomputing from counts.  
- External links and formula claims treated as truth.  
- Multiple overlapping files double-count if naively charted.

## Value pyramid

```
              REGULATORY SHIELD
         Audit pack · ALCOA+-oriented trail · findings
        ────────────────────────────────────────────
              FINANCIAL RECOVERY
           COPQ visibility · scrap reduction leverage
        ────────────────────────────────────────────
              OPERATIONAL LEVERAGE
        Shared truth · fewer engineer hours on charts
```

## Quantified value (how to talk about numbers)

### From Disposafe problem docs (hypothesis, re-validate per plant)

| Claim | Figure | Use in sales |
|-------|--------|--------------|
| Scrap recovery at 25% improvement | **₹12 lakhs / year** (example plant narrative) | Upper-bound story only after baseline |
| Engineer time returned | **10–15 hours / week** | Soft savings; discount 50% in conservative ROI |
| Audit prep | Weeks → hours | Risk narrative + timed drill in pilot |

**Rule:** Never present ₹12L as a guarantee. Present as: *“If your scrap economics look like this class of plant, and you achieve X% reduction, value is Y — we will baseline your ledger in pilot.”*

## Value by persona

| Persona | Primary value | Proof in product |
|---------|---------------|------------------|
| GM | Clarity + money + monthly pack | Dashboard, COPQ, reports |
| QM | Drill + evidence + less archaeology | Analyses, View Source, findings, audit ZIP |
| Operator | Familiar columns, less re-key pain | Generated Data Entry |
| IT | Contained deploy, no mystery AI egress | On-prem + local LLM path |

## Why buy now (urgency)

- Regulatory scrutiny is structural, not a fad.  
- Scrap inflation and material costs make COPQ material.  
- AI hype made buyers distrust “smart dashboards” — MOID’s **anti-hallucination architecture** is timely.  
- Switching to full MES remains multi-year; this wedge can pay this year.

## Why not “just hire someone for Excel”

- People leave; files fork; formulas rot; audits need system evidence.  
- Multi-user concurrent truth and tamper-evident history are software problems.

## Value props (canonical lines)

1. **Trust:** Rejection % becomes a ledger fact with source, not a spreadsheet claim.  
2. **Money:** Progressive COPQ turns scrap into rupees leadership can act on.  
3. **Audit:** One-click package with integrity hashes.  
4. **Fit:** Plant’s own stages, defects, and column names.  
5. **Honesty:** AI never authors the KPI.
