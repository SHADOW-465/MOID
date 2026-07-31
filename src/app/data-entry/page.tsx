// src/app/data-entry/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import AppShell from "@/components/app/AppShell";
import { useEvents } from "@/components/app/EventsContext";
import BatchMatrixEntry from "@/components/BatchMatrixEntry";
import EntryHistory from "@/components/EntryHistory";
import type { AuditEntryRow, AuditEventLike } from "@/lib/analytics/audit-sessions";

type EntryMode = "matrix" | "history";

const TAB_HINT: Record<EntryMode, string> = {
  matrix: "One inspection, one batch, now.",
  history: "Read back what you saved, and see which lots are still open.",
};

export default function DataEntryPage() {
  const { events } = useEvents();
  const [activeTab, setActiveTab] = useState<EntryMode>("matrix");
  const [success, setSuccess] = useState<string | null>(null);
  /** Batch id handed to the entry form by History → Reuse. */
  const [reuseBatch, setReuseBatch] = useState<string | null>(null);

  // Deep link: /data-entry?batch=… opens History focused on that lot.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const batch = new URLSearchParams(window.location.search).get("batch");
    if (batch?.trim()) setActiveTab("history");
  }, []);

  // Success feedback is brief on this surface.
  useEffect(() => {
    if (!success) return;
    const id = window.setTimeout(() => setSuccess(null), 5000);
    return () => window.clearTimeout(id);
  }, [success]);

  const handleReuse = (row: AuditEntryRow) => {
    setReuseBatch(row.batch);
    setActiveTab("matrix");
    setSuccess(
      `Batch ${row.batch} loaded onto the form. Set Recorded on to today and enter this station's quantities.`,
    );
  };

  return (
    <AppShell active="data-entry">
      <header style={{ marginBottom: 16 }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-3xl, 28px)",
            fontWeight: 700,
            margin: "0 0 4px",
            letterSpacing: "var(--tracking-tight, -0.02em)",
            lineHeight: "var(--leading-tight, 1.15)",
          }}
        >
          Data Entry
        </h1>
        <p
          className="muted"
          style={{ fontSize: "var(--text-md)", margin: "0 0 4px", maxWidth: "68ch", lineHeight: "var(--leading-body)" }}
        >
          {TAB_HINT[activeTab]}
        </p>
        <p
          className="muted"
          style={{ fontSize: "var(--text-sm)", margin: 0, maxWidth: "68ch", lineHeight: "var(--leading-body)" }}
        >
          Defect columns come from your{" "}
          <a href="/staging" style={{ color: "var(--accent)", fontWeight: 600 }}>
            imported Excel
          </a>{" "}
          schema. Saves appear on the Dashboard immediately.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Data entry mode"
        style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}
      >
        <TabButton active={activeTab === "matrix"} onClick={() => setActiveTab("matrix")} first>
          Log a batch
        </TabButton>
        <TabButton active={activeTab === "history"} onClick={() => setActiveTab("history")} last>
          History
        </TabButton>
      </div>

      {success && (
        <div
          role="status"
          className="fade-up"
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: "var(--radius-md)",
            background: "var(--positive-weak)",
            border: "1px solid var(--positive)",
            color: "var(--positive)",
            fontSize: "var(--text-sm)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span>{success}</span>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            aria-label="Dismiss message"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 16,
              color: "var(--positive)",
              fontWeight: 700,
              lineHeight: 1,
              padding: "0 4px",
              minHeight: 24,
            }}
          >
            ×
          </button>
        </div>
      )}

      {activeTab === "matrix" ? (
        <BatchMatrixEntry
          prefillBatchId={reuseBatch}
          onPrefillConsumed={() => setReuseBatch(null)}
        />
      ) : (
        <EntryHistory events={(events ?? []) as AuditEventLike[]} onReuse={handleReuse} />
      )}
    </AppShell>
  );
}

function TabButton({
  active,
  onClick,
  children,
  first,
  last,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: "8px 16px",
        minHeight: 36,
        border: "none",
        borderRadius: first ? "8px 0 0 8px" : last ? "0 8px 8px 0" : 0,
        background: active ? "var(--accent)" : "var(--surface-2)",
        color: active ? "var(--text-invert)" : "var(--text-2)",
        fontWeight: 700,
        fontSize: "var(--text-sm)",
        fontFamily: "inherit",
        cursor: "pointer",
        transition: "background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)",
      }}
    >
      {children}
    </button>
  );
}
