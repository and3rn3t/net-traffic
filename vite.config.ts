import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

import { resolve } from 'path';

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // playwright.config.ts expects the dev server on 5001
    port: 5001,
    strictPort: true, // Fail if port 5001 is in use
    host: true, // Listen on all addresses
    hmr: {
      overlay: true,
      clientPort: 5001,
    },
    watch: {
      usePolling: false,
      ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src'),
    },
  },
  build: {
    // Code splitting configuration
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-error-boundary'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tabs'],
          'chart-vendor': ['recharts'],
          'animation-vendor': ['motion/react'],
          'query-vendor': ['@tanstack/react-query'],
          // Feature chunks
          analytics: ['./src/components/HistoricalTrends', './src/components/AnomalyDetection'],
        },
      },
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
  },
});
