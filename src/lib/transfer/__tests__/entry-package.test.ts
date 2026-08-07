import {
  buildEntryPackage,
  parseEntryPackage,
  ENTRY_PACKAGE_FORMAT,
} from "../entry-package";
import { emitStageDay, type StageDayRecord } from "@/lib/ingest/emit";
import type { Event } from "@/lib/store/types";

const SRC = {
  file: "Manual Entry",
  fileHash: "h1",
  sheet: "Day Shift",
  tableId: "t1",
};

function directRec(): StageDayRecord {
  return {
    occurredOn: { kind: "day", start: "2025-04-01", end: "2025-04-01" },
    stageId: "visual",
    source: SRC,
    checked: { value: 100, cell: "ENTRY!checked", header: "Checked" },
    acceptedGood: null,
    rework: null,
    rejected: { value: 5, cell: "ENTRY!rejected", header: "Rejected" },
    defects: [],
    statedPct: null,
    extractedBy: "direct-entry",
    ingestionId: "ing-1",
  };
}

function excelEvents(): Event[] {
  return emitStageDay({
    ...directRec(),
    source: {
      file: "VISUAL.xlsx",
      fileHash: "h2",
      sheet: "MAY",
      tableId: "t1",
    },
    extractedBy: "mod",
  });
}

describe("entry package", () => {
  it("exports only direct-entry by default channel", () => {
    const direct = emitStageDay(directRec());
    const excel = excelEvents();
    const pkg = buildEntryPackage([...direct, ...excel], {
      channel: "direct-entry",
    });
    expect(pkg.format).toBe(ENTRY_PACKAGE_FORMAT);
    expect(pkg.eventCount).toBe(direct.length);
    expect(
      (pkg.events as Event[]).every(
        (e) => (e as Event & { extractedBy?: string }).extractedBy === "direct-entry",
      ),
    ).toBe(true);
  });

  it("parses a round-tripped package", () => {
    const events = emitStageDay(directRec());
    const pkg = buildEntryPackage(events, { channel: "direct-entry" });
    const parsed = parseEntryPackage(pkg);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.events.length).toBe(events.length);
    expect(parsed.skipped).toBe(0);
  });

  it("rejects unknown format", () => {
    const bad = parseEntryPackage({ format: "nope", events: [] });
    expect(bad.ok).toBe(false);
  });
});
