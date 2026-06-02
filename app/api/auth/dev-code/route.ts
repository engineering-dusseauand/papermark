import { NextResponse } from "next/server";

import { isEmailAllowed } from "@/lib/auth/allowed-emails";
import { redis } from "@/lib/redis";

const LOGIN_CODE_EMAIL_PREFIX = "login_code:email:";

/**
 * DEV-ONLY helper. Returns the currently active login code for an allowlisted
 * email so the single permitted user is never locked out when email delivery
 * lands in spam or is filtered (a common issue when sending from and to the
 * same custom domain).
 *
 * Always returns 404 in production so codes are never exposed in a live env.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let email: string | undefined;
  try {
    const body = (await request.json()) as { email?: string };
    email = body.email;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!email || !isEmailAllowed(email)) {
    return NextResponse.json({ code: null });
  }

  try {
    const keys = await redis.keys(
      `${LOGIN_CODE_EMAIL_PREFIX}${email.toLowerCase()}:*`,
    );
    if (!keys.length) {
      return NextResponse.json({ code: null });
    }
    // Take the last segment of the most recent key as the code.
    const code = keys[keys.length - 1].split(":").pop() ?? null;
    return NextResponse.json({ code });
  } catch (error) {
    console.error("[dev-code] Failed to read login code:", error);
    return NextResponse.json({ code: null });
  }
}
