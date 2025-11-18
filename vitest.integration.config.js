import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/integration/helpers/setup.js'],
    include: ['tests/integration/**/*.test.js'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30000, // Monaco loading can take time
    hookTimeout: 30000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
