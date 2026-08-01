import { auditSummary, trustScore } from "../trust";
import type { Event } from "@/lib/store/types";

const ev = (basis: string, file: string, type = "production"): Event =>
  ({
    eventId: `${file}-${basis}-${Math.random()}`,
    eventType: type,
    occurredOn: { kind: "day", start: "2026-07-15", end: "2026-07-15" },
    provenance: { file },
    confidence: { score: 1, basis },
  }) as unknown as Event;

const ALL = {} as Parameters<typeof auditSummary>[1];

test("an empty ledger scores zero, not a flattering default", () => {
  expect(trustScore([], ALL)).toEqual({ pct: 0, verified: 0, assumed: 0, unresolved: 0 });
  const s = auditSummary([], ALL);
  expect(s.sourceFiles).toBe(0);
  expect(s.totalValues).toBe(0);
  expect(s.verifiedPct).toBe(0);
  expect(s.manualOverrides).toBe(0);
});

test("every audit figure is counted, never assumed", () => {
  const events = [
    ev("exact", "a.xlsx"),
    ev("heuristic", "a.xlsx"),
    ev("llm", "b.xlsx"),
    ev("exact", "b.xlsx", "correction"),
  ];
  const s = auditSummary(events, ALL);
  expect(s.sourceFiles).toBe(2);
  expect(s.totalValues).toBe(4);
  expect(s.verifiedValues).toBe(3); // exact + heuristic + the correction
  expect(s.verifiedPct).toBe(75);
  expect(s.unresolvedValues).toBe(1); // the llm-basis one
  expect(s.manualOverrides).toBe(1);
});
