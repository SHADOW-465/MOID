// src/app/api/manual-entries/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getStores } from "@/lib/store";
import { aggregate } from "@/lib/analytics/rejection";

export async function GET(req: NextRequest) {
  try {
    // Same store abstraction /api/events uses — works against the in-memory
    // store in local/test runs (no Supabase configured) as well as Supabase,
    // instead of querying Supabase directly and hard-failing without it.
    const { events: store } = getStores();
    const events = (await store.effective({}))
      .slice()
      .sort((a, b) => (b.recordedAt ?? "").localeCompare(a.recordedAt ?? ""));

    // Group events by occurredOn.start (Date) and provenance.sheet (Shift)
    const groups = new Map<string, any[]>();
    for (const e of events) {
      const date = e.occurredOn?.start;
      const shift = e.provenance?.sheet || "Day Shift";
      const key = `${date}|${shift}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(e);
    }

    const records = Array.from(groups.entries()).map(([key, groupEvents]) => {
      const [date, shift] = key.split("|");
      const firstEvent = groupEvents[0];
      const ingestionId = firstEvent.ingestionId;
      const customFields = firstEvent.customFields || {};

      const operator = customFields.operator || firstEvent.provenance?.operator || "";
      const supervisor = customFields.supervisor || firstEvent.provenance?.supervisor || "";
      const machine = customFields.machine || firstEvent.provenance?.machine || "";
      const product = customFields.product || firstEvent.provenance?.product || "";
      const size = customFields.size || firstEvent.provenance?.size || "";
      const batch = customFields.batch || firstEvent.provenance?.batch || "";
      const notes = customFields.notes || "";
      const isDirect = firstEvent.provenance?.is_direct_entry === true;
      const source = isDirect ? "Direct Entry" : (firstEvent.provenance?.file || "Upload");

      // Reconstruct stage-wise field values. `provenance.headerPath` is
      // whatever the source used (an internal field key like "checked" for
      // direct entry, or the raw sheet header text for an upload) — never a
      // reliable match for the "Checked Qty"/"Rejected Qty" keys the ledger
      // summary reads. Use the event's own semantic type instead (same
      // aggregate() the rest of the analytics layer trusts), grouped by stage.
      const stageData: Record<string, Record<string, any>> = {};
      const stageIds = new Set(groupEvents.map((e) => e.stageId).filter(Boolean));
      for (const stageId of stageIds) {
        const agg = aggregate(groupEvents.filter((e) => e.stageId === stageId));
        stageData[stageId] = {
          "Checked Qty": agg.checked,
          "Good Qty": agg.good,
          "Rework Qty": agg.rework,
          "Rejected Qty": agg.rejected,
        };
      }

      // Copy any genuine custom fields (excluding the header fields already
      // grouped at the top level) onto their stage.
      for (const e of groupEvents) {
        const stageId = e.stageId;
        if (!stageId || !e.customFields) continue;
        Object.entries(e.customFields).forEach(([k, v]) => {
          if (!["operator", "supervisor", "machine", "product", "size", "batch", "notes"].includes(k)) {
            stageData[stageId][k] = v;
          }
        });
      }

      return {
        date,
        shift,
        ingestionId,
        operator,
        supervisor,
        machine,
        product,
        size,
        batch,
        notes,
        stageData,
        source,
        recordedAt: firstEvent.recordedAt
      };
    });

    return NextResponse.json({ records });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to load manual entries" }, { status: 500 });
  }
}

/**
 * Erase one ledger entry outright — the deliberate exception to append-only.
 *
 * Beta testing means dummy rows, and a dummy row that can only be *superseded*
 * still sits in the audit trail forever. So this purges instead: the events of
 * the entry, plus the corrections and annotations that point at them, so no
 * orphan provenance is left behind.
 *
 * Scope, narrowest first:
 *   ?ingestionId=X          exactly one save
 *   ?date=&shift=[&source=] the ledger row as displayed (source guards against
 *                           a manual delete also taking out uploaded rows that
 *                           happen to share the day and sheet name)
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ingestionId = searchParams.get("ingestionId");
    const date = searchParams.get("date");
    const shift = searchParams.get("shift");
    const source = searchParams.get("source");

    if (!ingestionId && (!date || !shift)) {
      return NextResponse.json(
        { error: "Pass ingestionId, or both date and shift." },
        { status: 400 },
      );
    }

    const { events: store } = getStores();
    // `all`, not `effective` — a superseded event still occupies the row and
    // must go too, or re-saving the same day resurrects stale numbers.
    const everything = await store.all({});

    const targeted = everything.filter((e) => {
      if (ingestionId) return e.ingestionId === ingestionId;
      if (e.occurredOn?.start !== date) return false;
      if ((e.provenance?.sheet || "Day Shift") !== shift) return false;
      if (!source) return true;
      const isDirect = (e.provenance as any)?.is_direct_entry === true;
      const rowSource = isDirect ? "Direct Entry" : e.provenance?.file || "Upload";
      return rowSource === source;
    });

    const ids = new Set(targeted.map((e) => e.eventId));
    if (ids.size === 0) {
      return NextResponse.json({ success: true, deletedCount: 0 });
    }

    // Sweep up events that only exist to describe the ones being erased.
    for (const e of everything) {
      if (ids.has(e.eventId)) continue;
      const supersedes = (e as any).supersedesEventId;
      if (supersedes && ids.has(supersedes)) ids.add(e.eventId);
      const targets: string[] = (e as any).targetEventIds ?? [];
      if (targets.length > 0 && targets.every((t) => ids.has(t))) ids.add(e.eventId);
    }

    const deletedCount = await store.purge([...ids]);
    return NextResponse.json({ success: true, deletedCount });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to delete manual entry" }, { status: 500 });
  }
}
