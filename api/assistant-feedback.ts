import { waitUntil } from '@vercel/functions';
import { handleFeedback } from '../server/http.js';

/** POST /api/assistant-feedback: thumbs up or down on an earlier answer. */
export default {
  fetch: (request: Request) => handleFeedback(request, waitUntil),
};
