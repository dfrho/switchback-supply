import { answer, recordFeedback } from './assistant.js';
import { FALLBACK_REPLY } from './config.js';
import { NotConfigured, getDeps } from './runtime.js';
import { BadRequest } from './shopper.js';

/**
 * HTTP handlers shared by the Vercel functions in /api and the local dev server
 * (web/vite.config.ts). They take a standard Request and return a Response.
 *
 * `defer` keeps work running after the response is sent. Analytics events are
 * batched in memory, and a serverless instance can be frozen as soon as it
 * responds, so each handler flushes events through `defer` (Vercel's waitUntil).
 */
type Defer = (work: Promise<unknown>) => void;

async function readJson(request: Request): Promise<unknown> {
  if (request.method !== 'POST') throw new BadRequest('Use POST.');
  if (Number(request.headers.get('content-length') ?? 0) > 20_000) throw new BadRequest('Request too large.');
  try {
    return await request.json();
  } catch {
    throw new BadRequest('Send JSON.');
  }
}

function errorResponse(error: unknown): Response {
  if (error instanceof BadRequest) return Response.json({ error: error.message }, { status: 400 });
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
    defer(ld.flush().catch(() => undefined));
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
