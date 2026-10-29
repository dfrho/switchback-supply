---
paths:
  - "tests/**/*"
  - "web/src/**/*.test.{ts,tsx}"
  - "playwright.config.ts"
  - "web/vitest.config.ts"
---

# Testing conventions

## Unit and component (Vitest + Testing Library, jsdom)

- Tests sit beside the code as `*.test.ts(x)` under `web/src`.
- Components that use the LaunchDarkly SDK are tested with a controllable stand-in for `@launchdarkly/react-sdk` built with `vi.hoisted` and `vi.mock` (see `CheckoutDrawer.test.tsx`). It must behave like the real SDK where it matters: hooks re-render when a value changes, `change:<key>` events reach subscribed listeners, `identify()` resolves after new values arrive.
- Cover the fallback (no value from LaunchDarkly), each variation, a live change, and listener cleanup with the same handler.

## End to end (Playwright, Chromium)

- `playwright.config.ts` starts three servers: the mock LaunchDarkly (`tests/mock-launchdarkly/server.mjs`, port 8787), the Vite dev server (5180), and a production build preview (5181). Specs run against both builds.
- Control flags through the `ld` fixture in `tests/e2e/fixtures.ts`: `ld.reset(flags, segments)`, `ld.setFlag(key, value)`, `ld.target(flag, contextKey, value)`, `ld.requests()`, `ld.eventPayloads()`. Reset at the start of every test.
- The mock evaluates a subset of targeting (flag off, individual targets, rules with `in`, `endsWith`, `segmentMatch`, rule-based segments, default rule). Extend the mock in the same PR when a feature needs more of LaunchDarkly's behavior, and document the addition in the header comment.
- Prefer role and label selectors. Scope to a region (drawer, Release Console) when labels repeat. Use `expect.poll` or web-first assertions instead of fixed waits.
- Keep the phone checks to the single focused group in `responsive.spec.ts` (the README explains this choice).
- Privacy checks are part of the suite: no context in any request URL, and the private `email` never appears in analytics events. Keep them passing.

## Before a PR

`npm run typecheck && npm run lint && npm test && npm run test:e2e`, then update the test counts in the README Testing table if they changed.
