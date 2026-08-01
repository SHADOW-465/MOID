"use client";

// Lot identity, composed from the day the lot STARTED.
//
// The bug this replaces: the batch code was rebuilt from "Recorded on", the day
// the current station ran the lot. A lot spans several days on the floor, so
// setting Recorded on to tomorrow silently renamed the lot. The previous
// guard was a `batchManual` flag flipped by typing or entering a quantity —
// interaction-based, so an operator who simply moved the date first still lost
// the code.
//
// The fix is structural, not another guard: the code is composed from its own
// `batchDate`, which nothing else writes. Recorded on cannot reach it.
//
//   Batch date  →  26F27-14        (lot identity, set here)
//   Recorded on →  ledger event date only

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  buildBatchId,
  formatBatchIdInput,
  parseBatchId,
  MONTH_NAMES,
} from "@/lib/entry/batch-id";

const today = () => new Date().toISOString().slice(0, 10);

function prettyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${d.toLocaleString("en", { month: "short", timeZone: "UTC" })} ${d.getUTCFullYear()}`;
}

export default function BatchIdField({
  batchId,
  onBatchIdChange,
  batchDate,
  onBatchDateChange,
  size,
  onSizeChange,
  sizeOptions,
  disabled = false,
  recordedOn,
}: {
  batchId: string;
  onBatchIdChange: (raw: string) => void;
  /** ISO day the lot was started. The only input to the date part of the code. */
  batchDate: string;
  onBatchDateChange: (iso: string) => void;
  size: string;
  onSizeChange: (size: string) => void;
  sizeOptions: readonly string[];
  disabled?: boolean;
  /** Shown only to contrast the two dates when they differ. */
  recordedOn: string;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  const parsed = parseBatchId(batchId);
  const preview = buildBatchId(batchDate, size);
  const spansDays = recordedOn !== batchDate;

  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({
      left: Math.max(8, Math.min(r.left, window.innerWidth - 296)),
      top: r.bottom + 6,
      width: r.width,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const on = () => place();
    window.addEventListener("scroll", on, true);
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on, true);
      window.removeEventListener("resize", on);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => dateRef.current?.focus());
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <input
        value={batchId}
        onChange={(e) => onBatchIdChange(e.target.value)}
        disabled={disabled}
        maxLength={10}
        placeholder="26F27-14"
        aria-label="Batch or lot ID"
        title="Lot identity. Type it, or set the lot date below. It never changes when Recorded on moves."
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border-strong)",
          background: "var(--surface)",
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--accent)",
          boxSizing: "border-box",
        }}
      />

      {/* The breakdown is also the control: it names the parts of the code, so
          clicking it to edit those parts is where the hand already goes. */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        style={{
          width: "100%",
          marginTop: 6,
          padding: "5px 7px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 4,
          borderRadius: "var(--radius-sm)",
          border: `1px solid ${open ? "var(--accent)" : "transparent"}`,
          background: open ? "var(--surface)" : "transparent",
          cursor: disabled ? "not-allowed" : "pointer",
          textAlign: "left",
          fontFamily: "inherit",
          transition: "border-color var(--duration-fast) var(--ease-out)",
        }}
      >
        {parsed ? (
          <>
            <Part label="Yr" value={parsed.year2} />
            <Part label="Mo" value={parsed.monthName} />
            <Part label="Day" value={parsed.day} />
            <Part label="Sz" value={parsed.sizeFr ? `${parsed.sizeFr} FR` : "—"} muted={!parsed.sizeFr} />
          </>
        ) : (
          <span style={{ fontSize: "var(--text-xs)", color: "var(--status-warn, #d97706)" }}>
            {batchId.trim() ? "Incomplete — YY + month letter + DD + size" : "No lot set"}
          </span>
        )}
        <span
          style={{
            marginLeft: "auto",
            fontSize: "var(--text-2xs)",
            fontWeight: 600,
            color: "var(--accent-text)",
            whiteSpace: "nowrap",
          }}
        >
          Set lot date
        </span>
      </button>

      {spansDays && parsed && (
        <p
          className="small"
          style={{ margin: "5px 0 0", fontSize: "var(--text-2xs)", lineHeight: 1.4 }}
        >
          Lot opened {prettyDate(batchDate)} · you are recording {prettyDate(recordedOn)}.
        </p>
      )}

      {open && rect && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Lot date and size"
          className="dropdown-panel"
          style={{
            position: "fixed",
            left: rect.left,
            top: rect.top,
            width: 288,
            zIndex: 1000,
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-3)",
            padding: 12,
            display: "grid",
            gap: 10,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "var(--text-md)", fontWeight: 600 }}>Lot identity</h3>
            <p className="small" style={{ margin: "2px 0 0", fontSize: "var(--text-2xs)", lineHeight: 1.45 }}>
              The day this lot was started. Fixed for the life of the batch — moving
              &ldquo;Recorded on&rdquo; will not change it.
            </p>
          </div>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-2)" }}>
              Batch date
            </span>
            <input
              ref={dateRef}
              type="date"
              value={batchDate}
              onChange={(e) => e.target.value && onBatchDateChange(e.target.value)}
              style={fieldStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-2)" }}>
              Size
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {sizeOptions.map((s) => {
                const on = s === size;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onSizeChange(s)}
                    aria-pressed={on}
                    style={{
                      padding: "3px 8px",
                      minHeight: 26,
                      borderRadius: "var(--radius-pill)",
                      border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                      background: on ? "var(--accent-weak)" : "transparent",
                      color: on ? "var(--accent-text)" : "var(--text-2)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-2xs)",
                      fontWeight: on ? 700 : 500,
                      cursor: "pointer",
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </label>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: "8px 10px",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
            }}
          >
            <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-3)", fontWeight: 600 }}>
              Lot code
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: "0.04em",
                color: preview ? "var(--accent)" : "var(--text-3)",
              }}
            >
              {preview ?? "—"}
            </span>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => onBatchDateChange(today())}
              style={{ ...btnStyle, flex: 1 }}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ ...btnStyle, flex: 1, background: "var(--accent)", borderColor: "var(--accent)", color: "var(--text-invert)" }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Part({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 3,
        padding: "1px 6px",
        borderRadius: "var(--radius-pill)",
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        fontSize: "var(--text-2xs)",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: "var(--text-3)", fontWeight: 600 }}>{label}</span>
      <span style={{ color: muted ? "var(--text-3)" : "var(--text)", fontWeight: 600 }}>{value}</span>
    </span>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border-strong)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: "var(--text-sm)",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const btnStyle: React.CSSProperties = {
  padding: "6px 10px",
  minHeight: 30,
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border-strong)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
};

export { MONTH_NAMES };
