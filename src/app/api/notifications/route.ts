// Operational notifications: entry exceptions + edit requests for the GM.

import { NextRequest, NextResponse } from "next/server";
import {
  createNotification,
  listNotifications,
  openCount,
  patchNotification,
} from "@/lib/notifications/store";
import type { NotificationType } from "@/lib/notifications/types";
import { issueGrant } from "@/lib/entry/edit-grants";
import type { EditRequestPayload } from "@/lib/notifications/types";
import { canApprove, isPersonaId } from "@/lib/persona";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") ?? "open";
  const type = req.nextUrl.searchParams.get("type") as NotificationType | null;
  const list = listNotifications({
    status: status === "all" ? "all" : (status as "open"),
    type: type || undefined,
  });
  return NextResponse.json({ notifications: list, openCount: openCount() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.type || !body?.title || !body?.body) {
      return NextResponse.json({ error: "type, title, body required" }, { status: 400 });
    }
    const n = createNotification({
      type: body.type,
      title: body.title,
      body: body.body,
      createdBy: body.createdBy ?? "unknown",
      targetPersona: body.targetPersona ?? "gm",
      payload: body.payload ?? {},
    });
    return NextResponse.json({ notification: n, openCount: openCount() });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create notification" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = body?.id as string | undefined;
    const action = body?.action as "ack" | "approve" | "deny" | undefined;
    const actorPersona = body?.actorPersona as string | undefined;

    if (!id || !action) {
      return NextResponse.json({ error: "id and action required" }, { status: 400 });
    }
    if (!["ack", "approve", "deny"].includes(action)) {
      return NextResponse.json({ error: "invalid action" }, { status: 400 });
    }

    // Approve/deny require GM capability (interim persona header honesty).
    if ((action === "approve" || action === "deny") && (!isPersonaId(actorPersona) || !canApprove(actorPersona))) {
      return NextResponse.json({ error: "Only GM may approve or deny" }, { status: 403 });
    }

    const existing = listNotifications({ status: "all" }).find((n) => n.id === id);
    if (!existing) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const updated = patchNotification(id, action);
    if (!updated) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    let grant = null;
    if (action === "approve" && existing.type === "edit_request") {
      const p = existing.payload as EditRequestPayload;
      if (p?.entryKey) {
        grant = issueGrant({
          entryKey: p.entryKey,
          approvedBy: actorPersona ?? "gm",
          notificationId: id,
        });
      }
    }

    return NextResponse.json({ notification: updated, grant, openCount: openCount() });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to patch notification" },
      { status: 500 },
    );
  }
}
