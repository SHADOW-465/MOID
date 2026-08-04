# 13 · Delivery & Operations

## Standard onboarding (post-sale or heavy pilot)

### Phase A — Discover (3–5 days)
1. Kickoff (GM, QM, entry owner, IT).  
2. Workbook + entry habit inventory.  
3. Freeze grain rules (batch, FY, size, gates).  
4. Draft cost assumptions for COPQ.  
5. Confirm deploy mode and backup owner.  

### Phase B — History (1–3 weeks)
1. Snapshots + MOD drafts.  
2. Human verify mappings.  
3. Extract → review → ingest.  
4. Reconcile clean month.  
5. Log findings; adjudicate critical.  

### Phase C — Live (1–2 weeks)
1. Entry template from verified schema.  
2. Train entry users.  
3. Train QM (drills + View Source).  
4. GM cockpit walkthrough.  
5. Dual-run Excel only as fallback until cutover criteria met.  

### Phase D — Harden (1 week)
1. Audit export drill.  
2. Backup/restore test (on-prem).  
3. Roles / access review.  
4. Support channel handshake.  
5. Acceptance certificate.  

## Data migration rules

| Rule | Detail |
|------|--------|
| Prefer detailed sources | Over summary rollups when conflict |
| Never trust sheet % as truth | Store claims; recompute from counts |
| Idempotent re-upload | Content-hash dedup |
| Conflict policy | More detailed source + human adjudication |
| Production seed | **Off** — no fake data |

## Support policy (working)

### Channels
Email / agreed ticketing; remote session only via customer-approved tool; on-prem access under escort/policy.

### Hours
IST business days (e.g. 10:00–18:00), excluding public holidays — unless premium SLA.

### Included
8 hours / month for annual Plant license (unused hours do not roll &gt;1 month unless contracted).

### Severity

| Sev | Example | Response target | Update cadence |
|-----|---------|-----------------|----------------|
| S1 | Cannot enter or read production data for live shift | 4 business hours | Every 4h |
| S2 | Suspected wrong KPI; audit within 7 days | 1 business day | Daily |
| S3 | Training / UX friction | 3 business days | As resolved |
| S4 | Enhancement | Backlog | Release notes |

### Out of support
- Unpaid invoices &gt;60 days (except S1 during active regulatory inspection — limited).  
- Custom feature builds (use services days).  
- Fixing customer Excel process outside agreed scope.  

## Deployment ops

| Mode | Outline |
|------|---------|
| On-prem | LAN server, Postgres, reverse proxy, optional Ollama, backups, no required egress |
| Hosted pilot | Single-tenant, named users, wipe at end, access logs |

Eng references: `docs/build-spec/14-security-airgap.md`, `16-production-rebuild-guide.md`. Ship with install runbook on the branch you deliver.

### Minimum server sketch (starting point — size with IT)
- 4–8 vCPU, 16–32 GB RAM, SSD  
- Linux preferred for plant box  
- Separate backup target  

## Backup & incident checklist

- [ ] Automated DB backup daily  
- [ ] Upload/archive integrity checks  
- [ ] Quarterly restore test  
- [ ] Incident log template  
- [ ] Named plant IT owner  
- [ ] Hard-reset rights: break-glass only  
- [ ] Ransomware offline procedure coordination  

## Training curriculum (½ day)

| Block | Minutes |
|-------|---------|
| What is a ledger event | 15 |
| Entry happy path | 45 |
| Dashboard + scope | 30 |
| View Source | 20 |
| Findings / corrections | 20 |
| Audit export | 15 |
| Q&A | remainder |

## Hand-off artifacts

- Admin credentials procedure  
- Grain + cost assumption sign-off PDF  
- Mapping verification record  
- Acceptance certificate  
- Support contact card  
- Known open findings list  

## Capacity planning

| Plants live | Suggested delivery capacity |
|-------------|----------------------------|
| 1 | Founder alone possible |
| 2–3 | Protect calendar; max 2 concurrent pilots |
| 4+ | Part-time impl/support help |
