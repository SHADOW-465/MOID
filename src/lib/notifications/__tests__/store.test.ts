import {
  __resetNotificationsForTests,
  createNotification,
  listNotifications,
  openCount,
  patchNotification,
} from "@/lib/notifications/store";

describe("notification store trail", () => {
  beforeEach(() => {
    __resetNotificationsForTests();
  });

  it("creates open alerts and keeps an action trail on ack", () => {
    const n = createNotification({
      type: "entry_exception",
      title: "Entry saved with quantity exception",
      body: "Op saved 26F27-14 with mismatch",
      createdBy: "Ravi",
      payload: {
        kind: "qty_mismatch",
        date: "2026-06-27",
        batchId: "26F27-14",
        reason: "Hold pending re-inspection",
        checked: 100,
        accept: 20,
        reject: 50,
      },
    });
    expect(n.status).toBe("open");
    expect(n.history).toEqual([]);
    expect(openCount()).toBe(1);

    const updated = patchNotification(n.id, {
      action: "ack",
      actor: "gm",
      note: "Reviewed — OK to leave",
    });
    expect(updated?.status).toBe("acked");
    expect(updated?.resolvedBy).toBe("gm");
    expect(updated?.resolutionNote).toBe("Reviewed — OK to leave");
    expect(updated?.history).toHaveLength(1);
    expect(updated?.history[0].action).toBe("ack");
    expect(updated?.history[0].by).toBe("gm");
    expect(openCount()).toBe(0);

    const closed = listNotifications({ status: "closed" });
    expect(closed).toHaveLength(1);
    expect(closed[0].id).toBe(n.id);
  });
});
