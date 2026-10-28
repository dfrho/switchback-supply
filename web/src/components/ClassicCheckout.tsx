import { useState } from 'react';
import { formatPrice, shippingFor } from '../data/catalog';

interface Props {
  subtotal: number;
  onPlaced: (orderId: string) => void;
}

const STEPS = ['Shipping', 'Payment', 'Review'] as const;

/**
 * The CLASSIC checkout: the current, known-good experience served when
 * release-new-checkout is false (and whenever LaunchDarkly is unreachable).
 * Three separate steps, each with its own Continue button.
 */
export default function ClassicCheckout({ subtotal, onPlaced }: Props) {
  const [step, setStep] = useState(0);
  // Same shipping rule as Express checkout: the flag changes the experience, not the price.
  const shipping = shippingFor(subtotal);

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
          <label>
            Full name
            <input defaultValue="Jordan Trailwalker" />
          </label>
          <label>
            Street
            <input defaultValue="411 Switchback Ln" />
          </label>
          <div className="form-row">
            <label>
              City
              <input defaultValue="Nashville" />
            </label>
            <label>
              ZIP
              <input defaultValue="37203" />
            </label>
          </div>
        </fieldset>
      )}

      {step === 1 && (
        <fieldset className="form-block">
          <legend>Payment</legend>
          <label>
            Card number
            <input defaultValue="4242 4242 4242 4242" inputMode="numeric" />
          </label>
          <div className="form-row">
            <label>
              Expiry
              <input defaultValue="12 / 29" />
            </label>
            <label>
              CVC
              <input defaultValue="123" />
            </label>
          </div>
          <p className="fine-print">Demo store: test card values only. Nothing is charged.</p>
        </fieldset>
      )}

      {step === 2 && (
        <div className="form-block">
          <p className="legend">Review order</p>
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
          <button className="btn btn--primary" onClick={() => setStep(step + 1)}>
            Continue to {STEPS[step + 1].toLowerCase()}
          </button>
        ) : (
          <button className="btn btn--primary" onClick={() => onPlaced(`SB-${Date.now().toString().slice(-6)}`)}>
            Place order
          </button>
        )}
      </div>
    </div>
  );
}
