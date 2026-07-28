// Client-side page export helpers — only serialize data already on the page.

export type ExportFormat = "csv" | "json";

export type ExportSection =
  | {
      id: string;
      label: string;
      kind: "kpi" | "table";
      /** Flat rows for tables; single-row map for KPIs. */
      getData: () => Record<string, unknown>[] | Record<string, unknown>;
    }
  | {
      id: string;
      label: string;
      kind: "chart";
      /** Optional DOM node for future PNG capture. */
      getElement?: () => HTMLElement | null;
    };

function escapeCsv(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const keys = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>()),
  );
  const lines = [keys.map(escapeCsv).join(",")];
  for (const row of rows) {
    lines.push(keys.map((k) => escapeCsv(row[k])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

export function buildPageExport(opts: {
  page: string;
  sections: ExportSection[];
  include: { kpi: boolean; table: boolean; chart: boolean };
  format: ExportFormat;
}): { blob: Blob; fileName: string } {
  const date = new Date().toISOString().slice(0, 10);
  const picked = opts.sections.filter((s) => {
    if (s.kind === "kpi") return opts.include.kpi;
    if (s.kind === "table") return opts.include.table;
    return opts.include.chart;
  });

  if (opts.format === "json") {
    const payload: Record<string, unknown> = {
      page: opts.page,
      exportedAt: new Date().toISOString(),
      sections: {},
    };
    for (const s of picked) {
      if (s.kind === "chart") {
        (payload.sections as Record<string, unknown>)[s.id] = {
          label: s.label,
          kind: "chart",
          note: "Chart geometry not serialized; use CSV/JSON for values or capture PNG from the page.",
        };
        continue;
      }
      (payload.sections as Record<string, unknown>)[s.id] = {
        label: s.label,
        kind: s.kind,
        data: s.getData(),
      };
    }
    const text = JSON.stringify(payload, null, 2);
    return {
      blob: new Blob([text], { type: "application/json" }),
      fileName: `moid-${opts.page}-${date}.json`,
    };
  }

  // CSV: concatenate sections with headers
  const chunks: string[] = [];
  for (const s of picked) {
    if (s.kind === "chart") continue;
    const data = s.getData();
    const rows = Array.isArray(data) ? data : [data];
    chunks.push(`# ${s.label}`);
    chunks.push(rowsToCsv(rows as Record<string, unknown>[]));
  }
  const text = chunks.join("\r\n") || "# no data\r\n";
  return {
    blob: new Blob([text], { type: "text/csv;charset=utf-8;" }),
    fileName: `moid-${opts.page}-${date}.csv`,
  };
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
