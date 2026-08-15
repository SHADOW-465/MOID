"use client";

// The tree half of Data Schema. Renders whatever nodes it is handed and knows
// nothing about stages, defects or sizes — every structural rule lives in
// lib/schema/tree.ts. Keyboard model follows the WAI-ARIA tree pattern.

import React, { useCallback, useMemo } from "react";
import { visibleRows, type SchemaNode, type SchemaNodeBadge } from "@/lib/schema/tree";

const BADGE_STYLE: Record<SchemaNodeBadge, { label: string; color: string; title: string }> = {
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
    color: "var(--status-warn, #d97706)",
    title: "Spelling differs from the canonical id — learned from a workbook.",
  },
  orphan: {
    label: "orphan",
    color: "var(--critical)",
    title: "Resolves to nothing, or is scoped to no stage — invisible downstream.",
  },
};

function Badge({ badge }: { badge: SchemaNodeBadge }) {
  const b = BADGE_STYLE[badge];
  return (
    <span
      title={b.title}
      style={{
        marginLeft: 6,
        padding: "0 5px",
        borderRadius: 999,
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: 0.2,
        color: b.color,
        background: `color-mix(in srgb, ${b.color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${b.color} 32%, transparent)`,
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

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent, node: SchemaNode, index: number) => {
      const move = (to: number) => {
        e.preventDefault();
        const next = rows[to];
        if (!next) return;
        const el = document.getElementById(`schema-node-${next.node.id}`);
        el?.focus();
      };
      const open = expanded.has(node.id);
      switch (e.key) {
        case "ArrowDown":
          return move(index + 1);
        case "ArrowUp":
          return move(index - 1);
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
      <div className="small" style={{ padding: 16, color: "var(--text-3)" }}>
        Nothing matches.
      </div>
    );
  }

  return (
    <div role="tree" aria-label="Plant schema" style={{ padding: 4 }}>
      {rows.map(({ node, depth }, i) => {
        const open = expanded.has(node.id);
        const selected = node.id === selectedId;
        const hasKids = node.children.length > 0;
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
            onClick={() => {
              onSelect(node);
              if (hasKids) onToggle(node.id);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              paddingLeft: 8 + depth * 14,
              borderRadius: 6,
              cursor: "pointer",
              outlineOffset: -2,
              background: selected
                ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                : "transparent",
              boxShadow: selected ? "inset 2px 0 0 var(--accent)" : undefined,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 12,
                flexShrink: 0,
                color: "var(--text-3)",
                fontSize: 9,
                transform: open ? "rotate(90deg)" : undefined,
                transition: "transform 120ms",
              }}
            >
              {hasKids ? "▶" : ""}
            </span>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: node.kind === "category" ? 700 : node.kind === "stage" ? 600 : 400,
                color: node.locked ? "var(--text-2)" : "var(--text)",
                fontFamily:
                  node.kind === "defect" || node.kind === "alias" || node.kind === "mapping"
                    ? "var(--font-mono)"
                    : undefined,
                whiteSpace: "nowrap",
              }}
            >
              {node.label}
            </span>
            {node.badge && <Badge badge={node.badge} />}
            {node.sublabel && (
              <span
                className="small"
                style={{
                  fontSize: 11,
                  color: "var(--text-3)",
                  marginLeft: 6,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {node.sublabel}
              </span>
            )}
            {node.locked && (
              <span
                title="Section folders are fixed — stages and defects inside them are fully editable."
                aria-label="locked"
                style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-3)" }}
              >
                🔒
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
