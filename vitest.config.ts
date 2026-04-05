import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, './src/core'),
      '@logic': path.resolve(__dirname, './src/logic'),
      '@server': path.resolve(__dirname, './src/server'),
      '@web': path.resolve(__dirname, './src/web'),
      '@components': path.resolve(__dirname, './src/web/components'),
      // Deep fixes for common frontend patterns
      '@/lib/utils': path.resolve(__dirname, 'src/core/utils.ts'),
      '@web/lib/utils': path.resolve(__dirname, 'src/core/utils.ts'),
      '@/components/ui': path.resolve(__dirname, 'src/web/components/ui'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
