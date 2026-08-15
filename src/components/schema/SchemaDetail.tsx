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

  // "Add X" — a folder node (category / defects-folder / all-defects-folder /
  // sizes-folder) offers to create a new child, pre-scoped to where you clicked.
  const [creating, setCreating] = useState<"stage" | "defect" | "size" | null>(null);
  const [newStage, setNewStage] = useState({
    stageId: "",
    label: "",
    category: "assembly" as string,
    captures: [] as string[],
    upstream: [] as string[],
    isQualityGate: false,
  });
  const [newDefect, setNewDefect] = useState({ defectCode: "", label: "", stages: [] as string[] });
  const [newSize, setNewSize] = useState({ sizeId: "", label: "" });
  useEffect(() => {
    setCreating(null);
  }, [node?.id]);

  if (!node) {
    return (
      <div style={emptyWrap}>
        <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, maxWidth: "42ch", lineHeight: 1.6 }}>
          Select anything on the left to edit it.
        </p>
        <p className="small" style={{ color: "var(--text-3)", margin: 0, maxWidth: "46ch", lineHeight: 1.6 }}>
          The three sections are fixed. Every stage, defect, size and learned
          spelling inside them can be edited, added or removed — and each change
          reaches Data Entry on the next load.
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
        {/* The header already names the section — repeating it as a row was
            the panel telling you what you just clicked. */}
        <p className="small" style={{ ...note, marginTop: 0 }}>
          {count === 0
            ? "No stages here yet. Add the first one below — it will appear in Data Entry as soon as it has capture columns."
            : `${count} ${count === 1 ? "stage" : "stages"}, in process order. This section is fixed, but everything inside it is yours to change.`}
        </p>
        {creating === "stage" ? (
          <NewStageForm
            draft={newStage}
            onChange={setNewStage}
            onCancel={() => setCreating(null)}
            onSave={() => {
              const stageId = newStage.stageId.trim().toLowerCase().replace(/\s+/g, "-");
              const label = newStage.label.trim();
              if (!stageId || !label) return;
              void mutate(
                {
                  action: "upsert-stage",
                  stage: {
                    stageId,
                    label,
                    category: newStage.category,
                    captures: newStage.captures,
                    upstream: newStage.upstream,
                    isQualityGate: newStage.isQualityGate,
                    effectiveFrom: null,
                    effectiveTo: null,
                  },
                },
                `Added stage ${stageId}`,
              );
              setCreating(null);
              setNewStage({ stageId: "", label: "", category: node.ref?.categoryId ?? "assembly", captures: [], upstream: [], isQualityGate: false });
            }}
            busy={busy}
          />
        ) : (
          <button
            type="button"
            style={addBtn}
            onClick={() => {
              setNewStage((d) => ({ ...d, category: node.ref?.categoryId ?? "assembly" }));
              setCreating("stage");
            }}
          >
            + Add stage to {node.label}
          </button>
        )}
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
        {creating === "defect" ? (
          <NewDefectForm
            draft={newDefect}
            stages={data.stages}
            onChange={setNewDefect}
            onCancel={() => setCreating(null)}
            onSave={() => {
              const defectCode = newDefect.defectCode.trim().toUpperCase();
              const label = newDefect.label.trim();
              if (!defectCode || !label) return;
              void mutate(
                { action: "upsert-defect", defect: { defectCode, label, aliases: [], stages: newDefect.stages } },
                `Added defect ${defectCode}`,
              );
              setCreating(null);
              setNewDefect({ defectCode: "", label: "", stages: [] });
            }}
            busy={busy}
          />
        ) : (
          <button
            type="button"
            style={addBtn}
            onClick={() => {
              setNewDefect((d) => ({ ...d, stages: [stage.stageId] }));
              setCreating("defect");
            }}
          >
            + Add defect to {stage.label}
          </button>
        )}
      </>
    );
  } else if (node.kind === "defect" && defect) {
    const scoped = node.ref?.scopedUnderStageId;
    const stages = (draft.stages as string[]) ?? [];
    body = (
      <>
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
        <Row label="Resolves to"><code style={mono}>{node.sublabel ?? "—"}</code></Row>
        <p className="small" style={note}>
          A spelling learned from a workbook. Removing it only stops the resolver
          using that rule; nothing on the ledger changes.
        </p>
      </>
    );
  } else if (node.kind === "all-defects-folder" || node.kind === "defects-folder") {
    const preScope = node.kind === "defects-folder" ? node.ref?.stageId : undefined;
    body = (
      <>
        <p className="small" style={{ ...note, marginTop: 0 }}>
          {node.children.length === 0
            ? "No defects here yet."
            : `${node.children.length} defect${node.children.length === 1 ? "" : "s"}. Select one to edit it.`}
        </p>
        {creating === "defect" ? (
          <NewDefectForm
            draft={newDefect}
            stages={data.stages}
            onChange={setNewDefect}
            onCancel={() => setCreating(null)}
            onSave={() => {
              const defectCode = newDefect.defectCode.trim().toUpperCase();
              const label = newDefect.label.trim();
              if (!defectCode || !label) return;
              void mutate(
                { action: "upsert-defect", defect: { defectCode, label, aliases: [], stages: newDefect.stages } },
                `Added defect ${defectCode}`,
              );
              setCreating(null);
              setNewDefect({ defectCode: "", label: "", stages: [] });
            }}
            busy={busy}
          />
        ) : (
          <button
            type="button"
            style={addBtn}
            onClick={() => {
              setNewDefect({ defectCode: "", label: "", stages: preScope ? [preScope] : [] });
              setCreating("defect");
            }}
          >
            + Add defect
          </button>
        )}
      </>
    );
  } else if (node.kind === "sizes-folder") {
    body = (
      <>
        <p className="small" style={{ ...note, marginTop: 0 }}>
          {node.children.length === 0
            ? "No sizes yet."
            : `${node.children.length} size${node.children.length === 1 ? "" : "s"} available across the plant.`}
        </p>
        {creating === "size" ? (
          <NewSizeForm
            draft={newSize}
            onChange={setNewSize}
            onCancel={() => setCreating(null)}
            onSave={() => {
              const sizeId = newSize.sizeId.trim();
              const label = newSize.label.trim();
              if (!sizeId) return;
              void mutate(
                { action: "upsert-size", size: { sizeId, label: label || sizeId } },
                `Added size ${sizeId}`,
              );
              setCreating(null);
              setNewSize({ sizeId: "", label: "" });
            }}
            busy={busy}
          />
        ) : (
          <button type="button" style={addBtn} onClick={() => setCreating("size")}>
            + Add size
          </button>
        )}
      </>
    );
  } else {
    body = (
      <>
        <p className="small" style={{ ...note, marginTop: 0 }}>
          {node.children.length} item{node.children.length === 1 ? "" : "s"}. Select one to edit it.
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
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <header
        style={{
          padding: "14px 20px 12px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          className="small"
          style={{
            color: "var(--text-3)",
            fontSize: 11,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            marginBottom: 3,
          }}
        >
          {KIND_LABEL[node.kind] ?? node.kind}
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 650,
            letterSpacing: "-0.01em",
            color: "var(--text)",
            fontFamily: MONO_TITLE.has(node.kind) ? "var(--font-mono)" : undefined,
          }}
        >
          {node.label}
        </h2>
      </header>

      <div style={{ padding: "16px 20px 20px", display: "grid", gap: 14, alignContent: "start", flex: 1 }}>
        {body}
      </div>

      {(canSave || deletable) && (
        <footer
          style={{
            display: "flex",
            gap: 8,
            padding: "12px 20px",
            borderTop: "1px solid var(--border)",
            background: "var(--surface-2)",
            position: "sticky",
            bottom: 0,
          }}
        >
          {canSave && (
            <button type="button" style={primaryBtn} onClick={onSave} disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </button>
          )}
          {deletable && (
            <button type="button" style={dangerBtn} onClick={onDelete} disabled={busy}>
              {intent.kind === "unscope-defect" ? "Remove from this stage" : "Delete…"}
            </button>
          )}
        </footer>
      )}
    </div>
  );
}

/** Titles that ARE data — codes and spellings — not prose. */
const MONO_TITLE = new Set(["defect", "alias", "mapping"]);

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
  padding: "32px 24px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: 10,
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

const addBtn: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  padding: "7px 12px",
  borderRadius: 8,
  border: "1px dashed var(--border-strong)",
  background: "var(--surface-2)",
  color: "var(--accent)",
  cursor: "pointer",
  alignSelf: "start",
};

interface NewStageDraft {
  stageId: string;
  label: string;
  category: string;
  captures: string[];
  upstream: string[];
  isQualityGate: boolean;
}

function NewStageForm({
  draft,
  onChange,
  onSave,
  onCancel,
  busy,
}: {
  draft: NewStageDraft;
  onChange: (next: NewStageDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const canSave = draft.stageId.trim().length > 0 && draft.label.trim().length > 0;
  return (
    <div style={formBox}>
      <Row label="Stage ID">
        <input
          style={input}
          placeholder="e.g. shrink-wrap"
          value={draft.stageId}
          onChange={(e) => onChange({ ...draft, stageId: e.target.value })}
        />
      </Row>
      <Row label="Label">
        <input
          style={input}
          placeholder="e.g. Shrink Wrap"
          value={draft.label}
          onChange={(e) => onChange({ ...draft, label: e.target.value })}
        />
      </Row>
      <Row label="Section">
        <select
          style={input}
          value={draft.category}
          onChange={(e) => onChange({ ...draft, category: e.target.value })}
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
                checked={draft.captures.includes(c)}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    captures: e.target.checked
                      ? [...draft.captures, c]
                      : draft.captures.filter((x) => x !== c),
                  })
                }
              />
              {c}
            </label>
          ))}
        </div>
      </Row>
      <FormButtons canSave={canSave} busy={busy} onSave={onSave} onCancel={onCancel} />
    </div>
  );
}

interface NewDefectDraft {
  defectCode: string;
  label: string;
  stages: string[];
}

function NewDefectForm({
  draft,
  stages,
  onChange,
  onSave,
  onCancel,
  busy,
}: {
  draft: NewDefectDraft;
  stages: { stageId: string; label: string }[];
  onChange: (next: NewDefectDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const canSave = draft.defectCode.trim().length > 0 && draft.label.trim().length > 0;
  return (
    <div style={formBox}>
      <Row label="Code">
        <input
          style={input}
          placeholder="e.g. SD"
          value={draft.defectCode}
          onChange={(e) => onChange({ ...draft, defectCode: e.target.value })}
        />
      </Row>
      <Row label="Label">
        <input
          style={input}
          placeholder="e.g. Surface Damage"
          value={draft.label}
          onChange={(e) => onChange({ ...draft, label: e.target.value })}
        />
      </Row>
      <Row label="Scoped to">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {stages.map((s) => (
            <label key={s.stageId} style={checkLabel}>
              <input
                type="checkbox"
                checked={draft.stages.includes(s.stageId)}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    stages: e.target.checked
                      ? [...draft.stages, s.stageId]
                      : draft.stages.filter((x) => x !== s.stageId),
                  })
                }
              />
              {s.label}
            </label>
          ))}
        </div>
      </Row>
      <FormButtons canSave={canSave} busy={busy} onSave={onSave} onCancel={onCancel} />
    </div>
  );
}

function NewSizeForm({
  draft,
  onChange,
  onSave,
  onCancel,
  busy,
}: {
  draft: { sizeId: string; label: string };
  onChange: (next: { sizeId: string; label: string }) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const canSave = draft.sizeId.trim().length > 0;
  return (
    <div style={formBox}>
      <Row label="Size ID">
        <input
          style={input}
          placeholder="e.g. Fr16"
          value={draft.sizeId}
          onChange={(e) => onChange({ ...draft, sizeId: e.target.value })}
        />
      </Row>
      <Row label="Label">
        <input
          style={input}
          placeholder="e.g. 16Fr"
          value={draft.label}
          onChange={(e) => onChange({ ...draft, label: e.target.value })}
        />
      </Row>
      <FormButtons canSave={canSave} busy={busy} onSave={onSave} onCancel={onCancel} />
    </div>
  );
}

function FormButtons({
  canSave,
  busy,
  onSave,
  onCancel,
}: {
  canSave: boolean;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button type="button" style={primaryBtn} disabled={!canSave || busy} onClick={onSave}>
        {busy ? "Saving…" : "Save"}
      </button>
      <button type="button" style={ghostBtn} disabled={busy} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

const formBox: React.CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 12,
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
};

const ghostBtn: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text-2)",
  cursor: "pointer",
};
