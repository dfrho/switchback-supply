import { describe, expect, it } from 'vitest';
import { CENTRAL_STATES } from './config';
import { EMPLOYEE_EMAIL_DOMAIN, buildPersonas, toLDContext, type ShopperAttributes } from './contexts';

const base: ShopperAttributes = {
  key: 'shopper-1',
  anonymous: false,
  loyaltyTier: 'none',
  country: 'US',
  deviceType: 'desktop',
  betaTester: false,
};

describe('toLDContext', () => {
  it('builds a user context with the targeting attributes', () => {
    expect(toLDContext({ ...base, loyaltyTier: 'gold', state: 'TN', betaTester: true })).toMatchObject({
      kind: 'user',
      key: 'shopper-1',
      loyaltyTier: 'gold',
      state: 'TN',
      country: 'US',
      deviceType: 'desktop',
      betaTester: true,
    });
  });

  it('always marks email private, so it targets but is stripped from events', () => {
    const context = toLDContext({ ...base, email: 'merch@switchbacksupply.test' }) as Record<string, unknown>;
    expect(context.email).toBe('merch@switchbacksupply.test');
    expect(context._meta).toEqual({ privateAttributes: ['email'] });
  });

  it('omits unknown values instead of sending empty strings, so rules simply do not match', () => {
    const context = toLDContext(base) as Record<string, unknown>;
    expect(context).not.toHaveProperty('state');
    expect(context).not.toHaveProperty('email');
    expect(context).not.toHaveProperty('anonymous');
  });

  it('flags guests as anonymous', () => {
    expect(toLDContext({ ...base, anonymous: true })).toMatchObject({ anonymous: true });
  });
});

describe('personas', () => {
  const personas = buildPersonas();

  it('gives the guest a stable, anonymous key with no personal data', () => {
    const first = buildPersonas();
    const again = buildPersonas();
    expect(first.guest.attributes.anonymous).toBe(true);
    expect(first.guest.attributes.key).toMatch(/^guest-/);
    expect(again.guest.attributes.key).toBe(first.guest.attributes.key);
    expect(first.guest.attributes.email).toBeUndefined();
  });

  it('sets each preset up to match exactly the targeting it demonstrates', () => {
    expect(personas.qa.attributes.key).toBe('qa-tester-001');
    expect(personas.employee.attributes.email?.endsWith(EMPLOYEE_EMAIL_DOMAIN)).toBe(true);
    expect(personas.beta.attributes.betaTester).toBe(true);
    expect(personas.gold.attributes.loyaltyTier).toBe('gold');
    expect((CENTRAL_STATES as readonly string[]).includes(personas.gold.attributes.state!)).toBe(true);
    // The beta tester and employee sit outside the Central region, so only their own rule matches.
    expect((CENTRAL_STATES as readonly string[]).includes(personas.beta.attributes.state!)).toBe(false);
    expect((CENTRAL_STATES as readonly string[]).includes(personas.employee.attributes.state!)).toBe(false);
  });

  it('never puts personal data in a context key', () => {
    for (const p of Object.values(personas)) expect(p.attributes.key).not.toContain('@');
  });
});
