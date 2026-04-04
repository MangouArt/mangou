import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/web'),
      '@core': path.resolve(__dirname, './src/cli/core'),
      '@components': path.resolve(__dirname, './src/web/components'),
      '@server': path.resolve(__dirname, './src/cli/server'), // Backward compat for some imports
    },
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.MANGOU_API_ORIGIN ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
