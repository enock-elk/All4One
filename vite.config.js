import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEEP_LINK_RE = /^\/(DocumentManager|TrelloWatcher|CaseMaker|AffidavitAutomation|EmailGenerator)(\/index\.html)?\/?$/;

function rewriteDeepLinks() {
    return {
        name: 'all4one-deep-links',
        configureServer(server) {
            server.middlewares.use((req, _res, next) => {
                const [path, query] = (req.url || '').split('?');
                if (DEEP_LINK_RE.test(path)) {
                    req.url = query ? `/?${query}` : '/';
                }
                next();
            });
        },
        configurePreviewServer(server) {
            server.middlewares.use((req, _res, next) => {
                const [path, query] = (req.url || '').split('?');
                if (DEEP_LINK_RE.test(path)) {
                    req.url = query ? `/?${query}` : '/';
                }
                next();
            });
        },
    };
}

export default defineConfig({
  base: './',
  plugins: [
    rewriteDeepLinks(),
    react(),
    {
      name: 'stable-pwa-urls',
      closeBundle() {
        const indexPath = resolve('dist/index.html');
        try {
          const html = readFileSync(indexPath, 'utf8')
            .replace(/href="[^"]*manifest[^"]*\.json"/, 'href="./manifest.json"')
            .replace(/href="[^"]*icon-192[^"]*\.png"/g, 'href="./icons/icon-192.png"');
          writeFileSync(indexPath, html);
        } catch (_) {
          // dist/index.html may not exist during non-build runs
        }
      },
    },
  ],
  appType: 'spa',
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
