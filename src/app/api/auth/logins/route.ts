import { NextResponse } from "next/server";
import { isAuthEnabled, listLoginOptions } from "@/lib/auth/config";

/**
 * Public list of preset logins for the login page picker.
 * Never returns passwords.
 */
export async function GET() {
  if (!isAuthEnabled()) {
    return NextResponse.json({
      authEnabled: false,
      logins: [],
    });
  }
  return NextResponse.json({
    authEnabled: true,
    logins: listLoginOptions(),
  });
}
