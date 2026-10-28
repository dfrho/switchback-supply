import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useSearchParams } from 'react-router';
import { CATEGORIES } from '../data/catalog';
import type { ShopperId, ShopperProfile } from '../launchdarkly/contexts';
import { useCart } from '../state/Cart';
import { Logo } from './Brand';
import CheckoutDrawer from './CheckoutDrawer';
import ReleaseConsole from './ReleaseConsole';

interface Props {
  shoppers: Record<ShopperId, ShopperProfile>;
}

/** Scroll to the top on page changes, like a traditional site. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Braces matter: newer browsers return a value from scrollTo, and an effect may only return a cleanup function.
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/**
 * Site shell: header, page content, footer, plus two things that stay mounted
 * on every page: the checkout drawer (so its flag listener is always active)
 * and the Release Console.
 */
export default function Layout({ shoppers }: Props) {
  const [activeShopper, setActiveShopper] = useState<ShopperId>('guest');
  const { count, openCart } = useCart();
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const activeCategory = pathname === '/shop' ? params.get('category') : null;

  return (
    <div className="page">
      <ScrollToTop />
      <header className="topbar">
        <Link to="/" aria-label="Switchback Supply home">
          <Logo />
        </Link>
        <nav className="topbar__nav" aria-label="Departments">
          <NavLink to="/shop" className={() => (pathname === '/shop' && !activeCategory ? 'is-active' : '')} end>
            All gear
          </NavLink>
          {CATEGORIES.map((c) => (
            <Link key={c.id} to={`/shop?category=${c.id}`} className={activeCategory === c.id ? 'is-active' : ''}>
              {c.name}
            </Link>
          ))}
        </nav>
        <button className="cart-btn" onClick={openCart} aria-label={`Open your pack, ${count} ${count === 1 ? 'item' : 'items'}`}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M7 8V6a5 5 0 0 1 10 0v2M4 8h16l-1.2 12.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
          <span className="cart-btn__label">Pack</span>
          <span className="cart-btn__count" aria-hidden="true">
            {count}
          </span>
        </button>
      </header>

      <Outlet />

      <footer className="footer">
        <Logo />
        <p className="muted small">
          Switchback Supply is a fictional retailer built to demonstrate LaunchDarkly feature management. No real orders
          are placed.
        </p>
      </footer>

      <CheckoutDrawer />
      <ReleaseConsole shoppers={shoppers} activeShopper={activeShopper} onShopperChange={setActiveShopper} />
    </div>
  );
}
