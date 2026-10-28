import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useBoolVariation, useInitializationStatus } from '@launchdarkly/react-sdk';
import { FALLBACKS, FLAGS } from '../launchdarkly/config';
import { FREE_SHIPPING_MIN, formatPrice, getProduct } from '../data/catalog';
import { Contours } from './Brand';
import ProductImage from './ProductImage';

/**
 * How long the hero waits for LaunchDarkly on first load before falling back to
 * the current hero. Long enough to avoid flashing the wrong hero for nearly every
 * visitor, short enough that an outage never leaves the page blank.
 */
export const HERO_WAIT_MS = 1200;

const WINTER_PICKS = ['ember-puffer', 'squall-shell', 'nightfall-20'];

/**
 * PART 2: TARGET
 *
 * The landing page hero is wrapped in the "release-landing-hero" feature flag:
 *   true  -> the revamped Winter-Ready hero (the new component)
 *   false -> the current hero (also the fallback if LaunchDarkly is unreachable)
 *
 * Who gets true is decided entirely by targeting in LaunchDarkly: individual
 * targets, then rules, then the default rule (see README, Part 2).
 */
export default function LandingHero() {
  const showWinterHero = useBoolVariation(FLAGS.landingHero, FALLBACKS.landingHero);
  const { status } = useInitializationStatus();
  const [waitedLongEnough, setWaitedLongEnough] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setWaitedLongEnough(true), HERO_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // On first load, hold a neutral placeholder until LaunchDarkly answers, so a
  // targeted shopper never sees the old hero flash and swap.
  if (status === 'initializing' && !waitedLongEnough) {
    return <section className="hero hero--placeholder" aria-busy="true" aria-label="Loading featured content" />;
  }

  return showWinterHero ? <WinterReadyHero /> : <CurrentHero />;
}

/** The current hero: the "before" in this release. */
function CurrentHero() {
  return (
    <section className="hero" data-hero="current">
      <Contours />
      <div className="hero__copy">
        <p className="eyebrow">Fall trail season</p>
        <h1 className="hero__title">
          Gear for the
          <br />
          long way up.
        </h1>
        <p className="hero__sub">
          Field-tested packs, boots, and shells for every switchback between the trailhead and the summit.
        </p>
        <Link className="btn btn--primary" to="/shop">
          Shop the trail kit
        </Link>
      </div>
      <div className="hero__marker" aria-hidden="true">
        <span>EL. 6,643 FT</span>
        <span>MILE 12.4</span>
      </div>
    </section>
  );
}

/** The revamped hero: seasonal message, three featured products, free shipping callout. */
function WinterReadyHero() {
  const picks = WINTER_PICKS.map((id) => getProduct(id)).filter((p) => p !== undefined);
  return (
    <section className="hero hero--winter" data-hero="winter-ready">
      <Contours />
      <div className="winter__copy">
        <p className="eyebrow">New for winter</p>
        <h1 className="hero__title">
          Winter-ready.
          <br />
          Trail-tested.
        </h1>
        <p className="hero__sub">
          Down, storm shells, and cold-night sleep systems for the shoulder season and beyond.
        </p>
        <div className="winter__actions">
          <Link className="btn btn--primary" to="/shop?category=outerwear">
            Shop winter layers
          </Link>
          <span className="winter__ship">Free shipping over {formatPrice(FREE_SHIPPING_MIN)}</span>
        </div>
      </div>
      <ul className="winter__picks" aria-label="Winter picks">
        {picks.map((p) => (
          <li key={p.id}>
            <Link to={`/products/${p.id}`} className="winter-pick">
              <ProductImage product={p} priority />
              <span className="winter-pick__name">{p.name}</span>
              <span className="winter-pick__price">{formatPrice(p.price)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
