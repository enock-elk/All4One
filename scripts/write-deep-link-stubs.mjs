import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const slugs = [
    'DocumentManager',
    'TrelloWatcher',
    'CaseMaker',
    'AffidavitAutomation',
    'EmailGenerator',
];

const root = resolve(import.meta.dirname, '..');

for (const slug of slugs) {
    const dir = resolve(root, slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>All4One — ${slug}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script>
        (function () {
            try { sessionStorage.setItem('all4one_deep_link', '/${slug}' + location.search + location.hash); } catch (e) {}
            if (!location.hostname.endsWith('github.io')) {
                location.replace('/?tab=${slug}' + (location.hash || ''));
                return;
            }
            var parts = location.pathname.split('/').filter(Boolean);
            var repo = parts[0] || 'All4One';
            location.replace('/' + repo + '/docs/${slug}' + location.search + location.hash);
        })();
    </script>
</head>
<body>
    <p style="font-family:ui-sans-serif,system-ui,sans-serif;padding:2rem;color:#64748b;">Opening ${slug}…</p>
</body>
</html>
`);
}

console.log('Wrote deep-link stubs for', slugs.join(', '));
