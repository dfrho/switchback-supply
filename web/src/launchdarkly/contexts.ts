import type { LDContext } from '@launchdarkly/react-sdk';

/**
 * LaunchDarkly evaluates flags against a "context": who or what is using the app.
 * Part 1 needs only two contexts:
 *
 * 1. An anonymous guest shopper (everyone on the public site).
 * 2. An internal QA tester, used to "test in production": you can individually
 *    target this key so QA sees the new checkout before any customer does.
 *
 * Part 2 extends this file with full shopper personas and custom attributes.
 */

const GUEST_KEY_STORAGE = 'switchback.guest-key';

/**
 * Anonymous guests get a random, device-stable key. Keeping the key stable means
 * a shopper sees the same variation on every visit (percentage rollouts bucket by
 * key), and the key contains no personal information.
 */
function getGuestKey(): string {
  try {
    const existing = window.localStorage.getItem(GUEST_KEY_STORAGE);
    if (existing) return existing;
    const created = `guest-${crypto.randomUUID()}`;
    window.localStorage.setItem(GUEST_KEY_STORAGE, created);
    return created;
  } catch {
    // Private windows can block storage. A per-session key still works.
    return `guest-${crypto.randomUUID()}`;
  }
}

export type ShopperId = 'guest' | 'qa';

export interface ShopperProfile {
  id: ShopperId;
  label: string;
  description: string;
  context: LDContext;
}

export function buildShoppers(): Record<ShopperId, ShopperProfile> {
  return {
    guest: {
      id: 'guest',
      label: 'Guest shopper',
      description: 'Anonymous visitor on the public site',
      context: { kind: 'user', key: getGuestKey(), anonymous: true },
    },
    qa: {
      id: 'qa',
      label: 'Internal QA tester',
      description: 'Individually targeted to test in production',
      // TARGET THIS KEY: in LaunchDarkly, open release-new-checkout > Targeting >
      // Individual targets and add "qa-tester-001" to the true variation.
      context: { kind: 'user', key: 'qa-tester-001', name: 'QA Tester (Switchback)' },
    },
  };
}
