import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'auth-bridge-headers',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.split('?')[0] === '/redirect.html') {
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Referrer-Policy', 'no-referrer');
          }
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.split('?')[0] === '/redirect.html') {
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Referrer-Policy', 'no-referrer');
          }
          next();
        });
      },
    },
  ],
  build: { rolldownOptions: { input: { main: 'index.html', redirect: 'redirect.html' } } },
  server: { proxy: { '/api': 'http://127.0.0.1:8791' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:8791' } },
});
