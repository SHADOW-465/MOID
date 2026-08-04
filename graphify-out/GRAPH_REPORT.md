# Graph Report - .  (2026-08-04)

## Corpus Check
- Large corpus: 546 files · ~7,247,404 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 1283 nodes · 2619 edges · 73 communities
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 392 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Ask MOID Task Agent|Ask MOID Task Agent]]
- [[_COMMUNITY_MOD Publish & Catalog Learning|MOD Publish & Catalog Learning]]
- [[_COMMUNITY_Cost, Defect & Size Analytics|Cost, Defect & Size Analytics]]
- [[_COMMUNITY_Batch Matrix Entry Form|Batch Matrix Entry Form]]
- [[_COMMUNITY_Event Canonicalisation & Precedence|Event Canonicalisation & Precedence]]
- [[_COMMUNITY_Audit Sessions & Entry Rows|Audit Sessions & Entry Rows]]
- [[_COMMUNITY_View Source Drill-down|View Source Drill-down]]
- [[_COMMUNITY_API Routes & Supabase Client|API Routes & Supabase Client]]
- [[_COMMUNITY_Content Hashing & Memory Store|Content Hashing & Memory Store]]
- [[_COMMUNITY_Supabase Row Mappers|Supabase Row Mappers]]
- [[_COMMUNITY_Report Builder Blocks|Report Builder Blocks]]
- [[_COMMUNITY_CAPA Register|CAPA Register]]
- [[_COMMUNITY_Chart Builder & KPI Widgets|Chart Builder & KPI Widgets]]
- [[_COMMUNITY_Staging Review Grid|Staging Review Grid]]
- [[_COMMUNITY_SVG Chart Rendering|SVG Chart Rendering]]
- [[_COMMUNITY_Decision Rule Engine|Decision Rule Engine]]
- [[_COMMUNITY_Persona Capabilities & Nav|Persona Capabilities & Nav]]
- [[_COMMUNITY_Scope Selectors & Source Filters|Scope Selectors & Source Filters]]
- [[_COMMUNITY_AI Backends & Chat Prompt|AI Backends & Chat Prompt]]
- [[_COMMUNITY_Edit Grants|Edit Grants]]
- [[_COMMUNITY_Intent Resolution & Jump|Intent Resolution & Jump]]
- [[_COMMUNITY_MOD Store & Lineage|MOD Store & Lineage]]
- [[_COMMUNITY_Workbook Sheet Reader|Workbook Sheet Reader]]
- [[_COMMUNITY_App Shell Navigation|App Shell Navigation]]
- [[_COMMUNITY_MOD Document Builder|MOD Document Builder]]
- [[_COMMUNITY_Column Role Assignment|Column Role Assignment]]
- [[_COMMUNITY_Assisted Profiling|Assisted Profiling]]
- [[_COMMUNITY_Header Detection|Header Detection]]
- [[_COMMUNITY_Stage Resolver Ladder|Stage Resolver Ladder]]
- [[_COMMUNITY_Column Profiling & Formula Class|Column Profiling & Formula Class]]
- [[_COMMUNITY_Extract From MOD|Extract From MOD]]

## God Nodes (most connected - your core abstractions)
1. `scopeEvents()` - 33 edges
2. `getModStore()` - 27 edges
3. `runTurn()` - 23 edges
4. `createServerClient()` - 21 edges
5. `getKnowledgeStore()` - 20 edges
6. `useEvents()` - 18 edges
7. `normalizeKey()` - 18 edges
8. `buildProfilingTables()` - 17 edges
9. `tryModels()` - 17 edges
10. `extractFromMod()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `migrate()` --calls--> `getStores()`  [INFERRED]
  scripts/migrate-presets-to-mods.ts → src/lib/store/index.ts
- `main()` --calls--> `extractFromMod()`  [INFERRED]
  scripts/repair-ingest-verified-mods.ts → src/core/ingest/extract-from-mod.ts
- `check()` --calls--> `resolveModel()`  [INFERRED]
  scripts/check-ai.ts → src/lib/ai.ts
- `main()` --calls--> `availableBackends()`  [INFERRED]
  scripts/check-ai.ts → src/lib/ai.ts
- `knowledgeFromRegistry()` --calls--> `normalizeKey()`  [INFERRED]
  scripts/migrate-presets-to-mods.ts → src/core/ontology/store/knowledge-store.ts

## Communities (73 total, 0 thin omitted)

### Community 0 - "Ask MOID Task Agent"
Cohesion: 0.05
Nodes (82): buildEntryDraft(), buildReportDraft(), draftToShiftRecord(), finalizeEntrySlots(), classifyTaskKind(), hasEntrySignals(), hasExecuteLanguage(), isCancelMessage() (+74 more)

### Community 1 - "MOD Publish & Catalog Learning"
Cohesion: 0.05
Nodes (42): knowledgeFromMod(), learnFromMod(), POST(), GET(), templateFrom(), GET(), POST(), loadCatalog() (+34 more)

### Community 2 - "Cost, Defect & Size Analytics"
Cohesion: 0.07
Nodes (59): copq(), copqTrend(), getFinishedCost(), getStageWeight(), getTargetRejectionRate(), savingsOpportunity(), byDefect(), bySize() (+51 more)

### Community 3 - "Batch Matrix Entry Form"
Cohesion: 0.05
Nodes (51): sizeIsValid(), clearPrefill(), readPrefill(), applyA12AndSave(), applyCategory(), applyCatheterType(), buildPendingRecord(), cancelEdit() (+43 more)

### Community 4 - "Event Canonicalisation & Precedence"
Cohesion: 0.05
Nodes (39): canonicalizeEvents(), dayOf(), fileOf(), isDirectEntry(), precedenceOf(), stageOf(), Cell(), GET() (+31 more)

### Community 5 - "Audit Sessions & Entry Rows"
Cohesion: 0.06
Nodes (43): batchFiguresInconsistent(), batchOf(), buildEntryRows(), dateDaysAgo(), eventTs(), filterEntryRows(), filterEventsByDatePreset(), filterSessions() (+35 more)

### Community 6 - "View Source Drill-down"
Cohesion: 0.05
Nodes (33): calculatePareto(), consolidateEntries(), defaultGroupMode(), defaultSourceFilters(), fileBasename(), filterSourceRows(), groupKeyFor(), groupSourceRows() (+25 more)

### Community 7 - "API Routes & Supabase Client"
Cohesion: 0.09
Nodes (13): POST(), resolveArchiveDir(), POST(), createServerClient(), GET(), fromDb(), MemoryCatalogStore, mergeInto() (+5 more)

### Community 8 - "Content Hashing & Memory Store"
Cohesion: 0.08
Nodes (18): canonicalize(), hashEvent(), hashFinding(), sha256(), sortDeep(), defectOf(), MemoryEventStore, MemoryFindingStore (+10 more)

### Community 9 - "Supabase Row Mappers"
Cohesion: 0.07
Nodes (11): chunk(), getPayload(), mapRowToEvent(), mapRowToFinding(), mapRowToRule(), sortRegistryRows(), SupabaseEventStore, SupabaseFindingStore (+3 more)

### Community 10 - "Report Builder Blocks"
Cohesion: 0.12
Nodes (32): describeSourceFilter(), buildDefects(), availableBlocks(), blockId(), canReport(), chart(), cloneSpec(), forensicBookSpec() (+24 more)

### Community 11 - "CAPA Register"
Cohesion: 0.1
Nodes (25): cancelEdit(), confirmDelete(), cycleStatus(), openBlank(), openFromRec(), saveEdit(), varsContext(), applyAsAction() (+17 more)

### Community 12 - "Chart Builder & KPI Widgets"
Cohesion: 0.08
Nodes (17): Kpi(), bestGrain(), describeSpec(), scopeFor(), clusterStem(), clusterWorkbooks(), fileBasename(), prettyLabel() (+9 more)

### Community 13 - "Staging Review Grid"
Cohesion: 0.08
Nodes (14): parseQtyDraft(), activeStageIds(), resolveDefect(), applyEdit(), buildReviewRows(), defectKey(), defectMatches(), reviewRow() (+6 more)

### Community 14 - "SVG Chart Rendering"
Cohesion: 0.09
Nodes (10): handleMouseMove(), buildBezierPath(), handleMouseMove(), xs(), ys(), getBaseSpacing(), hoverIndexFromPixels(), shouldShowLabel() (+2 more)

### Community 15 - "Decision Rule Engine"
Cohesion: 0.1
Nodes (14): POST(), decide(), fillTemplate(), matchedVars(), whenMatches(), explainRecommendations(), getDecisionRuleStore(), MemoryDecisionRuleStore (+6 more)

### Community 16 - "Persona Capabilities & Nav"
Cohesion: 0.13
Nodes (22): canApprove(), canConfigure(), canEraseLedger(), canWrite(), filterNavKeys(), isPersonaId(), personaCapabilities(), readStoredPersona() (+14 more)

### Community 17 - "Scope Selectors & Source Filters"
Cohesion: 0.11
Nodes (17): countBySourceChannel(), describeActiveScope(), describeSectionsFromStageIds(), eventBatchId(), eventSourceChannel(), eventSourceFileLabel(), fyContaining(), isDirectEntryEvent() (+9 more)

### Community 18 - "AI Backends & Chat Prompt"
Cohesion: 0.13
Nodes (18): llmSlotExtractor(), POST(), buildChatContext(), buildPrompt(), POST(), catalogForPrompt(), activeBackend(), availableBackends() (+10 more)

### Community 19 - "Edit Grants"
Cohesion: 0.12
Nodes (15): act(), entryKey(), hasValidGrant(), issueGrant(), listActiveGrants(), loadAll(), mem(), __resetGrantsForTests() (+7 more)

### Community 20 - "Intent Resolution & Jump"
Cohesion: 0.16
Nodes (15): bestEntity(), resolveIntent(), resolveIntentDeterministic(), batchOf(), buildEntitySets(), defectOf(), matchMetric(), norm() (+7 more)

### Community 21 - "MOD Store & Lineage"
Cohesion: 0.16
Nodes (4): fromDb(), MemoryModStore, mergeCatalog(), SupabaseModStore

### Community 22 - "Workbook Sheet Reader"
Cohesion: 0.24
Nodes (18): cellRef(), colLetter(), detectLayout(), findDateCol(), iso(), labelFor(), norm(), num() (+10 more)

### Community 23 - "App Shell Navigation"
Cohesion: 0.11
Nodes (3): emitNavBanner(), subscribeNavBanner(), handleExport()

### Community 24 - "MOD Document Builder"
Cohesion: 0.21
Nodes (9): buildModDocument(), deriveCatalogs(), humanize(), proposalToEntity(), regionKey(), modPathRecords(), modRow(), readWorkbookSnapshot() (+1 more)

### Community 25 - "Column Role Assignment"
Cohesion: 0.24
Nodes (10): compareScores(), scoreAssignment(), scoreCascade(), assignRoles(), candidateSplits(), chooseSplit(), roleOf(), splitOnStageTokensOnly() (+2 more)

### Community 26 - "Assisted Profiling"
Cohesion: 0.2
Nodes (4): buildProfilingTablesAssisted(), unconvincingSheets(), buildProfilingTables(), load()

### Community 27 - "Header Detection"
Cohesion: 0.24
Nodes (6): buildHeaderBlock(), colIndexToLabel(), detectHeaderRow(), isHeaderLabelRow(), normalizeHeaders(), rowHasHeaderHint()

### Community 28 - "Stage Resolver Ladder"
Cohesion: 0.38
Nodes (8): conceptsForRole(), globalHit(), headerShapeHit(), resolveWorkbook(), ruleHit(), stageFromFileName(), stageFromRegionLabel(), toProposal()

### Community 30 - "Column Profiling & Formula Class"
Cohesion: 0.36
Nodes (7): classifyFormula(), classifyRole(), columnType(), dominantFormulaClass(), looksSerialDate(), profileColumn(), profileTable()

### Community 32 - "Extract From MOD"
Cohesion: 0.57
Nodes (6): colLabelToIndex(), extractFromMod(), grid(), planFor(), rangeOrigin(), toNumber()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useEvents()` connect `View Source Drill-down` to `Batch Matrix Entry Form`, `Audit Sessions & Entry Rows`, `CAPA Register`, `Chart Builder & KPI Widgets`, `Staging Review Grid`, `SVG Chart Rendering`, `Edit Grants`, `App Shell Navigation`?**
  _High betweenness centrality (0.221) - this node is a cross-community bridge._
- **Why does `getModStore()` connect `MOD Publish & Catalog Learning` to `Event Canonicalisation & Precedence`, `MOD Store & Lineage`, `Decision Rule Engine`?**
  _High betweenness centrality (0.213) - this node is a cross-community bridge._
- **Why does `canonicalizeEvents()` connect `Event Canonicalisation & Precedence` to `Scope Selectors & Source Filters`, `Cost, Defect & Size Analytics`, `Decision Rule Engine`?**
  _High betweenness centrality (0.144) - this node is a cross-community bridge._
- **Are the 24 inferred relationships involving `scopeEvents()` (e.g. with `srcRows()` and `srcRows()`) actually correct?**
  _`scopeEvents()` has 24 INFERRED edges - model-reasoned connections that need verification._
- **Are the 14 inferred relationships involving `getModStore()` (e.g. with `migrate()` and `POST()`) actually correct?**
  _`getModStore()` has 14 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `runTurn()` (e.g. with `submitWidgetQuery()` and `isCancelMessage()`) actually correct?**
  _`runTurn()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `createServerClient()` (e.g. with `POST()` and `POST()`) actually correct?**
  _`createServerClient()` has 12 INFERRED edges - model-reasoned connections that need verification._