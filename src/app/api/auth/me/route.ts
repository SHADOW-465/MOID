import { NextRequest, NextResponse } from "next/server";
import { isAuthEnabled } from "@/lib/auth/config";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({
      authEnabled: false,
      user: null,
    });
  }

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
