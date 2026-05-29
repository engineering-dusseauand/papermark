import { getSession } from "next-auth/react";
import posthog from "posthog-js";
// import { useEffect } from "react";
// import { useRouter } from "next/router";
import { PostHogProvider } from "posthog-js/react";

import { getPostHogConfig } from "@/lib/posthog";
import { CustomUser } from "@/lib/types";

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
 * property so it is attached to all subsequent events. Intentionally
 * defensive: no-ops when PostHog is unavailable, flags have not loaded, or
 * this runs outside the browser, so analytics can never break the app.
 */
function registerLandingVariant(client?: typeof posthog | null): void {
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
    // `onFeatureFlags` fires immediately if flags are already loaded.
    if (typeof client.onFeatureFlags === "function") {
      client.onFeatureFlags(apply);
    } else {
      apply();
    }
  } catch {
    // Ignore – analytics is best-effort.
  }
}

export const PostHogCustomProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const posthogConfig = getPostHogConfig();
  // const router = useRouter();

  // Check that PostHog is client-side
  if (typeof window !== "undefined" && posthogConfig) {
    posthog.init(posthogConfig.key, {
      api_host: posthogConfig.host,
      ui_host: "https://eu.posthog.com",
      disable_session_recording: true,
      autocapture: false,
      // Enable debug mode in development
      loaded: (posthog) => {
        if (process.env.NODE_ENV === "development") posthog.debug();
        getSession()
          .then((session) => {
            if (session) {
              posthog.identify(
                (session.user as CustomUser).email ??
                  (session.user as CustomUser).id,
                {
                  email: (session.user as CustomUser).email,
                  userId: (session.user as CustomUser).id,
                },
              );
            } else {
              posthog.reset();
            }
            registerLandingVariant(posthog);
          })
          .catch(() => {
            // Do nothing.
          });
      },
    });
  }

  // useEffect(() => {
  //   // Track page views
  //   const handleRouteChange = () => posthog?.capture("$pageview");
  //   router.events.on("routeChangeComplete", handleRouteChange);

  //   return () => {
  //     router.events.off("routeChangeComplete", handleRouteChange);
  //   };
  // }, []);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
};
