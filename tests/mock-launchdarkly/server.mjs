#!/usr/bin/env node
/**
 * A tiny stand-in for LaunchDarkly's client-side endpoints, used only by the
 * end-to-end tests. It speaks the same streaming protocol as LaunchDarkly
 * (a `put` event with all flags, `patch` events for changes), so the real
 * React SDK runs unmodified against it.
 *
 * The app points here through VITE_LD_BASE_URI / VITE_LD_STREAM_URI /
 * VITE_LD_EVENTS_URI, the same settings a customer would use for a Relay Proxy.
 *
 * Admin API (used by tests):
 *   POST /__mock/reset    { flags?: {key: value}, targets?: {flagKey: {contextKey: value}} }
 *   POST /__mock/flags    { key, value }                  change the default value, streams a patch
 *   POST /__mock/targets  { flag, contextKey, value }     individually target one context key
 *   GET  /__mock/state    current flags, targets, open streams, and events received
 *
 * Run: node tests/mock-launchdarkly/server.mjs [port]   (default 8787)
 */
import { createServer } from 'node:http';

const PORT = Number(process.argv[2] ?? process.env.MOCK_LD_PORT ?? 8787);
const DEFAULT_FLAGS = { 'release-new-checkout': false };

let flags = {};
let targets = {};
let versions = {};
let eventPayloads = 0;
const streams = new Set(); // { res, context }

function reset(next = {}) {
  flags = { ...DEFAULT_FLAGS, ...(next.flags ?? {}) };
  targets = structuredClone(next.targets ?? {});
  versions = Object.fromEntries(Object.keys(flags).map((k) => [k, 1]));
}
reset();

/** The context arrives base64url-encoded in the request path. */
function decodeContext(segment) {
  try {
    return JSON.parse(Buffer.from(decodeURIComponent(segment), 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

const contextKey = (context) => context?.key ?? context?.user?.key;

/** Evaluate one flag for one context: individual target first, then the default value. */
function evaluate(flagKey, context) {
  const key = contextKey(context);
  const targeted = key !== undefined && targets[flagKey] && Object.hasOwn(targets[flagKey], key);
  const value = targeted ? targets[flagKey][key] : flags[flagKey];
  return {
    key: flagKey,
    value,
    variation: value === true ? 0 : value === false ? 1 : 0,
    version: versions[flagKey] ?? 1,
    flagVersion: versions[flagKey] ?? 1,
    reason: targeted ? { kind: 'TARGET_MATCH' } : { kind: 'FALLTHROUGH' },
    trackEvents: false,
  };
}

function allFlags(context) {
  return Object.fromEntries(Object.keys(flags).map((k) => {
    const { key, ...rest } = evaluate(k, context);
    return [key, rest];
  }));
}

function broadcastPatch(flagKey) {
  for (const stream of streams) {
    stream.res.write(`event: patch\ndata: ${JSON.stringify(evaluate(flagKey, stream.context))}\n\n`);
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, REPORT, OPTIONS',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS, ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const parts = url.pathname.split('/').filter(Boolean);

  if (req.method === 'OPTIONS') return send(res, 204);

  // ---- Admin API ---------------------------------------------------------
  if (url.pathname === '/__mock/reset' && req.method === 'POST') {
    reset(await readJson(req));
    for (const stream of streams) stream.res.write(`event: put\ndata: ${JSON.stringify(allFlags(stream.context))}\n\n`);
    return send(res, 200, { ok: true, flags, targets });
  }
  if (url.pathname === '/__mock/flags' && req.method === 'POST') {
    const { key, value } = await readJson(req);
    flags[key] = value;
    versions[key] = (versions[key] ?? 1) + 1;
    broadcastPatch(key);
    return send(res, 200, { ok: true, key, value, streams: streams.size });
  }
  if (url.pathname === '/__mock/targets' && req.method === 'POST') {
    const { flag, contextKey: key, value } = await readJson(req);
    targets[flag] = { ...(targets[flag] ?? {}), [key]: value };
    versions[flag] = (versions[flag] ?? 1) + 1;
    broadcastPatch(flag);
    return send(res, 200, { ok: true });
  }
  if (url.pathname === '/__mock/state') {
    return send(res, 200, { flags, targets, streams: streams.size, eventPayloads });
  }

  // ---- Streaming: GET /eval/{clientSideId}/{base64Context} ---------------
  if (parts[0] === 'eval' && req.method === 'GET' && parts.length >= 3) {
    const context = decodeContext(parts[2]);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      ...CORS,
    });
    const stream = { res, context };
    streams.add(stream);
    res.write(`event: put\ndata: ${JSON.stringify(allFlags(context))}\n\n`);
    const keepAlive = setInterval(() => res.write(':\n\n'), 15000);
    req.on('close', () => {
      clearInterval(keepAlive);
      streams.delete(stream);
    });
    return;
  }

  // ---- Polling: GET /sdk/evalx/{clientSideId}/contexts/{base64Context} ---
  if (parts[0] === 'sdk' && parts[1] === 'evalx' && req.method === 'GET') {
    return send(res, 200, allFlags(decodeContext(parts.at(-1))));
  }
  if (parts[0] === 'sdk' && parts[1] === 'goals') return send(res, 200, []);

  // ---- Analytics and diagnostic events: accept and count ----------------
  if (req.method === 'POST') {
    for await (const _ of req) {
      // drain the body
    }
    eventPayloads += 1;
    return send(res, 202);
  }

  send(res, 404, { error: `mock LaunchDarkly has no route for ${req.method} ${url.pathname}` });
});

server.listen(PORT, () => console.log(`Mock LaunchDarkly listening on http://localhost:${PORT}`));
