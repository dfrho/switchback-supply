import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LandingHero, { HERO_WAIT_MS } from './LandingHero';

const ld = vi.hoisted(() => ({ heroValue: undefined as boolean | undefined, status: 'complete' as string }));

vi.mock('@launchdarkly/react-sdk', () => ({
  useBoolVariation: (_key: string, fallback: boolean) => ld.heroValue ?? fallback,
  useInitializationStatus: () => ({ status: ld.status }),
}));

const renderHero = () =>
  render(
    <MemoryRouter>
      <LandingHero />
    </MemoryRouter>,
  );

const heroKind = () => document.querySelector('[data-hero]')?.getAttribute('data-hero');

describe('LandingHero (release-landing-hero)', () => {
  beforeEach(() => {
    ld.heroValue = undefined;
    ld.status = 'complete';
  });
  afterEach(() => vi.useRealTimers());

  it('shows the current hero when the flag is false', () => {
    ld.heroValue = false;
    renderHero();
    expect(heroKind()).toBe('current');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/long way up/i);
  });

  it('shows the Winter-Ready hero, with three product links, when the flag is true', () => {
    ld.heroValue = true;
    renderHero();
    expect(heroKind()).toBe('winter-ready');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Winter-ready/i);
    expect(screen.getAllByRole('link', { name: /\$/ })).toHaveLength(3);
  });

  it('holds a placeholder while LaunchDarkly connects, so the wrong hero never flashes', () => {
    ld.status = 'initializing';
    renderHero();
    expect(heroKind()).toBeUndefined();
    expect(screen.getByLabelText('Loading featured content')).toHaveAttribute('aria-busy', 'true');
  });

  it('falls back to the current hero if LaunchDarkly is still not ready after the wait', () => {
    vi.useFakeTimers();
    ld.status = 'initializing';
    renderHero();
    act(() => vi.advanceTimersByTime(HERO_WAIT_MS + 1));
    expect(heroKind()).toBe('current');
  });
});
