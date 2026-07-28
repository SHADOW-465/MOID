# Graph Report - RAIS-Pro  (2026-07-28)

Built from commit: `e1fa68c570c5` (AST code-only rebuild)

# Graph Report - .  (2026-07-28)

## Corpus Check
- Large corpus: 488 files · ~7,185,355 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 1005 nodes · 1905 edges · 68 communities (66 shown, 2 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 233 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_knowledgeFromMod()|knowledgeFromMod()]]
- [[_COMMUNITY_copq()|copq()]]
- [[_COMMUNITY_iso()|iso()]]
- [[_COMMUNITY_canonicalizeEvents()|canonicalizeEvents()]]
- [[_COMMUNITY_weekOfMonthBounds()|weekOfMonthBounds()]]
- [[_COMMUNITY_POST()|POST()]]
- [[_COMMUNITY_batch.ts|batch.ts]]
- [[_COMMUNITY_batchOf()|batchOf()]]
- [[_COMMUNITY_applyA12AndSave()|applyA12AndSave()]]
- [[_COMMUNITY_checkRecord()|checkRecord()]]
- [[_COMMUNITY_bestGrain()|bestGrain()]]
- [[_COMMUNITY_bg()|bg()]]
- [[_COMMUNITY_canonicalize()|canonicalize()]]
- [[_COMMUNITY_cancelEdit()|cancelEdit()]]
- [[_COMMUNITY_decide()|decide()]]
- [[_COMMUNITY_consolidateEntries()|consolidateEntries()]]
- [[_COMMUNITY_llmSlotExtractor()|llmSlotExtractor()]]
- [[_COMMUNITY_mod-store.ts|mod-store.ts]]
- [[_COMMUNITY_buildModDocument()|buildModDocument()]]
- [[_COMMUNITY_compareScores()|compareScores()]]
- [[_COMMUNITY_buildProfilingTablesAssisted()|buildProfilingTablesAssisted()]]
- [[_COMMUNITY_useEvents()|useEvents()]]
- [[_COMMUNITY_applyCatalog()|applyCatalog()]]
- [[_COMMUNITY_isNumericish()|isNumericish()]]
- [[_COMMUNITY_confirmLeavePeriodGrid()|confirmLeavePeriodGrid()]]
- [[_COMMUNITY_classifyFormula()|classifyFormula()]]
- [[_COMMUNITY_conceptsForRole()|conceptsForRole()]]
- [[_COMMUNITY_EventsProvider()|EventsProvider()]]
- [[_COMMUNITY_colLabelToIndex()|colLabelToIndex()]]
- [[_COMMUNITY_calculatePareto()|calculatePareto()]]
- [[_COMMUNITY_openModal()|openModal()]]

## God Nodes (most connected - your core abstractions)
1. `scopeEvents()` - 31 edges
2. `getModStore()` - 28 edges
3. `createServerClient()` - 21 edges
4. `useEvents()` - 20 edges
5. `getKnowledgeStore()` - 20 edges
6. `normalizeKey()` - 18 edges
7. `buildProfilingTables()` - 17 edges
8. `tryModels()` - 17 edges
9. `resolveWorkbook()` - 16 edges
10. `buildAuditPackage()` - 16 edges

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

## Communities (68 total, 2 thin omitted)

### Community 0 - "knowledgeFromMod()"
Cohesion: 0.06
Nodes (35): knowledgeFromMod(), learnFromMod(), POST(), GET(), POST(), POST(), buildExactIndex(), companyId() (+27 more)

### Community 1 - "copq()"
Cohesion: 0.08
Nodes (54): copq(), copqTrend(), getFinishedCost(), getStageWeight(), getTargetRejectionRate(), savingsOpportunity(), byDefect(), bySize() (+46 more)

### Community 2 - "iso()"
Cohesion: 0.05
Nodes (30): iso(), lastDay(), parseDatePhrase(), bestEntity(), hrefForNav(), resolveIntent(), resolveIntentDeterministic(), batchOf() (+22 more)

### Community 3 - "canonicalizeEvents()"
Cohesion: 0.06
Nodes (33): canonicalizeEvents(), dayOf(), fileOf(), isDirectEntry(), precedenceOf(), stageOf(), GET(), POST() (+25 more)

### Community 4 - "weekOfMonthBounds()"
Cohesion: 0.06
Nodes (25): weekOfMonthBounds(), confirmDiscardIfDirty(), goToPeriod(), rowId(), updateCapture(), isoDate(), pickRow(), loadDraft() (+17 more)

### Community 5 - "POST()"
Cohesion: 0.09
Nodes (13): POST(), resolveArchiveDir(), POST(), createServerClient(), GET(), fromDb(), MemoryCatalogStore, mergeInto() (+5 more)

### Community 6 - "batch.ts"
Cohesion: 0.07
Nodes (11): chunk(), getPayload(), mapRowToEvent(), mapRowToFinding(), mapRowToRule(), sortRegistryRows(), SupabaseEventStore, SupabaseFindingStore (+3 more)

### Community 7 - "batchOf()"
Cohesion: 0.1
Nodes (31): batchOf(), buildEntryRows(), dateDaysAgo(), eventTs(), filterEntryRows(), filterEventsByDatePreset(), filterSessions(), groupAuditSessions() (+23 more)

### Community 8 - "applyA12AndSave()"
Cohesion: 0.11
Nodes (25): applyA12AndSave(), buildPendingRecord(), cancelEdit(), clearFormKeepContext(), commitRecord(), deleteLocal(), finalizeSave(), onBatchInput() (+17 more)

### Community 9 - "checkRecord()"
Cohesion: 0.08
Nodes (8): checkRecord(), checkSpike(), defectOf(), MemoryEventStore, MemoryFindingStore, MemoryRegistryStore, MemoryRulebookStore, stageOf()

### Community 10 - "bestGrain()"
Cohesion: 0.08
Nodes (16): bestGrain(), describeSpec(), scopeFor(), clusterStem(), clusterWorkbooks(), fileBasename(), prettyLabel(), confirmDelete() (+8 more)

### Community 11 - "bg()"
Cohesion: 0.09
Nodes (11): handleMouseMove(), Kpi(), buildBezierPath(), handleMouseMove(), xs(), ys(), getBaseSpacing(), hoverIndexFromPixels() (+3 more)

### Community 12 - "canonicalize()"
Cohesion: 0.12
Nodes (22): canonicalize(), hashEvent(), hashFinding(), sha256(), sortDeep(), activeStageIds(), resolveDefect(), basisFor() (+14 more)

### Community 13 - "cancelEdit()"
Cohesion: 0.12
Nodes (24): cancelEdit(), cycleStatus(), openBlank(), openFromRec(), saveEdit(), varsContext(), applyAsAction(), create() (+16 more)

### Community 14 - "decide()"
Cohesion: 0.12
Nodes (12): decide(), fillTemplate(), matchedVars(), whenMatches(), getDecisionRuleStore(), MemoryDecisionRuleStore, resetDecisionRuleStoreForTests(), SupabaseDecisionRuleStore (+4 more)

### Community 15 - "consolidateEntries()"
Cohesion: 0.15
Nodes (20): consolidateEntries(), defaultGroupMode(), defaultSourceFilters(), fileBasename(), filterSourceRows(), groupKeyFor(), groupSourceRows(), inferSourceKind() (+12 more)

### Community 16 - "llmSlotExtractor()"
Cohesion: 0.13
Nodes (17): llmSlotExtractor(), POST(), buildChatContext(), buildPrompt(), POST(), activeBackend(), availableBackends(), getModel() (+9 more)

### Community 17 - "mod-store.ts"
Cohesion: 0.16
Nodes (4): fromDb(), MemoryModStore, mergeCatalog(), SupabaseModStore

### Community 18 - "buildModDocument()"
Cohesion: 0.21
Nodes (9): buildModDocument(), deriveCatalogs(), humanize(), proposalToEntity(), regionKey(), modPathRecords(), modRow(), readWorkbookSnapshot() (+1 more)

### Community 19 - "compareScores()"
Cohesion: 0.24
Nodes (10): compareScores(), scoreAssignment(), scoreCascade(), assignRoles(), candidateSplits(), chooseSplit(), roleOf(), splitOnStageTokensOnly() (+2 more)

### Community 20 - "buildProfilingTablesAssisted()"
Cohesion: 0.2
Nodes (5): buildProfilingTablesAssisted(), unconvincingSheets(), buildProfilingTables(), resetMasterSchema(), load()

### Community 21 - "useEvents()"
Cohesion: 0.22
Nodes (5): useEvents(), Dashboard(), useRegistry(), srcRows(), srcRows()

### Community 22 - "applyCatalog()"
Cohesion: 0.3
Nodes (8): applyCatalog(), defectsFromEntities(), GET(), humanize(), isMigratedDoc(), regionKey(), stageScore(), templateFrom()

### Community 23 - "isNumericish()"
Cohesion: 0.24
Nodes (6): buildHeaderBlock(), colIndexToLabel(), detectHeaderRow(), isHeaderLabelRow(), normalizeHeaders(), rowHasHeaderHint()

### Community 25 - "confirmLeavePeriodGrid()"
Cohesion: 0.29
Nodes (6): confirmLeavePeriodGrid(), handleDeleteLedgerRecord(), handleDuplicateLedgerRecord(), loadLedger(), switchTab(), today()

### Community 26 - "classifyFormula()"
Cohesion: 0.31
Nodes (7): classifyFormula(), classifyRole(), columnType(), dominantFormulaClass(), looksSerialDate(), profileColumn(), profileTable()

### Community 27 - "conceptsForRole()"
Cohesion: 0.38
Nodes (8): conceptsForRole(), globalHit(), headerShapeHit(), resolveWorkbook(), ruleHit(), stageFromFileName(), stageFromRegionLabel(), toProposal()

### Community 28 - "EventsProvider()"
Cohesion: 0.22
Nodes (3): EventsProvider(), RegistryProvider(), TweaksProvider()

### Community 32 - "colLabelToIndex()"
Cohesion: 0.57
Nodes (6): colLabelToIndex(), extractFromMod(), grid(), planFor(), rangeOrigin(), toNumber()

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useEvents()` connect `useEvents()` to `calculatePareto()`, `iso()`, `openModal()`, `weekOfMonthBounds()`, `batchOf()`, `applyA12AndSave()`, `bestGrain()`, `bg()`, `fmtInt()`, `confirmLeavePeriodGrid()`, `EventsProvider()`, `addCustomDefect()`, `flushBullets()`?**
  _High betweenness centrality (0.300) - this node is a cross-community bridge._
- **Why does `decide()` connect `decide()` to `copq()`, `canonicalizeEvents()`, `useEvents()`?**
  _High betweenness centrality (0.227) - this node is a cross-community bridge._
- **Why does `getModStore()` connect `knowledgeFromMod()` to `mod-store.ts`, `canonicalizeEvents()`, `applyCatalog()`?**
  _High betweenness centrality (0.200) - this node is a cross-community bridge._
- **Are the 23 inferred relationships involving `scopeEvents()` (e.g. with `srcRows()` and `srcRows()`) actually correct?**
  _`scopeEvents()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **Are the 15 inferred relationships involving `getModStore()` (e.g. with `migrate()` and `POST()`) actually correct?**
  _`getModStore()` has 15 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `createServerClient()` (e.g. with `POST()` and `POST()`) actually correct?**
  _`createServerClient()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `getKnowledgeStore()` (e.g. with `migrate()` and `POST()`) actually correct?**
  _`getKnowledgeStore()` has 10 INFERRED edges - model-reasoned connections that need verification._