import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth/users";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { PERSONAS } from "@/lib/persona";

export async function POST(req: NextRequest) {
  let body: { username?: string; role?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Prefer role (from the picker); username accepted as alias for the same id.
  const identity = String(body.role ?? body.username ?? "").trim();
  const password = String(body.password ?? "");
  if (!identity || !password) {
    return NextResponse.json(
      { error: "Select a role and enter its password." },
      { status: 400 },
    );
  }

  const user = await authenticate(identity, password);
  if (!user) {
    // One message for unknown user, wrong password and disabled account —
    // anything more specific is a way to enumerate who works here.
    return NextResponse.json(
      { error: "Wrong username or password." },
      { status: 401 },
    );
  }

  const token = await createSessionToken(user);
  const persona = PERSONAS[user.role];
  const res = NextResponse.json({
    ok: true,
    user: {
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      label: persona.label,
      homeHref: persona.homeHref,
    },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
