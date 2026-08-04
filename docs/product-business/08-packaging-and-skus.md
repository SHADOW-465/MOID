# 08 · Packaging & SKUs

## Ladder

```
MOID Pilot → MOID Plant → Plant + Airgap → Multi-site
                    ↘ services packages ↗
```

## SKU definitions

### MOID Pilot
Time-boxed **8-week** engagement to prove trust, entry, and ROI path.  
Software license is **not** perpetual; runs for pilot window only.  
Deliverable: success report + commercial recommendation.

### MOID Plant
Annual license for **one plant**: daily quality operations on MOID — entry and/or import, trusted KPIs, drills, COPQ (if costs signed), audit export, support band included.

### MOID Plant + Airgap
Plant license plus **on-prem appliance setup**: LAN deploy, local DB, local LLM default, egress-off posture, IT handover.

### Multi-site
Same Plant capabilities per additional site; **20% off** list; optional future rollup features as they ship (do not oversell rollup before built).

---

## Feature matrix

| Capability | Pilot | Plant | +Airgap | Multi-site |
|------------|:----:|:-----:|:-------:|:----------:|
| Dashboard / factory overview | ✓ | ✓ | ✓ | ✓ |
| Stage / size / defect analysis | ✓ | ✓ | ✓ | ✓ |
| SPC | ○ | ✓ | ✓ | ✓ |
| COPQ (signed costs) | ○ | ✓ | ✓ | ✓ |
| Data Entry (batch + period) | ✓ | ✓ | ✓ | ✓ |
| Excel MOD import + verify | ✓ | ✓ | ✓ | ✓ |
| Staging → ledger commit | ✓ | ✓ | ✓ | ✓ |
| View Source / provenance | ✓ | ✓ | ✓ | ✓ |
| Audit ZIP + manifest | limited | ✓ | ✓ | ✓ |
| Reports / monthly pack | ○ | ✓ | ✓ | ✓ |
| CAPA basic | ○ | ✓ | ✓ | ✓ |
| Ask MOID chat | ○ | ✓ | ✓ | ✓ |
| Schema / catalog admin | limited | ✓ | ✓ | ✓ |
| Named users (25) | limited seats | ✓ | ✓ | ✓ per site |
| Real auth / RBAC | stub→target | target→req | required | required |
| Cloud AI | demo possible | optional | off default | policy |
| Local LLM only | — | optional | default | default |
| On-prem install support | — | add-on | included | included |
| Multi-plant rollup admin | — | — | — | roadmap |
| License key / source protection | — | later | later | later |
| Custom SLA | — | ○ | ✓ | ✓ |

○ = optional/partial in package · target = product intent in flight · later = roadmap

---

## Explicit exclusions (all SKUs unless contracted)

- Full MES / scheduling / inventory control  
- PLC / machine telemetry integration  
- Guaranteed scrap % reduction  
- Unlimited custom chart recreation  
- Public multi-tenant SaaS tenancy  
- Predictive quality SLA  

---

## Add-ons

| Add-on | When |
|--------|------|
| Extended history archaeology | &gt;12 months messy multi-root folders |
| Second product family ontology | New line with different stages/defects |
| SOP indexing pack | Defect ↔ SOP deep links |
| On-site training day | Beyond remote package |
| Premium 24×5 / audit-season cover | Contracted SLA |

---

## Contract naming

- `MOID Plant Annual License — Single Site`  
- `MOID Implementation Package — Standard`  
- `MOID Pilot Success Package — 8 Week`  
- `MOID On-Prem Appliance Deployment`  
- `MOID Additional Site Annual License`

## Packaging rules for sellers

1. Never sell Pilot without success criteria (see pilot playbook).  
2. Never sell Plant without naming deploy mode (on-prem vs temporary host).  
3. Never enable COPQ in demos as “truth” without saying assumptions are illustrative until signed.  
4. Do not promise multi-site rollup dashboard until shipped — sell per-site truth first.
