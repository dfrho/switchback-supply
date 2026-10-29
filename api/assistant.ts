import { waitUntil } from '@vercel/functions';
import { handleAssistant } from '../server/http.js';

/**
 * POST /api/assistant: one question to the AI shopping assistant.
 * A Vercel Function (Node.js runtime). The logic lives in server/assistant.ts.
 * Docs: https://vercel.com/docs/functions
 */
export default {
  fetch: (request: Request) => handleAssistant(request, waitUntil),
};
