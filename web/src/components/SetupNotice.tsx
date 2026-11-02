import { Logo } from './Brand';

/** Shown when VITE_LD_CLIENT_SIDE_ID is missing, instead of a broken storefront. */
export default function SetupNotice() {
  return (
    <main className="setup">
      <Logo />
      <h1>Almost at the trailhead</h1>
      <p>
        This storefront needs a LaunchDarkly client-side ID before it can evaluate feature flags.
      </p>
      <ol>
        <li>
          Copy <code>.env.example</code> to <code>.env</code> in the repository root.
        </li>
        <li>
          Paste your client-side ID into <code>VITE_LD_CLIENT_SIDE_ID</code>. Find it in LaunchDarkly: gear icon (lower left),
          All environments, your environment, SDK keys tab.
        </li>
        <li>
          Restart <code>npm run dev</code>.
        </li>
      </ol>
      <p className="muted">Full setup steps are in the README.</p>
    </main>
  );
}
