import { act, render, screen, within } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PRODUCTS } from '../data/catalog';
import { CartProvider, useCart } from '../state/Cart';
import { ReleaseLogProvider, useReleaseLog } from '../state/ReleaseLog';
import { ToastProvider } from '../state/Toasts';
import { ShopperProvider, useShopper } from '../state/Shopper';
import { buildPersonas } from '../launchdarkly/contexts';
import CheckoutDrawer from './CheckoutDrawer';

/**
 * A controllable stand-in for the LaunchDarkly React SDK. It behaves like the
 * real one where it matters: the hook re-renders when the flag value changes,
 * and the client emits "change:<flag-key>" events to subscribed listeners.
 */
const ld = vi.hoisted(() => {
  const flags: Record<string, boolean> = {};
  const hookSubscribers = new Set<() => void>();
  const listeners = new Map<string, Set<() => void>>();
  const client = {
    on: vi.fn((event: string, fn: () => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(fn);
    }),
    off: vi.fn((event: string, fn: () => void) => listeners.get(event)?.delete(fn)),
    boolVariation: vi.fn((key: string, fallback: boolean) => flags[key] ?? fallback),
    getInitializationState: vi.fn(() => 'complete'),
    // identify() resolves after LaunchDarkly evaluates the new context. Tests set
    // nextIdentifyFlags to simulate the values LaunchDarkly returns for that shopper.
    identify: vi.fn(async () => {
      if (state.nextIdentifyFlags) {
        for (const [key, value] of Object.entries(state.nextIdentifyFlags)) {
          flags[key] = value;
          hookSubscribers.forEach((notify) => notify());
          listeners.get(`change:${key}`)?.forEach((fn) => fn());
        }
      }
      return { status: 'completed' };
    }),
  };
  const state: { nextIdentifyFlags?: Record<string, boolean> } = {};
  return {
    flags,
    hookSubscribers,
    listeners,
    client,
    /** Mirrors the SDK: update the stored value, re-render hooks, then emit the change event. */
    setFlag(key: string, value: boolean) {
      flags[key] = value;
      hookSubscribers.forEach((notify) => notify());
      listeners.get(`change:${key}`)?.forEach((fn) => fn());
    },
    listenerCount: (event: string) => listeners.get(event)?.size ?? 0,
    state,
  };
});

vi.mock('@launchdarkly/react-sdk', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useLDClient: () => ld.client,
    useBoolVariation: (key: string, fallback: boolean) =>
      useSyncExternalStore(
        (notify) => {
          ld.hookSubscribers.add(notify);
          return () => ld.hookSubscribers.delete(notify);
        },
        () => ld.flags[key] ?? fallback,
      ),
  };
});

const FLAG = 'release-new-checkout';
const bottle = PRODUCTS.find((p) => p.id === 'canyon-bottle')!;

/** Puts one item in the cart and opens the drawer, like a shopper clicking Add to pack. */
function OpenWithItem() {
  const { add, openCart } = useCart();
  useEffect(() => {
    add(bottle.variants[0].sku);
    openCart();
  }, [add, openCart]);
  return null;
}

function LogCount() {
  const { events } = useReleaseLog();
  return <output data-testid="log-count">{events.length}</output>;
}

/** Exposes persona switching to tests. */
let switchPersona: ((id: 'qa') => Promise<void>) | undefined;
function PersonaHandle() {
  const { choosePersona } = useShopper();
  useEffect(() => {
    switchPersona = choosePersona;
  }, [choosePersona]);
  return null;
}

function renderDrawer() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <ReleaseLogProvider>
          <ShopperProvider personas={buildPersonas()}>
            <CartProvider>
              <OpenWithItem />
              <CheckoutDrawer />
              <LogCount />
              <PersonaHandle />
            </CartProvider>
          </ShopperProvider>
        </ReleaseLogProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

const drawer = () => screen.getByRole('complementary', { name: 'Checkout' });
const badge = () => within(drawer()).getByText(/^(Classic|Express) checkout$/, { selector: '.variant-tag' });

describe('CheckoutDrawer feature flag', () => {
  beforeEach(() => {
    for (const key of Object.keys(ld.flags)) delete ld.flags[key];
    ld.listeners.clear();
    ld.client.on.mockClear();
    ld.client.off.mockClear();
    ld.state.nextIdentifyFlags = undefined;
  });

  it('serves the Classic checkout when the flag is false', () => {
    ld.flags[FLAG] = false;
    renderDrawer();
    expect(badge()).toHaveTextContent('Classic checkout');
    expect(screen.getByRole('button', { name: 'Continue to payment' })).toBeInTheDocument();
  });

  it('serves the Express checkout when the flag is true', () => {
    ld.flags[FLAG] = true;
    renderDrawer();
    expect(badge()).toHaveTextContent('Express checkout');
    expect(screen.getByRole('button', { name: /^Place order, \$/ })).toBeInTheDocument();
  });

  it('falls back to Classic when LaunchDarkly has no value for the flag', () => {
    renderDrawer();
    expect(badge()).toHaveTextContent('Classic checkout');
  });

  it('subscribes to this flag only, not to every flag change', () => {
    renderDrawer();
    expect(ld.client.on).toHaveBeenCalledWith(`change:${FLAG}`, expect.any(Function));
    expect(ld.client.on).not.toHaveBeenCalledWith('change', expect.any(Function));
    expect(ld.listenerCount(`change:${FLAG}`)).toBe(1);
  });

  it('swaps to Express live when the flag is released, then announces and logs it', () => {
    ld.flags[FLAG] = false;
    renderDrawer();
    act(() => ld.setFlag(FLAG, true));
    expect(badge()).toHaveTextContent('Express checkout');
    expect(screen.getByText('New checkout released')).toBeInTheDocument();
    expect(screen.getByTestId('log-count')).toHaveTextContent('1');
  });

  it('swaps back to Classic live when the flag is rolled back', () => {
    ld.flags[FLAG] = true;
    renderDrawer();
    act(() => ld.setFlag(FLAG, false));
    expect(badge()).toHaveTextContent('Classic checkout');
    expect(screen.getByText('Checkout rolled back')).toBeInTheDocument();
  });

  it('labels a change caused by switching shoppers as a switch, not a release', async () => {
    ld.flags[FLAG] = false;
    renderDrawer();
    ld.state.nextIdentifyFlags = { [FLAG]: true };
    await act(async () => {
      await switchPersona!('qa');
    });
    expect(badge()).toHaveTextContent('Express checkout');
    expect(screen.getByText('Shopper switched')).toBeInTheDocument();
    expect(screen.queryByText('New checkout released')).not.toBeInTheDocument();
  });

  it('stays quiet when a change event carries the value the shopper already has', () => {
    ld.flags[FLAG] = false;
    renderDrawer();
    act(() => ld.setFlag(FLAG, false));
    expect(screen.queryByText('Checkout rolled back')).not.toBeInTheDocument();
    expect(screen.getByTestId('log-count')).toHaveTextContent('0');
  });

  it('stays quiet while LaunchDarkly is still loading initial values', () => {
    ld.client.getInitializationState.mockReturnValueOnce('initializing');
    ld.flags[FLAG] = false;
    renderDrawer();
    act(() => ld.setFlag(FLAG, true));
    expect(screen.queryByText('New checkout released')).not.toBeInTheDocument();
    expect(badge()).toHaveTextContent('Express checkout');
  });

  it('keeps the cart intact across a flag change', () => {
    ld.flags[FLAG] = false;
    renderDrawer();
    act(() => ld.setFlag(FLAG, true));
    expect(within(drawer()).getByText(bottle.name)).toBeInTheDocument();
  });

  it('removes its listener with the same function when unmounted', () => {
    const { unmount } = renderDrawer();
    const handler = ld.client.on.mock.calls.find(([event]) => event === `change:${FLAG}`)![1];
    unmount();
    expect(ld.client.off).toHaveBeenCalledWith(`change:${FLAG}`, handler);
    expect(ld.listenerCount(`change:${FLAG}`)).toBe(0);
  });
});
