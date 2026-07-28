/** @jest-environment node */
import {
  __resetNotificationsForTests,
  createNotification,
  listNotifications,
  openCount,
  patchNotification,
} from "../store";

describe("notification store", () => {
  beforeEach(() => __resetNotificationsForTests());

  it("creates open exceptions and counts them", () => {
    createNotification({
      type: "entry_exception",
      title: "Qty mismatch",
      body: "batch X",
      createdBy: "op1",
      payload: { kind: "qty_mismatch", date: "2026-07-28", reason: "recheck pending" },
    });
    expect(openCount()).toBe(1);
    expect(listNotifications({ status: "open" })).toHaveLength(1);
  });

  it("acks and closes an exception", () => {
    const n = createNotification({
      type: "entry_exception",
      title: "Defect mismatch",
      body: "…",
      createdBy: "op1",
      payload: { kind: "defect_mismatch", date: "2026-07-28", reason: "code later" },
    });
    const updated = patchNotification(n.id, "ack");
    expect(updated?.status).toBe("acked");
    expect(openCount()).toBe(0);
  });
});
