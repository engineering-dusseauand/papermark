// Single-user / allowlisted access. Signups are disabled, so only these
// emails may authenticate via ANY provider (email, Google, LinkedIn, SAML).
// Configure with ALLOWED_LOGIN_EMAILS (comma-separated) to add teammates.
export const ALLOWED_LOGIN_EMAILS = (
  process.env.ALLOWED_LOGIN_EMAILS || "mark@starterstack.ai"
)
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function isEmailAllowed(email?: string | null): boolean {
  if (!email) return false;
  return ALLOWED_LOGIN_EMAILS.includes(email.trim().toLowerCase());
}
