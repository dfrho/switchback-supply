import type { LDContext } from '@launchdarkly/react-sdk';

/**
 * LaunchDarkly evaluates flags against a "context": who is using the app.
 * Switchback Supply sends a "user" context built from the shopper's profile.
 *
 * In a real store, these attributes come from the signed-in shopper's account.
 * In this demo there is no login, so the personas below stand in for signed-in
 * shoppers, and the Release Console lets you edit their attributes live.
 *
 * Only attributes you send can be used in targeting rules.
 */

export type LoyaltyTier = 'none' | 'silver' | 'gold';
export type DeviceType = 'desktop' | 'mobile';

export interface ShopperAttributes {
  /** Unique, stable, and free of personal data. Individual targeting matches on this. */
  key: string;
  /** Anonymous shoppers do not appear on LaunchDarkly's Contexts page. */
  anonymous: boolean;
  name?: string;
  /** Marked private below: usable in targeting, but stripped from analytics events. */
  email?: string;
  loyaltyTier: LoyaltyTier;
  /** Two-letter US state. Omitted when unknown, so state rules simply do not match. */
  state?: string;
  country: string;
  /** Detected from the browser, so it works for anonymous guests too. */
  deviceType: DeviceType;
  betaTester: boolean;
  /**
   * Set to "synthetic" only by scripts/assistant-traffic.mjs, so simulated shoppers
   * are labeled as such on LaunchDarkly's Contexts page and in experiment data.
   */
  trafficSource?: 'synthetic';
}

export type PersonaId = 'guest' | 'qa' | 'gold' | 'beta' | 'employee';

export interface Persona {
  id: PersonaId;
  label: string;
  description: string;
  attributes: ShopperAttributes;
}

/** Emails ending in this domain match the "Employees" targeting rule. */
export const EMPLOYEE_EMAIL_DOMAIN = '@switchbacksupply.test';
export const EMPLOYEE_EMAIL = `merch${EMPLOYEE_EMAIL_DOMAIN}`;

/** Attribute names never sent to LaunchDarkly in events (still usable for targeting). */
export const PRIVATE_ATTRIBUTES = ['email'];

const GUEST_KEY_STORAGE = 'switchback.guest-key';

/**
 * Anonymous guests get a random, device-stable key: no personal data, and the same
 * experience on every visit (percentage rollouts bucket by key).
 */
function getGuestKey(): string {
  try {
    const existing = window.localStorage.getItem(GUEST_KEY_STORAGE);
    if (existing) return existing;
    const created = `guest-${crypto.randomUUID()}`;
    window.localStorage.setItem(GUEST_KEY_STORAGE, created);
    return created;
  } catch {
    return `guest-${crypto.randomUUID()}`;
  }
}

export function detectDeviceType(): DeviceType {
  try {
    return window.matchMedia('(max-width: 720px), (pointer: coarse)').matches ? 'mobile' : 'desktop';
  } catch {
    return 'desktop';
  }
}

/** Turns shopper attributes into the context LaunchDarkly evaluates. */
export function toLDContext(a: ShopperAttributes): LDContext {
  const context: Record<string, unknown> = {
    kind: 'user',
    key: a.key,
    loyaltyTier: a.loyaltyTier,
    country: a.country,
    deviceType: a.deviceType,
    betaTester: a.betaTester,
  };
  if (a.anonymous) context.anonymous = true;
  if (a.name) context.name = a.name;
  if (a.email) context.email = a.email;
  if (a.state) context.state = a.state;
  if (a.trafficSource) context.trafficSource = a.trafficSource;
  context._meta = { privateAttributes: PRIVATE_ATTRIBUTES };
  return context as LDContext;
}

export function buildPersonas(): Record<PersonaId, Persona> {
  const deviceType = detectDeviceType();
  const base = { country: 'US', deviceType, betaTester: false, anonymous: false } as const;
  return {
    guest: {
      id: 'guest',
      label: 'Guest shopper',
      description: 'Anonymous visitor on the public site',
      attributes: { ...base, key: getGuestKey(), anonymous: true, loyaltyTier: 'none' },
    },
    qa: {
      id: 'qa',
      label: 'Internal QA tester',
      description: 'Individually targeted to test in production',
      // Individually target "qa-tester-001" on both flags (see README).
      attributes: { ...base, key: 'qa-tester-001', name: 'QA Tester (Switchback)', loyaltyTier: 'none', state: 'WA' },
    },
    gold: {
      id: 'gold',
      label: 'Gold member, Nashville',
      description: 'Matches the Gold members in Central states rule',
      attributes: { ...base, key: 'shopper-gold-001', name: 'Gold Member (Nashville)', loyaltyTier: 'gold', state: 'TN' },
    },
    beta: {
      id: 'beta',
      label: 'Beta tester, Seattle',
      description: 'Matches the Beta shoppers segment',
      attributes: { ...base, key: 'shopper-beta-001', name: 'Beta Tester (Seattle)', loyaltyTier: 'silver', state: 'WA', betaTester: true },
    },
    employee: {
      id: 'employee',
      label: 'Employee',
      description: 'Matches the Employees rule through a private email attribute',
      attributes: {
        ...base,
        key: 'employee-001',
        name: 'Merch Lead (Switchback)',
        email: EMPLOYEE_EMAIL,
        loyaltyTier: 'silver',
        state: 'CA',
      },
    },
  };
}

/** States offered in the Release Console: the Central region plus a few others. */
export const STATE_OPTIONS = ['TN', 'TX', 'IL', 'MN', 'CO', 'CA', 'NY', 'WA'] as const;
