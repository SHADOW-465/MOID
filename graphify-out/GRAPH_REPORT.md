# Graph Report - .  (2026-08-14)

## Corpus Check
- Large corpus: 603 files · ~7,288,604 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 1840 nodes · 3534 edges · 134 communities (120 shown, 14 thin omitted)
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 528 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Chat Entry Drafting|Chat Entry Drafting]]
- [[_COMMUNITY_Audit Session Filters|Audit Session Filters]]
- [[_COMMUNITY_Entry Package Export|Entry Package Export]]
- [[_COMMUNITY_Chat Decision Engine|Chat Decision Engine]]
- [[_COMMUNITY_Source Trace Grouping|Source Trace Grouping]]
- [[_COMMUNITY_Event Canonicalization|Event Canonicalization]]
- [[_COMMUNITY_Ledger Hash Memory|Ledger Hash Memory]]
- [[_COMMUNITY_Intent Date Phrases|Intent Date Phrases]]
- [[_COMMUNITY_MOD Knowledge Plane|MOD Knowledge Plane]]
- [[_COMMUNITY_Auth Session Config|Auth Session Config]]
- [[_COMMUNITY_Report Block Presets|Report Block Presets]]
- [[_COMMUNITY_CAPA Composer Flow|CAPA Composer Flow]]
- [[_COMMUNITY_Workbook Header Profiling|Workbook Header Profiling]]
- [[_COMMUNITY_Inline SVG Charts|Inline SVG Charts]]
- [[_COMMUNITY_Analytics Scope Filters|Analytics Scope Filters]]
- [[_COMMUNITY_Catalog Store Merge|Catalog Store Merge]]
- [[_COMMUNITY_Batch Matrix Entry|Batch Matrix Entry]]
- [[_COMMUNITY_Persona Capabilities|Persona Capabilities]]
- [[_COMMUNITY_Staging Review Edits|Staging Review Edits]]
- [[_COMMUNITY_Calculation Policy Store|Calculation Policy Store]]
- [[_COMMUNITY_Company Catalog Diff|Company Catalog Diff]]
- [[_COMMUNITY_Rejection Rate Maths|Rejection Rate Maths]]
- [[_COMMUNITY_Dashboard Event Context|Dashboard Event Context]]
- [[_COMMUNITY_MOD Store Lifecycle|MOD Store Lifecycle]]
- [[_COMMUNITY_ICP And Buyers|ICP And Buyers]]
- [[_COMMUNITY_Calculation Policy UI|Calculation Policy UI]]
- [[_COMMUNITY_App Shell Navigation|App Shell Navigation]]
- [[_COMMUNITY_Checked Denominator Rules|Checked Denominator Rules]]
- [[_COMMUNITY_Defect And Stage Trends|Defect And Stage Trends]]
- [[_COMMUNITY_Workbook Upload Drafts|Workbook Upload Drafts]]
- [[_COMMUNITY_Authored Plant Catalog|Authored Plant Catalog]]
- [[_COMMUNITY_Sheet Layout Reader|Sheet Layout Reader]]
- [[_COMMUNITY_MOD Document Builder|MOD Document Builder]]
- [[_COMMUNITY_Entry Edit Grants|Entry Edit Grants]]
- [[_COMMUNITY_Canonical Batch IDs|Canonical Batch IDs]]
- [[_COMMUNITY_Product Positioning|Product Positioning]]
- [[_COMMUNITY_Business Pack Index|Business Pack Index]]
- [[_COMMUNITY_Data Entry Export|Data Entry Export]]
- [[_COMMUNITY_Knowledge From MOD|Knowledge From MOD]]
- [[_COMMUNITY_Calculation Rules Form|Calculation Rules Form]]
- [[_COMMUNITY_Section Rate Aggregation|Section Rate Aggregation]]
- [[_COMMUNITY_Supabase Event Store|Supabase Event Store]]
- [[_COMMUNITY_Ledger And Catalog Invariants|Ledger And Catalog Invariants]]
- [[_COMMUNITY_COPQ Cost Functions|COPQ Cost Functions]]
- [[_COMMUNITY_Air-Gap Plant SKUs|Air-Gap Plant SKUs]]
- [[_COMMUNITY_Locked Section-Rate Formula|Locked Section-Rate Formula]]
- [[_COMMUNITY_On-Prem Deployment Model|On-Prem Deployment Model]]
- [[_COMMUNITY_Analytics Integration Tests|Analytics Integration Tests]]
- [[_COMMUNITY_Workbook Mapping Edits|Workbook Mapping Edits]]
- [[_COMMUNITY_Defect Category Mapping|Defect Category Mapping]]
- [[_COMMUNITY_Workbook Snapshot Store|Workbook Snapshot Store]]
- [[_COMMUNITY_COPQ Pricing Narrative|COPQ Pricing Narrative]]
- [[_COMMUNITY_Entry Package API|Entry Package API]]
- [[_COMMUNITY_Audit Session Tests|Audit Session Tests]]
- [[_COMMUNITY_Resolver Ladder Hits|Resolver Ladder Hits]]
- [[_COMMUNITY_Column Role Profiling|Column Role Profiling]]
- [[_COMMUNITY_MOD Validate And Learn|MOD Validate And Learn]]
- [[_COMMUNITY_Supabase Upload Routes|Supabase Upload Routes]]
- [[_COMMUNITY_Supabase Registry Store|Supabase Registry Store]]
- [[_COMMUNITY_Preset To MOD Migration|Preset To MOD Migration]]
- [[_COMMUNITY_Plant Catalog Merge|Plant Catalog Merge]]
- [[_COMMUNITY_Root Provider Layout|Root Provider Layout]]
- [[_COMMUNITY_Audit ZIP Package|Audit ZIP Package]]
- [[_COMMUNITY_Supabase Knowledge Store|Supabase Knowledge Store]]
- [[_COMMUNITY_Pilot Playbook SKUs|Pilot Playbook SKUs]]
- [[_COMMUNITY_Extract From MOD|Extract From MOD]]
- [[_COMMUNITY_Select And Batch Field|Select And Batch Field]]
- [[_COMMUNITY_Supabase Event Mappers|Supabase Event Mappers]]
- [[_COMMUNITY_Supabase Finding Store|Supabase Finding Store]]
- [[_COMMUNITY_Anti-Hallucination Architecture|Anti-Hallucination Architecture]]
- [[_COMMUNITY_Entry Template API|Entry Template API]]
- [[_COMMUNITY_Analytics Test Fixtures|Analytics Test Fixtures]]
- [[_COMMUNITY_Local Cost Policy|Local Cost Policy]]
- [[_COMMUNITY_Decision Engine Tests|Decision Engine Tests]]
- [[_COMMUNITY_Policy Analytics Tests|Policy Analytics Tests]]
- [[_COMMUNITY_Supabase Rulebook Store|Supabase Rulebook Store]]
- [[_COMMUNITY_On-Prem Compose Stack|On-Prem Compose Stack]]
- [[_COMMUNITY_Chart Widget Primitives|Chart Widget Primitives]]
- [[_COMMUNITY_Stage Day Records|Stage Day Records]]
- [[_COMMUNITY_ALCOA Audit Shield|ALCOA Audit Shield]]
- [[_COMMUNITY_Catalog Store Tests|Catalog Store Tests]]
- [[_COMMUNITY_Entry Transfer Import|Entry Transfer Import]]
- [[_COMMUNITY_Stage Size Heatmap|Stage Size Heatmap]]
- [[_COMMUNITY_MOID QBR SKU|MOID QBR SKU]]
- [[_COMMUNITY_Clear Schema Handler|Clear Schema Handler]]
- [[_COMMUNITY_Parse Source Ref|Parse Source Ref]]
- [[_COMMUNITY_Next Config Object|Next Config Object]]
- [[_COMMUNITY_Decision Rules Table|Decision Rules Table]]

## God Nodes (most connected - your core abstractions)
1. `scopeEvents()` - 36 edges
2. `getModStore()` - 27 edges
3. `MOID` - 26 edges
4. `POST()` - 24 edges
5. `MOID Product & Business Pack` - 24 edges
6. `createServerClient()` - 23 edges
7. `runTurn()` - 23 edges
8. `useEvents()` - 21 edges
9. `getKnowledgeStore()` - 20 edges
10. `normalizeKey()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Policy Is a Read-Time Lens` --rationale_for--> `CalculationPolicy`  [EXTRACTED]
  docs/CALCULATION-POLICY-PLAN.md → src/core/policy/policy.ts
- `Form With Dropdowns Not a Rules Engine` --rationale_for--> `CalculationPolicy`  [EXTRACTED]
  docs/CALCULATION-POLICY-PLAN.md → src/core/policy/policy.ts
- `reworkCountsAs (A3)` --implements--> `aggregate`  [EXTRACTED]
  docs/CALCULATION-POLICY-PLAN.md → src/lib/analytics/rejection.ts
- `Rules Page Worked Example` --conceptually_related_to--> `CalculationRules`  [INFERRED]
  docs/CALCULATION-POLICY-PLAN.md → src/components/settings/CalculationRules.tsx
- `Append-Only Ledger` --conceptually_related_to--> `handleClearTransactions`  [INFERRED]
  README.md → src/app/settings/page.tsx

## Hyperedges (group relationships)
- **MOID Trust Architecture Contract** — 01_product_definition_model_never_does_maths, 01_product_definition_append_only_ledger, 01_product_definition_provenance_mandatory, 01_product_definition_source_excel_readonly, 01_product_definition_findings, 01_product_definition_copq_signed_costs, 01_product_definition_onprem_first_class [EXTRACTED 1.00]
- **Excel and Entry to Ledger to Cockpit** — 01_product_definition_mod, 01_product_definition_catalog, 01_product_definition_data_entry, 01_product_definition_event_ledger, 01_product_definition_view_source, 01_product_definition_copq, 01_product_definition_audit_zip, 01_product_definition_ask_moid [EXTRACTED 1.00]
- **Pilot to Plant to Airgap to Multi-Site** — 08_packaging_and_skus_moid_pilot, 08_packaging_and_skus_moid_plant, 08_packaging_and_skus_moid_plant_airgap, 08_packaging_and_skus_multi_site, 07_pricing_strategy_moid_pilot, 07_pricing_strategy_moid_plant_y1, 07_pricing_strategy_moid_airgap, 07_pricing_strategy_moid_site_n [EXTRACTED 1.00]
- **Locked Section-Rate Rejection Formula** — policy_locked_rejection_formula, rejection_rejectionrate, rejection_bysection, rejection_totalchecked, source_trace_rejectionratefromsummary, calculationrules_calculationrules [EXTRACTED 1.00]
- **Policy as Read-Time Lens on Scope** — policy_calculationpolicy, scope_scope, scope_policyof, scope_resolvescope, rejection_rejectionrate, cost_copq, status_qualitystatus [EXTRACTED 1.00]
- **On-Prem Plant Appliance Stack** — docker_compose_moid_plant, docker_compose_gateway, docker_compose_app, docker_compose_rest, docker_compose_db, on_prem_plant_appliance [EXTRACTED 1.00]
- **Entry-Gate Checked Measurement** — source_trace_summarizesource, rejection_totalchecked, rejection_rejectionrate, source_trace_rejectionratefromsummary, rationale_entry_gate_checked [EXTRACTED 1.00]
- **Catalog Ownership and Novel Consent** — catalog_store_companycatalog, catalog_diff_filterincomingforcatalogmerge, catalog_store_mergefrommod, mods_route_post, schema_route_post, workbooks_route_delete [EXTRACTED 1.00]
- **HMAC Session Login Lifecycle** — login_route_post, session_createsessiontoken, session_verifysessiontoken, me_route_get, logout_route_post [EXTRACTED 1.00]
- **Ledger-read analysis screens** — page_dashboard, page_copqpage, page_defectanalysispage, page_sizeanalysispage, page_stageanalysispage, page_spcpage, page_processflowpage, page_reportspage, rationale_ledger_read_screens [INFERRED 0.95]
- **DB-to-DB entry transfer package** — entryexportpanel_entryexportpanel, route_exportpackage, entry_package_buildentrypackage, entry_package_parseentrypackage, route_importpackage, entrytransferimport_entrytransferimport, rationale_content_addressed_transfer [EXTRACTED 1.00]
- **MOD verify-extract-ingest pipeline** — page_stagingpage, page_handleupload, page_handlemodpublished, page_publish, rationale_mod_only_ingestion [EXTRACTED 1.00]
- **Auth-gated SWR shell caches** — proxy_proxy, personacontext_personaprovider, eventscontext_eventsprovider, registrycontext_registryprovider [INFERRED 0.95]
- **MOD verify → publish → catalog merge** — mappingverificationpanel_publish, 20260713000000_mod_core_mods, 20260723_company_catalog_company_catalog, 20260713000000_mod_core_company_knowledge [EXTRACTED 1.00]
- **Ask MOID task-agent loop** — appshell_askmoid, commandpalette_submitintent, appshell_executetools, eventscontext_eventsprovider [INFERRED 0.85]

## Communities (134 total, 14 thin omitted)

### Community 0 - "Chat Entry Drafting"
Cohesion: 0.07
Nodes (65): buildEntryDraft(), buildReportDraft(), draftToShiftRecord(), finalizeEntrySlots(), classifyTaskKind(), hasEntrySignals(), hasExecuteLanguage(), isCancelMessage() (+57 more)

### Community 1 - "Audit Session Filters"
Cohesion: 0.06
Nodes (42): batchFiguresInconsistent(), batchOf(), buildEntryRows(), dateDaysAgo(), eventTs(), filterEntryRows(), filterEventsByDatePreset(), filterSessions() (+34 more)

### Community 2 - "Entry Package Export"
Cohesion: 0.05
Nodes (63): buildEntryPackage, ENTRY_PACKAGE_FORMAT, EntryPackage, filterEventsForExport, parseEntryPackage, entry package tests, countMatching, EntryExportPanel.download (+55 more)

### Community 3 - "Chat Decision Engine"
Cohesion: 0.06
Nodes (31): llmSlotExtractor(), POST(), buildChatContext(), buildPrompt(), POST(), POST(), decide(), fillTemplate() (+23 more)

### Community 4 - "Source Trace Grouping"
Cohesion: 0.06
Nodes (36): consolidateEntries(), defaultGroupMode(), defaultSourceFilters(), entryStageChecked(), fileBasename(), filterSourceRows(), groupKeyFor(), groupSourceRows() (+28 more)

### Community 5 - "Event Canonicalization"
Cohesion: 0.05
Nodes (34): canonicalizeEvents(), dayOf(), fileOf(), isDirectEntry(), precedenceOf(), stageOf(), sheetRecords, Cell() (+26 more)

### Community 6 - "Ledger Hash Memory"
Cohesion: 0.06
Nodes (25): canonicalize(), hashEvent(), hashFinding(), sha256(), sortDeep(), checkRecord(), checkSpike(), basisFor() (+17 more)

### Community 7 - "Intent Date Phrases"
Cohesion: 0.08
Nodes (36): findMonthIndex(), iso(), lastDay(), parseDatePhrase(), parseWeekOfMonth(), weekOfMonth(), yearForMonth(), bestEntity() (+28 more)

### Community 8 - "MOD Knowledge Plane"
Cohesion: 0.05
Nodes (55): anon role, authenticated role, authenticator role, service_role, datasets, company_knowledge, global_ontology, MOD Knowledge Plane (+47 more)

### Community 9 - "Auth Session Config"
Cohesion: 0.08
Nodes (36): findUser(), getAuthSecret(), getAuthUsers(), isAuthEnabled(), listLoginOptions(), parseAuthUsers(), passwordForRole(), b64urlDecodeToString() (+28 more)

### Community 10 - "Report Block Presets"
Cohesion: 0.12
Nodes (34): describeSectionsFromStageIds(), describeSourceFilter(), buildDefects(), availableBlocks(), blockId(), canReport(), chart(), cloneSpec() (+26 more)

### Community 11 - "CAPA Composer Flow"
Cohesion: 0.09
Nodes (26): calculatePareto(), cancelEdit(), confirmDelete(), cycleStatus(), openBlank(), openFromRec(), saveEdit(), varsContext() (+18 more)

### Community 12 - "Workbook Header Profiling"
Cohesion: 0.08
Nodes (20): buildProfilingTablesAssisted(), unconvincingSheets(), buildProfilingTables(), compareScores(), scoreAssignment(), scoreCascade(), assignRoles(), candidateSplits() (+12 more)

### Community 13 - "Inline SVG Charts"
Cohesion: 0.09
Nodes (10): handleMouseMove(), buildBezierPath(), handleMouseMove(), xs(), ys(), getBaseSpacing(), hoverIndexFromPixels(), shouldShowLabel() (+2 more)

### Community 14 - "Analytics Scope Filters"
Cohesion: 0.11
Nodes (17): countBySourceChannel(), describeActiveScope(), eventBatchId(), eventSourceChannel(), eventSourceFileLabel(), fyContaining(), isDirectEntryEvent(), isPlantDefaultTweaks() (+9 more)

### Community 15 - "Catalog Store Merge"
Cohesion: 0.16
Nodes (9): diffAgainstCatalog(), filterIncomingForCatalogMerge(), isPlantConfigured(), fromDb(), MemoryCatalogStore, mergeInto(), nowIso(), SupabaseCatalogStore (+1 more)

### Community 16 - "Batch Matrix Entry"
Cohesion: 0.11
Nodes (21): sizeIsValid(), applyA12AndSave(), buildPendingRecord(), cancelEdit(), clearFormKeepContext(), commitRecord(), confirmExceptionAndSave(), deleteLocal() (+13 more)

### Community 17 - "Persona Capabilities"
Cohesion: 0.13
Nodes (22): canApprove(), canConfigure(), canEraseLedger(), canWrite(), filterNavKeys(), isPersonaId(), personaCapabilities(), readStoredPersona() (+14 more)

### Community 18 - "Staging Review Edits"
Cohesion: 0.09
Nodes (13): parseQtyDraft(), activeStageIds(), applyEdit(), buildReviewRows(), defectKey(), defectMatches(), reviewRow(), reviewSummary() (+5 more)

### Community 19 - "Calculation Policy Store"
Cohesion: 0.13
Nodes (13): parsePolicy(), fromDb(), getPolicyStore(), isMissingTable(), MemoryPolicyStore, PolicyTableMissingError, __resetPolicyStoreForTests(), seedVersion() (+5 more)

### Community 20 - "Company Catalog Diff"
Cohesion: 0.1
Nodes (29): CatalogDiff, diffAgainstCatalog, filterIncomingForCatalogMerge, isPlantConfigured, Catalog Diff Tests, CatalogStore, CompanyCatalog, EMPTY_CATALOG (+21 more)

### Community 21 - "Rejection Rate Maths"
Cohesion: 0.15
Nodes (14): fpy(), ids(), rejectionRate(), totalChecked(), totalRejected(), trend(), weeklyTrend(), rupee() (+6 more)

### Community 22 - "Dashboard Event Context"
Cohesion: 0.11
Nodes (10): useApplyInvestigationFromUrl(), useEvents(), Dashboard(), usePolicy(), useRegistry(), srcRows(), srcRows(), SettingsPage() (+2 more)

### Community 23 - "MOD Store Lifecycle"
Cohesion: 0.16
Nodes (4): fromDb(), MemoryModStore, mergeCatalog(), SupabaseModStore

### Community 24 - "ICP And Buyers"
Cohesion: 0.1
Nodes (23): CDSCO MDR 2017, Problem & Value, ISO 13485, Jobs To Be Done, Disposafe Scrap Recovery Narrative, Disposafe-Class Design Partner, GM / Plant Director, Year-1 Ideal Customer Profile (+15 more)

### Community 25 - "Calculation Policy UI"
Cohesion: 0.12
Nodes (23): Calculation Policy, reworkCountsAs (A3), Rules Page Worked Example, CalculationRules, putPolicy, DisplayDefaults, pick Default Sections, RulesRedirect (+15 more)

### Community 26 - "App Shell Navigation"
Cohesion: 0.1
Nodes (4): emitNavBanner(), subscribeNavBanner(), handleExport(), useCommandPaletteHotkey()

### Community 27 - "Checked Denominator Rules"
Cohesion: 0.15
Nodes (22): Checked Consistency Tests, Locked Formula Invariant Tests, Entry-Gate Checked Denominator, Disposition Beats Defect Codes, Rework Is Never Checked, aggregate, totalChecked, searchJumpTargets (+14 more)

### Community 28 - "Defect And Stage Trends"
Cohesion: 0.17
Nodes (13): copqTrend(), byDefect(), bySize(), defectTrend(), cumulativeStageTrend(), stageTrend(), calendarPeriods(), periodLabel() (+5 more)

### Community 29 - "Workbook Upload Drafts"
Cohesion: 0.19
Nodes (16): buildProfilingTablesAssisted, buildModDocument, buildExactIndex, resolveWorkbook, profileTable, Upload Writes Draft Only, readWorkbookSnapshot, POST() (+8 more)

### Community 30 - "Authored Plant Catalog"
Cohesion: 0.25
Nodes (16): getCatalogStore, POST(), loadCatalog, loadCatalog(), mergePlantCatalog, Authored Plant Catalog Not Inferred, companyId(), DELETE() (+8 more)

### Community 31 - "Sheet Layout Reader"
Cohesion: 0.24
Nodes (18): cellRef(), colLetter(), detectLayout(), findDateCol(), iso(), labelFor(), norm(), num() (+10 more)

### Community 32 - "MOD Document Builder"
Cohesion: 0.19
Nodes (10): buildModDocument(), deriveCatalogs(), humanize(), proposalToEntity(), regionKey(), modPathRecords(), modRow(), POST() (+2 more)

### Community 33 - "Entry Edit Grants"
Cohesion: 0.19
Nodes (15): act(), entryKey(), hasValidGrant(), issueGrant(), listActiveGrants(), loadAll(), mem(), __resetGrantsForTests() (+7 more)

### Community 34 - "Canonical Batch IDs"
Cohesion: 0.18
Nodes (8): editRow(), onBatchInput(), buildBatchId(), canonicalBatchId(), formatBatchIdInput(), isCanonicalBatchId(), isValidBatchId(), parseBatchId()

### Community 35 - "Product Positioning"
Cohesion: 0.13
Nodes (19): MOID, RAIS-Pro, Rejection Diagnostic, Rejection Intelligence Cockpit, Source Excel Is Read-Only, V1 Commercial Wedge, Operational Leverage, Anti-ICP (+11 more)

### Community 36 - "Business Pack Index"
Cohesion: 0.14
Nodes (19): MOID Product & Business Pack, Product Definition, MOID-SPEC, ICP & Buyers, Positioning & Messaging, Competitive Landscape, Business Model, Pricing Strategy & Price Book (+11 more)

### Community 37 - "Data Entry Export"
Cohesion: 0.15
Nodes (5): countMatching(), download(), describeDataEntryExportConfig(), readDataEntryExportConfig(), writeDataEntryExportConfig()

### Community 38 - "Knowledge From MOD"
Cohesion: 0.19
Nodes (5): knowledgeFromMod(), learnFromMod(), entryKey(), MemoryKnowledgeStore, normalizeKey()

### Community 39 - "Calculation Rules Form"
Cohesion: 0.18
Nodes (5): formatApiError(), putPolicy(), save(), setAsPlantDefault(), validateDraft()

### Community 40 - "Section Rate Aggregation"
Cohesion: 0.32
Nodes (13): aggregate(), batchCascadedAgg(), bySection(), isAcc(), isProd(), isRej(), isRew(), legacySumOfGateRates() (+5 more)

### Community 42 - "Ledger And Catalog Invariants"
Cohesion: 0.23
Nodes (14): Ledger Is Append-Only, Company Catalog, Schema-Generated Data Entry, Append-Only Event Ledger, Findings, Mapping Ontology Document, Provenance Is Mandatory, Plant Schema Learned and Human-Verified (+6 more)

### Community 43 - "COPQ Cost Functions"
Cohesion: 0.36
Nodes (11): copq(), getFinishedCost(), getStageWeight(), getTargetRejectionRate(), savingsOpportunity(), byStage(), policyOf(), getTargetLimit() (+3 more)

### Community 44 - "Air-Gap Plant SKUs"
Cohesion: 0.23
Nodes (13): On-Prem Air-Gap First-Class, IT / OT Security, Messaging Pillar Fit, B2B Plant License Model, Bundle B Fast Start, Bundle D Air-Gapped Plant, MOID-AIRGAP, MOID-IMPL-PLUS (+5 more)

### Community 45 - "Locked Section-Rate Formula"
Cohesion: 0.24
Nodes (13): 9.73% vs 8.46% Argument, Withdrawn headlineRejection and checkedMeasuredAt, Locked Section-Rate Formula, bySection, legacySumOfGateRates, rejectionRate, eventBatchId, policyOf (+5 more)

### Community 46 - "On-Prem Deployment Model"
Cohesion: 0.18
Nodes (13): Form With Dropdowns Not a Rules Engine, Policy Is a Read-Time Lens, moid-plant Compose Stack, Air-Gap Operating Rules, Optional Local LLM, MOID On-Prem Plant Appliance, handleClearTransactions, AI Backend Chain (+5 more)

### Community 47 - "Analytics Integration Tests"
Cohesion: 0.21
Nodes (13): Analytics Integration Tests, evaluate Live Preview, byDefect, bySize, Empty Analytics Stay Empty, FPY Is Rolled-Throughput Yield, fpy, stageBySize (+5 more)

### Community 48 - "Workbook Mapping Edits"
Cohesion: 0.29
Nodes (7): clusterStem(), clusterWorkbooks(), fileBasename(), prettyLabel(), confirmDelete(), confirmDeleteMapping(), mutate()

### Community 49 - "Defect Category Mapping"
Cohesion: 0.32
Nodes (10): applyCategory(), applyCatheterType(), categoryAndTypeFrom(), defectDisplayLabel(), escapeRegExp(), previousAssemblyStageId(), productTypeFor(), sizesFor() (+2 more)

### Community 51 - "COPQ Pricing Narrative"
Cohesion: 0.21
Nodes (12): Cost of Poor Quality, Financial Recovery, Messaging Pillar Money, Business Unit Economics Targets, MOID-DAY, MOID-PLANT-Y1, MOID-PLANT-Y3, MOID-SITE-N (+4 more)

### Community 52 - "Entry Package API"
Cohesion: 0.27
Nodes (7): GET(), POST(), directRec(), excelEvents(), buildEntryPackage(), filterEventsForExport(), parseEntryPackage()

### Community 53 - "Audit Session Tests"
Cohesion: 0.2
Nodes (11): batchFiguresInconsistent, buildEntryRows, filterEventsByDatePreset, filterSessions, groupAuditSessions, groupByBatchThenStage, isDirectEntry, Audit Sessions Tests (+3 more)

### Community 54 - "Resolver Ladder Hits"
Cohesion: 0.38
Nodes (8): conceptsForRole(), globalHit(), headerShapeHit(), resolveWorkbook(), ruleHit(), stageFromFileName(), stageFromRegionLabel(), toProposal()

### Community 55 - "Column Role Profiling"
Cohesion: 0.31
Nodes (7): classifyFormula(), classifyRole(), columnType(), dominantFormulaClass(), looksSerialDate(), profileColumn(), profileTable()

### Community 56 - "MOD Validate And Learn"
Cohesion: 0.27
Nodes (5): learnFromMod, validateModDocument, GET(), POST(), validateModDocument()

### Community 57 - "Supabase Upload Routes"
Cohesion: 0.29
Nodes (5): POST(), resolveArchiveDir(), POST(), createServerClient(), GET()

### Community 58 - "Supabase Registry Store"
Cohesion: 0.27
Nodes (3): sortRegistryRows(), SupabaseRegistryStore, toRegistryRow()

### Community 59 - "Preset To MOD Migration"
Cohesion: 0.28
Nodes (3): companyId(), knowledgeFromRegistry(), migrate()

### Community 60 - "Plant Catalog Merge"
Cohesion: 0.39
Nodes (4): peekCatalog(), canonicalDefectCode(), mergePlantCatalog(), plantCatalog()

### Community 61 - "Root Provider Layout"
Cohesion: 0.22
Nodes (4): EventsProvider(), PersonaProvider(), RegistryProvider(), TweaksProvider()

### Community 63 - "Audit ZIP Package"
Cohesion: 0.39
Nodes (7): buildAuditPackage(), buildStoredZip(), crc32(), makeZip(), pct(), sha256hex(), toCsv()

### Community 65 - "Pilot Playbook SKUs"
Cohesion: 0.31
Nodes (9): Bundle A Pilot Then Convert, MOID-PILOT, MOID Pilot SKU, GTM Funnel, 12-Slide Pitch Deck, Pilot Playbook, Eight-Week Pilot, Pilot Kill Criteria (+1 more)

### Community 66 - "Extract From MOD"
Cohesion: 0.46
Nodes (7): colLabelToIndex(), extractFromMod(), grid(), planFor(), rangeOrigin(), toNumber(), at()

### Community 68 - "Select And Batch Field"
Cohesion: 0.32
Nodes (6): on(), place(), commit(), onKeyDown(), onScroll(), step()

### Community 69 - "Supabase Event Mappers"
Cohesion: 0.36
Nodes (3): getPayload(), mapRowToEvent(), mapRowToRule()

### Community 71 - "Anti-Hallucination Architecture"
Cohesion: 0.25
Nodes (8): Ask MOID, COPQ Requires Signed Cost Assumptions, The Model Never Does Maths, Anti-Hallucination Architecture, Finance, Messaging Pillar Trust, COPQ Integrity Rules, AI Disclosure Annex

### Community 73 - "Analytics Test Fixtures"
Cohesion: 0.43
Nodes (5): prevWindow(), build(), sheetRecords(), valveSheet(), visualSheet()

### Community 74 - "Local Cost Policy"
Cohesion: 0.47
Nodes (6): Per-Browser localStorage Cost Policy, copq, getFinishedCost, IMPROVEMENT_RECOVERY_FRACTION, savingsOpportunity, byStage

### Community 75 - "Decision Engine Tests"
Cohesion: 0.53
Nodes (6): computeCanonicalVars, Decision Engine Tests, decide, fillTemplate, Rules Over Canonical Vars Only, SEED_DECISION_RULES

### Community 77 - "Policy Analytics Tests"
Cohesion: 0.6
Nodes (4): ev(), gate(), scope(), withRule()

### Community 79 - "On-Prem Compose Stack"
Cohesion: 0.5
Nodes (5): MOID app Service, Postgres db Service, nginx gateway Service, migrate One-Shot Job, PostgREST rest Service

### Community 80 - "Chart Widget Primitives"
Cohesion: 0.5
Nodes (5): ChartTip, Donut, Inline SVG Charts, LineChart, MultiLine

### Community 81 - "Stage Day Records"
Cohesion: 0.83
Nodes (3): qtyHeaderFor(), sv(), toStageDayRecord()

### Community 82 - "ALCOA Audit Shield"
Cohesion: 0.83
Nodes (4): Audit ZIP and Hash Manifest, ALCOA+, Regulatory Shield, Messaging Pillar Audit

## Ambiguous Edges - Review These
- `datasets` → `workbook_snapshots`  [AMBIGUOUS]
  supabase/migrations/20260701000000_datasets.sql · relation: conceptually_related_to

## Knowledge Gaps
- **124 isolated node(s):** `ICP & Buyers`, `Positioning & Messaging`, `Competitive Landscape`, `Business Model`, `Packaging & SKUs` (+119 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `datasets` and `workbook_snapshots`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `getModStore()` connect `Workbook Upload Drafts` to `MOD Document Builder`, `Chat Decision Engine`, `Event Canonicalization`, `Knowledge From MOD`, `Catalog Store Tests`, `MOD Store Lifecycle`, `MOD Validate And Learn`, `Preset To MOD Migration`, `Plant Catalog Merge`, `Authored Plant Catalog`?**
  _High betweenness centrality (0.143) - this node is a cross-community bridge._
- **Why does `useEvents()` connect `Dashboard Event Context` to `Audit Session Filters`, `Source Trace Grouping`, `Data Entry Export`, `Calculation Rules Form`, `CAPA Composer Flow`, `Inline SVG Charts`, `Workbook Mapping Edits`, `Batch Matrix Entry`, `Staging Review Edits`, `Entry Transfer Import`, `App Shell Navigation`, `Root Provider Layout`?**
  _High betweenness centrality (0.139) - this node is a cross-community bridge._
- **Why does `emitMany` connect `Event Canonicalization` to `Analytics Test Fixtures`, `Rejection Rate Maths`, `Ledger Hash Memory`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Are the 26 inferred relationships involving `scopeEvents()` (e.g. with `srcRows()` and `srcRows()`) actually correct?**
  _`scopeEvents()` has 26 INFERRED edges - model-reasoned connections that need verification._
- **Are the 14 inferred relationships involving `getModStore()` (e.g. with `migrate()` and `POST()`) actually correct?**
  _`getModStore()` has 14 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `POST()` (e.g. with `POST()` and `availableBackends()`) actually correct?**
  _`POST()` has 11 INFERRED edges - model-reasoned connections that need verification._