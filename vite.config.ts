import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, './src/core'),
      '@logic': path.resolve(__dirname, './src/logic'),
      '@server': path.resolve(__dirname, './src/server'),
      '@web': path.resolve(__dirname, './src/web'),
      '@components': path.resolve(__dirname, './src/web/components'),
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
