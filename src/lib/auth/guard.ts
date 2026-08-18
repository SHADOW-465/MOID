// The API boundary's AUTHORIZATION check.
//
// `src/proxy.ts` already handles authentication: every non-public path needs a
// valid session cookie or it gets a 401. What it does not do — and, per Next's
// own guidance, should not do — is decide *what* a signed-in caller may do.
// It is role-blind, so until this module every signed-in user had the full
// write surface:
//
//   - "Owner — View only" could POST /api/ingest and DELETE ledger rows.
//   - An operator could POST /api/clear-data, which truncates the events table.
//   - Anyone could approve their own edit request by naming themselves GM in
//     the request body (see /api/notifications).
//
// Meanwhile `persona.ts` had declared the right model all along — `write`,
// `approve`, `configure`, `eraseLedger`, with comments spelling out exactly who
// may do what ("an operator must be able to save entries and must NOT be able
// to erase them once saved"). It was only ever consulted to decide which
// sidebar links to render; its own header said "Does not affect APIs".
//
// This module makes the declared model the enforced one. It does not invent
// permissions — it reads `PERSONAS[role].capabilities`.
//
// The check lives next to the handler rather than in the proxy because Next is
// explicit that proxy "should not be used as a full session management or
// authorization solution", and because the handler needs the actor anyway for
// role-conditional logic and provenance. It also means a proxy matcher edit
// cannot silently un-protect a route.
// `src/app/api/__tests__/route-auth-coverage.test.ts` stops a new route from
// forgetting to call it.

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./session";
import { PERSONAS, type PersonaCapabilities, type PersonaId } from "@/lib/persona";

export type Capability = keyof PersonaCapabilities;

/** The authenticated caller. Never built from the request body — a client that
 *  can name its own role can grant itself one. */
export interface Actor {
  username: string;
  role: PersonaId;
  capabilities: PersonaCapabilities;
}

export type Guard =
  | { ok: true; actor: Actor }
  | { ok: false; actor: null; response: NextResponse };

/** The session's actor, or null when unauthenticated / expired / tampered. */
export async function actorFrom(req: NextRequest): Promise<Actor | null> {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const persona = PERSONAS[session.r];
  if (!persona) return null;
  return { username: session.u, role: session.r, capabilities: persona.capabilities };
}

/**
 * 401 = "you are not signed in", 403 = "you are, and this is not yours".
 * Kept distinct so the client can tell a expired-session redirect apart from a
 * genuine permission wall, and so an audit of 403s is meaningful.
 */
export async function requireSession(req: NextRequest): Promise<Guard> {
  const actor = await actorFrom(req);
  if (!actor) {
    return {
      ok: false,
      actor: null,
      response: NextResponse.json({ error: "Sign in required." }, { status: 401 }),
    };
  }
  return { ok: true, actor };
}

/** Require an authenticated caller holding `cap`. */
export async function requireCapability(req: NextRequest, cap: Capability): Promise<Guard> {
  const session = await requireSession(req);
  if (!session.ok) return session;
  if (!session.actor.capabilities[cap]) {
    return {
      ok: false,
      actor: null,
      response: NextResponse.json(
        { error: `Your role (${PERSONAS[session.actor.role].label}) cannot perform this action.`, need: cap },
        { status: 403 },
      ),
    };
  }
  return session;
}
