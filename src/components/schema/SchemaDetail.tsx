"use client";

// The editor half of Data Schema. Dispatches on node kind; every mutation goes
// through the page's existing `mutate` helper and the existing /api/schema
// actions — this panel adds no new endpoints.
//
// The one rule worth stating: deleting a defect from a STAGE folder unscopes it
// from that stage, while deleting from All defects removes it everywhere.
// deleteIntentFor() in lib/schema/tree.ts decides which; this file only asks.

import React, { useEffect, useMemo, useState } from "react";
import { STAGE_CATEGORIES } from "@/core/ontology/plant-catalog";
import {
  deleteIntentFor,
  type SchemaNode,
  type SchemaTreeInput,
} from "@/lib/schema/tree";

const CAPTURE_OPTS = ["checked", "accepted", "hold", "rejected"] as const;

export interface SchemaDetailProps {
  node: SchemaNode | null;
  data: SchemaTreeInput;
  busy: boolean;
  mutate: (body: Record<string, unknown>, okMsg: string) => void | Promise<void>;
}

export default function SchemaDetail({ node, data, busy, mutate }: SchemaDetailProps) {
  const stage = useMemo(
    () => data.stages.find((s) => s.stageId === node?.ref?.stageId) ?? null,
    [data.stages, node],
  );
  const defect = useMemo(
    () => data.defects.find((d) => d.defectCode === node?.ref?.defectCode) ?? null,
    [data.defects, node],
  );
  const size = useMemo(
    () => data.sizes.find((s) => s.sizeId === node?.ref?.sizeId) ?? null,
    [data.sizes, node],
  );

  // Local draft, reset whenever the selection changes.
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  useEffect(() => {
    if (node?.kind === "stage" && stage) setDraft({ ...stage });
    else if (node?.kind === "defect" && defect) setDraft({ ...defect });
    else if (node?.kind === "size" && size) setDraft({ ...size });
    else setDraft({});
  }, [node, stage, defect, size]);

  if (!node) {
    return (
      <div style={emptyWrap}>
        <div className="h3" style={{ marginBottom: 6 }}>Nothing selected</div>
        <p className="small" style={{ color: "var(--text-3)", maxWidth: 320 }}>
          Pick a stage, defect, size or alias on the left. Section folders are
          fixed; everything inside them can be edited, added or removed.
        </p>
      </div>
    );
  }

  const onDelete = () => {
    const intent = deleteIntentFor(node, data);
    switch (intent.kind) {
      case "not-deletable":
        alert(intent.reason);
        return;

      case "unscope-defect": {
        const last = intent.remaining.length === 0;
        const msg = last
          ? `Remove ${intent.defectCode} from this stage?\n\nIt is not scoped to any other stage, so it will stop appearing in Data Entry entirely. The definition stays in All defects.`
          : `Remove ${intent.defectCode} from this stage only?\n\nIt stays on: ${intent.remaining.join(", ")}.`;
        if (!confirm(msg)) return;
        const target = data.defects.find((d) => d.defectCode === intent.defectCode);
        if (!target) return;
        void mutate(
          {
            action: "upsert-defect",
            defect: {
              ...target,
              aliases: target.aliases ?? [],
              stages: (target.stages ?? []).filter((s) => s !== intent.stageId),
            },
          },
          `${intent.defectCode} unscoped from ${intent.stageId}`,
        );
        return;
      }

      case "delete-defect": {
        const where = intent.affectedStages.length
          ? `\n\nIt will disappear from: ${intent.affectedStages.join(", ")}.`
          : "";
        if (!confirm(`Delete ${intent.defectCode} from the master schema?${where}\n\nLedger events are not deleted.`)) return;
        void mutate(
          { action: "delete-defect", id: intent.defectCode },
          `Removed defect ${intent.defectCode}`,
        );
        return;
      }

      case "delete-stage": {
        const orphan = intent.orphanedDefects.length
          ? `\n\nThese defects live only on this stage and will be left scoped to nothing: ${intent.orphanedDefects.join(", ")}.`
          : "";
        if (!confirm(`Delete stage ${intent.stageId} from the master schema?${orphan}\n\nLedger events are not deleted.`)) return;
        void mutate({ action: "delete-stage", id: intent.stageId }, `Removed stage ${intent.stageId}`);
        return;
      }

      case "delete-size":
        if (!confirm(`Remove size ${intent.sizeId}?`)) return;
        void mutate({ action: "delete-size", id: intent.sizeId }, `Removed size ${intent.sizeId}`);
        return;

      case "delete-mapping":
        if (!confirm(`Remove the learned spelling “${intent.mappingKey}”?\n\nThe resolver will stop using this Excel→canonical rule. Ledger facts are not deleted.`)) return;
        void mutate(
          { action: "delete-mapping", kind: intent.mappingKind, key: intent.mappingKey },
          `Removed mapping ${intent.mappingKey}`,
        );
        return;
    }
  };

  // ── Per-kind editors ────────────────────────────────────────────────────
  let body: React.ReactNode = null;

  if (node.kind === "category") {
    const count = node.children.length;
    body = (
      <>
        <Row label="Section">{node.label}</Row>
        <Row label="Stages">{count}</Row>
        <p className="small" style={note}>
          The three sections are fixed — they cannot be renamed, added to or
          removed, so this schema stays recognisable as this plant&apos;s process.
          The stages inside are fully editable.
        </p>
      </>
    );
  } else if (node.kind === "stage" && stage) {
    const captures = (draft.captures as string[]) ?? [];
    body = (
      <>
        <Row label="Stage ID">
          <code style={mono}>{stage.stageId}</code>
        </Row>
        <Row label="Label">
          <input
            style={input}
            value={(draft.label as string) ?? ""}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
        </Row>
        <Row label="Section">
          <select
            style={input}
            value={(draft.category as string) ?? ""}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          >
            {STAGE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </Row>
        <Row label="Captures">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {CAPTURE_OPTS.map((c) => (
              <label key={c} style={checkLabel}>
                <input
                  type="checkbox"
                  checked={captures.includes(c)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      captures: e.target.checked
                        ? [...captures, c]
                        : captures.filter((x) => x !== c),
                    })
                  }
                />
                {c}
              </label>
            ))}
          </div>
        </Row>
        <Row label="Quality gate">
          <label style={checkLabel}>
            <input
              type="checkbox"
              checked={!!draft.isQualityGate}
              onChange={(e) => setDraft({ ...draft, isQualityGate: e.target.checked })}
            />
            records a pass/fail disposition
          </label>
        </Row>
        <p className="small" style={note}>
          A stage with no capture columns cannot be typed into and is hidden from
          Data Entry.
        </p>
      </>
    );
  } else if (node.kind === "defect" && defect) {
    const scoped = node.ref?.scopedUnderStageId;
    const stages = (draft.stages as string[]) ?? [];
    body = (
      <>
        <Row label="Code">
          <code style={mono}>{defect.defectCode}</code>
        </Row>
        <Row label="Label">
          <input
            style={input}
            value={(draft.label as string) ?? ""}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
        </Row>
        <Row label="Scoped to">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {data.stages.map((s) => (
              <label key={s.stageId} style={checkLabel}>
                <input
                  type="checkbox"
                  checked={stages.includes(s.stageId)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      stages: e.target.checked
                        ? [...stages, s.stageId]
                        : stages.filter((x) => x !== s.stageId),
                    })
                  }
                />
                {s.label}
              </label>
            ))}
          </div>
        </Row>
        {scoped && (
          <p className="small" style={note}>
            You are viewing this defect inside a stage. <strong>Remove</strong> here
            unscopes it from that stage only — the definition and its other stages
            survive. To delete it everywhere, open it under <em>All defects</em>.
          </p>
        )}
      </>
    );
  } else if (node.kind === "size" && size) {
    body = (
      <>
        <Row label="Size ID"><code style={mono}>{size.sizeId}</code></Row>
        <Row label="Label">
          <input
            style={input}
            value={(draft.label as string) ?? ""}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
        </Row>
      </>
    );
  } else if (node.kind === "alias" || node.kind === "mapping") {
    body = (
      <>
        <Row label="Spelling"><code style={mono}>{node.label}</code></Row>
        <Row label="Resolves to"><code style={mono}>{node.sublabel ?? "—"}</code></Row>
        <p className="small" style={note}>
          A spelling learned from a workbook. Removing it only stops the resolver
          using that rule; nothing on the ledger changes.
        </p>
      </>
    );
  } else {
    body = (
      <>
        <Row label="Folder">{node.label}</Row>
        <Row label="Items">{node.children.length}</Row>
        <p className="small" style={note}>
          Select an item inside this folder to edit it.
        </p>
      </>
    );
  }

  const canSave =
    (node.kind === "stage" && !!stage) ||
    (node.kind === "defect" && !!defect) ||
    (node.kind === "size" && !!size);

  const onSave = () => {
    if (node.kind === "stage" && stage) {
      void mutate({ action: "upsert-stage", stage: { ...stage, ...draft } }, `Saved ${stage.stageId}`);
    } else if (node.kind === "defect" && defect) {
      void mutate(
        { action: "upsert-defect", defect: { ...defect, aliases: defect.aliases ?? [], ...draft } },
        `Saved ${defect.defectCode}`,
      );
    } else if (node.kind === "size" && size) {
      void mutate({ action: "upsert-size", size: { ...size, ...draft } }, `Saved ${size.sizeId}`);
    }
  };

  const intent = deleteIntentFor(node, data);
  const deletable = intent.kind !== "not-deletable";

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ marginBottom: 12 }}>
        <div className="h3">{node.label}</div>
        <div className="small" style={{ color: "var(--text-3)" }}>
          {KIND_LABEL[node.kind] ?? node.kind}
        </div>
      </div>

      <div style={{ display: "grid", gap: 10, flex: 1, alignContent: "start" }}>{body}</div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        {canSave && (
          <button type="button" style={primaryBtn} onClick={onSave} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        )}
        {deletable && (
          <button type="button" style={dangerBtn} onClick={onDelete} disabled={busy}>
            {intent.kind === "unscope-defect" ? "Remove from this stage" : "Delete…"}
          </button>
        )}
      </div>
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  category: "Section (fixed)",
  stage: "Stage",
  defect: "Defect",
  size: "Size",
  alias: "Learned spelling",
  mapping: "Learned mapping",
  "captures-folder": "Capture columns",
  "defects-folder": "Defects on this stage",
  "aliases-folder": "Learned spellings",
  "defect-scope-folder": "Stages using this defect",
  "all-defects-folder": "Every defect in the schema",
  "sizes-folder": "Sizes",
  "unmatched-folder": "Patterns resolving to nothing",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 10, alignItems: "center" }}>
      <span className="small" style={{ color: "var(--text-3)" }}>{label}</span>
      <div style={{ fontSize: 13 }}>{children}</div>
    </div>
  );
}

const emptyWrap: React.CSSProperties = {
  padding: 24,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  height: "100%",
};

const mono: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 12.5 };

const input: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: 13,
  fontFamily: "inherit",
};

const checkLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  fontSize: 12.5,
  color: "var(--text-2)",
};

const note: React.CSSProperties = {
  color: "var(--text-3)",
  fontSize: 12,
  lineHeight: 1.5,
  marginTop: 4,
};

const primaryBtn: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "var(--text-invert)",
  cursor: "pointer",
};

const dangerBtn: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid color-mix(in srgb, var(--critical) 30%, var(--border))",
  background: "var(--surface)",
  color: "var(--critical)",
  cursor: "pointer",
};
