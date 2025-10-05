import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), 
   ],
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis'  // Correct polyfill for 'global'
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          buffer: false,  // Disable buffer polyfill to avoid conflicts
          process: true
        }),
        NodeModulesPolyfillPlugin()  // Required for `stream`, `crypto`, etc.
      ]
    }
  },
  resolve: {
    alias: {
      stream: 'stream-browserify',
      crypto: 'crypto-browserify',
      events: 'events/',
      buffer: 'buffer'  // Explicit buffer alias
    }
  },
  define: {
    global: "globalThis" // Use globalThis consistently
  }
});
