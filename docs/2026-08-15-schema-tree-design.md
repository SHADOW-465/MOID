# Data Schema as a directory tree

**Status:** approved design, not yet implemented
**Date:** 2026-08-15
**Surface:** `/schema` (Data Schema page)

## Problem

The Data Schema page presents the plant's durable knowledge as four flat
tables — stages, defects, sizes, mappings — switched by a section selector.
Each table is correct in isolation and says nothing about how the pieces
connect. A stage's capture columns, the defects scoped to it, and the Excel
spellings that resolve to it are three separate lookups in three separate
tables. There is no view that answers "what does the system know about Visual
Inspection?" in one place.

The catalog is also the most consequential data in the app: Data Entry is a
projection of it, and every analytics rollup keys off its stage ids. Editing it
through flat tables makes the blast radius of a delete invisible — removing a
defect row does not show which stages just lost a column.

## Goal

Present the catalog as a directory tree so structure and relationships are
visible, and make edit / delete operations state their consequences before
they happen. Same data, same mutations, better shape.

## Non-goals

- Changing the catalog's storage shape. It stays flat on disk; the tree is a
  derived projection.
- Changing any analytics rollup or stage id.
- Letting operators reorganise the plant's structure (see "Locked structure").

## Locked structure

Category folders (`primary`, `secondary`, `assembly`) are **not user-editable** —
neither their labels nor their membership. They are authored in
`core/ontology/plant-catalog.ts` and owned by the code.

The reason is ownership, not simplicity. The schema is the plant's process
written down; a deployment could otherwise be reorganised and re-pointed at a
different plant without the owner's involvement. Locking the structural spine
keeps the catalog recognisable as *this* plant's process while leaving the
contents — stages, defects, sizes, aliases — fully editable.

Consequence: a stage's `category` becomes a **read-only** property in the
detail panel. It is displayed, never edited. Everything else about a stage
(label, captures, upstream, quality-gate flag, effective dates) stays editable
exactly as today.

### Authored structure changes

Three edits to `plant-catalog.ts`, shipped as part of this work:

1. The `primary` category's label becomes **"Production Dipping"** (was
   "Primary (P1–P9)"). The id stays `primary` — every rollup, `STAGE_CATEGORY`
   lookup and `DEFAULT_STAGE_CATEGORIES` entry is untouched.
2. `eye-punching` moves from `primary` to `secondary`.
3. `hanging` moves from `primary` to `secondary`.

Resulting membership:

| Category (id) | Stages |
|---|---|
| Production Dipping (`primary`) | Production (Dipping), Leaching, Chlorination, Gauge, Trimming, Balloon Production |
| Secondary (`secondary`) | Secondary Production, Eye Punching, Hanging |
| Assembly (`assembly`) | Visual Inspection (P17), Balloon Inspection, Valve Fixing, Valve Integrity, Final Inspection (P24), Primary Pack Inspection |

Already-seeded plants hold their own stored catalog and will not pick these up
on their own, because the existing backfill only inserts missing stages and
repairs empty fields — it never overwrites a populated `category`. Since
category assignment is now code-owned rather than a per-plant preference, the
backfill in `load-catalog.ts` is extended to realign `category` for **authored**
stages (stages the plant did not invent), gated behind a bumped `SEED_TAG`.
Hand-added stages keep whatever category they were given.

## Tree shape

Derived by a pure function; never stored.

```
Plant schema
├─ Production Dipping                     (locked folder)
│  └─ Production (Dipping)
│     ├─ Captures (3)      checked · accepted · rejected
│     └─ Defects (8)       AIR, COAG ↩ shared …
│     ⌐ no Aliases folder anywhere in this category
├─ Secondary                              (locked folder)
│  ├─ Secondary Production
│  ├─ Eye Punching
│  └─ Hanging
├─ Assembly                               (locked folder)
│  ├─ Visual Inspection (P17)   ⚑ quality gate
│  │  ├─ Captures (4)
│  │  ├─ Defects (21)      COAG ↩ also on Final
│  │  └─ Aliases (5)       VISUAL INSEPTION ⚠ misspelling
│  └─ Final Inspection (P24)
├─ All defects (38)                       ← definitions live here
│  └─ COAG
│     ├─ Scoped to (2)     Visual · Final
│     └─ Aliases (3)
├─ Sizes (12)
└─ Unmatched patterns (33)  column-mappings / header-patterns with no target
```

Stages sort by the `upstream[]` cascade so the tree reads down the process line.

### Aliases

Stage-aliases nest under their stage; defect-aliases under their defect.
Column-mappings and header-patterns that resolve to no single entity collect in
`Unmatched patterns`.

**Exception:** no stage inside the **Production Dipping** category renders an
Aliases folder. Those mappings remain in the catalog and keep resolving during
Excel ingestion — they are simply not surfaced as tree nodes.

### Shared defects

A defect scoped to several stages appears under each of them, like a hard link,
and carries a `↩ shared` badge naming its other stages. Its definition lives in
the top-level `All defects` folder.

## Deletion semantics

The part that has to be exactly right. Every row maps to an **existing** API
action — no new endpoints.

| Where you delete | What happens | Action |
|---|---|---|
| Defect inside a **stage** folder | Unscopes from that stage only | `upsert-defect` with `stages` minus one |
| Defect in **All defects** | Global delete; confirm names every affected stage | `delete-defect` |
| Last scope removed | Warns — an unscoped defect disappears from Data Entry | — |
| Stage | Confirm names defects left orphaned | `delete-stage` |
| Size | Unchanged from today | `delete-size` |
| Alias / mapping | Unchanged from today | `delete-mapping` |
| Category folder | Not deletable (locked) | — |

## Architecture

Three new units, each independently understandable:

**`src/lib/schema/tree.ts`** — pure derivation. Exports `SchemaNode`,
`SchemaNodeKind`, and `buildSchemaTree({ stages, defects, sizes, mappings })`.
Holds every structural rule: category membership and order, process ordering
via `upstream[]`, shared-defect badging, the Production Dipping alias
exception, orphan bucketing. No React, no I/O — testable in the node
environment like `lib/analytics/`.

```ts
export interface SchemaNode {
  id: string;            // stable path, "cat:assembly/stage:visual/defects/defect:COAG"
  kind: SchemaNodeKind;  // category | stage | captures | defect-folder | defect | …
  label: string;
  sublabel?: string;     // "21 scoped", "also on Final"
  badge?: "shared" | "misspelling" | "orphan" | "quality-gate";
  locked?: boolean;      // category folders
  ref?: { stageId?: string; defectCode?: string; sizeId?: string; mappingKey?: string };
  children: SchemaNode[];
}
```

**`src/components/schema/SchemaTree.tsx`** — recursive renderer. Rows, expand
/ collapse, selection, `role="tree"` / `role="treeitem"` with `aria-expanded`, and
arrow-key navigation. Holds no schema knowledge; renders whatever nodes it is
given.

**`src/components/schema/SchemaDetail.tsx`** — the right-hand editor,
dispatching on `node.kind`. Reuses the existing field components and save
handlers from `page.tsx`; adds the unscope-vs-delete decision described above.

`src/app/schema/page.tsx` keeps its integrity panel, workbook/MOD lineage,
fiscal-year control and load-catalog action. The four table blocks are removed
in favour of the tree, which should take 600–800 lines out of a 2,467-line
file.

## State

Expanded-node set and selected-node id live in the page component. The expanded
set persists to `localStorage` so the tree remembers where you were. A search
box filters nodes and auto-expands to matches.

## Error handling

- Save failures surface in the detail panel; the tree keeps the prior value
  until the write confirms.
- Deletes that would orphan something require confirmation naming the affected
  entities.
- A stage stored with an unknown category renders under its own folder rather
  than being silently dropped — the same rule `source-trace.ts` already uses for
  unclassified stages.

## Testing

`buildSchemaTree` is pure, so jest covers it in the node environment:

- hierarchy shape — categories → stages → captures / defects / aliases
- process ordering follows `upstream[]`, not insertion or alphabetical order
- a defect on several stages appears under each, badged, with its definition in
  `All defects`
- no stage under Production Dipping emits an Aliases folder; stages in other
  categories do
- mappings with no resolvable target land in `Unmatched patterns`
- the unscope-vs-delete helper returns unscope for a stage-scoped delete and
  global delete only from `All defects`
- a stage with an unrecognised category still appears

Component rendering is not tested — the suite runs node-only, with no jsdom, per
`AGENTS.md`.

## Deliberately not built

- **Drag-and-drop re-scoping.** Fiddly, hostile to keyboard users, and moot now
  that structure is locked.
- **Bulk multi-select.** No current workflow needs it.
- **Virtualisation.** ~250 nodes at full expansion.
- **Inline id renaming.** Changing a `stageId` or `defectCode` is an identity
  change with ledger consequences; it stays in the detail panel under the rules
  that already govern it.
