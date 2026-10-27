import { useState } from 'react';
import { Contours, Logo } from './components/Brand';
import CheckoutDrawer from './components/CheckoutDrawer';
import ProductArt from './components/ProductArt';
import ReleaseConsole from './components/ReleaseConsole';
import { PRODUCTS, formatPrice } from './data/products';
import type { ShopperId, ShopperProfile } from './launchdarkly/contexts';
import { CartProvider, useCart } from './state/Cart';
import { ReleaseLogProvider } from './state/ReleaseLog';
import { ToastProvider, useToast } from './state/Toasts';

interface AppProps {
  shoppers: Record<ShopperId, ShopperProfile>;
}

export default function App({ shoppers }: AppProps) {
  return (
    <ToastProvider>
      <ReleaseLogProvider>
        <CartProvider>
          <Storefront shoppers={shoppers} />
        </CartProvider>
      </ReleaseLogProvider>
    </ToastProvider>
  );
}

function Storefront({ shoppers }: AppProps) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [activeShopper, setActiveShopper] = useState<ShopperId>('guest');
  const { count, add } = useCart();
  const { showToast } = useToast();

  return (
    <div className="page">
      <header className="topbar">
        <Logo />
        <nav className="topbar__nav" aria-label="Departments">
          <a href="#gear">Packs</a>
          <a href="#gear">Footwear</a>
          <a href="#gear">Outerwear</a>
          <a href="#gear">Camp</a>
        </nav>
        <button className="cart-btn" onClick={() => setCheckoutOpen(true)}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M7 8V6a5 5 0 0 1 10 0v2M4 8h16l-1.2 12.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
          Pack
          <span className="cart-btn__count" aria-label={`${count} items`}>
            {count}
          </span>
        </button>
      </header>

      <section className="hero">
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
          <a className="btn btn--primary" href="#gear">
            Shop the trail kit
          </a>
        </div>
        <div className="hero__marker" aria-hidden="true">
          <span>EL. 6,643 FT</span>
          <span>MILE 12.4</span>
        </div>
      </section>

      <main id="gear" className="catalog">
        <div className="catalog__head">
          <h2>Trail kit</h2>
          <p className="muted">Free shipping on orders over $150</p>
        </div>
        <ul className="grid">
          {PRODUCTS.map((p, i) => (
            <li key={p.id} className="card" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="card__art" style={{ background: p.tone }}>
                <ProductArt kind={p.art} />
                <span className="card__cat">{p.category}</span>
              </div>
              <div className="card__body">
                <h3>{p.name}</h3>
                <p className="card__blurb">{p.blurb}</p>
                <div className="card__foot">
                  <span className="card__price">{formatPrice(p.price)}</span>
                  <button
                    className="btn btn--small"
                    onClick={() => {
                      add(p);
                      showToast({ tone: 'info', title: 'Added to your pack', body: p.name });
                    }}
                  >
                    Add to pack
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {count > 0 && (
          <div className="checkout-cta">
            <button className="btn btn--primary" onClick={() => setCheckoutOpen(true)}>
              Check out ({count})
            </button>
          </div>
        )}
      </main>

      <footer className="footer">
        <Logo />
        <p className="muted small">
          Switchback Supply is a fictional retailer built to demonstrate LaunchDarkly feature management.
        </p>
      </footer>

      <CheckoutDrawer open={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
      <ReleaseConsole shoppers={shoppers} activeShopper={activeShopper} onShopperChange={setActiveShopper} />
    </div>
  );
}
