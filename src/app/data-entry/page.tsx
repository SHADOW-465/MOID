// src/app/data-entry/page.tsx
"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import AppShell from "@/components/app/AppShell";
import { useEvents } from "@/components/app/EventsContext";
import MonthlyEntryGrid from "@/components/MonthlyEntryGrid";
import BatchMatrixEntry from "@/components/BatchMatrixEntry";
import { useTweaks } from "@/components/editorial/TweaksContext";
import WeekPicker from "@/components/WeekPicker";
import { type EntryGrain } from "@/lib/entry/period";
import { fyContaining } from "@/lib/analytics/scope";

const today = () => new Date().toISOString().slice(0, 10);

type EntryMode = "matrix" | "period" | "ledger";

const TAB_HINT: Record<EntryMode, string> = {
  matrix: "One inspection, one batch, now.",
  period: "Catch up many days for one stage.",
  ledger: "Find, reuse, or permanently erase past rows.",
};

export default function DataEntryPage() {
  const { refreshEvents, events } = useEvents();
  const [activeTab, setActiveTab] = useState<EntryMode>("matrix");
  const [monthlyDirty, setMonthlyDirty] = useState(false);
  const [date, setDate] = useState(today());

  const { t, setTweak } = useTweaks();

  const [fyStartYear, setFyStartYear] = useState<number>(() => fyContaining(today()).startYear);
  const [fyOpenMonth, setFyOpenMonth] = useState<string>(() => {
    const fy = fyContaining(today());
    return fy.from;
  });

  // Grain-change guard for period grid only
  const prevGrainRef = useRef(t.grain);
  useEffect(() => {
    if (t.grain === prevGrainRef.current) return;
    if (activeTab === "period" && monthlyDirty) {
      const ok = confirm(
        "You have unsaved changes in the period grid. Switching the grain will discard them. Continue?",
      );
      if (!ok) {
        setTweak("grain", prevGrainRef.current);
        return;
      }
    }
    prevGrainRef.current = t.grain;
  }, [t.grain, activeTab, monthlyDirty, setTweak]);

  const fyOptions = useMemo(() => {
    const years = new Set<number>([fyContaining(today()).startYear]);
    for (const e of events ?? []) {
      years.add(fyContaining(e.occurredOn.start).startYear);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [events]);

  const effectiveGrain: EntryGrain = t.grain === "fy" ? "month" : t.grain;
  const effectiveAnchor = t.grain === "fy" ? fyOpenMonth : date;

  const [hdr, setHdr] = useState({
    shift: "Day Shift",
    operator: "",
    supervisor: "",
    product: "FBC",
    size: "All",
    machine: "All Machines",
    batch: "",
  });

  const [notes, setNotes] = useState("");
  const [success, setSuccess] = useState<string | null>(null);

  const [ledgerRecords, setLedgerRecords] = useState<any[]>([]);
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerSort, setLedgerSort] = useState<{ col: string; desc: boolean }>({ col: "date", desc: true });

  useEffect(() => {
    loadLedger();
    if (typeof window !== "undefined") {
      const savedOperator = localStorage.getItem("rais_hdr_operator");
      const savedSupervisor = localStorage.getItem("rais_hdr_supervisor");
      const savedMachine = localStorage.getItem("rais_hdr_machine");
      const savedProduct = localStorage.getItem("rais_hdr_product");
      const savedSize = localStorage.getItem("rais_hdr_size");
      const savedBatch = localStorage.getItem("rais_hdr_batch");
      const savedShift = localStorage.getItem("rais_hdr_shift");
      const urlParams = new URLSearchParams(window.location.search);
      const urlBatch = urlParams.get("batch");
      const urlDate = urlParams.get("date");

      setHdr((prev) => ({
        shift: savedShift !== null ? savedShift : prev.shift,
        operator: savedOperator !== null ? savedOperator : prev.operator,
        supervisor: savedSupervisor !== null ? savedSupervisor : prev.supervisor,
        machine: savedMachine !== null ? savedMachine : prev.machine,
        product: savedProduct !== null ? savedProduct : prev.product,
        size: savedSize !== null ? savedSize : prev.size,
        batch: urlBatch?.trim() || (savedBatch !== null ? savedBatch : prev.batch),
      }));
      if (urlBatch?.trim()) {
        setLedgerSearch(urlBatch.trim());
      } else if (urlDate?.trim()) {
        setLedgerSearch(urlDate.trim());
      }
      if (urlDate?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(urlDate.trim())) {
        setDate(urlDate.trim());
      }
    }
  }, []);

  // Success feedback is brief on this surface.
  useEffect(() => {
    if (!success) return;
    const id = window.setTimeout(() => setSuccess(null), 5000);
    return () => window.clearTimeout(id);
  }, [success]);

  const updateHdrField = (field: keyof typeof hdr, val: string) => {
    setHdr((prev) => {
      const next = { ...prev, [field]: val };
      if (typeof window !== "undefined") {
        localStorage.setItem(`rais_hdr_${field}`, val);
      }
      return next;
    });
  };

  const loadLedger = async () => {
    try {
      const res = await fetch("/api/manual-entries");
      const data = await res.json();
      if (data.records) {
        setLedgerRecords(data.records);
      }
    } catch (err) {
      console.error("Error loading ledger:", err);
    }
  };

  const confirmLeavePeriodGrid = (): boolean => {
    if (activeTab !== "period" || !monthlyDirty) return true;
    return confirm(
      "You have unsaved changes in the period grid. Continuing will discard them. Continue?",
    );
  };

  const entryCustomFields = useMemo(
    () => ({
      operator: hdr.operator,
      supervisor: hdr.supervisor,
      machine: hdr.machine,
      product: hdr.product,
      size: hdr.size,
      batch: hdr.batch,
      shift: hdr.shift,
      notes,
    }),
    [hdr, notes],
  );

  const handleEditLedgerRecord = (rec: any) => {
    setHdr({
      shift: rec.shift,
      operator: rec.operator,
      supervisor: rec.supervisor,
      product: rec.product,
      size: rec.size,
      machine: rec.machine,
      batch: rec.batch,
    });
    setNotes(rec.notes || "");
    setActiveTab("period");
    setDate(rec.date);
    setSuccess(
      `Opened ${rec.date} in the period grid. Revise quantities and save to update the ledger.`,
    );
  };

  const handleDuplicateLedgerRecord = (rec: any) => {
    setHdr({
      shift: rec.shift,
      operator: rec.operator,
      supervisor: rec.supervisor,
      product: rec.product,
      size: rec.size,
      machine: rec.machine,
      batch: rec.batch,
    });
    setNotes(rec.notes || "");
    setActiveTab("period");
    setDate(today());
    setSuccess("Header copied onto today. Enter today's quantities and save.");
  };

  const handleDeleteLedgerRecord = async (rec: any) => {
    const isDirect = rec.source === "Direct Entry";
    const recordType = isDirect ? "manual entry" : `uploaded record (${rec.source})`;
    if (
      !confirm(
        `Permanently delete this ${recordType}?\n\n` +
          `${rec.date} · ${rec.shift}${rec.batch ? ` · batch ${rec.batch}` : ""}\n\n` +
          "Removed from the dashboard and audit trail — this is an erase, not a correction, and cannot be undone.",
      )
    )
      return;
    try {
      const qs = new URLSearchParams({ date: rec.date, shift: rec.shift, source: rec.source });
      if (rec.batch) qs.set("batch", String(rec.batch).trim().toUpperCase());
      const res = await fetch(`/api/manual-entries?${qs}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({} as { error?: string; deletedCount?: number }));
      if (!res.ok) throw new Error(body.error ?? "Failed to delete record");
      if (!body.deletedCount) {
        throw new Error("No matching ledger events found for this record.");
      }

      setSuccess(
        `Removed from ledger and dashboard · ${rec.date} (${rec.shift}) — cannot be undone.`,
      );
      loadLedger();
      refreshEvents().catch(console.error);
    } catch (e: any) {
      alert("Could not delete: " + e.message);
    }
  };

  const filteredLedger = useMemo(() => {
    return ledgerRecords
      .filter((rec) => {
        const query = ledgerSearch.toLowerCase().trim();
        if (!query) return true;
        return (
          rec.date.includes(query) ||
          rec.shift.toLowerCase().includes(query) ||
          (rec.source || "").toLowerCase().includes(query) ||
          rec.operator.toLowerCase().includes(query) ||
          rec.supervisor.toLowerCase().includes(query) ||
          rec.machine.toLowerCase().includes(query) ||
          rec.product.toLowerCase().includes(query) ||
          rec.size.toLowerCase().includes(query) ||
          rec.batch.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const field = ledgerSort.col;
        const desc = ledgerSort.desc;
        let av = a[field] ?? "";
        let bv = b[field] ?? "";

        if (field === "date" || field === "recordedAt") {
          return desc ? bv.localeCompare(av) : av.localeCompare(bv);
        }

        av = typeof av === "string" ? av.toLowerCase() : av;
        bv = typeof bv === "string" ? bv.toLowerCase() : bv;

        if (av < bv) return desc ? 1 : -1;
        if (av > bv) return desc ? -1 : 1;
        return 0;
      });
  }, [ledgerRecords, ledgerSearch, ledgerSort]);

  const toggleSort = (col: string) => {
    setLedgerSort((prev) => ({
      col,
      desc: prev.col === col ? !prev.desc : true,
    }));
  };

  const switchTab = (tab: EntryMode) => {
    if (tab !== "period" && !confirmLeavePeriodGrid()) return;
    setActiveTab(tab);
    if (tab === "ledger") loadLedger();
  };

  const ledgerEmpty = ledgerRecords.length === 0;
  const searchActive = ledgerSearch.trim().length > 0;

  return (
    <AppShell active="data-entry">
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
      <p className="muted" style={{ fontSize: 14, margin: "0 0 6px", maxWidth: 640, lineHeight: 1.5 }}>
        {TAB_HINT[activeTab]}
      </p>
      <p className="muted" style={{ fontSize: 13, margin: "0 0 16px", maxWidth: 720, lineHeight: 1.45 }}>
        Defect columns come from your{" "}
        <a href="/staging" style={{ color: "var(--accent)", fontWeight: 600 }}>
          imported Excel
        </a>{" "}
        schema. Saves appear on the Dashboard immediately.
      </p>

      <div
        role="tablist"
        aria-label="Data entry mode"
        style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}
      >
        <TabButton active={activeTab === "matrix"} onClick={() => switchTab("matrix")} first>
          Log a batch
        </TabButton>
        <TabButton active={activeTab === "period"} onClick={() => switchTab("period")}>
          Fill a period
        </TabButton>
        <TabButton active={activeTab === "ledger"} onClick={() => switchTab("ledger")} last>
          What I&apos;ve entered
        </TabButton>
      </div>

      {success && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 9,
            background: "var(--positive-weak)",
            border: "1px solid var(--positive)",
            color: "var(--positive)",
            fontSize: 13,
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
            aria-label="Dismiss"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 16,
              color: "var(--positive)",
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}

      {activeTab === "matrix" && <BatchMatrixEntry onSynced={() => loadLedger()} />}

      {activeTab === "period" && (
        <div>
          {/* Single meta surface — who/when + optional remarks, not three cards */}
          <div
            style={{
              marginBottom: 16,
              padding: 16,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 14,
                alignItems: "flex-end",
                marginBottom: 14,
              }}
            >
              <label style={fieldLabel}>
                {t.grain === "day" && "Report date"}
                {t.grain === "week" && "Report week"}
                {t.grain === "month" && "Report month"}
                {t.grain === "fy" && "Report FY"}

                {t.grain === "day" && (
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      if (!confirmLeavePeriodGrid()) return;
                      setDate(e.target.value);
                    }}
                    style={{ ...inp, width: 160, marginTop: 4 }}
                  />
                )}

                {t.grain === "week" && (
                  <div style={{ marginTop: 4 }}>
                    <WeekPicker
                      value={date}
                      onChange={(next) => {
                        if (!confirmLeavePeriodGrid()) return;
                        setDate(next);
                      }}
                    />
                  </div>
                )}

                {t.grain === "month" && (
                  <input
                    type="month"
                    value={date.slice(0, 7)}
                    onChange={(e) => {
                      if (!confirmLeavePeriodGrid()) return;
                      setDate(`${e.target.value}-01`);
                    }}
                    style={{ ...inp, width: 160, marginTop: 4 }}
                  />
                )}

                {t.grain === "fy" && (
                  <select
                    value={fyStartYear}
                    onChange={(e) => {
                      if (!confirmLeavePeriodGrid()) return;
                      const y = Number(e.target.value);
                      setFyStartYear(y);
                      setFyOpenMonth(`${y}-04-01`);
                    }}
                    style={{ ...inp, width: 160, marginTop: 4 }}
                  >
                    {fyOptions.map((y) => (
                      <option key={y} value={y}>
                        FY{y}-{String((y + 1) % 100).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              <label style={fieldLabel}>
                Shift
                <select
                  value={hdr.shift}
                  onChange={(e) => updateHdrField("shift", e.target.value)}
                  style={{ ...inp, width: 140, marginTop: 4 }}
                >
                  <option>Day Shift</option>
                  <option>Night Shift</option>
                </select>
              </label>

              <label style={fieldLabel}>
                Operator <span style={{ color: "var(--status-bad)" }}>*</span>
                <input
                  style={{ ...inp, width: 160, marginTop: 4 }}
                  value={hdr.operator}
                  onChange={(e) => updateHdrField("operator", e.target.value)}
                  placeholder="Your name"
                  aria-required
                />
              </label>

              <label style={fieldLabel}>
                Supervisor
                <input
                  style={{ ...inp, width: 140, marginTop: 4 }}
                  value={hdr.supervisor}
                  onChange={(e) => updateHdrField("supervisor", e.target.value)}
                />
              </label>

              <label style={fieldLabel}>
                Batch / lot
                <input
                  style={{ ...inp, width: 140, marginTop: 4, fontFamily: "var(--font-mono)" }}
                  value={hdr.batch}
                  onChange={(e) => updateHdrField("batch", e.target.value)}
                  placeholder="e.g. 26F27-14"
                />
              </label>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 12,
                paddingTop: 12,
                borderTop: "1px solid var(--border)",
              }}
            >
              <label style={fieldLabel}>
                Product
                <input
                  style={{ ...inp, marginTop: 4 }}
                  value={hdr.product}
                  onChange={(e) => updateHdrField("product", e.target.value)}
                />
              </label>
              <label style={fieldLabel}>
                Size (French)
                <input
                  style={{ ...inp, marginTop: 4 }}
                  value={hdr.size}
                  onChange={(e) => updateHdrField("size", e.target.value)}
                />
              </label>
              <label style={fieldLabel}>
                Machine
                <input
                  style={{ ...inp, marginTop: 4 }}
                  value={hdr.machine}
                  onChange={(e) => updateHdrField("machine", e.target.value)}
                />
              </label>
              <label style={{ ...fieldLabel, gridColumn: "1 / -1" }}>
                Remarks
                <textarea
                  style={{ ...inp, marginTop: 4, minHeight: 48, fontFamily: "inherit", resize: "vertical" }}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes for this period…"
                />
              </label>
            </div>
          </div>

          {t.grain === "fy" && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}>
              {Array.from({ length: 12 }, (_, i) => {
                const month = ((i + 3) % 12) + 1;
                const year = month >= 4 ? fyStartYear : fyStartYear + 1;
                const anchor = `${year}-${String(month).padStart(2, "0")}-01`;
                const on = fyOpenMonth.slice(0, 7) === anchor.slice(0, 7);
                const label = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
                  month - 1
                ];
                return (
                  <button
                    key={anchor}
                    type="button"
                    onClick={() => {
                      if (confirmLeavePeriodGrid()) setFyOpenMonth(anchor);
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-strong)",
                      background: on ? "var(--accent)" : "var(--surface-2)",
                      color: on ? "var(--text-invert)" : "var(--text-2)",
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          <MonthlyEntryGrid
            key={`${effectiveGrain}-${effectiveAnchor}`}
            grain={effectiveGrain}
            anchorDate={effectiveAnchor}
            onAnchorChange={(next) => {
              if (t.grain === "fy") {
                setFyOpenMonth(next);
                setFyStartYear(fyContaining(next).startYear);
              } else {
                setDate(next);
              }
            }}
            customFields={entryCustomFields}
            blockedReason={hdr.operator.trim() ? null : "Enter the operator name before saving."}
            onDirtyChange={setMonthlyDirty}
          />
        </div>
      )}

      {activeTab === "ledger" && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 16,
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 18,
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                Everything entered so far
              </h2>
              <p className="muted" style={{ fontSize: 13, margin: "4px 0 0", maxWidth: 560, lineHeight: 1.5 }}>
                <strong>Open in period grid</strong> loads a row for revision.{" "}
                <strong>Delete permanently</strong> erases it from the dashboard and audit trail —
                useful for clearing test entries.
              </p>
            </div>
            <div style={{ position: "relative", width: "min(300px, 100%)" }}>
              <input
                type="search"
                placeholder="Search date, batch, operator…"
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                aria-label="Search entries"
                style={{ ...inp, paddingRight: 12 }}
              />
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr
                  style={{
                    color: "var(--text-3)",
                    textAlign: "left",
                    fontSize: 12,
                    fontWeight: 600,
                    borderBottom: "1px solid var(--border-strong)",
                  }}
                >
                  <th style={{ ...th, cursor: "pointer" }} onClick={() => toggleSort("date")}>
                    Date {ledgerSort.col === "date" ? (ledgerSort.desc ? "▼" : "▲") : ""}
                  </th>
                  <th style={{ ...th, cursor: "pointer" }} onClick={() => toggleSort("shift")}>
                    Shift / sheet {ledgerSort.col === "shift" ? (ledgerSort.desc ? "▼" : "▲") : ""}
                  </th>
                  <th style={{ ...th, cursor: "pointer" }} onClick={() => toggleSort("source")}>
                    Source {ledgerSort.col === "source" ? (ledgerSort.desc ? "▼" : "▲") : ""}
                  </th>
                  <th style={{ ...th, cursor: "pointer" }} onClick={() => toggleSort("operator")}>
                    Operator {ledgerSort.col === "operator" ? (ledgerSort.desc ? "▼" : "▲") : ""}
                  </th>
                  <th style={{ ...th, cursor: "pointer" }} onClick={() => toggleSort("machine")}>
                    Machine {ledgerSort.col === "machine" ? (ledgerSort.desc ? "▼" : "▲") : ""}
                  </th>
                  <th style={{ ...th, cursor: "pointer" }} onClick={() => toggleSort("product")}>
                    Product {ledgerSort.col === "product" ? (ledgerSort.desc ? "▼" : "▲") : ""}
                  </th>
                  <th style={th}>Checked</th>
                  <th style={th}>Rejected</th>
                  <th style={th}>Rej %</th>
                  <th style={{ ...th, cursor: "pointer" }} onClick={() => toggleSort("recordedAt")}>
                    Last saved {ledgerSort.col === "recordedAt" ? (ledgerSort.desc ? "▼" : "▲") : ""}
                  </th>
                  <th style={{ ...th, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ ...td, textAlign: "center", padding: 32, color: "var(--text-3)" }}>
                      {ledgerEmpty ? (
                        <span style={{ lineHeight: 1.5 }}>
                          No entries yet.
                          <br />
                          <button
                            type="button"
                            onClick={() => switchTab("matrix")}
                            style={{
                              marginTop: 10,
                              background: "var(--accent)",
                              color: "var(--text-invert)",
                              border: "none",
                              borderRadius: 8,
                              padding: "8px 14px",
                              fontWeight: 700,
                              fontSize: 13,
                              cursor: "pointer",
                            }}
                          >
                            Log a batch
                          </button>
                        </span>
                      ) : searchActive ? (
                        <>No matches for &ldquo;{ledgerSearch.trim()}&rdquo;.</>
                      ) : (
                        <>No entries match.</>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((rec, idx) => {
                    let chk = 0;
                    let rej = 0;
                    Object.values(rec.stageData).forEach((sData: any) => {
                      chk += Number(sData["Checked Qty"]) || 0;
                      rej += Number(sData["Rejected Qty"]) || 0;
                    });
                    const rate = chk ? (rej / chk) * 100 : 0;

                    return (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          background: idx % 2 === 0 ? "transparent" : "var(--surface-2)",
                        }}
                      >
                        <td style={{ ...td, fontWeight: 700, color: "var(--text)" }}>{rec.date}</td>
                        <td style={td}>{rec.shift}</td>
                        <td style={td}>
                          <span
                            style={{
                              fontSize: 12,
                              padding: "2px 8px",
                              borderRadius: 9999,
                              background:
                                rec.source === "Direct Entry" ? "var(--accent-weak)" : "var(--surface-3)",
                              color:
                                rec.source === "Direct Entry" ? "var(--accent-text)" : "var(--text-2)",
                              fontWeight: 600,
                            }}
                          >
                            {rec.source}
                          </span>
                        </td>
                        <td style={td}>{rec.operator}</td>
                        <td style={td}>{rec.machine}</td>
                        <td style={td}>
                          {rec.product} ({rec.size})
                        </td>
                        <td style={{ ...td, fontFamily: "var(--font-mono)", color: "var(--text)" }}>
                          {chk.toLocaleString()}
                        </td>
                        <td
                          style={{
                            ...td,
                            fontFamily: "var(--font-mono)",
                            color: rej > 0 ? "var(--status-bad)" : "var(--text-2)",
                            fontWeight: rej > 0 ? 600 : 400,
                          }}
                        >
                          {rej.toLocaleString()}
                        </td>
                        <td
                          style={{
                            ...td,
                            fontFamily: "var(--font-mono)",
                            color: rate > 10 ? "var(--status-bad)" : "inherit",
                          }}
                        >
                          {rate.toFixed(2)}%
                        </td>
                        <td style={td}>
                          {rec.recordedAt
                            ? new Date(rec.recordedAt).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              onClick={() => handleEditLedgerRecord(rec)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--accent)",
                                cursor: "pointer",
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              Open in period grid
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateLedgerRecord(rec)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--text-2)",
                                cursor: "pointer",
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              Duplicate
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLedgerRecord(rec)}
                              title="Erase this entry from the ledger — cannot be undone"
                              style={{
                                background: "transparent",
                                border: "1px solid color-mix(in srgb, var(--status-bad) 45%, transparent)",
                                borderRadius: 9999,
                                padding: "3px 12px",
                                color: "var(--status-bad)",
                                cursor: "pointer",
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              Delete permanently
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
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
        border: "none",
        borderRadius: first ? "8px 0 0 8px" : last ? "0 8px 8px 0" : 0,
        background: active ? "var(--accent)" : "var(--surface-2)",
        color: active ? "var(--text-invert)" : "var(--text-2)",
        fontWeight: 700,
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

const fieldLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-2)",
  display: "flex",
  flexDirection: "column",
  gap: 0,
};

const inp: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const th: React.CSSProperties = {
  padding: "10px 12px",
  fontWeight: 600,
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "10px 12px",
  color: "var(--text-2)",
};
