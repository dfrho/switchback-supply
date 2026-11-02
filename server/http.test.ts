import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FALLBACK_REPLY, LIMITS } from './config.js';
import { NotConfigured } from './runtime.js';
import { BadRequest } from './shopper.js';

/**
 * The HTTP layer in front of the assistant: request checks, status codes, and
 * event flushing. The assistant itself and the real clients are replaced with
 * fakes here; server/assistant.test.ts covers the assistant's logic.
 */
const fake = vi.hoisted(() => ({
  answer: vi.fn(),
  recordFeedback: vi.fn(),
  getDeps: vi.fn(),
  flush: vi.fn(async () => undefined),
}));

vi.mock('./assistant.js', () => ({ answer: fake.answer, recordFeedback: fake.recordFeedback }));
vi.mock('./runtime.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./runtime.js')>()),
  getDeps: fake.getDeps,
}));

const { handleAssistant, handleFeedback } = await import('./http.js');

const URL = 'https://store.test/api/assistant';
const json = (body: unknown, init: RequestInit = {}) =>
  new Request(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), ...init });

/** A body sent without a Content-Length header, the way a chunked upload arrives. */
function streamed(text: string) {
  const bytes = new TextEncoder().encode(text);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 1024) controller.enqueue(bytes.slice(i, i + 1024));
      controller.close();
    },
  });
  return new Request(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, duplex: 'half' } as RequestInit);
}

const defer = vi.fn();

describe('assistant HTTP handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.getDeps.mockResolvedValue({ deps: {}, ld: { flush: fake.flush } });
    fake.answer.mockResolvedValue({ reply: 'Try the pack.', products: ['ridgeline-45'], source: 'claude' });
  });

  it('answers a valid question, uncached, and flushes analytics events after responding', async () => {
    const res = await handleAssistant(json({ message: 'Hi' }), defer);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toMatchObject({ reply: 'Try the pack.' });
    expect(fake.answer).toHaveBeenCalledWith({}, { message: 'Hi' });
    expect(defer).toHaveBeenCalledOnce();
    expect(fake.flush).toHaveBeenCalledOnce();
  });

  it('accepts only POST, and says so', async () => {
    const res = await handleAssistant(new Request(URL, { method: 'GET' }), defer);
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST');
    expect(fake.answer).not.toHaveBeenCalled();
  });

  it('refuses bodies that are not sent as JSON, so other sites cannot post without a CORS preflight', async () => {
    const res = await handleAssistant(json({ message: 'Hi' }, { headers: { 'Content-Type': 'text/plain' } }), defer);
    expect(res.status).toBe(415);
    expect(fake.answer).not.toHaveBeenCalled();
  });

  it('accepts a JSON content type with a charset', async () => {
    const res = await handleAssistant(json({ message: 'Hi' }, { headers: { 'Content-Type': 'application/json; charset=utf-8' } }), defer);
    expect(res.status).toBe(200);
  });

  it('refuses a body larger than the cap from its Content-Length, before reading it', async () => {
    const headers = { 'Content-Type': 'application/json', 'Content-Length': String(LIMITS.bodyBytes + 1) };
    const res = await handleAssistant(json({ message: 'Hi' }, { headers }), defer);
    expect(res.status).toBe(413);
    expect(fake.getDeps).not.toHaveBeenCalled();
  });

  it('refuses an oversized body that arrives without a Content-Length header', async () => {
    const res = await handleAssistant(streamed(JSON.stringify({ message: 'x'.repeat(LIMITS.bodyBytes) })), defer);
    expect(res.status).toBe(413);
    expect(fake.answer).not.toHaveBeenCalled();
  });

  it('reads a normal body that arrives without a Content-Length header', async () => {
    const res = await handleAssistant(streamed(JSON.stringify({ message: 'Hi' })), defer);
    expect(res.status).toBe(200);
    expect(fake.answer).toHaveBeenCalledWith({}, { message: 'Hi' });
  });

  it('answers malformed JSON with a 400', async () => {
    const res = await handleAssistant(new Request(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' }), defer);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Send JSON.' });
  });

  it('passes validation errors from the assistant through as a 400', async () => {
    fake.answer.mockRejectedValue(new BadRequest('Ask a question first.'));
    const res = await handleAssistant(json({ message: '' }), defer);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Ask a question first.' });
  });

  it('serves the fallback reply with a 503 when the server keys are missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fake.getDeps.mockRejectedValue(new NotConfigured('Set LD_SDK_KEY and ANTHROPIC_API_KEY on the server.'));
    const res = await handleAssistant(json({ message: 'Hi' }), defer);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ reply: FALLBACK_REPLY, products: [], source: 'off' });
  });

  it('hides unexpected errors behind a generic 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fake.answer.mockRejectedValue(new Error('internal detail: connection string'));
    const res = await handleAssistant(json({ message: 'Hi' }), defer);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toContain('Something went wrong.');
    expect(text).not.toContain('internal detail');
  });

  it('records feedback with a 204 and flushes events', async () => {
    const res = await handleFeedback(json({ feedbackToken: 't.sig', kind: 'positive' }), defer);
    expect(res.status).toBe(204);
    expect(fake.recordFeedback).toHaveBeenCalledWith({}, { feedbackToken: 't.sig', kind: 'positive' });
    expect(fake.flush).toHaveBeenCalledOnce();
  });

  it('applies the same request checks to feedback', async () => {
    const res = await handleFeedback(json({ kind: 'positive' }, { headers: { 'Content-Type': 'text/plain' } }), defer);
    expect(res.status).toBe(415);
    expect(fake.recordFeedback).not.toHaveBeenCalled();
  });
});
