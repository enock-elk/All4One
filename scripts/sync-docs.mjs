import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const docs = resolve(root, 'docs');
const TAB_SLUGS = [
  'DocumentManager',
  'TrelloWatcher',
  'CaseMaker',
  'AffidavitAutomation',
  'EmailGenerator',
];

if (!existsSync(dist)) {
  console.error('dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

rmSync(docs, { recursive: true, force: true });
mkdirSync(docs, { recursive: true });
cpSync(dist, docs, { recursive: true });
writeFileSync(resolve(docs, '.nojekyll'), '');

const appIndex = resolve(docs, 'index.html');
for (const slug of TAB_SLUGS) {
  cpSync(appIndex, resolve(docs, `${slug}.html`));
}

console.log('Copied dist/ → docs/ for GitHub Pages.');
console.log('Wrote deep-link shells:', TAB_SLUGS.join(', '));
