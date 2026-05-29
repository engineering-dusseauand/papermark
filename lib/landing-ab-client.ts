import type { PostHog } from "posthog-js";

/**
 * Name of the PostHog feature flag used to bucket visitors into a
 * landing-page A/B test variant.
 */
const LANDING_AB_FLAG = "landing-page-variant";

/**
 * Super property attached to every captured event so the active landing-page
 * variant can be segmented in analytics.
 */
const LANDING_AB_PROPERTY = "landing_variant";

/**
 * Registers the visitor's landing-page A/B test variant as a PostHog super
 * property so that it is attached to all subsequent events.
 *
 * This is intentionally defensive: PostHog may not be initialized, feature
 * flags may not have loaded yet, or this may run in a non-browser context.
 * In any of those cases we simply no-op instead of throwing.
 */
export function registerLandingVariant(client?: PostHog | null): void {
  if (typeof window === "undefined" || !client) {
    return;
  }

  const apply = () => {
    try {
      const variant = client.getFeatureFlag(LANDING_AB_FLAG);

      // `getFeatureFlag` returns `undefined` while flags are loading and
      // `false` when the flag is disabled. Only register a real variant value.
      if (variant === undefined || variant === false) {
        return;
      }

      client.register({ [LANDING_AB_PROPERTY]: variant });
    } catch {
      // Never let analytics bucketing break the app.
    }
  };

  try {
    // Ensure flags are available before reading them; `onFeatureFlags` fires
    // immediately if they are already loaded.
    if (typeof client.onFeatureFlags === "function") {
      client.onFeatureFlags(apply);
    } else {
      apply();
    }
  } catch {
    // Ignore – analytics is best-effort.
  }
}
