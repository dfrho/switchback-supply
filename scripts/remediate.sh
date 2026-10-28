#!/usr/bin/env bash
#
# PART 1: REMEDIATE
#
# Turns OFF the release-new-checkout flag by calling its LaunchDarkly flag trigger.
# Every browser with the storefront open switches back to the Classic checkout
# within moments, with no deploy and no page reload.
#
# This is what an on-call engineer runs during an incident. In production the same
# URL is usually called automatically by a monitoring tool (Datadog, New Relic,
# Dynatrace, and others) when an alert fires.
#
# SETUP: create a Generic trigger on the flag (action: turn the flag off), copy its
# URL, and put it in the repo-root .env file as LD_TRIGGER_URL_CHECKOUT_OFF.
# Treat the URL like a password: anyone who has it can turn the flag off.
#
# Usage:
#   npm run remediate
#   npm run remediate -- "Payment errors spiking on Express checkout"

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

# Read only the trigger URL from .env, without executing the file.
if [[ -z "${LD_TRIGGER_URL_CHECKOUT_OFF:-}" && -f "$ENV_FILE" ]]; then
  LD_TRIGGER_URL_CHECKOUT_OFF="$(grep -E '^LD_TRIGGER_URL_CHECKOUT_OFF=' "$ENV_FILE" | tail -n 1 | cut -d '=' -f 2- | tr -d '"' | tr -d "'")"
fi

if [[ -z "${LD_TRIGGER_URL_CHECKOUT_OFF:-}" ]]; then
  echo "LD_TRIGGER_URL_CHECKOUT_OFF is not set."
  echo "Create a Generic trigger on release-new-checkout and add its URL to .env (see README, step 4)."
  exit 1
fi

INCIDENT="${1:-Checkout error spike detected}"
# Keep the JSON valid if the label contains double quotes or backslashes.
INCIDENT="${INCIDENT//\\/}"
INCIDENT="${INCIDENT//\"/}"

# The optional JSON body labels the change in the flag's history, so the team can
# see why the flag turned off. The trigger works without a body too.
BODY=$(printf '{"eventName": "%s", "url": "https://github.com/dfrho/switchback-supply#remediate"}' "$INCIDENT")

echo "Calling the release-new-checkout OFF trigger..."
STATUS=$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
  -H "Content-Type: application/json" \
  -d "$BODY" \
  "$LD_TRIGGER_URL_CHECKOUT_OFF") || STATUS="000"

if [[ "$STATUS" =~ ^2 ]]; then
  echo "Done (HTTP $STATUS). The flag is off, and shoppers are back on Classic checkout."
  echo "Flag history in LaunchDarkly will show: \"$INCIDENT\""
else
  echo "Trigger call failed with HTTP $STATUS. Check that the URL is current (resetting a trigger issues a new URL)."
  exit 1
fi
