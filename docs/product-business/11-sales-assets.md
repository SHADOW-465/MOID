# 11 · Sales Assets (Full Copy)

Use as-is for drafts; design into PDF/slides when ready.

---

## A. One-pager copy

### Headline
**MOID — Trust your rejection numbers. Recover scrap. Pass audits.**

### Subhead
Rejection intelligence for regulated plants. Ledger-backed. Source-traceable. AI that never invents maths.

### Body
Plants already capture quality in Excel — and still fight over percentages, lose days to audit prep, and track scrap in pieces instead of rupees. MOID maps your sheets once, runs daily entry in your plant’s own column names, and computes every KPI in deterministic code over an append-only ledger. Every major figure can show its source. Deploy on your LAN when data cannot leave the factory.

### Three pillars
1. **See** — Stage, defect, size, trend, COPQ.  
2. **Trust** — Append-only ledger, View Source, findings not silent fixes.  
3. **Prove** — Audit package with hash manifest; on-prem ready.

### Proof
Deterministic analytics · plant schema learning (MOD) · medical-device pilot depth · progressive COPQ · ALCOA+-oriented export.

### CTA
**Book a 45-minute data review.** Bring one messy workbook. Leave with a pilot plan.

### Footer
MOID · Rejection Diagnostic · Annual plant license from ₹8L list · 8-week pilot package available.

---

## B. Pitch deck (12 slides) — speaker notes included

**1. Title**  
MOID · Rejection Diagnostic · Trustworthy quality intelligence for regulated plants.

**2. Problem**  
Excel chaos: formula claims, overlapping files, audit panic, scrap invisible as money.

**3. Cost of the status quo**  
Engineer hours + scrap + regulatory risk. (Insert their numbers when known.)

**4. Why MES isn’t the only answer**  
MES is multi-year/multi-crore. You need a quality wedge this half.

**5. Solution**  
MOID: Excel + entry → verified schema → ledger → cockpit.

**6. How it works**  
Five steps: snapshot → verify MOD → commit events → analytics → audit/chat.

**7. Trust architecture**  
Model never does maths · provenance · append-only · on-prem path.

**8. Product tour screenshots**  
Dashboard · View Source · Data Entry · COPQ · Audit export.

**9. ROI framework**  
Baseline → opportunity cases → payback; example only if labeled.

**10. Security**  
LAN deploy, local LLM default, scrubbed optional cloud, customer-owned data.

**11. Packaging**  
Pilot ₹1.25L · Plant ₹8L/yr · Impl ₹2.5L · Airgap +₹3L.

**12. Ask**  
8-week pilot with success criteria → convert to annual.

---

## C. Demo script (30 minutes)

| Min | Block | Do / Say |
|-----|-------|----------|
| 0–3 | Frame | “We are here to make numbers defensible — not to show AI magic.” |
| 3–8 | Pain | Open their sheet; point at % claim vs raw checked/rejected if possible. |
| 8–14 | MOD | Upload/snapshot → mapping verify → human control. |
| 14–18 | Dashboard | Scope filters; headline KPI; method honesty. |
| 18–22 | View Source | Click KPI → provenance. |
| 22–25 | Entry | Show plant column names on grid. |
| 25–28 | Money or audit | COPQ with labeled assumptions **or** audit ZIP. |
| 28–30 | Close | Pilot criteria sheet + next meeting date. |

**Demo fails if:** AI invents a number; provenance skipped; you promise MES scope.

### 15-minute version
Pain (3) → View Source (4) → Entry (3) → Audit/COPQ (3) → Ask (2).

### 60-minute version
Add findings adjudication, stage drill, security Q&A, ROI worksheet live.

---

## D. Case study template

```markdown
# Case study — [Plant or anonymized]

## Customer
Industry · Location · Size · Compliance context

## Challenge
Excel / scrap / audit pain in their words

## What we deployed
MOID Plant · deploy mode · stages in scope · months of history

## Approach
MOD mapping · entry go-live · training · baseline month

## Results (quantified only if real)
- KPI trust / parity outcome
- Time saved
- COPQ visibility
- Audit pack usage

## Quote
GM or QM

## Why it worked
Champion · data access · scoped wedge
```

---

## E. Security one-pager (IT)

**Title:** MOID Security & Deployment Posture  

**Summary:** MOID is designed for regulated plants that treat batch and process data as sensitive. Production posture prefers on-premises deployment on the plant LAN with optional fully local AI.

**Controls (product intent):**
- Source workbooks archived read-only; application does not edit originals.  
- Append-only event ledger with content hashing; corrections supersede.  
- Provenance binds KPIs to source cells or direct-entry records.  
- Audit export with SHA-256 manifest (ALCOA+-oriented).  
- AI limited to classification and prose; quantitative metrics from application code.  
- Local LLM mode for zero-egress AI; optional cloud only with de-identification and allowlisted egress when policy permits.  
- Role model: GM / Quality / Supervisor / Operator (enterprise auth/RLS on product roadmap/hardening path).  
- Customer owns plant data; vendor access only under support instruction.

**Questions for IT workshop:** server specs, backup, IdP, outbound policy, maintenance window.

---

## F. FAQ / objections (full)

| Objection | Answer |
|-----------|--------|
| We already use Excel | Excel remains an input for history. MOID is the system of record for quality events and trusted KPIs. |
| Will AI hallucinate KPIs? | Architecturally forbidden. Analytics are deterministic code; models classify and explain only. |
| We need full MES | Start with rejection intelligence. MES is a separate multi-year program. |
| Data cannot leave the plant | On-prem + local LLM is the primary product path. |
| Implementation takes forever | Packaged pilot is 8 weeks with written success criteria. |
| Prove ROI | We baseline in pilot with your cost assumptions and write a payback letter. |
| Our sheets are unique | MOD learns schema; humans verify; entry uses your names. |
| Price vs free Excel | You already pay in scrap, rework, engineer time, and audit risk. |
| Integrate SAP? | Not required for V1 wedge; exports and audit pack first. |
| Who enters data? | Operators/PA daily; QM governs; GM reads. |
| What if numbers disagree with YEARLY sheet? | We recompute from counts; sheet % may be a claim — we surface both and document method. |
| Can we try free? | Pilot package is the trial: paid services, software free in window, convert credit. |
| Multi-plant? | Price per site with multi-site discount; rollup features as they ship. |
| Hindi? | UI English; operator-facing labels can include Hindi where configured. |

---

## G. Email templates

### Intro
**Subject:** Rejection numbers you can defend in an audit  

Plants like yours already log quality in Excel — and still lose time reconciling percentages and preparing audits. MOID builds an append-only ledger from your sheets and daily entry, shows scrap in rupees, and traces every major KPI to its source. The model is not allowed to invent the maths.  

If you share one month’s rejection workbook under NDA, we can show what an 8-week pilot would prove in 45 minutes.

### After demo
**Subject:** Pilot plan — [Plant name]  

Thanks for the session. Attached: draft success criteria and pilot SOW (8 weeks, ₹1,25,000 services; software included in window). On convert within 30 days, pilot fee credits implementation. Proposed kickoff week of ____.

### Convert
**Subject:** MOID Plant proposal — [Plant]  

Pilot success criteria met: [bullets]. Proposal: MOID Plant Annual ₹8,00,000 + Implementation (net of pilot credit) + optional on-prem setup. Valid 30 days. Happy to walk finance/IT through security and ROI letter.

---

## H. Call script (discovery — 30m)

1. How do you know rejection this month is “true”?  
2. Which stages matter most?  
3. Where does data live (files, people)?  
4. Last audit pain story?  
5. Do you see scrap in rupees today?  
6. Who would enter data daily?  
7. Cloud vs on-prem constraint?  
8. Timeline and budget owner?  
9. Book demo / NDA for sample files.
