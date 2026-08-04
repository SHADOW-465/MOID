# 15 · Roadmap & Product Gaps

## Already strong (sell the spine)

- Append-only event ledger + hashing / dedup philosophy  
- Deterministic analytics (`src/lib/analytics/*`)  
- MOD / Excel understanding (`src/core/*`)  
- Data Entry + staging concepts  
- View Source / provenance UX  
- Audit package direction  
- Domain depth from medical-device pilot  
- Personas at UI level  

## P0 gaps before confident multi-customer sell

| Gap | Commercial impact | Mitigation if selling now |
|-----|-------------------|---------------------------|
| Real **auth + RBAC + RLS** | GM asked; multi-user trust | Restrict users; network trust; roadmap in SOW |
| **Governed cost_config** | COPQ integrity | Written cost sign-off; careful demos |
| **On-prem path documented on ship branch** | Security story | Bundle appliance services; fixed environment |
| **Calculation policy** explicit in product | Number fights | Grain contract + dual method display |
| Support process | Founder burnout | This pack’s severity policy |

## P1 gaps (second plant)

- Batch-first analytics/UI completion (grain P0 historically)  
- Faster MOD verify UX  
- Health checks / diagnostics for support  
- End-user short manuals  
- Clean single-tenant packaging  

## P2+ (expansion)

- Multi-site rollup admin  
- License key / source protection tiers  
- Advanced CAPA suite  
- Deep SOP intelligence  
- OEE / WIP only with real data commitments  
- Predictive features (careful, never for core KPIs)  

## Roadmap themes

### Now — Productize pilot
Auth, cost governance, deploy docs, calculation policy, entry polish, commercial pack live.

### Next — Repeatable plant #2–3
Onboarding templates, support tooling, reduced impl days, case study.

### Later — Platform
Multi-site, modules, partners, appliance image hardening.

### Non-goals (near term)
Replace ERP; headline predictive quality; public freemium SaaS.

## GM review map (27.06.26)

| # | Request | Posture |
|---|---------|---------|
| 1 | Quantity on graphs | Addressable in product |
| 2 | Defect & size split | Core analyses |
| 3 | Stage-wise trends | Core |
| 4 | UX hierarchy | Ongoing |
| 5 | Auto data update | Partial; not full realtime |
| 6 | Authority rights | **Gap — harden** |
| 7 | Standardize sheets | Entry + MOD + process change |
| 8 | Rejection vs cost | COPQ exists; govern costs |
| 9 | Multi-sheet integrity + audit | Ledger + findings + audit ZIP |

## Invariants (never break for roadmap glitter)

1. Model never does maths.  
2. Append-only ledger.  
3. MOD path for Excel understanding.  
4. Catalog outlives workbooks.  
5. Entry generated from schema where productized.  
6. Provenance on major numbers.  

## Sales–eng alignment rule

If a feature is **target/later** in the SKU matrix, it may appear on roadmap slides but **must not** be in “included today” contract language without a dated commitment.
