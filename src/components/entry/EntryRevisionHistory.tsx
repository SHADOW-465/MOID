"use client";

import { useEffect, useState } from "react";
import type { AuditEntryRow } from "@/lib/analytics/audit-sessions";
import "./entry-revision-history.css";

type TimelineItem = {
  eventId: string;
  eventType: string;
  recordedAt: string;
  quantity: number | null;
  disposition: string | null;
  defect: string | null;
  isSuperseded: boolean;
  supersedesEventId: string | null;
  reason: string | null;
  extractedBy: string;
};

/**
 * Floating panel: append-only revision timeline for one Data Entry / audit row.
 * Current values stay on the card; this only shows history.
 */
export default function EntryRevisionHistory({
  row,
  onClose,
}: {
  row: Pick<AuditEntryRow, "date" | "batch" | "stageId" | "size" | "checked" | "accepted" | "rejected">;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({
          date: row.date,
          batch: row.batch,
          stageId: row.stageId,
          size: row.size ?? "",
        });
        const res = await fetch(`/api/entries/revisions?${qs}`, {
          credentials: "same-origin",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`);
        if (!cancelled) setTimeline(data.timeline ?? []);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load history");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [row.date, row.batch, row.stageId, row.size]);

  return (
    <div className="erh-root" role="dialog" aria-modal="true" aria-labelledby="erh-title">
      <button type="button" className="erh-backdrop" aria-label="Close history" onClick={onClose} />
      <div className="erh-panel">
        <header className="erh-head">
          <div>
            <p className="erh-kicker">Append-only ledger</p>
            <h2 id="erh-title" className="erh-title">
              Entry history
            </h2>
            <p className="erh-meta">
              <span className="erh-mono">{row.batch}</span>
              {" · "}
              {row.stageId}
              {row.size ? ` · ${row.size}` : ""}
              {" · "}
              {row.date}
            </p>
            <p className="erh-current">
              Current values: checked{" "}
              <strong className="erh-mono">{row.checked.toLocaleString()}</strong>
              {" · "}accepted{" "}
              <strong className="erh-mono">{row.accepted.toLocaleString()}</strong>
              {" · "}rejected{" "}
              <strong className="erh-mono">{row.rejected.toLocaleString()}</strong>
            </p>
          </div>
          <button type="button" className="erh-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="erh-body">
          {loading && <p className="erh-muted">Loading revisions…</p>}
          {error && (
            <p className="erh-err" role="alert">
              {error}
            </p>
          )}
          {!loading && !error && timeline.length === 0 && (
            <p className="erh-muted">No events found for this entry.</p>
          )}
          {!loading && timeline.length > 0 && (
            <ol className="erh-timeline">
              {timeline.map((item, i) => (
                <li
                  key={item.eventId + i}
                  className={`erh-item ${item.isSuperseded ? "is-old" : "is-current"} ${
                    item.eventType === "correction" ? "is-correction" : ""
                  }`}
                >
                  <div className="erh-item-head">
                    <span className="erh-type">{labelType(item)}</span>
                    <span className="erh-when">{fmtStamp(item.recordedAt)}</span>
                  </div>
                  <div className="erh-item-body">
                    {item.eventType === "correction" ? (
                      <span>
                        Correction
                        {item.reason ? `: ${item.reason}` : ""}
                        {item.supersedesEventId ? (
                          <span className="erh-mono erh-dim">
                            {" "}
                            → supersedes {item.supersedesEventId.slice(0, 8)}…
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span>
                        {item.quantity != null && (
                          <strong className="erh-mono">{item.quantity.toLocaleString()}</strong>
                        )}
                        {item.disposition ? ` ${item.disposition}` : ""}
                        {item.defect ? ` · ${item.defect}` : ""}
                      </span>
                    )}
                  </div>
                  <div className="erh-badges">
                    {item.isSuperseded ? (
                      <span className="erh-badge erh-badge--old">Superseded</span>
                    ) : item.eventType !== "correction" ? (
                      <span className="erh-badge erh-badge--live">Effective</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <footer className="erh-foot">
          <p className="erh-foot-note">
            History is never deleted. Edits append corrections and new values; the card always
            shows the effective numbers.
          </p>
          <button type="button" className="erh-btn" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

function labelType(item: TimelineItem): string {
  if (item.eventType === "correction") return "Correction";
  if (item.eventType === "production") return "Checked qty";
  if (item.eventType === "inspection") return "Inspection";
  if (item.eventType === "rejection") return "Defect";
  return item.eventType;
}

function fmtStamp(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}
