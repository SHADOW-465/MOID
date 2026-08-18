"use client";

/**
 * Floating export configurator for Data Entry (impeccable: layout + clarify).
 * Primary task: choose what to export → download. Defaults can be saved for next time.
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  readDataEntryExportConfig,
  writeDataEntryExportConfig,
  type DataEntryExportConfig,
  type DataEntryExportMode,
  type EntryExportChannel,
} from "@/lib/entry/export-config";
import { isDirectEntryEvent } from "@/lib/analytics/scope";
import type { Event } from "@/lib/store/types";
import DatePicker from "@/components/ui/DatePicker";
import "./entry-export-panel.css";

type DateMode = "all" | "topbar" | "custom";

function dateModeFromConfig(cfg: DataEntryExportConfig): DateMode {
  if (cfg.useDateScope) return "topbar";
  if (cfg.from || cfg.to) return "custom";
  return "all";
}

function countMatching(
  events: Event[],
  channel: EntryExportChannel,
  from: string,
  to: string,
): number {
  let n = 0;
  for (const e of events) {
    if (channel === "direct-entry" && !isDirectEntryEvent(e)) continue;
    const day = e.occurredOn?.start ?? "";
    if (from && day < from) continue;
    if (to && day > to) continue;
    n++;
  }
  return n;
}

export default function EntryExportPanel({
  events,
  topbarFrom,
  topbarTo,
  onClose,
}: {
  events: Event[];
  topbarFrom?: string;
  topbarTo?: string;
  onClose: () => void;
}) {
  const saved = useMemo(() => readDataEntryExportConfig(), []);
  const [mode, setMode] = useState<DataEntryExportMode>(saved.mode);
  const [channel, setChannel] = useState<EntryExportChannel>(saved.channel);
  const [dateMode, setDateMode] = useState<DateMode>(() => dateModeFromConfig(saved));
  const [from, setFrom] = useState(saved.from);
  const [to, setTo] = useState(saved.to);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saveDefaults, setSaveDefaults] = useState(true);

  // Escape closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const effectiveFrom =
    dateMode === "topbar" ? (topbarFrom ?? "") : dateMode === "custom" ? from : "";
  const effectiveTo =
    dateMode === "topbar" ? (topbarTo ?? "") : dateMode === "custom" ? to : "";

  const previewCount = useMemo(
    () => countMatching(events, channel, effectiveFrom, effectiveTo),
    [events, channel, effectiveFrom, effectiveTo],
  );

  const buildConfig = useCallback((): DataEntryExportConfig => {
    return {
      mode,
      channel,
      useDateScope: dateMode === "topbar",
      from: dateMode === "custom" ? from : "",
      to: dateMode === "custom" ? to : "",
    };
  }, [mode, channel, dateMode, from, to]);

  async function download() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const cfg = buildConfig();
      if (saveDefaults) writeDataEntryExportConfig(cfg);

      if (cfg.mode === "audit-zip") {
        const { buildAuditPackage } = await import("@/lib/audit-package");
        const { blob, fileName } = await buildAuditPackage(events, {
          grain: "month",
        });
        triggerDownload(blob, fileName);
        setStatus("Audit ZIP downloaded.");
        return;
      }

      const qs = new URLSearchParams({ channel: cfg.channel });
      if (cfg.useDateScope) {
        if (topbarFrom) qs.set("from", topbarFrom);
        if (topbarTo) qs.set("to", topbarTo);
      } else {
        if (cfg.from) qs.set("from", cfg.from);
        if (cfg.to) qs.set("to", cfg.to);
      }
      const res = await fetch(`/api/entries/export?${qs}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Export failed (${res.status})`);
      }
      const text = await res.text();
      let count = previewCount;
      try {
        count = JSON.parse(text).eventCount ?? count;
      } catch {
        /* ignore */
      }
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(cd);
      const fileName = match?.[1] ?? `moid-entries-${cfg.channel}.json`;
      triggerDownload(new Blob([text], { type: "application/json" }), fileName);
      setStatus(
        `Downloaded ${fileName} (${count} events). Import on Staging → Transfer package.`,
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="eep-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="eep-title"
    >
      <button
        type="button"
        className="eep-backdrop"
        aria-label="Close export panel"
        onClick={onClose}
      />
      <div className="eep-panel">
        <header className="eep-head">
          <div className="eep-head-text">
            <p className="eep-kicker">Data Entry</p>
            <h2 id="eep-title" className="eep-title">
              Export entries
            </h2>
            <p className="eep-lede">
              Choose what to include, then download. Use the JSON package to move rows
              to another MOID database (import on Staging).
            </p>
          </div>
          <button type="button" className="eep-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="eep-body">
          <section className="eep-section" aria-labelledby="eep-what">
            <h3 id="eep-what" className="eep-section-title">
              What to export
            </h3>
            <div className="eep-options" role="radiogroup" aria-label="Ledger scope">
              <label className={`eep-option ${channel === "direct-entry" ? "is-on" : ""}`}>
                <input
                  type="radio"
                  name="eep-channel"
                  checked={channel === "direct-entry"}
                  onChange={() => setChannel("direct-entry")}
                />
                <span className="eep-option-text">
                  <span className="eep-option-label">Data Entry only</span>
                  <span className="eep-option-hint">
                    Manual / batch-matrix rows (recommended for DB transfer)
                  </span>
                </span>
              </label>
              <label className={`eep-option ${channel === "all" ? "is-on" : ""}`}>
                <input
                  type="radio"
                  name="eep-channel"
                  checked={channel === "all"}
                  onChange={() => setChannel("all")}
                />
                <span className="eep-option-text">
                  <span className="eep-option-label">Full ledger</span>
                  <span className="eep-option-hint">
                    Includes Excel-ingested events as well as Data Entry
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section className="eep-section" aria-labelledby="eep-when">
            <h3 id="eep-when" className="eep-section-title">
              Date range
            </h3>
            <div className="eep-options" role="radiogroup" aria-label="Date range">
              <label className={`eep-option ${dateMode === "all" ? "is-on" : ""}`}>
                <input
                  type="radio"
                  name="eep-dates"
                  checked={dateMode === "all"}
                  onChange={() => setDateMode("all")}
                />
                <span className="eep-option-text">
                  <span className="eep-option-label">All dates</span>
                  <span className="eep-option-hint">Every matching event on the ledger</span>
                </span>
              </label>
              <label className={`eep-option ${dateMode === "topbar" ? "is-on" : ""}`}>
                <input
                  type="radio"
                  name="eep-dates"
                  checked={dateMode === "topbar"}
                  onChange={() => setDateMode("topbar")}
                />
                <span className="eep-option-text">
                  <span className="eep-option-label">Current topbar range</span>
                  <span className="eep-option-hint">
                    {topbarFrom || topbarTo
                      ? `${topbarFrom || "…"} → ${topbarTo || "…"}`
                      : "No range set on the topbar — will export all dates"}
                  </span>
                </span>
              </label>
              <label className={`eep-option ${dateMode === "custom" ? "is-on" : ""}`}>
                <input
                  type="radio"
                  name="eep-dates"
                  checked={dateMode === "custom"}
                  onChange={() => setDateMode("custom")}
                />
                <span className="eep-option-text">
                  <span className="eep-option-label">Custom range</span>
                  <span className="eep-option-hint">Pick inclusive from / to days</span>
                </span>
              </label>
            </div>
            {dateMode === "custom" && (
              <div className="eep-dates-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label className="eep-field">
                  <span className="eep-field-label">From</span>
                  <DatePicker
                    value={from}
                    onChange={(d) => setFrom(d)}
                    ariaLabel="Export from date"
                    size="sm"
                  />
                </label>
                <label className="eep-field">
                  <span className="eep-field-label">To</span>
                  <DatePicker
                    value={to}
                    onChange={(d) => setTo(d)}
                    ariaLabel="Export to date"
                    size="sm"
                  />
                </label>
              </div>
            )}
          </section>

          <section className="eep-section" aria-labelledby="eep-format">
            <h3 id="eep-format" className="eep-section-title">
              Format
            </h3>
            <div className="eep-options" role="radiogroup" aria-label="File format">
              <label className={`eep-option ${mode === "entry-transfer" ? "is-on" : ""}`}>
                <input
                  type="radio"
                  name="eep-mode"
                  checked={mode === "entry-transfer"}
                  onChange={() => setMode("entry-transfer")}
                />
                <span className="eep-option-text">
                  <span className="eep-option-label">Transfer package (JSON)</span>
                  <span className="eep-option-hint">
                    Re-import on Staging · content-hash safe re-import
                  </span>
                </span>
              </label>
              <label className={`eep-option ${mode === "audit-zip" ? "is-on" : ""}`}>
                <input
                  type="radio"
                  name="eep-mode"
                  checked={mode === "audit-zip"}
                  onChange={() => setMode("audit-zip")}
                />
                <span className="eep-option-text">
                  <span className="eep-option-label">Audit package (ZIP)</span>
                  <span className="eep-option-hint">
                    CSV extracts + hash manifest (not for Staging import)
                  </span>
                </span>
              </label>
            </div>
          </section>

          <div className="eep-preview" aria-live="polite">
            <div className="eep-preview-val">
              {mode === "audit-zip" ? "—" : previewCount.toLocaleString()}
            </div>
            <div className="eep-preview-lab">
              {mode === "audit-zip"
                ? "Audit ZIP uses the full in-memory ledger (not filtered above)"
                : previewCount === 0
                  ? "No matching events in the loaded ledger — adjust range or channel"
                  : "Events matching your filters (preview from loaded ledger)"}
            </div>
          </div>

          <label className="eep-remember">
            <input
              type="checkbox"
              checked={saveDefaults}
              onChange={(e) => setSaveDefaults(e.target.checked)}
            />
            <span>Remember these choices for next time</span>
          </label>

          {error && (
            <p className="eep-alert eep-alert--err" role="alert">
              {error}
            </p>
          )}
          {status && (
            <p className="eep-alert eep-alert--ok" role="status">
              {status}
            </p>
          )}
        </div>

        <footer className="eep-foot">
          <button type="button" className="eep-btn eep-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="eep-btn eep-btn--primary"
            disabled={busy}
            onClick={() => void download()}
          >
            {busy ? "Preparing…" : mode === "audit-zip" ? "Download ZIP" : "Download JSON"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

