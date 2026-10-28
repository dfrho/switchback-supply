#!/usr/bin/env node
/**
 * A tiny stand-in for LaunchDarkly's client-side endpoints, used only by the
 * end-to-end tests. It speaks LaunchDarkly's streaming protocol, so the real
 * React SDK runs unmodified against it:
 *   - GET mode:    GET /eval/{env}/{base64 context} streams `put`, then `patch` per change
 *   - REPORT mode: GET /ping/{env} streams `ping`; the SDK then fetches values with
 *                  REPORT /sdk/evalx/{env}/context (context in the body, never the URL)
 *
 * It also evaluates a useful subset of LaunchDarkly targeting, in LaunchDarkly's
 * order: flag off, individual targets, rules (first match wins), default rule.
 * Supported clause operators: in, endsWith, segmentMatch. Segments are rule-based.
 *
 * The app points here through VITE_LD_BASE_URI / VITE_LD_STREAM_URI /
 * VITE_LD_EVENTS_URI, the same settings a customer would use for a Relay Proxy.
 *
 * Admin API (used by tests):
 *   POST /__mock/reset    { flags?: {key: value | FlagConfig}, segments?: {key: Segment} }
 *   POST /__mock/flags    { key, value }                 set the default rule's value
 *   POST /__mock/targets  { flag, contextKey, value }    individually target one context
 *   GET  /__mock/state    flags, segments, open streams, request log
 *   GET  /__mock/events   analytics event payloads received (to check private attributes)
 *
 * FlagConfig: { on?, fallthrough, offValue?, targets?: {contextKey: value},
 *               rules?: [{ id, clauses: [{ attribute, op, values }], value }] }
 *
 * Run: node tests/mock-launchdarkly/server.mjs [port]   (default 8787)
 */
import { createServer } from 'node:http';

const PORT = Number(process.argv[2] ?? process.env.MOCK_LD_PORT ?? 8787);
const DEFAULT_FLAGS = { 'release-new-checkout': false, 'release-landing-hero': false };

let flags = {};
let segments = {};
let versions = {};
let requestLog = [];
let eventBodies = [];
const streams = new Set(); // { res, mode: 'get' | 'ping', context? }

const isConfig = (v) => v !== null && typeof v === 'object' && 'fallthrough' in v;
const toConfig = (v) => (isConfig(v) ? { on: true, offValue: false, targets: {}, rules: [], ...v } : { on: true, fallthrough: v, offValue: false, targets: {}, rules: [] });

function reset(next = {}) {
  const merged = { ...DEFAULT_FLAGS, ...(next.flags ?? {}) };
  flags = Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, toConfig(structuredClone(v))]));
  segments = structuredClone(next.segments ?? {});
  versions = Object.fromEntries(Object.keys(flags).map((k) => [k, 1]));
  requestLog = [];
  eventBodies = [];
}
reset();

function decodeContext(segment) {
  try {
    return JSON.parse(Buffer.from(decodeURIComponent(segment), 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

const contextKey = (context) => context?.key ?? context?.user?.key;
const attr = (context, name) => (context?.kind === 'multi' ? context.user?.[name] : context?.[name]);

function clauseMatches(clause, context) {
  if (clause.op === 'segmentMatch') {
    return clause.values.some((segKey) => {
      const seg = segments[segKey];
      if (!seg) return false;
      if ((seg.included ?? []).includes(contextKey(context))) return true;
      return (seg.rules ?? []).some((r) => r.clauses.every((c) => clauseMatches(c, context)));
    });
  }
  const actual = attr(context, clause.attribute);
  if (actual === undefined || actual === null) return false; // missing attribute: clause does not match
  switch (clause.op) {
    case 'in':
      return clause.values.includes(actual);
    case 'endsWith':
      return typeof actual === 'string' && clause.values.some((v) => actual.endsWith(v));
    default:
      return false;
  }
}

/** Evaluate one flag for one context, in LaunchDarkly's order. */
function evaluate(flagKey, context) {
  const f = flags[flagKey];
  const version = versions[flagKey] ?? 1;
  const result = (value, reason) => ({
    key: flagKey,
    value,
    variation: value === true ? 0 : value === false ? 1 : 0,
    version,
    flagVersion: version,
    reason,
    trackEvents: false,
  });
  if (!f.on) return result(f.offValue, { kind: 'OFF' });
  const key = contextKey(context);
  if (key !== undefined && Object.hasOwn(f.targets, key)) return result(f.targets[key], { kind: 'TARGET_MATCH' });
  for (const [i, rule] of f.rules.entries()) {
    if (rule.clauses.every((c) => clauseMatches(c, context))) {
      return result(rule.value, { kind: 'RULE_MATCH', ruleIndex: i, ruleId: rule.id ?? `rule-${i}` });
    }
  }
  return result(f.fallthrough, { kind: 'FALLTHROUGH' });
}

function allFlags(context) {
  return Object.fromEntries(
    Object.keys(flags).map((k) => {
      const { key, ...rest } = evaluate(k, context);
      return [key, rest];
    }),
  );
}

/** Tell every connected SDK that flags changed. */
function broadcastChange(flagKey) {
  for (const stream of streams) {
    if (stream.mode === 'ping') stream.res.write('event: ping\ndata: {}\n\n');
    else stream.res.write(`event: patch\ndata: ${JSON.stringify(evaluate(flagKey, stream.context))}\n\n`);
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

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw;
}

function openStream(req, res, stream, firstEvent) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', ...CORS });
  streams.add(stream);
  res.write(firstEvent);
  const keepAlive = setInterval(() => res.write(':\n\n'), 15000);
  req.on('close', () => {
    clearInterval(keepAlive);
    streams.delete(stream);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const parts = url.pathname.split('/').filter(Boolean);
  if (req.method === 'OPTIONS') return send(res, 204);
  if (!url.pathname.startsWith('/__mock')) requestLog.push(`${req.method} ${url.pathname}`);

  // ---- Admin API ---------------------------------------------------------
  if (url.pathname === '/__mock/reset' && req.method === 'POST') {
    reset(JSON.parse((await readBody(req)) || '{}'));
    for (const key of Object.keys(flags)) broadcastChange(key);
    return send(res, 200, { ok: true });
  }
  if (url.pathname === '/__mock/flags' && req.method === 'POST') {
    const { key, value } = JSON.parse(await readBody(req));
    flags[key] = flags[key] ?? toConfig(value);
    flags[key].fallthrough = value;
    flags[key].on = true;
    versions[key] = (versions[key] ?? 1) + 1;
    broadcastChange(key);
    return send(res, 200, { ok: true, key, value, streams: streams.size });
  }
  if (url.pathname === '/__mock/targets' && req.method === 'POST') {
    const { flag, contextKey: key, value } = JSON.parse(await readBody(req));
    flags[flag].targets[key] = value;
    versions[flag] = (versions[flag] ?? 1) + 1;
    broadcastChange(flag);
    return send(res, 200, { ok: true });
  }
  if (url.pathname === '/__mock/state') {
    return send(res, 200, { flags, segments, streams: streams.size, requests: requestLog });
  }
  if (url.pathname === '/__mock/events') {
    return send(res, 200, { payloads: eventBodies });
  }

  // ---- Streaming, GET mode: /eval/{env}/{base64Context} ------------------
  if (parts[0] === 'eval' && req.method === 'GET' && parts.length >= 3) {
    const context = decodeContext(parts[2]);
    return openStream(req, res, { res, mode: 'get', context }, `event: put\ndata: ${JSON.stringify(allFlags(context))}\n\n`);
  }
  // ---- Streaming, REPORT mode in browsers: /ping/{env} -------------------
  if (parts[0] === 'ping' && req.method === 'GET') {
    return openStream(req, res, { res, mode: 'ping' }, 'event: ping\ndata: {}\n\n');
  }

  // ---- Polling: GET .../contexts/{base64Context} or REPORT .../context ---
  if (parts[0] === 'sdk' && parts[1] === 'evalx') {
    if (req.method === 'REPORT') return send(res, 200, allFlags(JSON.parse((await readBody(req)) || '{}')));
    if (req.method === 'GET') return send(res, 200, allFlags(decodeContext(parts.at(-1))));
  }
  if (parts[0] === 'sdk' && parts[1] === 'goals') return send(res, 200, []);

  // ---- Analytics and diagnostic events: keep the payloads ----------------
  if (req.method === 'POST') {
    const body = await readBody(req);
    if (url.pathname.includes('/bulk/')) eventBodies.push(body);
    return send(res, 202);
  }

  send(res, 404, { error: `mock LaunchDarkly has no route for ${req.method} ${url.pathname}` });
});

server.listen(PORT, () => console.log(`Mock LaunchDarkly listening on http://localhost:${PORT}`));
