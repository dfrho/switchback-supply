import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPersonas } from '../launchdarkly/contexts';
import { ReleaseLogProvider } from '../state/ReleaseLog';
import { ShopperProvider } from '../state/Shopper';
import ReleaseConsole from './ReleaseConsole';

/**
 * A stand-in for the LaunchDarkly React SDK. These tests are about the console's
 * shopper controls, so flag values are fixed; what matters is which context the
 * console hands to identify().
 */
const ld = vi.hoisted(() => ({
  client: { identify: vi.fn(async (_context: Record<string, unknown>) => ({ status: 'completed' })) },
}));

vi.mock('@launchdarkly/react-sdk', () => ({
  useLDClient: () => ld.client,
  useInitializationStatus: () => ({ status: 'complete' }),
  useBoolVariation: () => false,
  useBoolVariationDetail: () => ({ value: false, reason: { kind: 'FALLTHROUGH' } }),
}));

function renderConsole() {
  render(
    <ReleaseLogProvider>
      <ShopperProvider personas={buildPersonas()}>
        <ReleaseConsole />
      </ShopperProvider>
    </ReleaseLogProvider>,
  );
}

/** The context passed to the most recent identify() call. */
const lastIdentified = () => ld.client.identify.mock.calls.at(-1)?.[0];

const contextKeyLine = () => screen.getByTestId('context-key');

async function openAs(personaId: string) {
  await userEvent.click(screen.getByRole('button', { name: /Release console/ }));
  await userEvent.selectOptions(screen.getByLabelText('Persona'), personaId);
}

describe('Release Console: resetting an edited shopper', () => {
  beforeEach(() => {
    ld.client.identify.mockClear();
    window.localStorage.clear();
  });

  it('shows no Reset while the persona is unedited', async () => {
    renderConsole();
    await openAs('beta');
    expect(contextKeyLine()).not.toHaveTextContent('edited');
    expect(screen.queryByRole('button', { name: /^Reset / })).not.toBeInTheDocument();
  });

  it('marks an attribute edit and offers Reset', async () => {
    renderConsole();
    await openAs('beta');
    await userEvent.click(screen.getByRole('switch', { name: 'Beta tester' }));
    expect(contextKeyLine()).toHaveTextContent('edited');
    expect(screen.getByRole('button', { name: 'Reset Beta tester, Seattle to its original attributes' })).toBeInTheDocument();
    expect(lastIdentified()).toMatchObject({ key: 'shopper-beta-001', betaTester: false });
  });

  it("Reset restores the persona's original attributes and tells LaunchDarkly", async () => {
    renderConsole();
    await openAs('beta');
    await userEvent.click(screen.getByRole('switch', { name: 'Beta tester' }));
    await userEvent.click(screen.getByRole('switch', { name: /Employee email/ }));
    expect(lastIdentified()).toMatchObject({ betaTester: false, email: 'merch@switchbacksupply.test' });

    await userEvent.click(screen.getByRole('button', { name: /^Reset / }));

    await waitFor(() => expect(contextKeyLine()).not.toHaveTextContent('edited'));
    expect(screen.getByRole('switch', { name: 'Beta tester' })).toBeChecked();
    expect(screen.getByRole('switch', { name: /Employee email/ })).not.toBeChecked();
    expect(screen.queryByRole('button', { name: /^Reset / })).not.toBeInTheDocument();
    const restored = lastIdentified();
    expect(restored).toMatchObject({ key: 'shopper-beta-001', betaTester: true, state: 'WA' });
    expect(restored).not.toHaveProperty('email');
  });

  it('Reset brings back an edited state, so the Gold member is in the Central region again', async () => {
    renderConsole();
    await openAs('gold');
    await userEvent.selectOptions(screen.getByLabelText('State'), 'CA');
    expect(lastIdentified()).toMatchObject({ key: 'shopper-gold-001', state: 'CA' });

    await userEvent.click(screen.getByRole('button', { name: 'Reset Gold member, Nashville to its original attributes' }));

    await waitFor(() => expect(lastIdentified()).toMatchObject({ key: 'shopper-gold-001', loyaltyTier: 'gold', state: 'TN' }));
    expect(screen.getByLabelText('State')).toHaveValue('TN');
  });
});
