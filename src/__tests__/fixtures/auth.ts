// Signed session cookies for route tests.
//
// Route handlers authorize at their own boundary (see `lib/auth/guard.ts`), so
// a test that calls POST/DELETE directly must arrive as somebody. Use the
// weakest role that should succeed — a test passing as `gm` everywhere proves
// the handler runs, not that it is correctly gated.

import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import type { PersonaId } from "@/lib/persona";

/** `Cookie:` header value carrying a valid session for `role`. */
export async function sessionCookie(role: PersonaId = "gm"): Promise<string> {
  return `${SESSION_COOKIE}=${await createSessionToken({ username: role, role })}`;
}

/** Headers for a JSON request made by `role`. */
export async function authedJsonHeaders(role: PersonaId = "gm"): Promise<Record<string, string>> {
  return { "Content-Type": "application/json", Cookie: await sessionCookie(role) };
}

/** Headers carrying only the session (for GET/DELETE with no body). */
export async function authedHeaders(role: PersonaId = "gm"): Promise<Record<string, string>> {
  return { Cookie: await sessionCookie(role) };
}
