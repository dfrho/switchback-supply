/**
 * Checkout form fields and validation, shared by both checkout experiences.
 * Kept free of React so the rules are easy to unit test.
 *
 * Demo store: nothing typed here leaves the browser, and no payment is taken.
 */

export interface CheckoutDetails {
  fullName: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  cardNumber: string;
  expiry: string;
  cvc: string;
}

export type FieldName = keyof CheckoutDetails;
export type FieldErrors = Partial<Record<FieldName, string>>;

export const EMPTY_DETAILS: CheckoutDetails = {
  fullName: '',
  street: '',
  city: '',
  state: '',
  zip: '',
  cardNumber: '',
  expiry: '',
  cvc: '',
};

export const SHIPPING_FIELDS: FieldName[] = ['fullName', 'street', 'city', 'state', 'zip'];
export const PAYMENT_FIELDS: FieldName[] = ['cardNumber', 'expiry', 'cvc'];

const digits = (value: string) => value.replace(/\D/g, '');

/** Returns an error message, or undefined when the value is valid. */
export function validateField(name: FieldName, raw: string, now = new Date()): string | undefined {
  const value = raw.trim();
  switch (name) {
    case 'fullName':
      return value.length >= 2 ? undefined : 'Enter your full name';
    case 'street':
      return value.length >= 3 ? undefined : 'Enter a street address';
    case 'city':
      return value.length >= 2 ? undefined : 'Enter a city';
    case 'state':
      return /^[A-Za-z]{2}$/.test(value) ? undefined : 'Use a two-letter state code';
    case 'zip':
      return /^\d{5}(-\d{4})?$/.test(value) ? undefined : 'Enter a 5-digit ZIP code';
    case 'cardNumber': {
      const d = digits(value);
      return d.length >= 13 && d.length <= 19 ? undefined : 'Enter a card number';
    }
    case 'expiry': {
      const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(value);
      if (!match) return 'Use MM / YY';
      const month = Number(match[1]);
      const year = 2000 + Number(match[2]);
      if (month < 1 || month > 12) return 'Use MM / YY';
      const endOfMonth = new Date(year, month, 0, 23, 59, 59);
      return endOfMonth >= now ? undefined : 'This card has expired';
    }
    case 'cvc':
      return /^\d{3,4}$/.test(value) ? undefined : 'Enter the 3 or 4 digit code';
  }
}

export function validateFields(details: CheckoutDetails, fields: FieldName[], now = new Date()): FieldErrors {
  const errors: FieldErrors = {};
  for (const name of fields) {
    const message = validateField(name, details[name], now);
    if (message) errors[name] = message;
  }
  return errors;
}

/** Display helper: "4242 4242 4242 4242" becomes "ending 4242". */
export const cardEnding = (cardNumber: string) => `ending ${digits(cardNumber).slice(-4)}`;

export const newOrderId = () => `SB-${Date.now().toString().slice(-6)}`;
