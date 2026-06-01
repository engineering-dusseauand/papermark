import { NextResponse } from "next/server";

import { isEmailAllowed } from "@/lib/auth/allowed-emails";

// Lightweight pre-check used by the login form so it can show a clear
// "this email isn't permitted" message before attempting sign-in. Signups are
// disabled, so this only reveals allowlist membership for a single-user app.
export async function POST(request: Request) {
  let email: unknown;
  try {
    ({ email } = await request.json());
  } catch {
    return NextResponse.json({ allowed: false }, { status: 400 });
  }

  if (typeof email !== "string") {
    return NextResponse.json({ allowed: false }, { status: 400 });
  }

  return NextResponse.json({ allowed: isEmailAllowed(email) });
}
