import { tenant } from "@teamhanko/passkeys-next-auth-provider";

type HankoTenant = ReturnType<typeof tenant>;

let cachedTenant: HankoTenant | null = null;

/**
 * Lazily create the Hanko passkey tenant. Initialization (and the env-var
 * check) is deferred until the tenant is actually used, so simply importing
 * this module never throws — important because it is pulled in eagerly by the
 * NextAuth options even when passkeys aren't configured.
 */
function getTenant(): HankoTenant {
  if (!process.env.HANKO_API_KEY || !process.env.NEXT_PUBLIC_HANKO_TENANT_ID) {
    // These need to be set in .env.local
    // You get them from the Passkey API itself, e.g. when first setting up the server.
    throw new Error(
      "Please set HANKO_API_KEY and NEXT_PUBLIC_HANKO_TENANT_ID in your .env.local file.",
    );
  }

  if (!cachedTenant) {
    cachedTenant = tenant({
      apiKey: process.env.HANKO_API_KEY,
      tenantId: process.env.NEXT_PUBLIC_HANKO_TENANT_ID,
    });
  }

  return cachedTenant;
}

/**
 * Proxy that forwards property access to a lazily-initialized Hanko tenant.
 * Preserves the existing `hanko.registration.initialize(...)` /
 * `tenant: hanko` usage without initializing at import time.
 */
const hanko = new Proxy({} as HankoTenant, {
  get(_target, prop, receiver) {
    const instance = getTenant();
    const value = Reflect.get(instance as object, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
}) as HankoTenant;

export default hanko;
