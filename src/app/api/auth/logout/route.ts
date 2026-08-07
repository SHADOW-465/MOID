import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  const secure =
    process.env.MOID_AUTH_COOKIE_SECURE === "1" ||
    process.env.VERCEL === "1" ||
    process.env.MOID_AUTH_COOKIE_SECURE === "true";
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  });
  return res;
}
