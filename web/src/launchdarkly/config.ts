/**
 * LaunchDarkly configuration for the Switchback Supply storefront.
 *
 * SETUP: the client-side ID is read from the VITE_LD_CLIENT_SIDE_ID variable
 * in the repo-root .env file (copy .env.example to .env and paste your own).
 * Find it in LaunchDarkly: gear icon (lower left) > All environments > Test (or
 * the environment you use) > SDK keys tab > Client-side ID.
 *
 * The client-side ID is not a secret. It is designed to ship in browser code.
 * Never put the server-side SDK key or a trigger URL in a VITE_ variable,
 * because Vite bundles every VITE_ variable into the public JavaScript.
 */
export const LD_CLIENT_SIDE_ID: string = import.meta.env.VITE_LD_CLIENT_SIDE_ID ?? '';

/**
 * Optional service endpoints. Leave these unset to talk to LaunchDarkly directly.
 * Set them to route the SDK through a LaunchDarkly Relay Proxy (common in enterprise
 * networks) or, in this repo's end-to-end tests, a local mock LaunchDarkly server.
 */
export const LD_ENDPOINTS = {
  baseUri: import.meta.env.VITE_LD_BASE_URI || undefined,
  streamUri: import.meta.env.VITE_LD_STREAM_URI || undefined,
  eventsUri: import.meta.env.VITE_LD_EVENTS_URI || undefined,
};

/**
 * Flag keys used by the app. Each one must exist in your LaunchDarkly project
 * with "Available on client-side SDKs" turned on, or the SDK silently serves
 * the fallback value.
 */
export const FLAGS = {
  /**
   * Part 1: Release and Remediate.
   * RECREATE THIS FLAG: boolean, key "release-new-checkout",
   * variations true / false, off variation false.
   */
  newCheckout: 'release-new-checkout',
  /**
   * Part 2: Target.
   * RECREATE THIS FLAG: boolean, key "release-landing-hero",
   * variations true (Winter-Ready hero) / false (current hero), off variation false.
   * Targeting is described in HERO_TARGETING below and in the README.
   */
  landingHero: 'release-landing-hero',
} as const;

/**
 * Fallback values served when LaunchDarkly is unreachable or a flag is missing.
 * Every fallback is the safe, known-good experience.
 */
export const FALLBACKS = {
  newCheckout: false,
  landingHero: false,
} as const;

/**
 * Custom events the store sends with ldClient.track(). A metric built on one of
 * these event keys can measure any flag the same shopper was served, so a release
 * reports business results, not just "on" or "off".
 * RECREATE THESE METRICS: `npm run ld:setup` creates them (scripts/ld-metrics.mjs).
 */
export const METRIC_EVENTS = {
  /** Sent when an order is placed, with the order total in US dollars as the value. */
  checkoutCompleted: 'checkout-completed',
} as const;

/**
 * The Central region used by the "Gold members in Central states" rule.
 * Keep this list in sync with the rule's "state is one of" values in LaunchDarkly.
 */
export const CENTRAL_STATES = ['TN', 'TX', 'IL', 'MN', 'CO'] as const;

/**
 * How release-landing-hero is targeted in LaunchDarkly, in evaluation order.
 * The Release Console uses these names to explain LaunchDarkly's evaluation reason,
 * which reports a matched rule by its position (ruleIndex). If you reorder the rules
 * in LaunchDarkly, reorder them here too.
 */
export const HERO_TARGETING = {
  individualTargets: ['qa-tester-001'],
  rules: [
    { name: 'Employees', detail: 'email ends with @switchbacksupply.test' },
    { name: 'Beta shoppers', detail: 'is in segment beta-shoppers (betaTester is true)' },
    { name: 'Gold members in Central states', detail: `loyaltyTier is gold AND state is one of ${CENTRAL_STATES.join(', ')}` },
  ],
} as const;
