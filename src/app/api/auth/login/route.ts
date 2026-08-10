import { NextRequest, NextResponse } from "next/server";
import { findUser } from "@/lib/auth/config";
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

  const user = findUser(identity, password);
  if (!user) {
    return NextResponse.json(
      { error: "Wrong password for that role." },
      { status: 401 },
    );
  }

  const token = await createSessionToken(user);
  const persona = PERSONAS[user.role];
  const res = NextResponse.json({
    ok: true,
    user: {
      username: user.username,
      role: user.role,
      label: persona.label,
      homeHref: persona.homeHref,
    },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
