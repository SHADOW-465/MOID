export type NotificationType = "entry_exception" | "edit_request" | "edit_granted";

export type NotificationStatus = "open" | "acked" | "approved" | "denied";

export type NotificationActionKind = "ack" | "approve" | "deny";

/** One step in the GM/operator trail — never deleted when status changes. */
export type NotificationHistoryEntry = {
  action: NotificationActionKind;
  at: string;
  by: string;
  note?: string;
};

export type EntryExceptionPayload = {
  kind: string;
  date: string;
  batchId?: string;
  stageId?: string;
  stageName?: string;
  processName?: string;
  size?: string;
  productType?: string;
  operator?: string;
  shift?: string;
  checked?: number;
  accept?: number;
  hold?: number;
  reject?: number;
  defectSum?: number;
  /** Plain-language equation e.g. "Checked 100 ≠ Accept 20 + Reject 50 (sum 70)" */
  detail?: string;
  reason: string;
  path?: string;
  /** How the operator chose to save when defects disagree */
  a12Choice?: "set-reject" | "keep-incomplete";
};

export type EditRequestPayload = {
  entryKey: string;
  date: string;
  batchId: string;
  stageId: string;
  stageName?: string;
  size: string;
  productType?: string;
  operator?: string;
  shift?: string;
  path?: string;
};

export type PlantNotification = {
  id: string;
  type: NotificationType;
  status: NotificationStatus;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  /** Who created it (operator name or persona). */
  createdBy: string;
  /** Persona that should act (usually gm). */
  targetPersona: "gm" | "owner" | "operator" | "any";
  payload: EntryExceptionPayload | EditRequestPayload | Record<string, unknown>;
  /** Append-only trail of GM (or actor) actions. */
  history: NotificationHistoryEntry[];
  /** Convenience mirrors of last history entry for filters/UI. */
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
};
