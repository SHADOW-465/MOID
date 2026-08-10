import { NextResponse } from "next/server";
import { listLoginOptions } from "@/lib/auth/config";

/**
 * Public list of preset logins for the login page picker.
 * Never returns passwords.
 */
export async function GET() {
  return NextResponse.json({
    authEnabled: true,
    logins: listLoginOptions(),
  });
}
