// Portable package of ledger events for moving Data Entry (and optional full
// ledger) between environments / databases. Content-addressed eventIds make
// re-import idempotent via EventStore.append.

import { z } from "zod";
import { CanonicalEvent } from "@/lib/contract/d1";
import { isDirectEntryEvent } from "@/lib/analytics/scope";
import type { Event } from "@/lib/store/types";

export const ENTRY_PACKAGE_FORMAT = "moid-entry-transfer-v1" as const;

export const EntryPackageFilter = z.object({
  channel: z.enum(["direct-entry", "all"]),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const EntryPackageMeta = z.object({
  format: z.literal(ENTRY_PACKAGE_FORMAT),
  exportedAt: z.string().min(1),
  companyId: z.string().optional(),
  backend: z.string().optional(),
  filter: EntryPackageFilter,
  eventCount: z.number().int().nonnegative(),
});

export const EntryPackage = EntryPackageMeta.extend({
  events: z.array(z.unknown()),
});

export type EntryPackageT = z.infer<typeof EntryPackage>;
export type EntryPackageFilterT = z.infer<typeof EntryPackageFilter>;

export function filterEventsForExport(
  events: Event[],
  filter: EntryPackageFilterT,
): Event[] {
  let list = events;
  if (filter.channel === "direct-entry") {
    list = list.filter(isDirectEntryEvent);
  }
  if (filter.from) {
    list = list.filter((e) => (e.occurredOn?.start ?? "") >= filter.from!);
  }
  if (filter.to) {
    list = list.filter((e) => (e.occurredOn?.start ?? "") <= filter.to!);
  }
  return list;
}

export function buildEntryPackage(
  events: Event[],
  filter: EntryPackageFilterT,
  opts?: { companyId?: string; backend?: string },
): EntryPackageT {
  const selected = filterEventsForExport(events, filter);
  return {
    format: ENTRY_PACKAGE_FORMAT,
    exportedAt: new Date().toISOString(),
    companyId: opts?.companyId,
    backend: opts?.backend,
    filter,
    eventCount: selected.length,
    events: selected,
  };
}

export type ImportParseResult =
  | { ok: true; package: EntryPackageT; events: Event[]; skipped: number; errors: string[] }
  | { ok: false; error: string };

/**
 * Validate package envelope + each event. Invalid events are skipped (counted)
 * so a partial transfer still lands good rows.
 */
export function parseEntryPackage(raw: unknown): ImportParseResult {
  const env = EntryPackage.safeParse(raw);
  if (!env.success) {
    return {
      ok: false,
      error: `Invalid package: ${env.error.issues[0]?.message ?? "parse error"}`,
    };
  }
  const pkg = env.data;
  if (pkg.format !== ENTRY_PACKAGE_FORMAT) {
    return { ok: false, error: `Unsupported format: ${String((raw as any)?.format)}` };
  }

  const events: Event[] = [];
  const errors: string[] = [];
  let skipped = 0;
  for (let i = 0; i < pkg.events.length; i++) {
    const parsed = CanonicalEvent.safeParse(pkg.events[i]);
    if (!parsed.success) {
      skipped++;
      if (errors.length < 20) {
        errors.push(
          `event[${i}]: ${parsed.error.issues[0]?.message ?? "invalid"}`,
        );
      }
      continue;
    }
    events.push(parsed.data as Event);
  }

  return { ok: true, package: pkg, events, skipped, errors };
}
