import { useEffect, useState } from 'react';
import { useBoolVariation, useLDClient } from '@launchdarkly/react-sdk';
import { FALLBACKS, FLAGS } from '../launchdarkly/config';
import { useReleaseLog } from '../state/ReleaseLog';
import { useToast } from '../state/Toasts';
import { useCart } from '../state/Cart';
import ClassicCheckout from './ClassicCheckout';
import NewCheckout from './NewCheckout';
import { formatPrice } from '../data/products';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * PART 1: RELEASE AND REMEDIATE
 *
 * The checkout drawer is wrapped in the "release-new-checkout" feature flag:
 *   true  -> the redesigned one-page Express checkout (the new feature)
 *   false -> the Classic three-step checkout (the known-good fallback)
 *
 * The drawer stays mounted even while closed, so its flag listener is always
 * active and every change shows up in the toast and the Release Console.
 */
export default function CheckoutDrawer({ open, onClose }: Props) {
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

  useEffect(() => {
    // Our callback. The change event carries only the context, not the value,
    // so we read the new value back from the client.
    const handleCheckoutFlagChange = () => {
      const isOn = ldClient.boolVariation(FLAGS.newCheckout, FALLBACKS.newCheckout);
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
  }, [ldClient, showToast, logEvent]);

  const { lines, subtotal, remove, clear } = useCart();
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const handlePlaced = (orderId: string) => {
    setConfirmation(orderId);
    clear();
  };

  const handleClose = () => {
    setConfirmation(null);
    onClose();
  };

  return (
    <>
      <div className={`scrim ${open ? 'scrim--open' : ''}`} onClick={handleClose} aria-hidden="true" />
      <aside
        className={`drawer ${open ? 'drawer--open' : ''}`}
        aria-label="Checkout"
        aria-hidden={!open}
        inert={!open}
      >
        <header className="drawer__head">
          <div>
            <p className="eyebrow">Your pack list</p>
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
              Order <strong>{confirmation}</strong> is packed and ready to ship. This is a demo store, so no
              payment was taken.
            </p>
            <button className="btn btn--primary" onClick={handleClose}>
              Keep browsing
            </button>
          </div>
        ) : lines.length === 0 ? (
          <div className="empty">
            <p>Your pack is empty. Add some gear to try checkout.</p>
          </div>
        ) : (
          <>
            <ul className="line-items">
              {lines.map((l) => (
                <li key={l.product.id} className="line-item">
                  <span className="line-item__swatch" style={{ background: l.product.tone }} />
                  <span className="line-item__name">
                    {l.product.name}
                    <small>Qty {l.quantity}</small>
                  </span>
                  <span className="line-item__price">{formatPrice(l.product.price * l.quantity)}</span>
                  <button className="link-btn" onClick={() => remove(l.product.id)}>
                    Remove
                  </button>
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
