import { useState } from 'react';
import Field from '../checkout/Field';
import {
  EMPTY_DETAILS,
  PAYMENT_FIELDS,
  SHIPPING_FIELDS,
  cardEnding,
  newOrderId,
  validateFields,
  type CheckoutDetails,
  type FieldErrors,
  type FieldName,
} from '../checkout/form';
import { formatPrice, shippingFor } from '../data/catalog';

interface Props {
  subtotal: number;
  onPlaced: (orderId: string) => void;
}

const STEPS = ['Shipping', 'Payment', 'Review'] as const;
const STEP_FIELDS: FieldName[][] = [SHIPPING_FIELDS, PAYMENT_FIELDS, []];

/**
 * The CLASSIC checkout: the current, known-good experience served when
 * release-new-checkout is false (and whenever LaunchDarkly is unreachable).
 * Three separate steps, each validated before moving on.
 */
export default function ClassicCheckout({ subtotal, onPlaced }: Props) {
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState<CheckoutDetails>(EMPTY_DETAILS);
  const [errors, setErrors] = useState<FieldErrors>({});
  // Same shipping rule as Express checkout: the flag changes the experience, not the price.
  const shipping = shippingFor(subtotal);

  const update = (name: FieldName, value: string) => {
    setDetails((d) => ({ ...d, [name]: value }));
    // Clear a field's error as soon as the shopper edits it.
    if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
  };

  const next = () => {
    const stepErrors = validateFields(details, STEP_FIELDS[step]);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) {
      document.getElementById(`checkout-${Object.keys(stepErrors)[0]}`)?.focus();
      return;
    }
    setStep(step + 1);
  };

  const fieldProps = (name: FieldName) => ({ name, value: details[name], error: errors[name], onValue: update });

  return (
    <div className="classic">
      <ol className="steps" aria-label="Checkout steps">
        {STEPS.map((label, i) => (
          <li key={label} className={`steps__item ${i === step ? 'is-current' : ''} ${i < step ? 'is-done' : ''}`}>
            <span className="steps__num">{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <fieldset className="form-block">
          <legend>Shipping address</legend>
          <Field {...fieldProps('fullName')} label="Full name" autoComplete="name" placeholder="First and last name" />
          <Field {...fieldProps('street')} label="Street" autoComplete="address-line1" placeholder="Street address" />
          <div className="form-row form-row--three">
            <Field {...fieldProps('city')} label="City" autoComplete="address-level2" />
            <Field {...fieldProps('state')} label="State" autoComplete="address-level1" placeholder="TN" maxLength={2} />
            <Field {...fieldProps('zip')} label="ZIP" autoComplete="postal-code" inputMode="numeric" maxLength={10} />
          </div>
        </fieldset>
      )}

      {step === 1 && (
        <fieldset className="form-block">
          <legend>Payment</legend>
          {/* autoComplete off: this is a demo store, so browsers should not offer to save real cards here. */}
          <Field {...fieldProps('cardNumber')} label="Card number" inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" />
          <div className="form-row">
            <Field {...fieldProps('expiry')} label="Expiry" autoComplete="off" placeholder="MM / YY" maxLength={7} />
            <Field {...fieldProps('cvc')} label="CVC" inputMode="numeric" autoComplete="off" placeholder="123" maxLength={4} />
          </div>
          <p className="fine-print">Demo store: use the test card 4242 4242 4242 4242. Nothing is charged or sent anywhere.</p>
        </fieldset>
      )}

      {step === 2 && (
        <div className="form-block">
          <p className="legend">Review order</p>
          <div className="review-summary">
            <div>
              <p className="saved-card__label">Ship to</p>
              <p>{details.fullName}</p>
              <p className="muted small">
                {details.street}, {details.city}, {details.state.toUpperCase()} {details.zip}
              </p>
            </div>
            <div>
              <p className="saved-card__label">Pay with</p>
              <p>Card {cardEnding(details.cardNumber)}</p>
            </div>
          </div>
          <dl className="totals">
            <dt>Subtotal</dt>
            <dd>{formatPrice(subtotal)}</dd>
            <dt>Ground shipping</dt>
            <dd>{shipping === 0 ? 'Free' : formatPrice(shipping)}</dd>
            <dt className="totals__grand">Total</dt>
            <dd className="totals__grand">{formatPrice(subtotal + shipping)}</dd>
          </dl>
        </div>
      )}

      <div className="classic__actions">
        {step > 0 && (
          <button className="btn btn--ghost" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button className="btn btn--primary" onClick={next}>
            Continue to {STEPS[step + 1].toLowerCase()}
          </button>
        ) : (
          <button className="btn btn--primary" onClick={() => onPlaced(newOrderId())}>
            Place order
          </button>
        )}
      </div>
    </div>
  );
}
