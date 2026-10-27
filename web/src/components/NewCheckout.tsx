import { formatPrice } from '../data/products';

interface Props {
  subtotal: number;
  onPlaced: (orderId: string) => void;
}

/**
 * The NEW checkout: a one-page Express checkout, served when
 * release-new-checkout is true. Saved address and payment are pre-filled,
 * free shipping is surfaced up front, and one tap places the order.
 *
 * This is the feature the engineering manager wants to ship faster
 * without adding risk.
 */
export default function NewCheckout({ subtotal, onPlaced }: Props) {
  const shipping = subtotal >= 150 ? 0 : 8;

  return (
    <div className="express">
      <div className="express__banner">
        <span className="trail-blaze" aria-hidden="true" />
        <p>
          <strong>Express checkout</strong> One page, saved details, done.
        </p>
      </div>

      <div className="express__cards">
        <div className="saved-card">
          <p className="saved-card__label">Ship to</p>
          <p className="saved-card__value">Jordan Trailwalker</p>
          <p className="saved-card__meta">411 Switchback Ln, Nashville, TN 37203</p>
        </div>
        <div className="saved-card">
          <p className="saved-card__label">Pay with</p>
          <p className="saved-card__value">Saved card ending 4242</p>
          <p className="saved-card__meta">Demo store: nothing is charged</p>
        </div>
      </div>

      <div className="eta">
        <span className="eta__dot" aria-hidden="true" />
        Arrives in 2 to 3 days{shipping === 0 ? ' with free shipping' : ''}
      </div>

      <dl className="totals">
        <dt>Subtotal</dt>
        <dd>{formatPrice(subtotal)}</dd>
        <dt>Shipping</dt>
        <dd>{shipping === 0 ? 'Free' : formatPrice(shipping)}</dd>
        <dt className="totals__grand">Total</dt>
        <dd className="totals__grand">{formatPrice(subtotal + shipping)}</dd>
      </dl>

      <button
        className="btn btn--primary btn--block btn--express"
        onClick={() => onPlaced(`SB-${Date.now().toString().slice(-6)}`)}
      >
        Place order, {formatPrice(subtotal + shipping)}
      </button>
    </div>
  );
}
