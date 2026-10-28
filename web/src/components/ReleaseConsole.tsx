import { useState } from 'react';
import { useBoolVariation, useBoolVariationDetail, useInitializationStatus } from '@launchdarkly/react-sdk';
import { CENTRAL_STATES, FALLBACKS, FLAGS, HERO_TARGETING } from '../launchdarkly/config';
import { EMPLOYEE_EMAIL, STATE_OPTIONS, type LoyaltyTier, type PersonaId } from '../launchdarkly/contexts';
import { explainEvaluation, type EvaluationReason } from '../launchdarkly/explain';
import { useReleaseLog } from '../state/ReleaseLog';
import { useShopper } from '../state/Shopper';

const CONSOLE_KEY = 'switchback.console';

const STATUS_LABEL: Record<string, string> = {
  initializing: 'Connecting',
  complete: 'Streaming',
  timeout: 'Timed out (serving fallbacks)',
  failed: 'Failed (serving fallbacks)',
};

const ROW_STATUS_LABEL = { match: 'Match', 'no-match': 'No match', 'not-evaluated': 'Not evaluated' } as const;

/**
 * Release Console: a demo-only panel built on the SDK's hooks to make LaunchDarkly
 * visible. It shows SDK status, both flags, who the SDK thinks you are (editable),
 * how LaunchDarkly decided the hero flag, and the checkout listener's log.
 * Not part of the LaunchDarkly SDK, and not something shoppers would see.
 */
export default function ReleaseConsole() {
  // Remember whether the console is open. Default: collapsed, so it never covers the store.
  const [expanded, setExpandedState] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem(CONSOLE_KEY);
      if (saved !== null) return saved === 'open';
    } catch {
      // Storage unavailable: fall through to the default.
    }
    return false;
  });
  const setExpanded = (open: boolean) => {
    setExpandedState(open);
    try {
      window.localStorage.setItem(CONSOLE_KEY, open ? 'open' : 'closed');
    } catch {
      // Ignore: the preference just will not persist.
    }
  };

  const { status } = useInitializationStatus();
  const newCheckout = useBoolVariation(FLAGS.newCheckout, FALLBACKS.newCheckout);
  const hero = useBoolVariationDetail(FLAGS.landingHero, FALLBACKS.landingHero);
  const explanation = explainEvaluation(hero.reason as EvaluationReason | null | undefined, HERO_TARGETING);
  const { events } = useReleaseLog();
  const { personas, personaId, attributes, edited, switching, choosePersona, updateAttributes } = useShopper();

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
            <dt>Checkout</dt>
            <dd>
              <span className="mono small">{FLAGS.newCheckout}</span>
              <span className={`value-pill ${newCheckout ? 'value-pill--on' : ''}`}>{String(newCheckout)}</span>
            </dd>
            <dt>Hero</dt>
            <dd>
              <span className="mono small">{FLAGS.landingHero}</span>
              <span className={`value-pill ${hero.value ? 'value-pill--on' : ''}`} data-testid="hero-flag-value">
                {String(hero.value)}
              </span>
            </dd>
          </dl>

          <fieldset className="console__shopper" disabled={switching}>
            <legend className="console__label">Shopping as</legend>
            <label className="console__field console__field--wide">
              <span className="sr-only">Persona</span>
              <select value={personaId} onChange={(e) => choosePersona(e.target.value as PersonaId)} aria-label="Persona">
                {(Object.keys(personas) as PersonaId[]).map((id) => (
                  <option key={id} value={id}>
                    {personas[id].label}
                  </option>
                ))}
              </select>
            </label>
            <p className="muted mono small" data-testid="context-key">
              key: {attributes.key}
              {attributes.anonymous ? ' (anonymous)' : ''}
              {edited ? ' · edited' : ''}
            </p>

            <p className="console__label">Shopper attributes</p>
            <div className="attr-grid">
              <Toggle
                label="Employee email"
                hint="private"
                checked={!!attributes.email}
                onChange={(on) => updateAttributes({ email: on ? EMPLOYEE_EMAIL : undefined })}
              />
              <Toggle
                label="Beta tester"
                checked={attributes.betaTester}
                onChange={(on) => updateAttributes({ betaTester: on })}
              />
              <label className="console__field">
                Loyalty tier
                <select value={attributes.loyaltyTier} onChange={(e) => updateAttributes({ loyaltyTier: e.target.value as LoyaltyTier })}>
                  <option value="none">none</option>
                  <option value="silver">silver</option>
                  <option value="gold">gold</option>
                </select>
              </label>
              <label className="console__field">
                State
                <select value={attributes.state ?? ''} onChange={(e) => updateAttributes({ state: e.target.value || undefined })}>
                  <option value="">unknown</option>
                  {STATE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                      {(CENTRAL_STATES as readonly string[]).includes(s) ? ' (Central)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          <div className="console__decision">
            <p className="console__label">How LaunchDarkly chose the hero</p>
            <p className="decision__summary" data-testid="hero-decision">
              {explanation.summary}
            </p>
            <ol className="decision__rows">
              {explanation.rows.map((row) => (
                <li key={row.id} className={`decision__row decision__row--${row.status}`} data-row={row.id} title={row.detail}>
                  <span>{row.label}</span>
                  <span className="decision__status">{ROW_STATUS_LABEL[row.status]}</span>
                </li>
              ))}
            </ol>
            <p className="muted small">First match wins, top to bottom.</p>
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

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__track" aria-hidden="true" />
      <span>
        {label}
        {hint && <span className="toggle__hint"> {hint}</span>}
      </span>
    </label>
  );
}
