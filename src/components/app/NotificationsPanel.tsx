"use client";

import React, { useCallback, useEffect, useState } from "react";
import Icon from "@/components/editorial/Icon";
import { usePersona } from "@/components/app/PersonaContext";
import type { PlantNotification } from "@/lib/notifications/types";
import { issueGrant } from "@/lib/entry/edit-grants";
import type { EditRequestPayload } from "@/lib/notifications/types";

export default function NotificationsPanel() {
  const { persona, canApprove } = usePersona();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PlantNotification[]>([]);
  const [count, setCount] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?status=open");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications ?? []);
      setCount(data.openCount ?? 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  async function act(id: string, action: "ack" | "approve" | "deny", n?: PlantNotification) {
    setBusyId(id);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, actorPersona: persona }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? "Action failed");
        return;
      }
      const data = await res.json();
      // Mirror grant into browser storage so operator's client can see it.
      if (action === "approve" && n?.type === "edit_request") {
        const p = n.payload as EditRequestPayload;
        if (p?.entryKey) {
          issueGrant({
            entryKey: p.entryKey,
            approvedBy: persona,
            notificationId: id,
          });
        } else if (data.grant?.entryKey) {
          issueGrant({
            entryKey: data.grant.entryKey,
            approvedBy: persona,
            notificationId: id,
          });
        }
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  // Owner + GM see the bell (exceptions matter to both); only GM acts.
  if (persona === "operator") {
    return null;
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          void refresh();
        }}
        aria-label={`Notifications${count ? `, ${count} open` : ""}`}
        style={{
          position: "relative",
          background: "var(--surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: "50%",
          width: 32,
          height: 32,
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          boxShadow: "var(--shadow-sm)",
          color: "var(--text)",
        }}
      >
        <Icon name="alert" size={14} />
        {count > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              background: "var(--accent)",
              color: "var(--text-invert, #fff)",
              fontSize: 9,
              fontWeight: 800,
              display: "grid",
              placeItems: "center",
              padding: "0 4px",
            }}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            marginTop: 8,
            width: 360,
            maxHeight: 420,
            overflowY: "auto",
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: 12,
            boxShadow: "var(--shadow-lg)",
            zIndex: 250,
            padding: 8,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-3)", padding: "6px 8px" }}>
            Notifications {count > 0 ? `(${count})` : ""}
          </div>
          {items.length === 0 && (
            <div style={{ padding: 16, fontSize: 12.5, color: "var(--text-3)", textAlign: "center" }}>
              No open alerts.
            </div>
          )}
          {items.map((n) => (
            <div
              key={n.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 10,
                marginBottom: 6,
                background: "var(--surface-2)",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 4 }}>{n.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.4, marginBottom: 8 }}>{n.body}</div>
              <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 8, fontFamily: "var(--font-mono)" }}>
                {new Date(n.createdAt).toLocaleString()} · {n.type}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {n.type === "entry_exception" && canApprove && (
                  <button type="button" disabled={busyId === n.id} onClick={() => void act(n.id, "ack")} style={btnSm}>
                    Acknowledge
                  </button>
                )}
                {n.type === "edit_request" && canApprove && (
                  <>
                    <button type="button" disabled={busyId === n.id} onClick={() => void act(n.id, "approve", n)} style={btnSmPrimary}>
                      Approve edit
                    </button>
                    <button type="button" disabled={busyId === n.id} onClick={() => void act(n.id, "deny", n)} style={btnSm}>
                      Deny
                    </button>
                  </>
                )}
                {!canApprove && (
                  <span style={{ fontSize: 11, color: "var(--text-3)" }}>View only — GM acts on these</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const btnSm: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: 6,
  border: "1px solid var(--border-strong)",
  background: "var(--surface)",
  fontSize: 11.5,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};
const btnSmPrimary: React.CSSProperties = {
  ...btnSm,
  background: "var(--accent)",
  color: "var(--text-invert, #fff)",
  border: "none",
};
