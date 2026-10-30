# Demo runbook

A 12-minute live demo of Switchback Supply on the live site, with a checklist to run beforehand and recovery steps for when something misbehaves. Each part follows the README's walkthrough; this page puts them in one order with the setup they need.

Live site: https://web-puce-kappa-92.vercel.app (LaunchDarkly **Test** environment).

## 30 minutes before

**Browser**
- [ ] Use a **clean Chrome profile** with no extensions. Ad blockers (Brave Shields, uBlock, NordVPN Threat Protection) block `events.launchdarkly.com`: flags still work, but Live events, Contexts, metrics, and experiment results stay empty.
- [ ] Open the live site. The Release Console (bottom left) shows **Connected** and **Streaming**. Leave it collapsed.
- [ ] Shopping as **Guest shopper**, cart empty.

**LaunchDarkly tabs** (Test environment selected in each)
- [ ] Flags > `release-new-checkout`
- [ ] Flags > `release-landing-hero`
- [ ] Agents > Configs > `shopping-assistant` (Targeting and Monitoring tabs)
- [ ] Experimentation > Experiments > the trail guide experiment (Results tab)
- [ ] Measurement > Metrics > Checkout completed (Activity tab)

**Starting state**
- [ ] `release-new-checkout`: **Off**, default rule serves **true**. Turning it On is then the release.
- [ ] `release-landing-hero`: **On**, targeting as `npm run ld:setup` sets it (QA tester, three rules, default false). Rerun `npm run ld:setup` if anything was edited by hand.
- [ ] `shopping-assistant`: targeting **On**. If the experiment is still running, its default rule is a three-way split: show the results instead of editing variations live (see Part 3).
- [ ] Trial still active (it ends around November 10, 2026).

**Terminal**
- [ ] A terminal open in the repo with `.env` in place, ready for `npm run remediate`.
- [ ] Optional fallback: `npm run dev` running locally (http://localhost:5173) in case the live site or the venue network fails.

## The demo (about 12 minutes)

### Part 1: Release and remediate (4 minutes)

1. Open a product, choose a size, **Add to pack**. The drawer shows **Classic checkout**. Leave it open.
2. **Release:** in LaunchDarkly, turn `release-new-checkout` **On** and save. The open drawer becomes **Express checkout** with no reload; a toast and the Release Console log record it.
3. **Roll back:** turn it **Off**. Classic returns instantly.
4. **Remediate:** turn it **On** again, then in the terminal:
   ```bash
   npm run remediate -- "Payment errors spiking on Express checkout"
   ```
   The drawer reverts to Classic. Show the flag's **History**: the trigger's change, labeled with the incident.
5. **Measure:** place an order (Express is one tap). Show **Metrics > Checkout completed > Activity**: the event arrives with its order total. Say why: these metrics let a guarded rollout or experiment judge Express against Classic on conversion and dollars, not just on/off.

### Part 2: Target (3 minutes)

Go to the home page and expand the Release Console.

1. **Guest shopper:** current hero, "default rule served".
2. **Internal QA tester:** Winter-Ready hero, "individually targeted".
3. **Employee**, **Beta tester**, **Gold member**: each matches a different rule (private email attribute, segment, two-clause rule). The console shows LaunchDarkly's own evaluation reason.
4. As the Gold member, change **State** to CA: falls through to the default rule. That is attributes, not code, deciding.

### Part 3: AI configs (4 minutes)

1. Open the **Trail guide** (header) and ask "Weekend in the Tennessee mountains in November. What do I pack?" Point at the product cards and the label under the answer: model and variation, chosen by LaunchDarkly.
2. **Kill switch:** turn `shopping-assistant` targeting **Off**, ask again: a polite fallback, no model called. Turn it back **On**.
3. **Monitoring:** tokens, time to generate, cost, and thumbs, by variation.
4. **Experiment:** open the Results tab. Lead with the business question (can a better prompt match a bigger model at a fraction of the cost?), the primary metric, and the response-time guardrail. Mention that the shoppers are synthetic but every answer is a real model reply.
5. **Only if no experiment is running:** set the default rule to **Treatment B** and ask again: the label changes to Sonnet with no deploy. Set it back to **Control**.

### Close (1 minute)

One shopper context drives the checkout release, the hero targeting, and the AI configuration, for three audiences (engineering, product, AI), and every change in the demo was made in LaunchDarkly without a deploy.

## If something goes wrong

| Symptom | Fix |
|---|---|
| A flag change does not reach the page | Check the dashboard is on **Test**. Check the Release Console says Streaming. Reload once. |
| Contexts, Live events, or metrics stay empty | An ad blocker is on. Switch to the clean profile. |
| `npm run remediate` fails | The trigger URL was reset. Copy the new URL into `.env` (`LD_TRIGGER_URL_CHECKOUT_OFF`), or turn the flag off in the dashboard and explain what the trigger would do. |
| The trail guide only gives the fallback | Config targeting is Off, or `LD_SDK_KEY` / `ANTHROPIC_API_KEY` is missing in Vercel. Use the local dev server, or show Monitoring instead. |
| The hero does not match the expected rule | Someone edited targeting by hand. Run `npm run ld:setup` to restore it. |
| The live site or the network is down | Use `npm run dev` on localhost (needs `.env`); flags still come from LaunchDarkly. |

## After the demo

- [ ] `release-new-checkout` back to **Off**.
- [ ] `shopping-assistant` targeting **On**, default rule **Control** (unless an experiment is running).
- [ ] If test orders or questions were added, nothing needs cleaning: they are labeled and harmless.
