/**
 * Part 1 metrics, as data. `npm run ld:setup` creates them in the project.
 *
 * Both metrics read the same event, "checkout-completed", which the checkout
 * drawer sends with ldClient.track() when an order is placed (see
 * web/src/components/CheckoutDrawer.tsx). One event can back several metrics:
 * one counts orders (conversion), the other averages the value sent with the
 * event (the order total) per shopper. Shoppers who were served the flag but did
 * not order count as $0, so it measures order dollars per shopper: conversion and
 * order size in one number, the usual revenue metric for a checkout. A unit test checks
 * that the event key matches METRIC_EVENTS in web/src/launchdarkly/config.ts.
 *
 * Attach them to release-new-checkout in an experiment or a guarded rollout to
 * compare Express checkout with Classic on business results.
 * Docs: https://launchdarkly.com/docs/home/metrics and https://launchdarkly.com/docs/sdk/features/events
 */

const CHECKOUT_EVENT = 'checkout-completed';

export const CHECKOUT_METRICS = [
  {
    key: 'checkout-completed',
    name: 'Checkout completed',
    description: 'Conversion: the shopper placed an order. Sent by the checkout drawer (ldClient.track).',
    kind: 'custom',
    eventKey: CHECKOUT_EVENT,
    isNumeric: false,
    successCriteria: 'HigherThanBaseline',
    randomizationUnits: ['user'],
  },
  {
    key: 'checkout-order-value',
    name: 'Checkout order value',
    description: 'Value: the order total in US dollars, sent as the metric value of checkout-completed.',
    kind: 'custom',
    eventKey: CHECKOUT_EVENT,
    isNumeric: true,
    unit: 'dollars',
    // Each shopper's orders are averaged, then compared by mean across shoppers.
    // LaunchDarkly counts shoppers with no order as $0 ("Units without events").
    unitAggregationType: 'average',
    analysisType: 'mean',
    successCriteria: 'HigherThanBaseline',
    randomizationUnits: ['user'],
  },
];
