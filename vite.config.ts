import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 8080,
  },
  preview: {
    host: '0.0.0.0',
    port: 8080,
  },
  esbuild: {
    // Strip console.* and debugger statements from production bundles.
    // Preserve console.warn and console.error for actionable runtime issues.
    drop: ['debugger'],
    pure: ['console.log', 'console.info', 'console.debug', 'console.trace'],
  },
  build: {
    // Keep source maps off by default for smaller bundles; flip on for debugging.
    sourcemap: false,
    // Always clear stale hashed chunks from previous builds (audit Phase 4.4).
    emptyOutDir: true,
  },
});
