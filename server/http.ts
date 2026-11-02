import { answer, recordFeedback } from './assistant.js';
import { FALLBACK_REPLY, LIMITS } from './config.js';
import { NotConfigured, getDeps } from './runtime.js';
import { BadRequest } from './shopper.js';

/**
 * HTTP handlers shared by the Vercel functions in /api and the local dev server
 * (web/vite.config.ts). They take a standard Request and return a Response.
 *
 * `defer` keeps work running after the response is sent. Analytics events are
 * batched in memory, and a serverless instance can be frozen as soon as it
 * responds, so each handler flushes events through `defer` (Vercel's waitUntil).
 *
 * These endpoints are public and every answer is a paid model call, so requests are
 * checked before any work: POST only, JSON only (a browser cannot send JSON across
 * sites without a CORS preflight, which this API never grants), and a body size cap
 * enforced while reading, not just from the Content-Length header. Rate limiting
 * per caller belongs in front of the function: see the README (Production notes).
 */
type Defer = (work: Promise<unknown>) => void;

const TOO_LARGE = () => new BadRequest('Request too large.', 413);

/** Reads the body, stopping as soon as it passes the size cap. */
async function readBody(request: Request): Promise<string> {
  if (Number(request.headers.get('content-length') ?? 0) > LIMITS.bodyBytes) throw TOO_LARGE();
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > LIMITS.bodyBytes) {
      await reader.cancel();
      throw TOO_LARGE();
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

async function readJson(request: Request): Promise<unknown> {
  if (request.method !== 'POST') throw new BadRequest('Use POST.', 405);
  const type = request.headers.get('content-type') ?? '';
  if (!/^application\/json\b/i.test(type)) throw new BadRequest('Send JSON with Content-Type: application/json.', 415);
  const text = await readBody(request);
  try {
    return JSON.parse(text);
  } catch {
    throw new BadRequest('Send JSON.');
  }
}

function errorResponse(error: unknown): Response {
  if (error instanceof BadRequest) {
    const headers: HeadersInit = error.status === 405 ? { Allow: 'POST' } : {};
    return Response.json({ error: error.message }, { status: error.status, headers });
  }
  if (error instanceof NotConfigured) {
    console.error(error.message);
    // The store keeps working; the assistant explains it is unavailable.
    return Response.json({ reply: FALLBACK_REPLY, products: [], source: 'off' }, { status: 503 });
  }
  console.error('Assistant request failed:', error);
  return Response.json({ error: 'Something went wrong.' }, { status: 500 });
}

export async function handleAssistant(request: Request, defer: Defer): Promise<Response> {
  try {
    const body = await readJson(request);
    const { deps, ld } = await getDeps();
    const reply = await answer(deps, body);
    // Send this request's analytics events after the response, so the shopper never
    // waits for them (Vercel's waitUntil).
    defer(ld.flush().catch(() => undefined));
    return Response.json(reply, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleFeedback(request: Request, defer: Defer): Promise<Response> {
  try {
    const body = await readJson(request);
    const { deps, ld } = await getDeps();
    recordFeedback(deps, body);
    // Send this request's analytics events after the response, so the shopper never
    // waits for them (Vercel's waitUntil).
    defer(ld.flush().catch(() => undefined));
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
