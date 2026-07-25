// src/app/api/entry-template/route.ts
// Data Entry = a generated view of the verified ontology (ADD §18).
//   GET /api/entry-template           → template from ALL of the company's verified MODs
//   GET /api/entry-template?modId=X   → template from one MOD lineage's verified version
//
// Columns come from the workbook that defined each stage — not a company-wide
// hardcoded defect catalog. Preference order when multiple MODs define a stage:
//   1. MOD with real sheet layout (uploaded workbook)
//   2. Non-migrated lineage over seed/migration synthetic docs
// Defects for a stage = Excel-mapped defect *entities* only (columns that were
// verified as DEFECT:*). Never pad the grid with the full seed catalog
// (DISPOSAFE_REGISTRY demoted-to-MOD) — that was the "hardcoded defects" bug.

import { NextRequest, NextResponse } from "next/server";
import { getModStore } from "@/core/ontology/store/mod-store";
import { getCatalogStore, type CompanyCatalog } from "@/core/ontology/store/catalog-store";
import type { ModRowT, ModDocumentT, ModEntityT } from "@/shared/models/ontology";

const CAPTURE_COLUMNS: Record<string, { key: string; label: string }> = {
  checked:  { key: "checked",      label: "Checked Qty" },
  accepted: { key: "acceptedGood", label: "Good Qty" },
  hold:     { key: "rework",       label: "Rework Qty" },
  rejected: { key: "rejected",     label: "Rejected Qty" },
};

const CAPTURE_ORDER = Object.keys(CAPTURE_COLUMNS);

export type EntryTemplateStage = {
  stageId: string;
  label: string;
  sizeWise: boolean;
  isQualityGate: boolean;
  columns: { key: string; label: string; type: "number"; required: boolean }[];
  /** `sources` = the workbook file names that taught this column. Traceability:
   *  a column is the union across every verified MOD, never one sheet's view. */
  defects: { defectCode: string; label: string; sources: string[] }[];
  layout: {
    sheet: string;
    tableId: string;
    headerRows: (string | number | null)[][];
    merges: unknown[];
  } | null;
  /** Internal ranking — not required by clients */
  _score?: number;
};

function isMigratedDoc(doc: ModDocumentT): boolean {
  return doc.workbook.fileHash === "migrated"
    || /\(migrated\)/i.test(doc.workbook.fileName)
    || doc.workbook.fileName.startsWith("disposafe-registry")
    || doc.workbook.fileName.startsWith("preset:");
}

function regionKey(e: { original: { sheet: string; tableId?: string | null } }): string {
  return `${e.original.sheet}::${e.original.tableId ?? "t1"}`;
}

function humanize(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Defect columns that actually appear as mapped Excel entities for this stage.
 * Never invents codes from a bare catalog — only columns that exist in entities.
 *
 * Attachment order:
 *  1. entity sheet-region maps to this stageId via a stage entity on the same region
 *  2. else entity's DEFECT:code is listed on this stage in doc.defects (catalog
 *     stages list only *scopes* an existing entity — it cannot add columns alone)
 */
function defectsFromEntities(
  doc: ModDocumentT,
  stageId: string,
  stageOfRegion: Map<string, string>,
): { defectCode: string; label: string; sources: string[] }[] {
  const out = new Map<string, { defectCode: string; label: string; sources: string[] }>();
  const catalogByCode = new Map((doc.defects ?? []).map((d) => [d.defectCode, d]));

  for (const e of doc.entities) {
    if (e.kind !== "defect" || !e.canonical?.startsWith("DEFECT:")) continue;
    const code = e.canonical.slice("DEFECT:".length);
    const regionStage = stageOfRegion.get(regionKey(e));
    const catalog = catalogByCode.get(code);
    const onStage =
      regionStage === stageId
      || (!regionStage && !!catalog?.stages?.includes(stageId));
    if (!onStage) continue;
    if (!out.has(code)) {
      out.set(code, {
        defectCode: code,
        label: e.original.header?.trim() || catalog?.label || humanize(code),
        sources: [doc.workbook.fileName],
      });
    }
  }
  return [...out.values()];
}

function stageScore(hasLayout: boolean, migrated: boolean, hasEntityDefects: boolean): number {
  // Higher wins when multiple MODs claim the same stageId.
  // Seed/migration docs without Excel columns always lose to real workbooks.
  return (hasLayout ? 4 : 0) + (migrated ? 0 : 2) + (hasEntityDefects ? 1 : 0);
}

/**
 * Data Schema (the company catalog) is the human-owned master; the MOD is what
 * Excel said. So the catalog OVERRIDES on every field it owns:
 *   · rename a defect there  → Data Entry shows the new label
 *   · delete a defect there  → the column disappears from Data Entry
 *   · add a defect there     → it appears, appended after the Excel-order ones
 * Column ORDER stays the extraction order from the sheet — that's what the
 * operator's eye already knows. Catalog-only additions can't have a sheet
 * position, so they go last.
 *
 * An empty catalog never subtracts: a plant that has published MODs but never
 * opened Data Schema must not lose every column.
 */
function applyCatalog(stages: EntryTemplateStage[], catalog: CompanyCatalog): EntryTemplateStage[] {
  if (catalog.defects.length === 0) return stages;
  const byCode = new Map(catalog.defects.map((d) => [d.defectCode, d]));

  return stages.map((stage) => {
    const kept = stage.defects
      .filter((d) => byCode.has(d.defectCode))
      .map((d) => ({ ...d, label: byCode.get(d.defectCode)!.label || d.label }));

    const present = new Set(kept.map((d) => d.defectCode));
    const added = catalog.defects
      .filter((d) => !present.has(d.defectCode) && (d.stages ?? []).includes(stage.stageId))
      .map((d) => ({ defectCode: d.defectCode, label: d.label, sources: ["Data Schema"] }));

    return { ...stage, defects: [...kept, ...added] };
  });
}

export function templateFrom(rows: ModRowT[], catalog?: CompanyCatalog) {
  const stages = new Map<string, EntryTemplateStage>();
  const sizes = new Map<string, { sizeId: string; label: string }>();
  const validation: { ruleId: string; expr: string; severity: string }[] = [];
  const seenRules = new Set<string>();

  for (const row of rows) {
    const doc = row.document;
    const migrated = isMigratedDoc(doc);

    const stageOfRegion = new Map<string, string>();
    for (const e of doc.entities) {
      if (e.kind === "stage" && e.canonical?.startsWith("STAGE:")) {
        // Published MOD: accept verified stages; migration seeds mark verified too.
        if (e.verified || e.resolvedBy === "user") {
          stageOfRegion.set(regionKey(e), e.canonical.slice("STAGE:".length));
        }
      }
    }

    for (const s of doc.stages) {
      const captures = s.captures ?? [];
      const columns = captures
        .map((c) => CAPTURE_COLUMNS[c])
        .filter(Boolean)
        .map((c) => ({ ...c, type: "number" as const, required: c.key === "checked" || c.key === "rejected" }));

      // Excel columns only — never the full seed catalog as empty-entity fallback.
      const defects = defectsFromEntities(doc, s.stageId, stageOfRegion);

      const regionEntry = [...stageOfRegion.entries()].find(([, id]) => id === s.stageId);
      let layout: EntryTemplateStage["layout"] = null;
      if (regionEntry) {
        const [sheet, tableId] = regionEntry[0].split("::");
        const l = doc.layout.find((x) => x.sheet === sheet && (x.tableId ?? "t1") === tableId);
        if (l && l.headerRows?.length) {
          layout = { sheet, tableId, headerRows: l.headerRows, merges: l.merges };
        }
      }
      // Migration presets sometimes store layout without stage entities.
      if (!layout) {
        const byLabel = doc.layout.find(
          (x) => x.sheet === s.label || x.sheet === s.stageId,
        );
        if (byLabel?.headerRows?.length) {
          layout = {
            sheet: byLabel.sheet,
            tableId: byLabel.tableId ?? "t1",
            headerRows: byLabel.headerRows,
            merges: byLabel.merges,
          };
        }
      }

      const score = stageScore(!!layout, migrated, defects.length > 0);
      const existing = stages.get(s.stageId);

      if (!existing) {
        stages.set(s.stageId, {
          stageId: s.stageId,
          label: s.label,
          sizeWise: !!s.sizeWise,
          isQualityGate: !!s.isQualityGate,
          columns,
          defects,
          layout,
          _score: score,
        });
        continue;
      }

      // UNION, not winner-take-all. Every verified workbook that touches this
      // stage contributes its columns; a second sheet sharing a defect code is
      // the *same* column (that shared code IS the learned relation), and a
      // code only one sheet has is added rather than dropped. `_score` now only
      // arbitrates the single-valued fields (label, layout).
      const byKey = new Map(existing.columns.map((c) => [c.key, c]));
      for (const c of columns) if (!byKey.has(c.key)) byKey.set(c.key, c);
      existing.columns = [...CAPTURE_ORDER]
        .map((k) => byKey.get(CAPTURE_COLUMNS[k].key))
        .filter((c): c is (typeof columns)[number] => !!c);

      const byCode = new Map(existing.defects.map((d) => [d.defectCode, d]));
      for (const d of defects) {
        const hit = byCode.get(d.defectCode);
        if (hit) {
          for (const src of d.sources) if (!hit.sources.includes(src)) hit.sources.push(src);
        } else {
          byCode.set(d.defectCode, d);
        }
      }
      existing.defects = [...byCode.values()];

      existing.sizeWise = existing.sizeWise || !!s.sizeWise;
      existing.isQualityGate = existing.isQualityGate || !!s.isQualityGate;
      if (score > (existing._score ?? 0)) {
        existing.label = s.label;
        if (layout) existing.layout = layout;
        existing._score = score;
      } else if (!existing.layout && layout) {
        existing.layout = layout;
      }
    }

    for (const sz of doc.sizes) if (!sizes.has(sz.sizeId)) sizes.set(sz.sizeId, sz);
    for (const v of doc.validation) {
      if (!seenRules.has(v.ruleId)) {
        seenRules.add(v.ruleId);
        validation.push(v);
      }
    }
  }

  // Strip internal score before shipping to the client.
  let stageList = [...stages.values()].map(({ _score, ...rest }) => rest);
  if (catalog) stageList = applyCatalog(stageList, catalog);

  return {
    stages: stageList,
    sizes: [...sizes.values()],
    validation,
    generatedFrom: rows.map((r) => ({
      modId: r.modId,
      version: r.version,
      fileName: r.document.workbook.fileName,
    })),
  };
}

export async function GET(req: NextRequest) {
  try {
    const store = getModStore();
    const company = process.env.MOID_COMPANY_ID || "default";
    const modId = req.nextUrl.searchParams.get("modId");

    let rows: ModRowT[];
    if (modId) {
      const row = await store.activeFor(modId);
      if (!row) {
        return NextResponse.json({ error: `No verified MOD for lineage ${modId}` }, { status: 404 });
      }
      rows = [row];
    } else {
      rows = await store.verified(company);
      if (rows.length === 0) {
        return NextResponse.json(
          { error: "No verified MODs yet — upload and verify a workbook first." },
          { status: 404 },
        );
      }
      // Prefer real uploaded workbooks over migration/seed MODs when both exist.
      // Seed alone still works (captures only; no invented defect columns).
      const real = rows.filter((r) => !isMigratedDoc(r.document));
      if (real.length > 0) rows = real;
    }

    const catalog = await getCatalogStore()
      .get(company)
      .catch(() => undefined);
    const template = templateFrom(rows, catalog);
    return NextResponse.json({
      template,
      // debug-friendly summary so deploy issues are diagnosable without guessing
      meta: {
        modCount: rows.length,
        stages: template.stages.map((s) => ({
          stageId: s.stageId,
          defectCount: s.defects.length,
          defectCodes: s.defects.map((d) => d.defectCode),
          captureCount: s.columns.length,
          hasLayout: !!s.layout,
        })),
        generatedFrom: template.generatedFrom,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to build entry template" },
      { status: 500 },
    );
  }
}
