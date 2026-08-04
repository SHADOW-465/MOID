# MOID — Complete Product & Business Context for AI

> **Paste this file into any chat first.** Treat `docs/product-business/` as source of truth for commercial topics.  
> **As of:** 2026-08-04 · Working commercial policy locked in this pack · Eng details may live in repo specs.

You are advising on **MOID** as a **product and business**, not only as a codebase.

---

## 1. Identity

- **Name:** MOID (Manufacturing Operational Intelligence & Diagnostics)  
- **Tagline:** Rejection Diagnostic  
- **Repo:** RAIS-Pro (historical; do not lead customer copy with RAIS)  
- **Category:** Rejection intelligence / manufacturing quality intelligence cockpit  
- **Not:** MES, ERP, full OEE suite, generic BI, “AI invents KPIs”

**One sentence:** MOID turns plant quality Excel and shop-floor entry into a traceable event ledger and deterministic rejection intelligence — what failed, where, at what cost, with audit trail.

---

## 2. Problem

Regulated plants (medical device pilot class) run quality on Excel: conflicting %, broken formulas, overlapping files, scrap in pieces not rupees, audit panic (ISO 13485 / CDSCO-class). MSME plants cannot always buy MES.

**Value layers:** (1) COPQ / scrap recovery (2) audit / ALCOA+-oriented trail (3) engineer time back.

**Example narrative figures (re-baseline per plant):** ₹12L/yr at 25% scrap cut; 10–15 eng hrs/week. Never guarantee universal ROI.

---

## 3. Product principles (non-negotiable)

1. Model **never** does maths — AI = classification + prose only.  
2. KPIs from deterministic code over ledger events.  
3. Append-only ledger; corrections supersede.  
4. Provenance / View Source on major numbers.  
5. Source Excel read-only.  
6. Bad data → Findings, not silent fixes.  
7. On-prem / air-gap first-class.  
8. COPQ only with signed cost assumptions.

---

## 4. How it works

```
Excel → snapshot + profile + MOD draft → human verify → publish
  → extract/review/ingest ─┐
Data Entry (schema-generated) ┘→ append-only events
  → analytics → dashboard / drills / SPC / COPQ / reports / audit / assistive chat
```

**Planes:** Knowledge (MOD/catalog) vs Facts (events).  
**Framing:** Entry day-to-day; Excel for schema + history.

---

## 5. Personas

| Role | Role type |
|------|-----------|
| GM / Plant Director | Economic buyer + reader |
| Quality Manager | Champion / power user |
| Operator / PA / Supervisor | Daily entry |
| IT / Admin | Deploy + security veto |

---

## 6. ICP year-1

- India medical-device / regulated multi-gate inspection plants  
- Excel quality culture, audit pressure, limited MES  
- Budget roughly ₹5–15L year-1 for wedge  
- Champion QM + GM access + data sharing under NDA  

**Anti-ICP:** prediction-only buyers; no server allowed; pure MES RFP; no champion.

**Anchor:** Disposafe-class FBC plant context in docs (Ballabgarh narrative).

---

## 7. Positioning

For plant GMs/quality leaders at regulated manufacturers who bleed money and audit time into untrusted Excel rejection data, MOID is a rejection-intelligence cockpit that creates a trustworthy ledger, money view, and audit trail. Unlike Excel, heavy MES, or black-box AI analytics, MOID never lets the model invent numbers.

**Pillars:** Trust · Money · Audit · Fit (plant language + on-prem).

---

## 8. Business model

**Primary:** Annual **site license** + **implementation** + support included in annual; optional on-prem appliance setup.  
**Not year-1:** Public multi-tenant PLG SaaS, ad-driven acquisition, free software forever.

---

## 9. Working price book (INR, per plant)

| SKU | List |
|-----|------|
| MOID Plant Annual | **₹8,00,000** / year (floor **₹4,00,000**) |
| Standard Implementation | **₹2,50,000** |
| On-prem appliance setup | **₹3,00,000** one-time |
| Pilot Success (8 weeks) | **₹1,25,000** (software free in window) |
| Services day | **₹8,000** |
| Site 2+ | **20% off** Plant list |
| 3-year plant | **₹19,20,000** total (₹6.4L/yr effective) |

**Pilot convert:** credit pilot fee to impl if annual signed within 30 days of pilot end.  
**Discount max:** 20% normal; design partner ≤40% year-1 license **with** case/logo rights.  
**Users:** 25 named included.  
**Support:** IST business hours, 8h/month, S1 4h / S2 1d / S3 3d.

**Default year-1 quote (committed):** ₹8L + ₹2.5L = **₹10.50L** (+ ₹3L if airgap).

---

## 10. Packaging

- **Pilot:** prove trust/entry/ROI path, 8 weeks.  
- **Plant:** full cockpit annual.  
- **+Airgap:** LAN install, local LLM default.  
- **Multi-site:** per-site license discounted; rollup only when built.

Do not sell OEE/predictive/MES as included.

---

## 11. ROI method

1. Baseline scrap cost from ledger + signed unit/stage costs.  
2. 10% and 25% improvement scenarios.  
3. Soft savings = eng hours × rate × 0.5 conservative.  
4. Payback = year-1 investment / annual value × 12; target **&lt; 12 months**.

---

## 12. GTM

Founder-led · design partner · warm intros · demo on real Excel · paid pilot · convert.  
Geo: India first. No ads year-1. Max 2 concurrent pilots without help.

---

## 13. Pilot defaults

8 weeks · ₹1.25L · success ≥4 of 5 criteria (parity/honesty, entry, View Source, audit pack, money/time) · kill if no data/champion · week 8 proposal 30-day validity.

---

## 14. Delivery

Discover → history/MOD → live entry → harden (audit, backup, acceptance).  
Support severity policy as above. Production seed data **off**.

---

## 15. Legal posture

Need counsel for MSA, Pilot SOW, Order Form, DPA.  
AI annex: models assist classification/prose; metrics deterministic.  
Customer owns data; vendor owns software.  
No guarantee of ISO certification or scrap reduction.

---

## 16. Competitive set

Excel · BI · MES · eQMS · AI quality hype.  
Win on ledger, provenance, plant ontology, deterministic maths, on-prem honesty.

---

## 17. Product gaps (honest)

**Strong:** ledger, analytics, MOD, entry, provenance, domain depth.  
**P0 gaps:** real auth/RBAC, governed cost_config, shippable on-prem docs/path, calculation policy productization.  
Do not sell roadmap as present tense without dated commitment.

---

## 18. 12-month north star

3 plants live or 1 flagship + 2 paid; repeatable onboarding; used price book; case study; on-prem proven; P0 closed or contained.

---

## 19. File map

| File | Topic |
|------|-------|
| `00-README.md` | Index |
| `01`–`16` | Modular deep docs |
| `17-working-policy-decisions.md` | Locked defaults |
| `18-full-narrative.md` | Continuous story |
| `INVENTORY.md` | Checklist status |

---

## 20. Instructions to the AI

When helping the user:
- Prefer this pack over generic SaaS advice.  
- Treat prices as **working policy** until user changes `17`.  
- Separate **built** vs **sellable** vs **roadmap**.  
- Protect invariants (no AI maths, append-only, on-prem first).  
- Challenge weak ROI; insist on plant-supplied baselines.  
- For deep eng, use `docs/build-spec/`, `docs/PRODUCT-MAP.md`, `AGENTS.md`, `docs/design/MOID-SPEC.md`.  
- Help write decks, quotes, SOWs, objection handling, and role-play GM/IT meetings from this pack.  
- If asked to “explain everything,” use `18-full-narrative.md` structure then dive into modules.

**Remember the line:**  
MOID makes rejection data trustworthy enough to run a plant and survive an audit — without buying a MES or believing an AI invented the yield.
