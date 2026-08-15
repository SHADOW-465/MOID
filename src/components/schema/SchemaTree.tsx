"use client";

// The tree half of Data Schema. Renders whatever nodes it is handed and knows
// nothing about stages, defects or sizes — every structural rule lives in
// lib/schema/tree.ts. Keyboard model follows the WAI-ARIA tree pattern.
//
// Depth reads through indent guides rather than indentation alone: a directory
// is legible because you can see which trunk a row hangs off, and at four
// levels deep padding-left on its own stops answering that.

import React, { useCallback, useMemo, useState } from "react";
import { visibleRows, type SchemaNode, type SchemaNodeBadge } from "@/lib/schema/tree";

/** Row geometry. One place, so the indent guides and rows can never disagree. */
const ROW_H = 30;
const INDENT = 16;

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      style={{
        transform: open ? "rotate(90deg)" : "none",
        transition: "transform var(--duration-fast) var(--ease-out)",
        flexShrink: 0,
      }}
    >
      <path
        d="M4.5 2.5L8 6l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Lock() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <rect x="2.5" y="5.25" width="7" height="5" rx="1.25" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.25 5.25V3.9a1.75 1.75 0 013.5 0v1.35" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

const BADGE: Record<SchemaNodeBadge, { label: string; color: string; title: string }> = {
  shared: {
    label: "shared",
    color: "var(--accent)",
    title: "Scoped to more than one stage — the definition lives in All defects.",
  },
  "quality-gate": {
    label: "gate",
    color: "var(--positive)",
    title: "Quality gate — this stage records a pass/fail disposition.",
  },
  misspelling: {
    label: "variant",
    color: "var(--warning)",
    title: "Spelling differs from the canonical id — learned from a workbook.",
  },
  orphan: {
    label: "orphan",
    color: "var(--critical)",
    title: "Resolves to nothing, or is scoped to no stage — invisible downstream.",
  },
};

function Badge({ badge }: { badge: SchemaNodeBadge }) {
  const b = BADGE[badge];
  return (
    <span
      title={b.title}
      style={{
        flexShrink: 0,
        padding: "0 5px",
        borderRadius: "var(--radius-pill)",
        fontSize: 9.5,
        lineHeight: "15px",
        fontWeight: 600,
        letterSpacing: "0.02em",
        color: b.color,
        background: `color-mix(in srgb, ${b.color} 12%, transparent)`,
      }}
    >
      {b.label}
    </span>
  );
}

export interface SchemaTreeProps {
  nodes: SchemaNode[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selectedId: string | null;
  onSelect: (node: SchemaNode) => void;
}

export default function SchemaTree({
  nodes,
  expanded,
  onToggle,
  selectedId,
  onSelect,
}: SchemaTreeProps) {
  const rows = useMemo(() => visibleRows(nodes, expanded), [nodes, expanded]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent, node: SchemaNode, index: number) => {
      const move = (to: number) => {
        e.preventDefault();
        const next = rows[to];
        if (!next) return;
        document.getElementById(`schema-node-${next.node.id}`)?.focus();
      };
      const open = expanded.has(node.id);
      switch (e.key) {
        case "ArrowDown":
          return move(index + 1);
        case "ArrowUp":
          return move(index - 1);
        case "Home":
          return move(0);
        case "End":
          return move(rows.length - 1);
        case "ArrowRight":
          if (node.children.length > 0 && !open) {
            e.preventDefault();
            onToggle(node.id);
          } else if (node.children.length > 0) {
            move(index + 1);
          }
          return;
        case "ArrowLeft":
          if (node.children.length > 0 && open) {
            e.preventDefault();
            onToggle(node.id);
          }
          return;
        case "Enter":
        case " ":
          e.preventDefault();
          onSelect(node);
          if (node.children.length > 0) onToggle(node.id);
          return;
        default:
      }
    },
    [rows, expanded, onToggle, onSelect],
  );

  if (rows.length === 0) {
    return (
      <div style={{ padding: "28px 16px", textAlign: "center" }}>
        <p className="small" style={{ color: "var(--text-3)", margin: 0 }}>
          Nothing matches that search.
        </p>
      </div>
    );
  }

  return (
    <div role="tree" aria-label="Plant schema" style={{ padding: "6px 6px 12px" }}>
      {rows.map(({ node, depth }, i) => {
        const open = expanded.has(node.id);
        const selected = node.id === selectedId;
        const hovered = hoveredId === node.id;
        const hasKids = node.children.length > 0;
        const isSection = node.kind === "category";
        // Top-level groups get air above them; siblings stay tight. That
        // contrast is what turns a flat list into readable groups.
        const startsGroup = depth === 0 && i > 0;

        return (
          <div
            key={node.id}
            id={`schema-node-${node.id}`}
            role="treeitem"
            aria-level={depth + 1}
            aria-selected={selected}
            aria-expanded={hasKids ? open : undefined}
            tabIndex={i === 0 ? 0 : -1}
            onKeyDown={(e) => onKeyDown(e, node, i)}
            onMouseEnter={() => setHoveredId(node.id)}
            onMouseLeave={() => setHoveredId((cur) => (cur === node.id ? null : cur))}
            onClick={() => {
              onSelect(node);
              if (hasKids) onToggle(node.id);
            }}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 6,
              height: ROW_H,
              paddingRight: 8,
              marginTop: startsGroup ? 10 : 0,
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              userSelect: "none",
              background: selected
                ? "var(--accent-weak)"
                : hovered
                  ? "var(--surface-2)"
                  : "transparent",
              transition: "background var(--duration-fast) var(--ease-out)",
            }}
          >
            {/* Indent guides — one hairline per ancestor level. */}
            {Array.from({ length: depth }, (_, d) => (
              <span
                key={d}
                aria-hidden
                style={{
                  position: "absolute",
                  left: 10 + d * INDENT,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  background: "var(--border)",
                }}
              />
            ))}
            {selected && (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: 0,
                  top: 4,
                  bottom: 4,
                  width: 2,
                  borderRadius: 2,
                  background: "var(--accent)",
                }}
              />
            )}

            <span style={{ width: depth * INDENT, flexShrink: 0 }} />

            <span
              style={{
                display: "grid",
                placeItems: "center",
                width: 14,
                flexShrink: 0,
                marginLeft: 4,
                color: "var(--text-3)",
              }}
            >
              {hasKids && <Chevron open={open} />}
            </span>

            <span
              title={node.label}
              style={{
                fontSize: 12.5,
                fontWeight: isSection ? 650 : node.kind === "stage" ? 550 : 400,
                letterSpacing: isSection ? "0.01em" : undefined,
                color: selected ? "var(--accent)" : isSection ? "var(--text)" : "var(--text-2)",
                fontFamily: MONO_KINDS.has(node.kind) ? "var(--font-mono)" : undefined,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {node.label}
            </span>

            {node.locked && (
              <span
                title="Fixed section — it cannot be renamed, added to or removed. The stages inside are fully editable."
                aria-label="fixed"
                style={{ display: "grid", placeItems: "center", color: "var(--text-3)", flexShrink: 0 }}
              >
                <Lock />
              </span>
            )}

            {node.badge && <Badge badge={node.badge} />}

            {/* Inline description — the label's qualifier, so it stays beside it. */}
            {node.sublabel && (
              <span
                title={node.sublabel}
                style={{
                  minWidth: 0,
                  fontSize: 11,
                  color: "var(--text-3)",
                  fontFamily: MONO_KINDS.has(node.kind) ? undefined : "var(--font-mono)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {node.sublabel}
              </span>
            )}

            {/* Counts share one right-hand gutter so the eye reads a column,
                not a ragged trail after each label. */}
            {node.count != null && (
              <span
                style={{
                  marginLeft: "auto",
                  paddingLeft: 10,
                  flexShrink: 0,
                  fontSize: 11,
                  fontVariantNumeric: "tabular-nums",
                  color: node.count === 0 ? "var(--text-3)" : "var(--text-2)",
                  opacity: node.count === 0 ? 0.55 : 1,
                }}
              >
                {node.count.toLocaleString()}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Kinds whose label IS data — ids, codes, spellings — not prose. */
const MONO_KINDS = new Set(["defect", "alias", "mapping", "capture"]);
