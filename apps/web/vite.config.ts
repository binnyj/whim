import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In dev, the web app calls the API on the same origin and Vite forwards it, so there's no CORS.
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': apiTarget,
      '/health': apiTarget,
    },
  },
});
