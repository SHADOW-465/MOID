import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ authEnabled: true, user: null }, { status: 401 });
  }

  return NextResponse.json({
    authEnabled: true,
    user: { username: session.u, role: session.r },
  });
}
