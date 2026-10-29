import type { LDContext } from '@launchdarkly/node-server-sdk';
import { toLDContext, type ShopperAttributes } from '../web/src/launchdarkly/contexts.js';

/**
 * The browser sends the current shopper with each assistant request. The server
 * builds the LaunchDarkly context with the same toLDContext() the browser uses,
 * so a shopper gets the same targeting, and the same experiment bucket, on both
 * sides. In a real store the server would load these attributes from the signed-in
 * account instead of trusting the browser; this demo has no login.
 */

export class BadRequest extends Error {}

const TIERS = new Set(['none', 'silver', 'gold']);
const DEVICES = new Set(['desktop', 'mobile']);

function optionalString(value: unknown, max: number, pattern?: RegExp): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > max || (pattern && !pattern.test(value))) {
    throw new BadRequest('Invalid shopper attribute.');
  }
  return value;
}

/** Accepts only the attributes the app defines, with sane shapes. Everything else is dropped. */
export function parseShopper(input: unknown): ShopperAttributes {
  if (!input || typeof input !== 'object') throw new BadRequest('Missing shopper.');
  const s = input as Record<string, unknown>;
  const key = optionalString(s.key, 100, /^[A-Za-z0-9._:-]+$/);
  if (!key) throw new BadRequest('Missing shopper key.');
  const loyaltyTier = TIERS.has(s.loyaltyTier as string) ? (s.loyaltyTier as ShopperAttributes['loyaltyTier']) : 'none';
  const deviceType = DEVICES.has(s.deviceType as string) ? (s.deviceType as ShopperAttributes['deviceType']) : 'desktop';
  return {
    key,
    anonymous: s.anonymous === true,
    name: optionalString(s.name, 80),
    email: optionalString(s.email, 120, /^[^\s@]+@[^\s@]+$/),
    loyaltyTier,
    state: optionalString(s.state, 2, /^[A-Z]{2}$/),
    country: optionalString(s.country, 2, /^[A-Z]{2}$/) ?? 'US',
    deviceType,
    betaTester: s.betaTester === true,
    trafficSource: s.trafficSource === 'synthetic' ? 'synthetic' : undefined,
  };
}

export function shopperContext(input: unknown): LDContext {
  return toLDContext(parseShopper(input)) as LDContext;
}
