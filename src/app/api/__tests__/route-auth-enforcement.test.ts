// End-to-end proof through the REAL handlers.
//
// `route-auth-coverage.test.ts` is static (does the file call a guard?) and
// `lib/auth/__tests__/guard.test.ts` is a unit test (does the guard decide
// correctly?). Both can pass while the wiring between them is wrong — a guard
// imported but called after the side effect, or with the wrong capability.
// These call the exported handlers and assert on the status they return.
//
// Note these bypass `src/proxy.ts` (Next does not run it for a direct handler
// call), which is exactly what makes them useful: they measure the handler's
// OWN authorization, not the proxy's authentication sitting in front of it.
// The `role: null` cases prove a handler is not relying on the proxy for a
// check it must make itself.
process.env.MOID_STORE = "memory";

import { NextRequest } from "next/server";
import { sessionCookie } from "@/__tests__/fixtures/auth";
import type { PersonaId } from "@/lib/persona";

type Handler = (req: NextRequest) => Promise<Response>;

async function call(
  handler: Handler,
  { method, url, role, body }: { method: string; url: string; role: PersonaId | null; body?: unknown },
) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (role) headers["Cookie"] = await sessionCookie(role);
  return handler(
    new NextRequest(url, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}

describe("POST /api/ingest — requires `write`", () => {
  const url = "http://localhost/api/ingest";
  const body = { ingestionId: "auth-test", fileName: "t", records: [] };
  const run = (role: PersonaId | null) =>
    import("../ingest/route").then((m) => call(m.POST as Handler, { method: "POST", url, role, body }));

  test("anonymous is 401", async () => expect((await run(null)).status).toBe(401));
  test("owner (view only) is 403", async () => expect((await run("owner")).status).toBe(403));

  test("operator gets past the gate", async () => {
    // 400 = "no records to ingest", i.e. the handler's own validation. Any
    // non-401/403 proves authorization passed.
    const res = await run("operator");
    expect([401, 403]).not.toContain(res.status);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/clear-data — requires `eraseLedger` (GM only)", () => {
  const url = "http://localhost/api/clear-data";
  const run = (role: PersonaId | null) =>
    import("../clear-data/route").then((m) => call(m.POST as Handler, { method: "POST", url, role }));

  test("anonymous is 401", async () => expect((await run(null)).status).toBe(401));

  test("an operator who may write may still NOT wipe the ledger", async () => {
    // The exact split persona.ts documents. This endpoint truncates the events
    // table, and the proxy would happily wave an operator through to it —
    // it authenticates, it does not check capabilities.
    expect((await run("operator")).status).toBe(403);
  });

  test("owner is 403", async () => expect((await run("owner")).status).toBe(403));

  test("the guard runs BEFORE the destructive work", async () => {
    // Supabase is not configured here, so reaching the body would throw (500).
    // 401 proves nothing downstream of the guard executed — the ordering
    // matters more here than anywhere else in the app.
    expect((await run(null)).status).toBe(401);
  });
});

describe("DELETE /api/manual-entries — requires `eraseLedger` (GM only)", () => {
  const url = "http://localhost/api/manual-entries?date=2026-08-01&shift=Data%20Entry";
  const run = (role: PersonaId | null) =>
    import("../manual-entries/route").then((m) => call(m.DELETE as Handler, { method: "DELETE", url, role }));

  test("anonymous is 401", async () => expect((await run(null)).status).toBe(401));
  test("operator is 403", async () => expect((await run("operator")).status).toBe(403));
  test("owner is 403", async () => expect((await run("owner")).status).toBe(403));
  test("gm gets past the gate", async () => {
    expect([401, 403]).not.toContain((await run("gm")).status);
  });
});

describe("POST /api/schema — requires `configure` (GM only)", () => {
  const url = "http://localhost/api/schema";
  const body = { action: "load-plant-catalog" };
  const run = (role: PersonaId | null) =>
    import("../schema/route").then((m) => call(m.POST as Handler, { method: "POST", url, role, body }));

  test("anonymous is 401", async () => expect((await run(null)).status).toBe(401));
  test("an operator may enter data but may not reshape the schema", async () =>
    expect((await run("operator")).status).toBe(403));
  test("gm gets past the gate", async () =>
    expect([401, 403]).not.toContain((await run("gm")).status));
});

describe("PATCH /api/notifications — approval authority is the session's, not the body's", () => {
  const url = "http://localhost/api/notifications";
  const run = (role: PersonaId | null, extra: Record<string, unknown> = {}) =>
    import("../notifications/route").then((m) =>
      call(m.PATCH as Handler, {
        method: "PATCH",
        url,
        role,
        body: { id: "n1", action: "approve", ...extra },
      }),
    );

  test("anonymous is 401", async () => expect((await run(null)).status).toBe(401));

  test("an operator cannot approve by naming themselves GM in the payload", async () => {
    // This was the escalation: authority was read off `actorPersona`.
    const res = await run("operator", { actorPersona: "gm" });
    expect(res.status).toBe(403);
  });
});

describe("reads are left to the proxy", () => {
  test("GET /api/schema has no capability gate of its own", async () => {
    // Every role may read; authentication for reads is the proxy's job, and
    // adding a capability check here would lock the Owner out of the product.
    const m = await import("../schema/route");
    expect((await (m.GET as () => Promise<Response>)()).status).toBe(200);
  });
});
