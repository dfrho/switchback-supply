import { describe, expect, it } from 'vitest';
import { EMPTY_DETAILS, PAYMENT_FIELDS, SHIPPING_FIELDS, cardEnding, validateField, validateFields } from './form';

const NOW = new Date(2026, 9, 28); // October 28, 2026

describe('validateField', () => {
  it.each([
    ['fullName', 'A', false],
    ['fullName', 'Avery Reviewer', true],
    ['street', '1', false],
    ['street', '100 Main St', true],
    ['city', 'Nashville', true],
    ['state', 'TN', true],
    ['state', 'tn', true],
    ['state', 'Tenn', false],
    ['zip', '37203', true],
    ['zip', '37203-1234', true],
    ['zip', '3720', false],
    ['cardNumber', '4242 4242 4242 4242', true],
    ['cardNumber', '4242', false],
    ['cvc', '123', true],
    ['cvc', '1234', true],
    ['cvc', '12', false],
  ] as const)('%s = "%s" is valid: %s', (field, value, valid) => {
    expect(validateField(field, value, NOW) === undefined).toBe(valid);
  });

  it('accepts an expiry in the current month or later', () => {
    expect(validateField('expiry', '10 / 26', NOW)).toBeUndefined();
    expect(validateField('expiry', '12/30', NOW)).toBeUndefined();
  });

  it('rejects an expired card and a malformed expiry', () => {
    expect(validateField('expiry', '09 / 26', NOW)).toBe('This card has expired');
    expect(validateField('expiry', '13 / 30', NOW)).toBe('Use MM / YY');
    expect(validateField('expiry', '1230', NOW)).toBe('Use MM / YY');
  });

  it('ignores surrounding whitespace', () => {
    expect(validateField('fullName', '   ', NOW)).toBe('Enter your full name');
    expect(validateField('zip', ' 37203 ', NOW)).toBeUndefined();
  });
});

describe('validateFields', () => {
  it('reports every empty shipping field and no payment fields', () => {
    const errors = validateFields(EMPTY_DETAILS, SHIPPING_FIELDS, NOW);
    expect(Object.keys(errors).sort()).toEqual([...SHIPPING_FIELDS].sort());
  });

  it('returns no errors for a complete, valid payment step', () => {
    const details = { ...EMPTY_DETAILS, cardNumber: '4242424242424242', expiry: '12 / 30', cvc: '123' };
    expect(validateFields(details, PAYMENT_FIELDS, NOW)).toEqual({});
  });
});

describe('cardEnding', () => {
  it('shows only the last four digits', () => {
    expect(cardEnding('4242 4242 4242 1881')).toBe('ending 1881');
  });
});
