/** Shared nav destination keys (AppShell + persona filter + command palette). */
export type NavKey =
  | "dashboard"
  | "workbooks"
  | "data-entry"
  | "staging"
  | "stage"
  | "size"
  | "defect"
  | "spc"
  | "process-flow"
  | "copq"
  | "reports"
  | "capa"
  | "ask"
  | "audit"
  | "schema"
  | "settings";

/**
 * Where each destination lives, and what people call it.
 *
 * One table. Deleting the /chat route meant editing four separate hardcoded
 * lists of the same fifteen screens — the sidebar, the Jump index, the intent
 * router's href map and the guide catalog — and missing any one of them left a
 * dead link that nothing type-checked. They read from here now.
 *
 * `href: null` means the destination is not a route: Ask MOID is a panel that
 * opens over whatever screen you are already on.
 */
export interface NavRoute {
  label: string;
  href: string | null;
  /** Extra words people type when they mean this screen. */
  keywords: string;
}

export const NAV_ROUTES: Record<NavKey, NavRoute> = {
  dashboard: { label: "Dashboard", href: "/", keywords: "home status factory overview" },
  "data-entry": { label: "Data Entry", href: "/data-entry", keywords: "batch matrix log capture" },
  staging: { label: "Import from Excel", href: "/staging", keywords: "excel upload import" },
  workbooks: { label: "Excel Data", href: "/workbooks", keywords: "mod ontology files" },
  stage: { label: "By Stage", href: "/stage-analysis", keywords: "gate visual balloon valve" },
  size: { label: "By Size", href: "/size-analysis", keywords: "fr french size" },
  defect: { label: "By Defect", href: "/defect-analysis", keywords: "pareto reason" },
  spc: { label: "SPC & Control Charts", href: "/spc", keywords: "control chart xbar" },
  "process-flow": { label: "Process Flow", href: "/process-flow", keywords: "fpy flow" },
  copq: { label: "Cost of Rejection", href: "/copq", keywords: "cost rupee money" },
  reports: { label: "Reports", href: "/reports", keywords: "print monthly pack" },
  capa: { label: "CAPA & Actions", href: "/capa", keywords: "action owner" },
  ask: { label: "Ask MOID", href: null, keywords: "assistant copilot chat" },
  audit: { label: "Audit Trail", href: "/audit", keywords: "provenance trust" },
  schema: { label: "Plant Schema", href: "/schema", keywords: "registry stages defects" },
  settings: { label: "Settings", href: "/settings", keywords: "target cost theme" },
};

/** Destinations that are actually routes — everything Jump can navigate to. */
export const ROUTED_NAV_KEYS = (Object.keys(NAV_ROUTES) as NavKey[]).filter(
  (k) => NAV_ROUTES[k].href !== null,
);

/** Href for a destination; falls back to the dashboard for panel-only keys. */
export function navHref(key: NavKey): string {
  return NAV_ROUTES[key].href ?? "/";
}
