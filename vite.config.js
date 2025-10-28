import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Development server configuration
  server: {
    port: 5173,
    open: true
  },

  // Build configuration
  build: {
    outDir: 'dist',
    emptyOutDir: false, // Don't delete dist/ - we'll manually copy CSS files
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/main.js'),
      name: 'ExpertEnhancements',
      fileName: 'expert-enhancements-embed',
      formats: ['iife'] // IIFE format for browser compatibility
    }
  }
});
