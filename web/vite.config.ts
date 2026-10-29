import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * Local stand-in for the Vercel Functions in /api. During `npm run dev`, requests
 * to /api/assistant and /api/assistant-feedback run the same handlers
 * (server/http.ts) that Vercel runs in production, so one command starts the
 * whole app. Production builds are unaffected (apply: 'serve').
 */
function assistantApi(): Plugin {
  const routes: Record<string, 'handleAssistant' | 'handleFeedback'> = {
    '/api/assistant': 'handleAssistant',
    '/api/assistant-feedback': 'handleFeedback',
  };
  return {
    name: 'switchback-assistant-api',
    apply: 'serve',
    configResolved(config) {
      // Server-only secrets from the repo-root .env. They go into this Node process,
      // never into the browser bundle (only VITE_ variables reach the browser).
      const env = loadEnv(config.mode, config.envDir || '..', '');
      for (const key of ['LD_SDK_KEY', 'ANTHROPIC_API_KEY']) {
        if (env[key] && !process.env[key]) process.env[key] = env[key];
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handler = routes[(req.url ?? '').split('?')[0]];
        if (!handler) return next();
        try {
          const http = await server.ssrLoadModule(fileURLToPath(new URL('../server/http.ts', import.meta.url)));
          const request = new Request(`http://${req.headers.host}${req.url}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : (Readable.toWeb(req) as ReadableStream),
            duplex: 'half',
          } as RequestInit);
          const response: Response = await http[handler](request, (work: Promise<unknown>) => void work);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), assistantApi()],
  // Read .env from the repository root so one file configures the whole project.
  // Only variables prefixed with VITE_ are exposed to browser code.
  envDir: '..',
  server: {
    port: 5173,
  },
});
