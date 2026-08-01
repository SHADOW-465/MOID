// src/app/data-entry/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import AppShell from "@/components/app/AppShell";
import { useEvents } from "@/components/app/EventsContext";
import BatchMatrixEntry from "@/components/BatchMatrixEntry";
import EntryHistory from "@/components/EntryHistory";
import Tabs from "@/components/ui/Tabs";
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
          style={{ fontSize: "var(--text-md)", margin: 0, maxWidth: "68ch", lineHeight: "var(--leading-body)" }}
        >
          {TAB_HINT[activeTab]}
        </p>
      </header>

      <div style={{ marginBottom: 16 }}>
        <Tabs
          ariaLabel="Data entry mode"
          active={activeTab}
          onSelect={(id) => setActiveTab(id as EntryMode)}
          items={[
            { id: "matrix", label: "Log a batch" },
            { id: "history", label: "History" },
          ]}
        />
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
