import { isSamlEnforcedForEmailDomain } from "@/lib/api/teams/is-saml-enforced-for-email-domain";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import PasskeyProvider from "@teamhanko/passkeys-next-auth-provider";
import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import LinkedInProvider from "next-auth/providers/linkedin";

import { identifyUser, trackAnalytics } from "@/lib/analytics";
import { isEmailAllowed } from "@/lib/auth/allowed-emails";
import { isQStashConfigured, qstash } from "@/lib/cron";
import { sendVerificationRequestEmail } from "@/lib/emails/send-verification-request";
import hanko from "@/lib/hanko";
import { jackson } from "@/lib/jackson";
import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";

const VERCEL_DEPLOYMENT = !!process.env.VERCEL_URL;

function getMainDomainUrl(): string {
  if (process.env.NODE_ENV === "development") {
    return process.env.NEXTAUTH_URL || "http://localhost:3000";
  }
  return process.env.NEXTAUTH_URL || "https://app.papermark.com";
}

// Determine the cookie Domain attribute. Scoping to `.papermark.com` only
// works when the app is actually served from a papermark.com host. On previews
// and other deployments (e.g. *.vercel.app) the host won't match, so the
// browser SILENTLY DROPS the session cookie and the user can never log in even
// though the code verifies. In those cases we leave Domain unset so the cookie
// is stored host-only against whatever origin is serving the app.
function getCookieDomain(): string | undefined {
  // Only set a cross-subdomain cookie domain when an explicit NEXTAUTH_URL
  // (the real production URL) is configured and points at papermark.com.
  const configuredUrl = process.env.NEXTAUTH_URL;
  if (!configuredUrl) return undefined;
  try {
    const host = new URL(configuredUrl).hostname;
    if (host === "papermark.com" || host.endsWith(".papermark.com")) {
      return ".papermark.com";
    }
  } catch {
    // ignore malformed NEXTAUTH_URL
  }
  return undefined;
}

const COOKIE_DOMAIN = getCookieDomain();

// Cookie SameSite/Secure policy.
//
// In real production (a Vercel deployment served top-level from papermark.com)
// we keep the stricter `SameSite=Lax` cookie. But the v0 preview renders the
// app inside a CROSS-ORIGIN IFRAME. In that context a `SameSite=Lax` cookie is
// treated as cross-site and the browser refuses to store/send it — so the
// session cookie set after code verification never sticks and the user is
// bounced back to /login instead of reaching the dashboard.
//
// Outside a real production deployment we therefore use `SameSite=None; Secure`
// so the session cookie is accepted inside the embedded preview iframe.
// `SameSite=None` requires `Secure`, which is satisfied because the preview is
// served over https (and localhost is treated as a secure context).
const SESSION_COOKIE_SAME_SITE: "lax" | "none" = VERCEL_DEPLOYMENT
  ? "lax"
  : "none";
const SESSION_COOKIE_SECURE = VERCEL_DEPLOYMENT
  ? true
  : SESSION_COOKIE_SAME_SITE === "none";

export const authOptions: NextAuthOptions = {
  pages: {
    error: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: true,
    }),
    LinkedInProvider({
      clientId: process.env.LINKEDIN_CLIENT_ID as string,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET as string,
      authorization: {
        params: { scope: "openid profile email" },
      },
      issuer: "https://www.linkedin.com/oauth",
      jwks_endpoint: "https://www.linkedin.com/oauth/openid/jwks",
      profile(profile, tokens) {
        const defaultImage =
          "https://cdn-icons-png.flaticon.com/512/174/174857.png";
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture ?? defaultImage,
        };
      },
      allowDangerousEmailAccountLinking: true,
    }),
    EmailProvider({
      async sendVerificationRequest({ identifier, url }) {
        // Don't send codes to non-allowlisted addresses. Throwing here makes
        // NextAuth redirect to the error page (/login) so the user sees a
        // clear message instead of being sent to a code screen where no code
        // will ever arrive.
        if (!isEmailAllowed(identifier)) {
          console.log(
            "[Auth] Blocked verification email for non-allowlisted address:",
            identifier,
          );
          throw new Error("AccessDenied");
        }

        const hasValidNextAuthUrl = !!process.env.NEXTAUTH_URL;
        let finalUrl = url;

        if (!hasValidNextAuthUrl) {
          const mainDomainUrl = getMainDomainUrl();
          const urlObj = new URL(url);
          const mainDomainObj = new URL(mainDomainUrl);
          urlObj.hostname = mainDomainObj.hostname;
          urlObj.protocol = mainDomainObj.protocol;
          urlObj.port = mainDomainObj.port || "";

          finalUrl = urlObj.toString();
        }

        if (process.env.NODE_ENV === "development") {
          await sendVerificationRequestEmail({
            url: finalUrl,
            email: identifier,
          });
          console.log("[Login Email Sent] Check your inbox for:", identifier);
        } else {
          await sendVerificationRequestEmail({
            url: finalUrl,
            email: identifier,
          });
        }
      },
    }),
    // Only register passkey auth when Hanko is configured. The provider reads
    // the tenant at construction time, so including it without env vars would
    // crash all of NextAuth (e.g. /api/auth/session).
    ...(process.env.HANKO_API_KEY && process.env.NEXT_PUBLIC_HANKO_TENANT_ID
      ? [
          PasskeyProvider({
            tenant: hanko,
            async authorize({ userId }) {
              const user = await prisma.user.findUnique({
                where: { id: userId },
              });
              if (!user) return null;
              return user;
            },
          }),
        ]
      : []),
    {
      id: "saml",
      name: "BoxyHQ SAML",
      type: "oauth",
      version: "2.0",
      checks: ["pkce", "state"],
      authorization: {
        url: `${getMainDomainUrl()}/api/auth/saml/authorize`,
        params: {
          scope: "",
          response_type: "code",
          provider: "saml",
        },
      },
      token: {
        url: `${getMainDomainUrl()}/api/auth/saml/token`,
        params: { grant_type: "authorization_code" },
      },
      userinfo: `${getMainDomainUrl()}/api/auth/saml/userinfo`,
      profile: async (profile) => {
        const name =
          `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
          null;

        return {
          id: profile.id || profile.email,
          name,
          email: profile.email,
          image: null,
        };
      },
      options: {
        clientId: "dummy",
        clientSecret: process.env.NEXTAUTH_SECRET as string,
      },
      allowDangerousEmailAccountLinking: true,
    },
    CredentialsProvider({
      id: "saml-idp",
      name: "IdP Login",
      credentials: {
        code: { type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.code) return null;

        try {
          const { oauthController } = await jackson();

          const { access_token } = await oauthController.token({
            code: credentials.code,
            grant_type: "authorization_code",
            redirect_uri: getMainDomainUrl(),
            client_id: "dummy",
            client_secret: process.env.NEXTAUTH_SECRET!,
          });

          if (!access_token) return null;

          const userInfo = await oauthController.userInfo(access_token);
          if (!userInfo) return null;

          const { email, firstName, lastName, requested } = userInfo as any;
          if (!email) return null;

          const name = [firstName, lastName].filter(Boolean).join(" ") || email;

          const user = await prisma.user.upsert({
            where: { email },
            create: { email, name },
            update: { name: name || undefined },
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            profile: userInfo,
          } as any;
        } catch (error) {
          console.error("[SAML] Error during SAML authorization:", error);
          return null;
        }
      },
    }),
  ],
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  cookies: {
    sessionToken: {
      name: `${VERCEL_DEPLOYMENT ? "__Secure-" : ""}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: SESSION_COOKIE_SAME_SITE,
        path: "/",
        domain: COOKIE_DOMAIN,
        secure: SESSION_COOKIE_SECURE,
      },
    },
  },
  callbacks: {
    signIn: async ({ user, profile }) => {
      // Enforce the allowlist for every provider. `profile.email` covers
      // OAuth/SAML flows where `user.email` may not be populated yet.
      const email =
        user?.email ?? (profile as { email?: string } | null)?.email ?? null;
      if (!isEmailAllowed(email)) {
        console.log("[Auth] Rejected login for non-allowlisted email:", email);
        return false;
      }
      return true;
    },
    jwt: async (params) => {
      const { token, user, trigger, account } = params;
      if (!token.email) {
        return {};
      }
      if (user) {
        token.user = user;
      }
      if (
        (account?.provider === "saml" || account?.provider === "saml-idp") &&
        user
      ) {
        token.provider = "saml";
      }
      if (trigger === "update") {
        const user = token?.user as CustomUser;
        const refreshedUser = await prisma.user.findUnique({
          where: { id: user.id },
        });
        if (refreshedUser) {
          token.user = refreshedUser;
        } else {
          return {};
        }

        if (refreshedUser?.email !== user.email) {
          if (user.id && refreshedUser.email) {
            await prisma.account.deleteMany({
              where: { userId: user.id },
            });
          }
        }
      }
      return token;
    },
    session: async ({ session, token }) => {
      (session.user as CustomUser) = {
        id: token.sub,
        // @ts-ignore
        ...(token || session).user,
      };
      return session;
    },
  },
  events: {
    async createUser(message) {
      await identifyUser(message.user.email ?? message.user.id);
      await trackAnalytics({
        event: "User Signed Up",
        email: message.user.email,
        userId: message.user.id,
      });

      // Skip the delayed welcome email when QStash isn't configured.
      if (isQStashConfigured) {
        await qstash.publishJSON({
          url: `${process.env.NEXT_PUBLIC_BASE_URL ?? getMainDomainUrl()}/api/cron/welcome-user`,
          body: {
            userId: message.user.id,
          },
          delay: 15 * 60,
        });
      }
    },
  },
};
