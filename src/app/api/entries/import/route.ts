import { NextRequest, NextResponse } from "next/server";
import { getStores } from "@/lib/store";
import { parseEntryPackage } from "@/lib/transfer/entry-package";

/**
 * POST /api/entries/import
 * Body: EntryPackage JSON (moid-entry-transfer-v1).
 * Appends events idempotently (same eventId → dedupe).
 */
export async function POST(req: NextRequest) {
  try {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = parseEntryPackage(raw);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    if (parsed.events.length === 0) {
      return NextResponse.json(
        {
          error: "No valid events in package.",
          skipped: parsed.skipped,
          errors: parsed.errors,
        },
        { status: 400 },
      );
    }

    const { events: store, backend } = getStores();
    const result = await store.append(parsed.events);

    return NextResponse.json({
      ok: true,
      backend,
      package: {
        format: parsed.package.format,
        exportedAt: parsed.package.exportedAt,
        filter: parsed.package.filter,
        eventCount: parsed.package.eventCount,
      },
      inserted: result.inserted,
      deduped: result.deduped,
      skippedInvalid: parsed.skipped,
      validationErrors: parsed.errors,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
