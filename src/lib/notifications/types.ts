export type NotificationType = "entry_exception" | "edit_request" | "edit_granted";

export type NotificationStatus = "open" | "acked" | "approved" | "denied";

export type EntryExceptionPayload = {
  kind: "qty_mismatch" | "defect_mismatch" | "reconcile";
  date: string;
  batchId?: string;
  stageId?: string;
  stageName?: string;
  size?: string;
  productType?: string;
  operator?: string;
  checked?: number;
  accept?: number;
  hold?: number;
  reject?: number;
  defectSum?: number;
  reason: string;
  path?: string;
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
};
