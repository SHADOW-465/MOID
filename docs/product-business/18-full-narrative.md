# 18 · Full Product & Business Narrative

*Read this as the continuous story of MOID as a company product — not as code.*

---

## Origin

MOID exists because regulated manufacturing plants — especially medical-device lines like Foley catheter dipping and assembly — already “have data” in Excel and still cannot trust it. Rejection percentages disagree across weekly and yearly sheets. Formulas sum rates that should never be summed. Overlapping files double-count. The GM sees a red number and cannot see which stage, defect, or size produced it, or what it costs in rupees. When an ISO 13485 or CDSCO-style inspection appears, quality engineers lose weeks reconstructing trails that spreadsheets never really had.

The product was forged against a real plant context (Disposafe-class FBC operations): multi-stage inspection, size-wise and monthly workbooks, batch language, progressive scrap cost, and a buyer who is the GM. The engineering response was not “another dashboard.” It was a **system of record for quality events** with non-negotiable trust rules.

---

## What MOID is

MOID (Manufacturing Operational Intelligence & Diagnostics) is a **rejection-intelligence cockpit**. It:

1. **Learns** plant Excel structure through a Mapping Ontology Document (MOD) that humans verify.  
2. **Commits** observations to an **append-only event ledger** (from Excel extract or direct Data Entry).  
3. **Computes** every KPI in deterministic code — rejection, defect Pareto, size concentration, SPC, COPQ.  
4. **Explains** with provenance (View Source) and optional AI **prose** that is forbidden from inventing maths.  
5. **Exports** audit-oriented packages with integrity hashes.

The UI brand is **MOID**; the repository still carries the historical name RAIS-Pro.

---

## What MOID is not

It is not a full MES, ERP, or OEE suite. It is not a promise that AI will predict defects and run the plant. It is not a generic BI layer that assumes a clean warehouse. Selling those fantasies destroys the wedge and the trust architecture.

---

## Principles that define the brand

- The model never does maths.  
- The ledger is append-only and content-addressed.  
- Bad data becomes Findings, not silent fixes.  
- Source Excel is read-only.  
- Plant schema is learned and verified, not permanently hardcoded as the only world.  
- On-prem / air-gap is first-class because plant data is sensitive.  
- COPQ appears only with signed cost assumptions.

These are product ethics and sales ethics. If a feature request breaks them, the answer is no.

---

## Who buys and who uses

The **economic buyer** is the GM / plant director. The **champion** is usually the quality head. **Operators or PAs** enter data. **IT** can veto on security grounds — so the story leads with LAN deployment and local AI, not cloud convenience.

Ideal year-1 customers are Indian medical-device (and similar regulated) plants with multi-gate inspection, Excel chaos, audit pressure, and budget to spend high single-digit to low double-digit lakhs for a quality wedge that pays back inside a year of scrap and time savings.

Anti-customers want prediction theater, free forever customization, or a full digital-factory RFP with no champion.

---

## Why money exists

Value stacks in three layers:

1. **Financial recovery** — scrap seen as progressive rupees (COPQ), enabling focused reduction.  
2. **Regulatory shield** — trails and audit packs that reduce panic and non-compliance risk.  
3. **Operational leverage** — engineer hours returned from chart compilation and file chasing.

A problem document example cites roughly **₹12 lakhs/year** at 25% scrap improvement for a narrative plant and **10–15 engineer hours/week**. Those figures are **hypotheses to re-baseline**, not guarantees. The commercial motion is: pilot baselines truth → ROI letter → annual license.

---

## How the business makes money

MOID is sold as **B2B plant software**, not consumer SaaS:

- **Annual plant license** (list **₹8,00,000** / year, floor ₹4L).  
- **Implementation package** (list **₹2,50,000**) because ontology and history load are the job.  
- **On-prem appliance setup** (list **₹3,00,000**) when air-gap is real.  
- **Pilot package** (**₹1,25,000**, 8 weeks) with software free only in-window and fee credited to impl on convert.  
- Multi-site at **20% off** incremental sites.  
- Overage services at **₹8,000** / eng-day.

This model matches reality: high-touch early, security-sensitive deploy, incomplete multi-tenant SaaS, founder-led sales.

---

## Go-to-market

Year 1 is not product-led growth. It is:

1. Design-partner path (depth + reference).  
2. Warm intros into med-device plants.  
3. Demo on real messy Excel.  
4. Paid pilot with kill criteria.  
5. Convert to annual.  
6. Productize onboarding until plant #2 is boring.

No ads, no freemium, no “AI MES” positioning.

---

## Competitive position

Excel is the incumbent. BI tools fail on messy multi-file truth. MES is the heavy alternative. eQMS owns documents more than live scrap economics. AI quality vendors often cannot explain numbers. MOID wins on **ledger + provenance + plant ontology + deterministic maths + on-prem honesty**.

---

## Packaging in plain language

- **Pilot:** Prove it in 8 weeks.  
- **Plant:** Run the quality cockpit for a year.  
- **Airgap:** Install it so data never needs the internet.  
- **Multi-site:** Repeat per plant with a discount — rollup features only when built.

---

## Delivery

A standard plant is discover → history/MOD → live entry → harden (audit, backup, acceptance). Support is severity-based in IST business hours with a monthly hour band. The company does not pretend unlimited WhatsApp is a strategy.

---

## Legal and trust

Customers own plant data. Vendor owns software. AI is disclosed as non-authoritative for numbers. Claims about audits are “supports readiness,” not “guarantees certification.” Counsel must turn the checklists into MSA, pilot SOW, and order forms before scale.

---

## What still must be built to feel “product”

Engineering is strong on the spine (ledger, analytics, MOD, entry, provenance). Commercial multi-customer readiness still needs real auth/RBAC, governed cost configuration, shippable on-prem docs/path, and calculation-policy productization — plus the discipline of not selling roadmap as present tense.

---

## Twelve-month ambition

By month 12: multiple plants live or one flagship plus two paid, repeatable installs, used price book, one case study, on-prem proven, P0 gaps closed or contained. That is the line between a brilliant pilot codebase and a company.

---

## The sentence to remember

**MOID makes rejection data trustworthy enough to run a plant and survive an audit — without buying a MES or believing an AI invented the yield.**

Everything in this folder exists to make that sentence true in product, price, and delivery.
