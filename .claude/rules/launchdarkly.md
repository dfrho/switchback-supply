---
paths:
  - "web/src/**/*.{ts,tsx}"
  - "scripts/ld-*.mjs"
  - "api/**/*.ts"
---

# LaunchDarkly SDK conventions

## Browser (React SDK v4)

- Package is `@launchdarkly/react-sdk` (v4). Use `createLDReactProvider` and the typed hooks: `useBoolVariation`, `useBoolVariationDetail`, `useLDClient`, `useInitializationStatus`. Do not use v3 APIs (`withLDProvider`, `asyncWithLDProvider`, `LDProvider`, `useFlags`); many online examples still show them.
- Provider options live in `web/src/main.tsx` under `ldOptions`: `streaming: true`, `useReport: true`, `withReasons: true`, `useCamelCaseFlagKeys: false`, plus optional `baseUri` / `streamUri` / `eventsUri` from `VITE_LD_*` (Relay Proxy style; the e2e tests point these at the mock). Keep these settings unless the user decides otherwise.
- Read flags only through keys and fallbacks in `web/src/launchdarkly/config.ts`. A new flag needs: a key in `FLAGS`, a fallback in `FALLBACKS`, a comment saying how to recreate it in LaunchDarkly (type, variations, off variation, "Available on client-side SDKs"), and a README setup step.
- Explicit listeners: subscribe to `change:<flag-key>` (never the global `change`) in a `useEffect`, read the value with `ldClient.boolVariation(key, fallback)`, and remove the same handler with `off` in the cleanup. Ignore events while the SDK is initializing and events that do not change the value (see `CheckoutDrawer.tsx`), so a page load or a shopper switch is never announced as a release.
- Custom events: `ldClient.track(METRIC_EVENTS.x, data, metricValue)` with a key from `METRIC_EVENTS` in `config.ts`; the metrics built on it are defined in `scripts/ld-metrics.mjs` (created by `ld:setup`). No personal data in `data`.
- Contexts come only from `toLDContext()` in `contexts.ts`: kind `user`, keys without personal data, `email` always in `_meta.privateAttributes`, empty values omitted so rules on missing attributes simply do not match. Change shoppers only through `ShopperProvider` (it calls `identify` and marks the change as a shopper switch).
- The Release Console explains targeting from LaunchDarkly's evaluation reason (`explain.ts`). Do not reimplement targeting logic in the app.
- First-paint flicker: `LandingHero` holds a placeholder for up to `HERO_WAIT_MS` while initializing. Bootstrapping from server-side evaluation is the documented production fix.

## Server and scripts

- Server-side keys (`LD_SDK_KEY`, `LD_API_TOKEN`, `ANTHROPIC_API_KEY`, trigger URLs) are read from `process.env` or the repo-root `.env` and are never prefixed with `VITE_`.
- The Node server SDK client must be a singleton, created once per process (not per request); on short-lived serverless functions, flush events with `waitUntil(ld.flush())` (see `server/runtime.ts` and `server/http.ts`).
- AgentControl: evaluate `completionConfig` per request with the shopper's context (built by `toLDContext()` via `server/shopper.ts`), always with the disabled fallback; one tracker per answer; feedback through the signed resumption token. Server logic takes injected dependencies so it is unit tested with fakes.
- REST API changes go through `scripts/ld-setup.mjs` patterns: `LD-API-Version: 20240415`, semantic patch with "replace" instructions so reruns converge, a `--dry-run`, an environment check against `VITE_LD_CLIENT_SIDE_ID`, and clear errors for 401 and 403. Configuration data belongs in a separate module (like `ld-targeting.mjs`) that a unit test can compare with the app.

## Comments

The brief asks for comments that tell a reviewer where to replace keys and which flags to recreate. Keep the `SETUP:` and `RECREATE THIS FLAG:` comment style already used in `config.ts`, `main.tsx`, and `remediate.sh`. Explain the why in plain words; link a LaunchDarkly doc page when behavior depends on it.
