// What the topbar "Export" button does on Data Entry.
// Stored per-browser (localStorage) so plant IT can set defaults without a deploy.

export type DataEntryExportMode = "entry-transfer" | "audit-zip";
export type EntryExportChannel = "direct-entry" | "all";

export interface DataEntryExportConfig {
  /**
   * entry-transfer — JSON package for Staging import / DB→DB moves (default).
   * audit-zip — legacy full ALCOA+ audit package (CSV + manifest zip).
   */
  mode: DataEntryExportMode;
  /** Which ledger rows go into the transfer package. */
  channel: EntryExportChannel;
  /**
   * When true, Export uses the current topbar date range (Sources / period).
   * When false, uses optional fixed from/to below (empty = all dates).
   */
  useDateScope: boolean;
  /** ISO yyyy-mm-dd inclusive, only if useDateScope is false. */
  from: string;
  to: string;
}

export const DATA_ENTRY_EXPORT_STORAGE_KEY = "moid_data_entry_export";

export const DEFAULT_DATA_ENTRY_EXPORT_CONFIG: DataEntryExportConfig = {
  mode: "entry-transfer",
  channel: "direct-entry",
  useDateScope: false,
  from: "",
  to: "",
};

export function readDataEntryExportConfig(): DataEntryExportConfig {
  if (typeof window === "undefined") return { ...DEFAULT_DATA_ENTRY_EXPORT_CONFIG };
  try {
    const raw = localStorage.getItem(DATA_ENTRY_EXPORT_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DATA_ENTRY_EXPORT_CONFIG };
    const parsed = JSON.parse(raw) as Partial<DataEntryExportConfig>;
    return {
      mode:
        parsed.mode === "audit-zip" || parsed.mode === "entry-transfer"
          ? parsed.mode
          : DEFAULT_DATA_ENTRY_EXPORT_CONFIG.mode,
      channel:
        parsed.channel === "all" || parsed.channel === "direct-entry"
          ? parsed.channel
          : DEFAULT_DATA_ENTRY_EXPORT_CONFIG.channel,
      useDateScope: !!parsed.useDateScope,
      from: typeof parsed.from === "string" ? parsed.from : "",
      to: typeof parsed.to === "string" ? parsed.to : "",
    };
  } catch {
    return { ...DEFAULT_DATA_ENTRY_EXPORT_CONFIG };
  }
}

export function writeDataEntryExportConfig(cfg: DataEntryExportConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DATA_ENTRY_EXPORT_STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* quota / private mode */
  }
}

export function describeDataEntryExportConfig(cfg: DataEntryExportConfig): string {
  if (cfg.mode === "audit-zip") {
    return "Full audit ZIP (CSV extracts + hash manifest)";
  }
  const ch =
    cfg.channel === "all" ? "all ledger events" : "Data Entry rows only";
  const dates = cfg.useDateScope
    ? "current topbar date range"
    : cfg.from || cfg.to
      ? `${cfg.from || "…"} → ${cfg.to || "…"}`
      : "all dates";
  return `Transfer JSON · ${ch} · ${dates}`;
}
