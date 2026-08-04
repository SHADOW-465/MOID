# MOID — Product & Business Pack (Complete)

**Product:** MOID (Manufacturing Operational Intelligence & Diagnostics)  
**Repo:** RAIS-Pro · **UI brand:** MOID · **Tagline:** Rejection Diagnostic  
**Pack status:** Working commercial source of truth (2026-08-04)  
**Audience:** Founders, sales, implementers, counsel, and any AI chat briefed on this folder

---

## What this folder is

Everything required to understand, sell, price, pilot, deliver, and productize MOID as a real B2B plant product — not only as engineering.

## How to brief an AI chat

1. Paste **`CONTEXT-FOR-AI.md`** first (full brain dump).  
2. Optionally attach the whole `docs/product-business/` folder.  
3. Prompt: *“Operate as my product + GTM advisor for MOID. Use only this pack. Pricing is working policy unless I change it.”*

## File map

| File | Contents |
|------|----------|
| [CONTEXT-FOR-AI.md](CONTEXT-FOR-AI.md) | Single-file full context for chats |
| [INVENTORY.md](INVENTORY.md) | Master checklist + status |
| [01-product-definition.md](01-product-definition.md) | What MOID is / is not |
| [02-problem-and-value.md](02-problem-and-value.md) | JTBD, value pyramid, ROI story |
| [03-icp-and-buyers.md](03-icp-and-buyers.md) | ICP, anti-ICP, buying committee |
| [04-positioning-and-messaging.md](04-positioning-and-messaging.md) | Category, pillars, pitches, tone |
| [05-competitive-landscape.md](05-competitive-landscape.md) | Alternatives + battlecard |
| [06-business-model.md](06-business-model.md) | How money works |
| [07-pricing-strategy.md](07-pricing-strategy.md) | Price book, floors, discounts |
| [08-packaging-and-skus.md](08-packaging-and-skus.md) | Feature matrix by SKU |
| [09-roi-and-economics.md](09-roi-and-economics.md) | ROI calculator + unit economics |
| [10-go-to-market.md](10-go-to-market.md) | Channels, funnel, year plan |
| [11-sales-assets.md](11-sales-assets.md) | One-pager, deck, demo, FAQ, emails |
| [12-pilot-playbook.md](12-pilot-playbook.md) | 8-week pilot SOW + convert |
| [13-delivery-and-ops.md](13-delivery-and-ops.md) | Onboarding, support, backup |
| [14-legal-compliance-checklist.md](14-legal-compliance-checklist.md) | Contracts + draft clauses |
| [15-roadmap-and-product-gaps.md](15-roadmap-and-product-gaps.md) | Built vs sellable vs later |
| [16-twelve-month-plan.md](16-twelve-month-plan.md) | Q1–Q4 operating plan |
| [17-working-policy-decisions.md](17-working-policy-decisions.md) | Locked working defaults |
| [18-full-narrative.md](18-full-narrative.md) | End-to-end product+business story |

## Working commercial defaults (summary)

- **Model:** On-prem / private plant license + implementation + annual support (not PLG SaaS).  
- **Primary SKU:** MOID Plant — **₹8,00,000 / year** list (floor ₹4,00,000).  
- **Impl package:** **₹2,50,000** standard.  
- **Pilot:** 8 weeks, services **₹1,25,000**, software free during pilot only.  
- **Brand in market:** **MOID**.  
- **First GTM:** Design partner (Disposafe-class) → founder-led India med-device plants.

Details and change log: `17-working-policy-decisions.md`.

## Engineering truth (do not contradict)

- Model **never** does maths. KPIs from `src/lib/analytics/*` only.  
- Append-only ledger; provenance required.  
- MOD is the Excel understanding path.  
- Production intent: air-gapped / on-prem first.  
- Specs: `docs/design/MOID-SPEC.md`, `docs/build-spec/*`, `docs/PRODUCT-MAP.md`, `AGENTS.md`.
