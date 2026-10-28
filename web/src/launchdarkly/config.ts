/**
 * LaunchDarkly configuration for the Switchback Supply storefront.
 *
 * SETUP: the client-side ID is read from the VITE_LD_CLIENT_SIDE_ID variable
 * in the repo-root .env file (copy .env.example to .env and paste your own).
 * Find it in LaunchDarkly: gear icon > Projects > your project > Environments
 * > Test (or the environment you use) > Client-side ID.
 *
 * The client-side ID is not a secret. It is designed to ship in browser code.
 * Never put the server-side SDK key or a trigger URL in a VITE_ variable,
 * because Vite bundles every VITE_ variable into the public JavaScript.
 */
export const LD_CLIENT_SIDE_ID: string = import.meta.env.VITE_LD_CLIENT_SIDE_ID ?? '';

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
} as const;

/**
 * Fallback values served when LaunchDarkly is unreachable or a flag is missing.
 * Every fallback is the safe, known-good experience.
 */
export const FALLBACKS = {
  newCheckout: false,
} as const;
