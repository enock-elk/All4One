import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5500,
    strictPort: false,
    open: false,
  },
  preview: {
    port: 5500,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
