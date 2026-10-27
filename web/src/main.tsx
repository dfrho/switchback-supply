import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createLDReactProvider } from '@launchdarkly/react-sdk';
import App from './App';
import SetupNotice from './components/SetupNotice';
import { LD_CLIENT_SIDE_ID } from './launchdarkly/config';
import { buildShoppers } from './launchdarkly/contexts';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

if (!LD_CLIENT_SIDE_ID) {
  // No client-side ID yet: show setup instructions instead of a broken store.
  root.render(<SetupNotice />);
} else {
  const shoppers = buildShoppers();

  /**
   * createLDReactProvider creates the LaunchDarkly client, starts it, and places it
   * in React context so any component can use the SDK hooks.
   *
   * streaming: true keeps a persistent connection open so flag changes are pushed
   * to the browser the moment they happen. This is what makes releases and
   * rollbacks instant, with no page reload. (The SDK also opens the stream on its
   * own when a component subscribes to change events; setting it explicitly makes
   * the behavior obvious to anyone reading this code.)
   */
  const LDProvider = createLDReactProvider(LD_CLIENT_SIDE_ID, shoppers.guest.context, {
    ldOptions: {
      streaming: true,
      // Keep flag keys exactly as they appear in LaunchDarkly, which also keeps
      // Code References accurate.
      useCamelCaseFlagKeys: false,
    },
  });

  root.render(
    <StrictMode>
      <LDProvider>
        <App shoppers={shoppers} />
      </LDProvider>
    </StrictMode>,
  );
}
