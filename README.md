# Switchback Supply

**A LaunchDarkly sample app for a fictional outdoor gear retailer.** It shows how a team ships features faster without adding risk: release a new checkout to production behind a feature flag, test it there with internal users first, and roll it back in under a second when something goes wrong, with no deploy and no page reload.

Switchback Supply plays the role of "ABC Company" from the exercise brief. Each section is written for the persona the brief names, the way it would be handed to a prospective customer.

| Section | Persona | What it shows | Status |
|---|---|---|---|
| Storefront | All | 25-product catalog with color and size variants, product pages, a persistent cart | Done |
| **Part 1: Release and Remediate** | Engineering manager | Flag-wrapped checkout, live listener, test in production, flag trigger remediation | Done |
| Part 2: Target | Developer | Landing page component, contexts with attributes, individual and rule-based targeting | Next |
| Extra credit 1 | Engineering manager | Observability plus a guarded rollout that rolls itself back | Planned |
| Extra credit 2 | AI product manager | AgentControl (AI Configs) shopping assistant on Anthropic Claude | Planned |

---

## Part 1: Release and Remediate

### The business problem

Competitors are catching up, and leadership wants features shipped faster. Switchback Supply's reputation rests on quality, so speed cannot come at the cost of risk. The engineering manager needs three things:

1. **Test in production before customers see it.** Ship the code dark, then turn it on only for internal QA.
2. **Release instantly.** Flip a switch and every shopper gets the new experience, without a redeploy.
3. **Roll back instantly.** If a bug slips through, turn the feature off in seconds, ideally without anyone logging into anything.

### What you will see

A working outdoor gear store: 25 products across six categories, each with a product page, color and size pickers, live stock levels, and a cart that survives a page refresh. The store's checkout is wrapped in one boolean feature flag, `release-new-checkout`:

| Flag value | Checkout shoppers get |
|---|---|
| `false` (default, and the fallback if LaunchDarkly is unreachable) | **Classic checkout**: three steps (shipping, payment, review) |
| `true` | **Express checkout**: one page, saved address and card, one-tap order |

A **Release Console** in the bottom-left corner shows the SDK connection status, the flag's live value, who the SDK thinks you are, and a timestamped log written by the flag change listener. It exists only to make LaunchDarkly visible during a demo.

---

## Quick start

If you already have a LaunchDarkly account and the flag set up (steps 1 to 4 below):

```bash
git clone https://github.com/dfrho/switchback-supply.git
cd switchback-supply
cp .env.example .env        # then paste your client-side ID and trigger URL into .env
npm install
npm run dev                 # open http://localhost:5173
```

---

## Prerequisites and assumptions

- **Node.js 20.19 or newer** (`node -v` to check). Developed on Node 22.
- **npm 10 or newer** (bundled with Node).
- **macOS, Linux, or Windows with WSL or Git Bash.** The remediation script uses `bash` and `curl`, both standard on macOS and Linux.
- **A modern browser** (Chrome, Edge, Firefox, or Safari). Some ad or privacy blockers block requests to LaunchDarkly; if the console says "Timed out," allow `launchdarkly.com` for `localhost`.
- **A LaunchDarkly account.** A free trial works: [launchdarkly.com/start-trial](https://launchdarkly.com/start-trial/). Flag triggers are an Enterprise feature, which the trial includes.
- Port **5173** is free on your machine.

---

## Setup, step by step

### Step 1: Pick a LaunchDarkly project and environment

Any project works. These instructions use the **Test** environment. Whatever you choose, use the same environment in every step.

### Step 2: Copy your client-side ID

In LaunchDarkly, open **Settings > (your project) > (your environment) > SDK keys**. Under **Client-side IDs**, copy the ID.

The client-side ID is **not a secret**. It is designed to ship in browser code. Do not use the **SDK key** here: that one is secret and belongs only on servers.

### Step 3: Recreate the feature flag

Create a flag with **exactly** these settings:

| Setting | Value |
|---|---|
| Name | Release new checkout |
| Key | `release-new-checkout` |
| Type | Boolean (`true` / `false`) |
| Off variation | `false` |
| **Available on client-side SDKs** | **On** (in the flag's right sidebar, under Advanced controls) |
| Permanent flag | Off (this is a temporary release flag, to be removed after full rollout) |

> If "Available on client-side SDKs" is off, the browser silently receives the fallback value (`false`) and the flag will appear to do nothing. This is the most common setup mistake.

Leave the flag **Off** for now.

### Step 4: Create the remediation trigger

1. Open the flag, select your environment, and open the environment's **three-dot menu > Configuration in environment**.
2. In **Triggers**, click **Add trigger**.
3. Choose **Generic trigger**, set the action to **turn the flag off**, and save.
4. **Copy the URL immediately.** LaunchDarkly hides it once you leave the page. If you lose it, reset the trigger to get a new one.

Treat the trigger URL like a password: anyone who has it can turn the flag off.

### Step 5 (optional): Target the internal QA tester

To test in production, give QA the new checkout before anyone else:

1. Open the flag's **Targeting** tab in your environment.
2. Under **Individual targets**, add the context key `qa-tester-001` to the **true** variation.
3. Leave the default rule serving **false**, turn the flag **On**, and save.

Now only `qa-tester-001` sees Express checkout. Everyone else still gets Classic.

### Step 6: Configure your environment file

```bash
cp .env.example .env
```

Open `.env` and fill in both values:

```bash
VITE_LD_CLIENT_SIDE_ID=your-client-side-id
LD_TRIGGER_URL_CHECKOUT_OFF=your-generic-trigger-url
```

`.env` is git-ignored. The trigger URL is deliberately **not** prefixed with `VITE_`, because Vite bundles every `VITE_` variable into public browser code.

### Step 7: Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Release Console should show **SDK: Streaming**.

---

## Demo walkthrough (about 3 minutes)

Keep LaunchDarkly open in one window and the storefront in another, side by side.

**1. Test in production.** Open any product, pick a size, and click **Add to pack**. The checkout drawer opens; confirm you see **Classic checkout**. In the Release Console, switch **Shopping as** to **Internal QA tester**. The drawer swaps to **Express checkout**, with no reload. Switch back to Guest: Classic again. Same production code, two audiences. *(Requires Step 5.)*

**2. Release.** In LaunchDarkly, set the default rule to serve **true** and save. Within a moment, every shopper gets Express checkout. A toast announces the release and the listener log records it.

**3. Roll back from the dashboard.** Turn the flag **Off**. Everyone is instantly back on Classic checkout.

**4. Remediate from the command line.** Turn the flag back **On**, then simulate an incident:

```bash
npm run remediate -- "Payment errors spiking on Express checkout"
```

The trigger turns the flag off, the storefront reverts live, and the flag's **History** in LaunchDarkly records the change with your incident label. This is the same call a monitoring tool such as Datadog or New Relic would make automatically when an alert fires.

---

## How it works

### 1. One client, one stream: `web/src/main.tsx`

```tsx
const LDProvider = createLDReactProvider(LD_CLIENT_SIDE_ID, shoppers.guest.context, {
  ldOptions: { streaming: true, useCamelCaseFlagKeys: false },
});
```

`createLDReactProvider` (React Web SDK v4) creates the LaunchDarkly client, starts it, and places it in React context. `streaming: true` keeps a persistent connection open, so LaunchDarkly **pushes** flag changes to the browser instead of the app polling for them. That push is what makes releases and rollbacks instant.

### 2. The flag and the listener: `web/src/components/CheckoutDrawer.tsx`

```tsx
// Release: the live flag value. Re-renders this component when the flag changes.
const showNewCheckout = useBoolVariation('release-new-checkout', false);

// Listener: an explicit subscription to this one flag's change event.
useEffect(() => {
  const handleCheckoutFlagChange = () => {
    const isOn = ldClient.boolVariation('release-new-checkout', false);
    showToast(/* release or rollback */);
    logEvent(/* timestamped entry for the Release Console */);
  };
  ldClient.on('change:release-new-checkout', handleCheckoutFlagChange);
  return () => ldClient.off('change:release-new-checkout', handleCheckoutFlagChange);
}, [ldClient, showToast, logEvent]);

return showNewCheckout ? <NewCheckout /> : <ClassicCheckout />;
```

- `useBoolVariation` alone already meets "switch instantly with no page reload": when LaunchDarkly pushes a change, only the components using that flag re-render.
- The explicit `change:release-new-checkout` listener makes the mechanism visible. The event carries the context, not the value, so the handler reads the new value back with `boolVariation`.
- The cleanup function unsubscribes with the same function reference, so listeners never pile up.
- The fallback `false` means shoppers get the known-good Classic checkout if LaunchDarkly is ever unreachable.

### 3. Contexts and test in production: `web/src/launchdarkly/contexts.ts`

Guests get an anonymous context with a random, device-stable key (no personal data, and a consistent experience across visits). The QA tester has a fixed key, `qa-tester-001`, which is what individual targeting matches. The Release Console switches between them with `ldClient.identify()`, which swaps the context and refetches flag values without a reload.

### 4. Remediation: `scripts/remediate.sh`

A `POST` to the Generic trigger URL with an optional JSON body (`eventName`, `url`) that labels the change in flag history. The script reads only `LD_TRIGGER_URL_CHECKOUT_OFF` from `.env` and never prints it.

### Where to change things

| To change | Edit |
|---|---|
| Flag key or fallback value | `web/src/launchdarkly/config.ts` |
| Client-side ID | `.env` (`VITE_LD_CLIENT_SIDE_ID`) |
| QA tester key | `web/src/launchdarkly/contexts.ts` |
| Products, prices, colors, sizes | `scripts/catalog-source.py`, then run `npm run catalog` |
| Product photos | Add `web/public/products/<product-id>.webp`, then run `npm run catalog` |
| Trigger URL | `.env` (`LD_TRIGGER_URL_CHECKOUT_OFF`) |

---

## Beyond the manual trigger

A manual trigger is the first step on a remediation ladder that enterprise teams climb:

1. **Flag trigger** (this part): a person, or a monitoring tool, calls a URL to turn the feature off.
2. **Kill switch flag**: a permanent flag that guards a risky dependency long after launch.
3. **Guarded rollout**: LaunchDarkly ramps the release gradually, watches error rate and business metrics, and **rolls back on its own** when a regression appears. No human in the loop. *(Extra credit 1 in this repo.)*

---

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Page shows "Almost at the trailhead" | `VITE_LD_CLIENT_SIDE_ID` is empty. Fill in `.env` and restart `npm run dev`. |
| Console shows "Timed out" or "Failed" | Wrong client-side ID, no network, or a browser extension blocking LaunchDarkly. The app keeps working on fallback values. |
| Flag changes do nothing | "Available on client-side SDKs" is off for the flag, or the flag lives in a different environment than your client-side ID. |
| QA tester does not get Express checkout | The flag must be **On** for individual targets to apply, and the key must be exactly `qa-tester-001`. |
| `npm run remediate` fails with HTTP 404 | The trigger was reset or deleted. Create or reset it and update `.env`. |

---

## Project structure

```
switchback-supply/
  data/catalog.json             25 products, 109 SKUs (generated; shared with the server later)
  web/                          React 19 + Vite + TypeScript storefront
    src/main.tsx                LaunchDarkly provider setup
    src/launchdarkly/           Flag keys, fallbacks, and contexts
    src/pages/                  Home, shop, product page, not found
    src/components/             Layout, product cards, checkout variants, Release Console
    src/state/                  Cart (persisted by SKU), toasts, and the listener log
    public/products/            Product photos (WebP, 800 x 800)
  scripts/remediate.sh          Calls the flag trigger (Part 1 remediation)
  scripts/catalog-source.py     Product copy, prices, and variants; generates data/catalog.json
  scripts/validate-catalog.mjs  Catalog checks run in CI
  vercel.json                   Build settings and single-page app routing for Vercel
  .github/workflows/ci.yml    Typecheck, lint, build, and a committed-secrets guard
  .env.example                Configuration template
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the storefront on http://localhost:5173 |
| `npm run build` | Typecheck and build for production |
| `npm run typecheck` | TypeScript check only |
| `npm run lint` | Lint with oxlint |
| `npm run remediate -- "label"` | Turn the checkout flag off through its trigger |
| `npm run catalog` | Regenerate `data/catalog.json` from `scripts/catalog-source.py` (needs Python 3) |
| `npm run validate:catalog` | Check the catalog for duplicate SKUs, bad prices, and missing images |

## LaunchDarkly documentation used

- [React Web SDK reference (v4)](https://launchdarkly.com/docs/sdk/client-side/react/react-web) and the [React SDK 4.0 changelog](https://launchdarkly.com/changelog/react-sdk-4-0-0/)
- [Subscribing to flag changes](https://launchdarkly.com/docs/sdk/features/flag-changes)
- [Flag triggers](https://launchdarkly.com/docs/home/releases/triggers) and [Creating flag triggers](https://launchdarkly.com/docs/home/releases/triggers-create)
- [Individual targeting](https://launchdarkly.com/docs/home/flags/individual-targeting)
- [Anonymous contexts](https://launchdarkly.com/docs/sdk/features/anonymous) and [Identifying contexts](https://launchdarkly.com/docs/sdk/features/identify)
- [Kill switch flags](https://launchdarkly.com/docs/home/flags/killswitch) and [Guarded rollouts](https://launchdarkly.com/docs/home/releases/guarded-rollouts)

## About the catalog

Switchback Supply and every product are fictional. Product photos were generated with Leonardo.ai from prompts that exclude logos and text, then converted to 800 x 800 WebP (about 30 KB each). Prices, specs, and stock levels are invented. A few SKUs are deliberately sold out or low in stock, so product pages show real availability states. Both checkouts use the same shipping rule (free over $150, otherwise $8), so the feature flag changes the experience, never the price.

## How this was built

Built by David Rhodes with Claude Code as a pair programmer. Claude researched the current LaunchDarkly documentation and drafted each pull request; David reviewed, ran, and tested every change against a live LaunchDarkly environment before merging.

## License

MIT. Switchback Supply is fictional. Product names and illustrations are invented for this demo.
