// Ask MOID task-agent types. Multi-turn sessions, drafts, tool intents.

import type { MacroId } from "@/lib/entry/disposafe-matrix";
import type { InvestigationState } from "@/lib/analytics/investigation-state";
import type { NavKey } from "@/lib/nav-keys";

export type TaskKind =
  | "howto"
  | "navigate"
  | "analyze"
  | "report"
  | "enter_data"
  | "workflow";

export type TaskStatus =
  | "collecting"
  | "confirming"
  | "executing"
  | "done"
  | "failed"
  | "idle";

/** Slots for enter_data. All optional until validated. */
export interface EntrySlots {
  macro?: MacroId;
  /** Assembly micro process id e.g. p15-visual */
  micro?: string;
  stageId?: string;
  processName?: string;
  checked?: number;
  acceptedGood?: number;
  rejected?: number;
  hold?: number;
  defects?: Record<string, number>;
  date?: string; // yyyy-mm-dd
  batchId?: string;
  size?: string; // display 16Fr
  productType?: string;
  shift?: string;
  operator?: string;
  remarks?: string;
}

export interface ReportSlots {
  from?: string;
  to?: string;
  grain?: InvestigationState["grain"];
  periodLabel?: string;
  stageView?: string;
  presetId?: string;
}

export interface EntryDraft {
  kind: "enter_data";
  slots: Required<
    Pick<
      EntrySlots,
      | "macro"
      | "micro"
      | "stageId"
      | "processName"
      | "checked"
      | "date"
      | "batchId"
      | "size"
    >
  > &
    EntrySlots;
  /** Human rows for the confirm card */
  summaryRows: { label: string; value: string }[];
  warnings: string[];
}

export interface ReportDraft {
  kind: "report" | "analyze";
  state: InvestigationState;
  periodLabel: string;
  presetId?: string;
  navKey: NavKey;
  href: string;
}

export type AgentDraft = EntryDraft | ReportDraft;

export interface AgentAction {
  id: string;
  label: string;
  kind:
    | "confirm_ingest"
    | "cancel"
    | "chip"
    | "navigate"
    | "open_reports"
    | "prefill_entry"
    | "copy_link"
    | "workflow_next"
    | "spotlight";
  /** For chip: text to re-submit as user message */
  chipText?: string;
  href?: string;
  navKey?: NavKey;
  state?: InvestigationState;
  /** URL to copy (share investigation) */
  copyText?: string;
  /** Nav key to pulse in the sidebar */
  spotlightNav?: string;
}

export interface WorkflowSessionState {
  workflowId: string;
  stepIndex: number;
  title: string;
}

export interface AgentSession {
  taskId: string;
  kind: TaskKind;
  status: TaskStatus;
  entrySlots: EntrySlots;
  reportSlots: ReportSlots;
  missing: string[];
  draft?: AgentDraft;
  /** Last balance / validation error shown to user */
  validationError?: string | null;
  /** Note e.g. inferred Visual from defects */
  notes: string[];
  workflow?: WorkflowSessionState;
  createdAt: string;
  updatedAt: string;
}

export type ToolIntent =
  | { type: "apply_scope"; state: InvestigationState }
  | { type: "navigate"; href: string; state?: InvestigationState; label: string }
  | { type: "open_reports"; state: InvestigationState; presetId?: string }
  | { type: "summarize"; state: InvestigationState; periodLabel: string; question: string }
  | { type: "ingest"; draft: EntryDraft }
  | { type: "prefill_entry"; draft: EntryDraft; href: string }
  | { type: "copy_link"; url: string }
  | { type: "spotlight"; navKey: string }
  | { type: "howto_reply" };

export interface AgentReply {
  text: string;
  steps?: string[];
  actions: AgentAction[];
  /** When true, client should run tool intents immediately (read-only). */
  autoTools: ToolIntent[];
  /** Show entry draft card */
  draft?: AgentDraft;
}

export interface TurnResult {
  session: AgentSession | null;
  reply: AgentReply;
}

export interface AgentCtx {
  dataMaxIso: string;
  /** Local calendar yyyy-mm-dd for "today" entry */
  todayIso: string;
  persona: string;
  canWrite: boolean;
  currentPath?: string;
  /** Effective ledger size — for empty-state tips */
  eventCount?: number;
}
