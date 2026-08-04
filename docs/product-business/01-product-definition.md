# 01 · Product Definition

## Identity

| Field | Value |
|-------|--------|
| Market name | **MOID** |
| Long form | Manufacturing Operational Intelligence & Diagnostics |
| Tagline | Rejection Diagnostic |
| Repo / history | RAIS-Pro / RAIS (do not lead sales with this) |
| Version framing | Plant product (post-PoC packaging) |

## One sentence

**MOID** turns plant quality Excel and shop-floor data entry into a **traceable event ledger** and **deterministic rejection intelligence** so GMs and quality teams know what failed, where, at what cost, with an audit trail spreadsheets cannot provide.

## Category

**Primary:** Manufacturing quality intelligence / rejection-intelligence cockpit  
**Secondary:** Audit-ready quality data system of record (for rejection events)

**Not:** MES · ERP · full OEE platform · generic BI · “AI invents yield” tool · document-only eQMS

## Problem MOID owns

Untrusted, fragmented rejection/quality counts in Excel → no single truth, no money view, weak audit evidence, slow root-cause conversations.

## Solution shape

```
Excel (history) + Data Entry (daily)
        ↓
 verified plant schema (MOD + catalog)
        ↓
 append-only event ledger (facts)
        ↓
 deterministic analytics + provenance
        ↓
 dashboard · drills · COPQ · reports · audit pack · assistive AI prose
```

## Product principles (contract with the customer)

1. **The model never does maths.** AI may classify columns and write explanations. Every KPI is deterministic application code.  
2. **Ledger is append-only.** Corrections supersede; nothing silent-rewrites history.  
3. **Provenance is mandatory.** Major numbers can be traced to file/sheet/cell or direct-entry record.  
4. **Source Excel is read-only.** MOID never edits client workbooks.  
5. **Bad data becomes Findings**, not silent “auto-fixes.”  
6. **Plant schema is learned and human-verified**, not permanently hardcoded for one factory only.  
7. **On-prem / air-gap is first-class.** Cloud is optional and constrained.  
8. **COPQ appears only with signed cost assumptions.**

## V1 commercial wedge (what you sell)

| Included | Explicitly out of wedge |
|----------|-------------------------|
| Rejection / hold / rework visibility by stage, defect, size, period | Full production scheduling |
| Excel → MOD verify → history load | Predictive quality SLA |
| Schema-driven data entry | Full MES / machine PLC integration |
| Dashboard, Pareto, size, stage, SPC | Company-wide ERP replacement |
| COPQ when costs configured | Guaranteed ISO certification |
| Findings + basic CAPA hooks | Unlimited custom BI recreation of every legacy chart |
| Audit ZIP + hash manifest | Multi-plant SaaS console (later SKU) |
| Optional Ask MOID narrative over real numbers | AI-authored KPIs |

## Personas (product)

| Persona | Job in product |
|---------|----------------|
| GM / Plant Director | Read trustable headline, money, monthly review |
| Quality Manager | Drill, adjudicate findings, CAPA, audit prep |
| Supervisor / Operator / PA | Enter data, bulk import, simple corrections |
| Admin / IT | Deploy, roles, backup, network policy |

## PoC vs sold product

| | Engineering PoC | Sold product |
|--|-----------------|--------------|
| Default host | Cloud-friendly stack | **On-prem LAN preferred** |
| Auth | Persona chrome | Real roles + access control |
| AI | MiniCPM + Groq chain possible | Local LLM default; scrubbed cloud optional |
| Empty state | Honest empty | No fake demo seed in production |
| Success | Demo works | Daily use + paid annual |

## Success bar (quality of product)

- Clean agreed month matches ground truth within tolerance, **or** method differences are explicit (sheet claim vs recomputed).  
- Doubling ledger events does not change KPIs.  
- View Source works on major KPIs.  
- Audit package exports with integrity manifest.  
- Operators can enter without inventing a parallel spreadsheet for in-scope gates.

## Related engineering sources

- `docs/design/MOID-SPEC.md`  
- `docs/build-spec/01-product-overview.md` and siblings  
- `docs/PRODUCT-MAP.md`  
- `src/lib/brand.ts`  
- `AGENTS.md`
