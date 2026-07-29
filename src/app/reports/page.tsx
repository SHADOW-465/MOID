"use client";

// Reports — named-preset editor (Phase 2).
//
// The GM builds a report by picking a named preset (GM monthly, full forensic
// package, …), editing sections when the preset is block-based, previewing
// live data, then Print / Save as PDF. The old 24-page forensic book is one
// built-in preset, not a separate product.

import { useMemo } from "react";
import AppShell from "@/components/app/AppShell";
import { useEvents } from "@/components/app/EventsContext";
import { useRegistry } from "@/components/app/RegistryContext";
import { useTweaks } from "@/components/editorial/TweaksContext";
import ReportPanel from "@/components/report/ReportPanel";
import { resolveScope } from "@/lib/analytics/scope";
import type { Scope } from "@/lib/analytics";
import PageLoader from "@/components/app/PageLoader";

export default function ReportsPage() {
  const { events, isLoading } = useEvents();
  const { registry } = useRegistry();
  const { t } = useTweaks();

  const scope: Scope = useMemo(
    () => resolveScope(events ?? [], t),
    [events, t.grain, t.dateFrom, t.dateTo, t.datePreset, t.stageView],
  );

  const periodLabel = useMemo(() => {
    if (scope.dateFrom && scope.dateTo) return `${scope.dateFrom} to ${scope.dateTo}`;
    return "all data";
  }, [scope.dateFrom, scope.dateTo]);

  return (
    <AppShell active="reports" dateRange={periodLabel}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="no-print">
          <h1 className="h1" style={{ margin: 0 }}>Reports</h1>
          <p className="body" style={{ color: "var(--text-2)", marginTop: 6, maxWidth: 560 }}>
            Choose a named preset, fine-tune sections, preview with live ledger data, then print to PDF.
            The full forensic audit book is available as <strong>Full forensic package</strong>.
          </p>
        </div>

        {isLoading ? (
          <PageLoader message="Loading ledger for report…" minHeight="40vh" />
        ) : (
          <ReportPanel
            page="reports"
            events={events ?? []}
            scope={scope}
            periodLabel={periodLabel}
            embedded
            registry={registry}
            initialPresetId="builtin:gm-monthly"
            onDownloadData={async () => {
              const { buildAuditPackage } = await import("@/lib/audit-package");
              const { blob, fileName } = await buildAuditPackage(events ?? [], { grain: "month" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = fileName;
              a.click();
              URL.revokeObjectURL(url);
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
