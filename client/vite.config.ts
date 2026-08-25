import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react() as any],
  server: {
    open: true,
    proxy: {
      '/api': 'http://localhost:4000'
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts']
  }
});