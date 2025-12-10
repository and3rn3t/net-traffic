import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig, PluginOption } from 'vite';

import sparkPlugin from '@github/spark/spark-vite-plugin';
import createIconImportProxy from '@github/spark/vitePhosphorIconProxyPlugin';
import { resolve } from 'path';

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname;

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // DO NOT REMOVE
    createIconImportProxy() as PluginOption,
    sparkPlugin() as PluginOption,
  ],
  server: {
    port: 5173,
    strictPort: true, // Fail if port 5173 is in use
    host: true, // Listen on all addresses
    hmr: {
      overlay: true,
      clientPort: 5173,
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
  optimizeDeps: {
    include: ['react-window'],
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
          'animation-vendor': ['framer-motion'],
          'query-vendor': ['@tanstack/react-query'],
          'd3-vendor': ['d3'],
          // Feature chunks
          visualizations: [
            './src/components/NetworkGraph',
            './src/components/GeographicMap',
            './src/components/FlowPipeVisualization',
            './src/components/HeatmapTimeline',
            './src/components/ProtocolSankey',
            './src/components/RadarChart',
          ],
          analytics: [
            './src/components/HistoricalTrends',
            './src/components/PeakUsageAnalysis',
            './src/components/BandwidthPatterns',
            './src/components/ProtocolTimeline',
            './src/components/UserActivityTimeline',
          ],
        },
      },
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
  },
});
