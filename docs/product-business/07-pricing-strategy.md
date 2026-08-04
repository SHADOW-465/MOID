# 07 · Pricing Strategy & Price Book

**Status:** Working policy (see `17-working-policy-decisions.md`).  
**Currency:** INR · **Geo:** India year 1 · **Unit:** per plant / production site

---

## Principles

1. Price against **COPQ + engineer time + audit risk**, not against Excel = ₹0.  
2. Prefer **annual site licenses**.  
3. **Implementation is paid** — it funds success.  
4. **On-prem is premium capability**, not a discount reason.  
5. Seats are a **soft cap**, not the main meter.  
6. Protect **floor**; strategic discounts need trade (case study, multi-year, multi-site).  
7. Do not meter AI tokens early.

---

## Value anchoring

| Anchor | Working use |
|--------|-------------|
| Example scrap recovery narrative ₹12L/yr @ 25% | ROI ceiling story after baseline |
| 10–15 eng hrs/week | Soft savings; take 50% in conservative case |
| Industrial heuristic | List year-1 software often ~10–30% of hard annual opportunity; all-in year-1 often &lt; 1× conservative annual value |

**Illustrative comfort band:** If hard opportunity ≈ ₹12L and soft conservative ≈ ₹3–5L, year-1 all-in customer investment of **₹8–12L** still aims for **&lt; 12 month** payback when improvement materializes. List ACV ₹8L + impl ₹2.5L = ₹10.5L sits in that band.

---

## Price book (list)

### Software

| SKU code | Name | List | Floor | Terms |
|----------|------|------|-------|-------|
| `MOID-PLANT-Y1` | MOID Plant Annual License | **₹8,00,000** / year | **₹4,00,000** | Per plant; paid annually in advance |
| `MOID-PLANT-Y3` | MOID Plant 3-Year | **₹19,20,000** (₹6.4L/yr effective) | ₹12,00,000 total | 20% vs 3× annual; prepaid |
| `MOID-SITE-N` | Additional site | **20% off** Plant list | Floor × 0.85 | Same term as primary |
| `MOID-AIRGAP` | On-prem appliance setup | **₹3,00,000** one-time | ₹1,50,000 | Install + hardening + local LLM wiring support |

### Services

| SKU code | Name | List | Includes |
|----------|------|------|----------|
| `MOID-PILOT` | Pilot Success Package | **₹1,25,000** | 8 weeks; mapping; training; success report; software free in window |
| `MOID-IMPL-STD` | Standard Implementation | **₹2,50,000** | History load, MOD verify, entry go-live, GM+QM training (≈ up to 15 eng-days) |
| `MOID-IMPL-PLUS` | Extended Implementation | **₹4,00,000** | Multi-line / heavy history / extra on-site |
| `MOID-DAY` | Professional services day | **₹8,000** / day | Overage beyond package |
| `MOID-QBR` | Quarterly business review | **₹50,000** / quarter | Optional premium |

### Support

Included in annual Plant license:
- Business hours IST  
- 8 support hours / month  
- Severity targets per `13-delivery-and-ops.md`  
- Updates for licensed version line  

Overage support: bill `MOID-DAY` or define premium SLA in contract.

---

## Bundles (recommended quotes)

### Bundle A — Pilot then convert (default path)
1. Now: `MOID-PILOT` ₹1,25,000  
2. On success: `MOID-PLANT-Y1` ₹8,00,000 + `MOID-IMPL-STD` ₹2,50,000  
   - Credit: **₹1,25,000 pilot fee credited** against impl if convert within 30 days of pilot end → net impl ₹1,25,000  
   - Year-1 cash if convert: 8L + 1.25L = **₹9,25,000** after credit (+ appliance if needed)

### Bundle B — Fast start (committed)
- `MOID-PLANT-Y1` + `MOID-IMPL-STD` = **₹10,50,000** year-1  
- Optional `MOID-AIRGAP` +₹3,00,000  

### Bundle C — Design partner year-1
- Up to **40% off** Plant list (→ ₹4.8L) **only with** logo + case study + reference clause  
- Impl at list or 20% off  
- Must stay ≥ floor ₹4L on license  

### Bundle D — Air-gapped plant
- Bundle B + `MOID-AIRGAP` = **₹13,50,000** year-1 all-in list  

---

## Discount policy

| Situation | Max off list | Approval |
|-----------|--------------|----------|
| Normal negotiation | 10% | Seller |
| Competitive / budget | 20% | Founder |
| Design partner + rights | 40% year-1 license only | Founder + written rights |
| Multi-site | Use site table | Auto |
| Below floor | **No** | Strategic equity-only exception documented |
| Free software forever | **No** | — |
| Free pilot software | Yes inside `MOID-PILOT` window | Auto |

---

## Metering

| Meter | Policy |
|-------|--------|
| Plants / sites | Primary |
| Named users | 25 included; +25 packs at ₹40,000 / year list (soft) |
| Lines / families | Included for one primary family; second family may need IMPL-PLUS |
| AI messages | Not metered |
| Excel row counts | Not metered |
| Support hours | 8/mo included |

---

## Payment terms (working)

- Pilot: 100% on SOW signature.  
- Impl: 50% order, 50% acceptance.  
- Annual license: 100% on contract start / anniversary.  
- Net 15 (prefer) to Net 30.  
- Suspend non-S1 support after 60 days unpaid (grace for active audit S1).

---

## Competitive price framing

| They compare to | You say |
|-----------------|---------|
| Excel free | You already pay in scrap and nights |
| MES multi-crore | Wedge at single-digit–low-double-digit lakhs |
| BI licenses | We fix source truth, not only charts |
| Cheaper dashboards | Provenance + ledger + plant ontology |

---

## Quote template (text)

```
Customer: _______________  Plant: _______________
SKU: MOID Plant Annual License          ₹8,00,000
SKU: Standard Implementation            ₹2,50,000
SKU: On-prem appliance (optional)       ₹3,00,000
Discount: ____%   Reason: _______________
Total year-1: ₹_______________
Term: 12 months from go-live / signature (specify)
Users included: 25 named
Support: 8h/mo IST business hours
```

---

## Future (not year-1 default)

- USD global list  
- Module SKUs (advanced CAPA, multi-site console)  
- Perpetual + AMC  
- Usage-based AI cloud pass-through  
