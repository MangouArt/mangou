import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Force NODE_ENV to production during build to strip local paths from jsxDev
if (process.env.npm_lifecycle_event === 'build' || process.argv.includes('build')) {
  process.env.NODE_ENV = 'production';
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
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
  },
});
