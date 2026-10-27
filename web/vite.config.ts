import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Read .env from the repository root so one file configures the whole project.
  // Only variables prefixed with VITE_ are exposed to browser code.
  envDir: '..',
  server: {
    port: 5173,
  },
});
