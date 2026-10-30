import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useBoolVariation, useLDClient } from '@launchdarkly/react-sdk';
import { FALLBACKS, FLAGS, METRIC_EVENTS } from '../launchdarkly/config';
import { useReleaseLog } from '../state/ReleaseLog';
import { useToast } from '../state/Toasts';
import { useCart } from '../state/Cart';
import { useShopper } from '../state/Shopper';
import ClassicCheckout from './ClassicCheckout';
import NewCheckout from './NewCheckout';
import ProductImage from './ProductImage';
import { formatPrice, shippingFor } from '../data/catalog';

/**
 * PART 1: RELEASE AND REMEDIATE
 *
 * The checkout drawer is wrapped in the "release-new-checkout" feature flag:
 *   true  -> the redesigned one-page Express checkout (the new feature)
 *   false -> the Classic three-step checkout (the known-good fallback)
 *
 * The drawer is mounted on every page, even while closed, so its flag listener
 * is always active and every change shows up in the toast and the Release Console.
 */
export default function CheckoutDrawer() {
  // 1. RELEASE: useBoolVariation returns the live flag value and re-renders this
  //    component whenever the flag changes. LaunchDarkly pushes the change over
  //    the streaming connection, so the swap happens with no page reload.
  //    FALLBACK: if LaunchDarkly is unreachable, shoppers get the classic checkout.
  const showNewCheckout = useBoolVariation(FLAGS.newCheckout, FALLBACKS.newCheckout);

  // 2. LISTENER: an explicit subscription to this one flag's change event.
  //    The hook above already re-renders on change; this listener makes the
  //    mechanism visible by announcing each release or rollback.
  const ldClient = useLDClient();
  const { showToast } = useToast();
  const { logEvent } = useReleaseLog();
  const { isSwitchingRef } = useShopper();
  // The value this shopper is currently seeing, so only real changes are announced.
  const lastAnnounced = useRef(showNewCheckout);

  useEffect(() => {
    // Our callback. The change event carries only the context, not the value,
    // so we read the new value back from the client.
    const handleCheckoutFlagChange = () => {
      const isOn = ldClient.boolVariation(FLAGS.newCheckout, FALLBACKS.newCheckout);
      const previous = lastAnnounced.current;
      lastAnnounced.current = isOn;
      // Change events also fire when flag values first load. Only announce a real
      // change, after LaunchDarkly has finished initializing.
      if (isOn === previous || ldClient.getInitializationState?.() === 'initializing') return;
      const experience = isOn ? 'Express checkout' : 'Classic checkout';

      // A change can also come from switching shoppers (identify), not a release in
      // LaunchDarkly. Say which, so the demo never calls a targeting change a release.
      if (isSwitchingRef.current) {
        showToast({ tone: 'info', title: 'Shopper switched', body: `This shopper gets ${experience}.` });
        logEvent({ flagKey: FLAGS.newCheckout, value: isOn, note: `Shopper switched: ${experience}` });
        return;
      }
      showToast(
        isOn
          ? { tone: 'release', title: 'New checkout released', body: 'Shoppers now see Express checkout. No reload needed.' }
          : { tone: 'rollback', title: 'Checkout rolled back', body: 'Shoppers are back on Classic checkout, instantly.' },
      );
      logEvent({
        flagKey: FLAGS.newCheckout,
        value: isOn,
        note: isOn ? 'Released: Express checkout' : 'Rolled back: Classic checkout',
      });
    };

    // Subscribe to changes for this flag only ("change" alone would fire for any flag).
    ldClient.on(`change:${FLAGS.newCheckout}`, handleCheckoutFlagChange);

    // Cleanup: unsubscribe with the same function reference. Without this,
    // listeners pile up (React mounts components twice in development mode).
    return () => ldClient.off(`change:${FLAGS.newCheckout}`, handleCheckoutFlagChange);
  }, [ldClient, showToast, logEvent, isSwitchingRef]);

  const { lines, subtotal, count, isOpen, closeCart, setQuantity, remove, clear } = useCart();
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const handlePlaced = (orderId: string) => {
    // 3. MEASURE: tell LaunchDarkly an order was placed, with the order total as the
    //    metric value. LaunchDarkly credits the event to the checkout this shopper was
    //    served, so metrics on it compare Classic and Express checkout (conversion and
    //    order value) and can guard a rollout. No personal data goes in the event.
    ldClient.track(
      METRIC_EVENTS.checkoutCompleted,
      { checkout: showNewCheckout ? 'express' : 'classic', items: count },
      subtotal + shippingFor(subtotal),
    );
    setConfirmation(orderId);
    clear();
  };

  const handleClose = () => {
    setConfirmation(null);
    closeCart();
  };

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeCart();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, closeCart]);

  return (
    <>
      <div className={`scrim ${isOpen ? 'scrim--open' : ''}`} onClick={handleClose} aria-hidden="true" />
      <aside className={`drawer ${isOpen ? 'drawer--open' : ''}`} aria-label="Checkout" aria-hidden={!isOpen} inert={!isOpen}>
        <header className="drawer__head">
          <div>
            <p className="eyebrow">Your pack {count > 0 && `· ${count} ${count === 1 ? 'item' : 'items'}`}</p>
            <h2 className="drawer__title">Checkout</h2>
          </div>
          <span className={`variant-tag ${showNewCheckout ? 'variant-tag--new' : ''}`}>
            {showNewCheckout ? 'Express checkout' : 'Classic checkout'}
          </span>
          <button className="icon-btn" onClick={handleClose} aria-label="Close checkout">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {confirmation ? (
          <div className="confirm">
            <p className="eyebrow">Order placed</p>
            <h3 className="confirm__title">See you on the trail.</h3>
            <p className="confirm__body">
              Order <strong>{confirmation}</strong> is packed and ready to ship. This is a demo store, so no payment was
              taken.
            </p>
            <button className="btn btn--primary" onClick={handleClose}>
              Keep browsing
            </button>
          </div>
        ) : lines.length === 0 ? (
          <div className="empty">
            <p>Your pack is empty.</p>
            <Link className="btn btn--primary" to="/shop" onClick={handleClose}>
              Shop the trail kit
            </Link>
          </div>
        ) : (
          <>
            <ul className="line-items">
              {lines.map((l) => (
                <li key={l.sku} className="line-item">
                  <Link
                    to={`/products/${l.product.id}`}
                    onClick={handleClose}
                    className="line-item__thumb"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <ProductImage product={l.product} />
                  </Link>
                  <div className="line-item__info">
                    <Link to={`/products/${l.product.id}`} onClick={handleClose} className="line-item__name">
                      {l.product.name}
                    </Link>
                    <span className="line-item__variant">
                      <span className="swatch-dot" style={{ background: l.variant.colorHex }} />
                      {l.variant.color}
                      {l.variant.size && ` · Size ${l.variant.size}`}
                    </span>
                    <div className="line-item__controls">
                      <div className="qty qty--small" aria-label={`Quantity for ${l.product.name}`}>
                        <button onClick={() => setQuantity(l.sku, l.quantity - 1)} aria-label="Decrease quantity">
                          -
                        </button>
                        <span>{l.quantity}</span>
                        <button
                          onClick={() => setQuantity(l.sku, l.quantity + 1)}
                          disabled={l.quantity >= l.variant.stock}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <button className="link-btn" onClick={() => remove(l.sku)}>
                        Remove
                      </button>
                    </div>
                  </div>
                  <span className="line-item__price">{formatPrice(l.product.price * l.quantity)}</span>
                </li>
              ))}
            </ul>

            {/* THE FLAG IN ACTION: one boolean decides which checkout renders. */}
            <div className="checkout-body" key={showNewCheckout ? 'new' : 'classic'}>
              {showNewCheckout ? (
                <NewCheckout subtotal={subtotal} onPlaced={handlePlaced} />
              ) : (
                <ClassicCheckout subtotal={subtotal} onPlaced={handlePlaced} />
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
