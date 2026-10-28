import { useState } from 'react';
import { useBoolVariation, useInitializationStatus, useLDClient } from '@launchdarkly/react-sdk';
import { FALLBACKS, FLAGS } from '../launchdarkly/config';
import type { ShopperId, ShopperProfile } from '../launchdarkly/contexts';
import { useReleaseLog } from '../state/ReleaseLog';

interface Props {
  shoppers: Record<ShopperId, ShopperProfile>;
  activeShopper: ShopperId;
  onShopperChange: (id: ShopperId) => void;
}

const CONSOLE_KEY = 'switchback.console';

const STATUS_LABEL: Record<string, string> = {
  initializing: 'Connecting',
  complete: 'Streaming',
  timeout: 'Timed out (serving fallbacks)',
  failed: 'Failed (serving fallbacks)',
};

/**
 * Release Console: a demo-only panel that makes LaunchDarkly visible.
 * It shows SDK status, the live flag value, who the SDK thinks you are,
 * and a timestamped log written by the checkout's flag change listener.
 */
export default function ReleaseConsole({ shoppers, activeShopper, onShopperChange }: Props) {
  // Remember whether the console is open. Default: open on desktop, closed on phones.
  const [expanded, setExpandedState] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem(CONSOLE_KEY);
      if (saved !== null) return saved === 'open';
    } catch {
      // Storage unavailable: fall through to the default.
    }
    return window.innerWidth > 720;
  });
  const setExpanded = (open: boolean) => {
    setExpandedState(open);
    try {
      window.localStorage.setItem(CONSOLE_KEY, open ? 'open' : 'closed');
    } catch {
      // Ignore: the preference just will not persist.
    }
  };
  const [switching, setSwitching] = useState(false);
  const ldClient = useLDClient();
  const { status } = useInitializationStatus();
  const newCheckout = useBoolVariation(FLAGS.newCheckout, FALLBACKS.newCheckout);
  const { events } = useReleaseLog();

  /**
   * Switching shoppers calls identify(): the SDK swaps the evaluation context and
   * fetches flag values for the new context. Hooks re-render with the new values,
   * still with no page reload. identify() never rejects; it resolves with a status.
   */
  const switchShopper = async (id: ShopperId) => {
    if (id === activeShopper) return; // identify is not free; skip no-op calls
    setSwitching(true);
    const result = await ldClient.identify(shoppers[id].context);
    setSwitching(false);
    if (result.status === 'completed') onShopperChange(id);
  };

  return (
    <section className={`console ${expanded ? 'console--open' : ''}`} aria-label="LaunchDarkly release console">
      <button className="console__toggle" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        <span className={`pulse pulse--${status}`} aria-hidden="true" />
        Release console
        <span className="console__chev" aria-hidden="true">
          {expanded ? 'Hide' : 'Show'}
        </span>
      </button>

      {expanded && (
        <div className="console__body">
          <dl className="console__grid">
            <dt>SDK</dt>
            <dd>{STATUS_LABEL[status] ?? status}</dd>
            <dt>Flag</dt>
            <dd className="mono">{FLAGS.newCheckout}</dd>
            <dt>Serving</dt>
            <dd>
              <span className={`value-pill ${newCheckout ? 'value-pill--on' : ''}`}>{String(newCheckout)}</span>
              <span className="muted">{newCheckout ? 'Express checkout' : 'Classic checkout'}</span>
            </dd>
          </dl>

          <div className="console__shopper">
            <p className="console__label">Shopping as</p>
            <div className="seg" role="radiogroup" aria-label="Shopper context">
              {(Object.keys(shoppers) as ShopperId[]).map((id) => (
                <button
                  key={id}
                  role="radio"
                  aria-checked={activeShopper === id}
                  className={`seg__btn ${activeShopper === id ? 'is-active' : ''}`}
                  disabled={switching}
                  onClick={() => switchShopper(id)}
                  title={shoppers[id].description}
                >
                  {shoppers[id].label}
                </button>
              ))}
            </div>
            <p className="muted mono small">key: {String((shoppers[activeShopper].context as { key: string }).key)}</p>
          </div>

          <div className="console__log">
            <p className="console__label">Listener log</p>
            {events.length === 0 ? (
              <p className="muted small">Toggle the flag in LaunchDarkly or run npm run remediate.</p>
            ) : (
              <ol>
                {events.map((e) => (
                  <li key={e.id} className={e.value ? 'is-on' : 'is-off'}>
                    <time className="mono">{e.at.toLocaleTimeString()}</time>
                    <span>{e.note}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
