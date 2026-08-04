// src/app/api/policy/route.ts
// Calculation policy — the conventions behind every number.
//
// GET → { policy, version, changedBy, changedAt, note, history[] }
// PUT → save a new version (append-only; latest wins)
//
// Reads are also served inline by /api/schema so the client gets plant config
// in one round trip; this route owns writes and history.

import { NextRequest, NextResponse } from "next/server";
import { CalculationPolicy } from "@/core/policy/policy";
import { getPolicyStore } from "@/core/policy/policy-store";

function companyId(): string {
  return process.env.MOID_COMPANY_ID || "default";
}

export async function GET() {
  const store = getPolicyStore();
  const company = companyId();
  const [current, history] = await Promise.all([store.current(company), store.history(company)]);
  return NextResponse.json({ ...current, history });
}

// A note is required on save: history nobody can read a year later is not an
// audit trail. changedBy comes from the active persona.
export async function PUT(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { policy: rawPolicy, note, changedBy } = (body ?? {}) as {
    policy?: unknown;
    note?: unknown;
    changedBy?: unknown;
  };

  const parsed = CalculationPolicy.safeParse(rawPolicy);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid policy", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  if (typeof note !== "string" || note.trim().length === 0) {
    return NextResponse.json(
      { error: "A note explaining the change is required" },
      { status: 400 },
    );
  }

  try {
    const saved = await getPolicyStore().save(companyId(), parsed.data, {
      changedBy: typeof changedBy === "string" && changedBy.trim() ? changedBy.trim() : "unknown",
      note: note.trim(),
    });
    return NextResponse.json(saved);
  } catch (err) {
    // Match on name, not instanceof: HMR and route bundling can load two copies
    // of the class, and then instanceof silently misses.
    if (err instanceof Error && err.name === "PolicyTableMissingError") {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("[api/policy] PUT failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save failed" },
      { status: 500 },
    );
  }
}
