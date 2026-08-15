"use client";

import { useEffect, useState } from "react";
import type { AuditEntryRow } from "@/lib/analytics/audit-sessions";
import {
  buildRevisions,
  formatGap,
  formatStamp,
  type RevisionEventLike,
} from "@/lib/entry/revision-diff";
import "./entry-revision-history.css";

type TimelineItem = RevisionEventLike;

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

  const revisions = buildRevisions(timeline);

  return (
    <div className="erh-root" role="dialog" aria-modal="true" aria-labelledby="erh-title">
      <button type="button" className="erh-backdrop" aria-label="Close history" onClick={onClose} />
      <div className="erh-panel">
        <header className="erh-head">
          <div>
            <p className="erh-kicker">Append-only ledger</p>
            <h2 id="erh-title" className="erh-title">
              {revisions.length > 1
                ? `Edited ${revisions.length - 1} time${revisions.length - 1 === 1 ? "" : "s"}`
                : "Entry history"}
            </h2>
            <p className="erh-meta">
              <span className="erh-mono">{row.batch}</span>
              {" · "}
              {row.stageId}
              {row.size ? ` · ${row.size}` : ""}
              {" · "}
              recorded on {row.date}
            </p>
            <p className="erh-current">
              Now: checked{" "}
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
          {!loading && !error && revisions.length === 0 && (
            <p className="erh-muted">No events found for this entry.</p>
          )}
          {!loading && revisions.length > 0 && (
            <ol className="erh-timeline">
              {revisions.map((rev, i) => {
                const prev = i > 0 ? revisions[i - 1] : null;
                const gap = prev ? formatGap(prev.recordedAt, rev.recordedAt) : null;
                const isCurrent = !rev.isSuperseded;
                return (
                  <li
                    key={rev.id}
                    className={`erh-rev ${isCurrent ? "is-current" : "is-old"}`}
                  >
                    <div className="erh-rev-head">
                      <span className="erh-rev-title">
                        {i === 0 ? "Entered" : `Edit ${i}`}
                      </span>
                      <span className="erh-when">{formatStamp(rev.recordedAt)}</span>
                      {gap && <span className="erh-gap">{gap}</span>}
                      <span className={`erh-badge ${isCurrent ? "erh-badge--live" : "erh-badge--old"}`}>
                        {isCurrent ? "Current" : "Replaced"}
                      </span>
                    </div>

                    <p className="erh-who">
                      {rev.operator && <span>{rev.operator}</span>}
                      {rev.productType && <span>{rev.productType}</span>}
                      {rev.shift && <span>{rev.shift}</span>}
                      {rev.extractedBy && (
                        <span>{rev.extractedBy === "direct-entry" ? "typed in" : rev.extractedBy}</span>
                      )}
                    </p>

                    {rev.changes.length > 0 && (
                      <ul className="erh-changes">
                        {rev.changes.map((c) => (
                          <li className="erh-change" key={`${rev.id}-${c.label}`}>
                            <span className={`erh-change-label ${c.kind === "defect" ? "is-defect" : ""}`}>
                              {c.label}
                            </span>
                            <span className="erh-from">{c.from ?? "—"}</span>
                            <span className="erh-arrow" aria-label="changed to">→</span>
                            <span className="erh-to">{c.to ?? "—"}</span>
                            {c.delta != null && c.delta !== 0 && (
                              <span className={`erh-delta ${c.delta > 0 ? "is-up" : "is-down"}`}>
                                {c.delta > 0 ? `+${c.delta}` : c.delta}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="erh-values">
                      {rev.snapshot.checked != null && (
                        <span>checked <strong>{rev.snapshot.checked.toLocaleString()}</strong></span>
                      )}
                      {rev.snapshot.accepted != null && (
                        <span>accepted <strong>{rev.snapshot.accepted.toLocaleString()}</strong></span>
                      )}
                      {rev.snapshot.rework != null && rev.snapshot.rework > 0 && (
                        <span>hold <strong>{rev.snapshot.rework.toLocaleString()}</strong></span>
                      )}
                      {rev.snapshot.rejected != null && (
                        <span>rejected <strong>{rev.snapshot.rejected.toLocaleString()}</strong></span>
                      )}
                      {Object.entries(rev.snapshot.defects).map(([code, qty]) => (
                        <span key={code}>{code} <strong>{qty}</strong></span>
                      ))}
                    </div>

                    {rev.remarks && <p className="erh-reason">Remark: {rev.remarks}</p>}
                    {rev.supersededReason && (
                      <p className="erh-reason">Replaced because: {rev.supersededReason}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <footer className="erh-foot">
          <p className="erh-foot-note">
            Nothing is ever deleted. Each edit appends a new version and retires the one before it;
            the row always shows the newest.
          </p>
          <button type="button" className="erh-btn" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
