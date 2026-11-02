# Demo runbook

A 12-minute live demo of Switchback Supply on the live site, with a checklist to run beforehand and recovery steps for when something misbehaves. Each part follows the README's walkthrough; this page puts them in one order with the setup they need.

Live site: https://web-puce-kappa-92.vercel.app (LaunchDarkly **Test** environment).

## 30 minutes before

**Browser**
- [ ] Use a **clean Chrome profile** with no extensions. Ad blockers that use the EasyPrivacy filter list, such as Brave Shields and uBlock Origin, block `events.launchdarkly.com`: flags still work, but the Event debugger, Contexts, metrics, and experiment results stay empty.
- [ ] Open the live site and expand the Release Console (bottom left): the **SDK** row should read **Streaming**. Collapse it again before you start.
- [ ] **SHOPPING AS:** Guest shopper, with your cart empty.

**LaunchDarkly tabs** (Test environment selected in each)

Everything in the demo uses the **Test** environment; Production is unused (it holds an early copy of the setup).

- [ ] Feature management > Flags > **Release new checkout**
- [ ] Feature management > Flags > **Release landing hero**
- [ ] Agent management > Configs > **Shopping assistant** (Targeting and Monitoring tabs)
- [ ] Experimentation > Experiments > **Trail guide: kit prompt vs larger model**, with **Test** selected (Results tab)
- [ ] Measurement > Metrics > **Checkout completed** (Activity tab)

**Starting state**
- [ ] **Release new checkout**: **Off**, default rule serves **true**. Turning it On is then the release. Check the Release Console reads Checkout **false**.
- [ ] **Release landing hero**: **On**, targeting as `npm run ld:setup` sets it (QA tester, three rules, default false). Rerun `npm run ld:setup` if anything was edited by hand.
- [ ] **Shopping assistant**: targeting **On**. If the experiment is still running, its default rule is a three-way split: show the results instead of editing variations live (see Part 3).
- [ ] Trial still active (it ends around November 10, 2026).

**Terminal**
- [ ] A terminal open in the repo with `.env` in place, ready for `npm run remediate`.
- [ ] Optional fallback: `npm run dev` running locally (http://localhost:5173) in case the live site is down. It still needs internet: flags come from LaunchDarkly and the assistant calls Claude.
- [ ] A short screen recording or screenshots of each part, in case your internet fails.

## The demo (about 12 minutes)

### Part 1: Release and remediate (4 minutes)

The checkout flag has no targeting, so it serves every shopper the same value: switching personas in the Release Console does not change the checkout. (To show test in production, add the optional individual target `qa-tester-001` from README Setup Step 5; then Guest shopper and Internal QA tester get different checkouts.)

1. Open a product, choose a size, **Add to pack**. The drawer shows **Classic checkout**, and the Release Console reads Checkout **false**. If it shows Express, the flag is still On: turn **Release new checkout** Off in Test before you begin. Leave the drawer open.
2. **Release:** in LaunchDarkly, turn **Release new checkout** **On** and save. The open drawer becomes **Express checkout** with no reload; a toast and the Release Console log record it.
3. **Roll back:** turn it **Off**. Classic returns instantly.
4. **Remediate:** turn it **On** again, then in the terminal:
   ```bash
   npm run remediate -- "Payment errors spiking on Express checkout"
   ```
   The drawer reverts to Classic. Show the flag's **History**: the trigger's change, labeled with the incident.
5. **Measure:** place an order (Express is one tap). Show **Metrics > Checkout completed > Activity**: the event arrives with its order total. Say why: these metrics let a guarded rollout or experiment judge Express against Classic on conversion and dollars, not just on/off.

### Part 2: Target (3 minutes)

Go to the home page and expand the Release Console. Choose each shopper in the **SHOPPING AS** dropdown (not the switches below it: the **Beta tester** switch under SHOPPER ATTRIBUTES edits the current shopper instead). Then read **HOW LAUNCHDARKLY CHOSE THE HERO**: that line is LaunchDarkly's own evaluation reason, sent with the flag value, not logic rebuilt in the app. The rows under it show which targeting was checked, top to bottom. Choosing a persona loads its original attributes. Edits made with the switches show as **· edited** next to the key; click **Reset** there to undo them (choosing the persona that is already selected does nothing, because the dropdown only reacts to a change).

| Shopping as | What is different about this shopper | What matches | The panel says | Hero |
|---|---|---|---|---|
| Guest shopper | Anonymous, no attributes set | Nothing | "No targeting matched; default rule served" | Current |
| Internal QA tester | Context key `qa-tester-001` | Individual target (listed by key, checked before any rule) | "Individually targeted" | Winter-Ready |
| Employee | Email `merch@switchbacksupply.test`, a **private** attribute (used for targeting, never stored by LaunchDarkly) | Rule 1, Employees: email ends with `@switchbacksupply.test` | "Matched rule 1: Employees" | Winter-Ready |
| Beta tester, Seattle | `betaTester` is true | Rule 2, Beta shoppers: is in the `beta-shoppers` **segment** (a reusable audience) | "Matched rule 2: Beta shoppers" | Winter-Ready |
| Gold member, Nashville | `loyaltyTier` gold and `state` TN | Rule 3: **two clauses**, gold **and** a Central state, and both must be true | "Matched rule 3: Gold members in Central states" | Winter-Ready |

Then show that attributes, not code, decide:

1. Choose **Gold member, Nashville**. Leave everything else as it is: **Employee email** and **Beta tester** both **off**, loyalty tier **gold**, State **TN (Central)**. The panel says "Matched rule 3: Gold members in Central states" and the Winter-Ready hero shows.
2. Change only **State** to **CA**. Rule 3 needs gold **and** a Central state, so it no longer matches, and with both switches off nothing else does either. LaunchDarkly serves the flag's **default rule**, the value for everyone no rule catches, which is the current hero. The panel says "No targeting matched; default rule served", and Hero reads **false**.
3. Optional, first match wins: turn on the **Employee email** switch. Rule 1 now matches, and the later rules show "Not evaluated".

To show the raw reason from LaunchDarkly: DevTools > **Network**, filter `withReasons`, click the latest `context?withReasons=true`, and open **Preview**. Each flag carries a `reason`, for example `{"kind": "RULE_MATCH", "ruleIndex": 2}`.

### Part 3: AI configs (4 minutes)

1. Open the **Trail guide** (header) and ask "Weekend in the Tennessee mountains in November. What do I pack?" Point at the product cards and the label under the answer: model and variation, chosen by LaunchDarkly.
2. **Kill switch:** turn **Shopping assistant** targeting **Off**, ask again: a polite fallback, no model called. Turn it back **On**.
3. **Monitoring:** tokens, time to generate, cost, and thumbs, by variation.
4. **Experiment:** open the Results tab. Lead with the business question (can a better prompt match a bigger model at a fraction of the cost?), the primary metric, and the response-time guardrail. Mention that the shoppers are synthetic but every answer is a real model reply.
5. **Only if no experiment is running:** set the default rule to **Treatment B** and ask again: the label changes to Sonnet with no deploy. Set it back to **Control**.

### Close (1 minute)

One shopper context drives the checkout release, the hero targeting, and the AI configuration, for three audiences (engineering, product, AI), and every change in the demo was made in LaunchDarkly without a deploy.

## If something goes wrong

| Symptom | Fix |
|---|---|
| A flag change does not reach the page | Check the dashboard is on **Test**. Check the Release Console says Streaming. Reload once. |
| Contexts, the Event debugger, or metrics stay empty | An ad blocker is on. Switch to the clean profile. |
| `npm run remediate` fails | The trigger URL was reset. Copy the new URL into `.env` (`LD_TRIGGER_URL_CHECKOUT_OFF`), or turn the flag off in the dashboard and explain what the trigger would do. |
| The trail guide only gives the fallback | Config targeting is Off, or `LD_SDK_KEY` / `ANTHROPIC_API_KEY` is missing in Vercel. Use the local dev server, or show Monitoring instead. |
| The hero does not match the expected rule | Someone edited targeting by hand. Run `npm run ld:setup` to restore it. |
| The live site is down | Use `npm run dev` on localhost (needs `.env`); flags still come from LaunchDarkly, so this needs internet. |
| Your internet is down | Switch to the recording or screenshots, say so once, and narrate what each step shows. |

## After the demo

- [ ] **Release new checkout** back to **Off**.
- [ ] **Shopping assistant** targeting **On**, default rule **Control** (unless an experiment is running).
- [ ] If test orders or questions were added, nothing needs cleaning: they are labeled and harmless.
