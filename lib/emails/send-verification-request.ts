import { waitUntil } from "@vercel/functions";
import { customAlphabet } from "nanoid";

import { redis } from "@/lib/redis";
import { sendEmail } from "@/lib/resend";

import VerificationCodeEmail from "@/components/emails/verification-link";

// Generate a 10-character uppercase alphanumeric verification code (like Linear's style)
const generateVerificationCode = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  10,
);

// Redis key prefixes for login codes
const LOGIN_CODE_PREFIX = "login_code:";
const LOGIN_CODE_EMAIL_PREFIX = "login_code:email:";
// Token expiration time in seconds (15 minutes)
const TOKEN_EXPIRATION_SECONDS = 15 * 60;

export interface LoginCodeData {
  email: string;
  code: string;
  callbackUrl: string;
  createdAt: number;
}

export const sendVerificationRequestEmail = async (params: {
  email: string;
  url: string;
}) => {
  const { url, email } = params;

  // Generate verification code
  const code = generateVerificationCode();

  // Store the login data in Redis with 15-minute TTL
  const loginCodeData: LoginCodeData = {
    email,
    code,
    callbackUrl: url,
    createdAt: Date.now(),
  };

  // Store with email:code as key for lookup (must complete before redirecting)
  await redis.set(
    `${LOGIN_CODE_EMAIL_PREFIX}${email.toLowerCase()}:${code}`,
    JSON.stringify(loginCodeData),
    { ex: TOKEN_EXPIRATION_SECONDS },
  );

  // Safety net: if email delivery isn't configured (no RESEND_API_KEY),
  // surface the login code in the server logs so the single allowlisted user
  // is never locked out.
  if (!process.env.RESEND_API_KEY) {
    console.log(
      `[Login Code] No RESEND_API_KEY set. Login code for ${email}: ${code}`,
    );
    return;
  }

  const emailTemplate = VerificationCodeEmail({
    email,
    code,
  });

  // Use waitUntil to send email in background after response is sent
  // This keeps the serverless function alive until the email is sent
  waitUntil(
    sendEmail({
      to: email as string,
      system: true,
      subject: "Your login code for File Share By Starter Stack AI",
      react: emailTemplate,
      // Always send to the real recipient. Previously this diverted to
      // Resend's test inbox (delivered@resend.dev) in development, so the
      // login code never reached the user.
      test: false,
    }).catch((e) => {
      console.error("Failed to send verification email:", e);
    }),
  );
};

/**
 * Atomically fetch and delete login code data from Redis
 * Uses GETDEL to prevent TOCTOU race conditions where the same code could be used twice
 * Returns null if not found or expired
 */
export const fetchAndDeleteLoginCodeData = async (
  email: string,
  code: string,
): Promise<LoginCodeData | null> => {
  try {
    const key = `${LOGIN_CODE_EMAIL_PREFIX}${email.toLowerCase()}:${code.toUpperCase()}`;

    // Use GETDEL for atomic get-and-delete operation
    // This prevents race conditions where two requests could use the same code
    const data = await redis.getdel(key);
    if (!data) return null;

    // Handle both string and already-parsed object (Redis client behavior)
    if (typeof data === "string") {
      return JSON.parse(data) as LoginCodeData;
    }
    return data as LoginCodeData;
  } catch (error) {
    console.error("Error fetching and deleting login code data:", error);
    return null;
  }
};
