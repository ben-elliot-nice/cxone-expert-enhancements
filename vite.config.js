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
    emptyOutDir: false, // Keep old files for now
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/main.js'),
      name: 'ExpertEnhancements',
      fileName: () => 'embed.js', // Simplified filename
      formats: ['iife'] // IIFE format for browser compatibility
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          // Simplified CSS filename
          if (assetInfo.name.endsWith('.css')) {
            return 'core.css';
          }
          return assetInfo.name;
        }
      }
    }
  }
});
