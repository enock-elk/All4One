import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/** Builds a self-contained ESM bundle for static hosting (GitHub Pages). */
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'js/react-tools.js'),
      formats: ['es'],
      fileName: () => 'react-island.js',
    },
    outDir: 'js',
    emptyOutDir: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
