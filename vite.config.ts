import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build --mode single` tworzy jeden samodzielny plik HTML (skrypty, style i czcionki w środku),
// który działa po dwukliku, bez serwera.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  server: { port: 5173, host: true },
  build: { chunkSizeWarningLimit: 4000 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}));
