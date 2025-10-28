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
      fileName: () => 'expert-enhancements-embed.js', // Override to remove format suffix
      formats: ['iife'] // IIFE format for browser compatibility
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          // Rename CSS to match current structure
          if (assetInfo.name.endsWith('.css')) {
            return 'expert-enhancements-core.css';
          }
          return assetInfo.name;
        }
      }
    }
  }
});
