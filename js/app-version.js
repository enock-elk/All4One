export const APP_VERSION = '1.2.4';
export const APP_RELEASE_DATE = '7 September 2026';

/** Newest first. Shown when SYSTEM ONLINE is clicked. */
export const APP_CHANGELOG = [
  {
    version: '1.2.4',
    date: '7 Sep 2026',
    items: [
      'Email paragraph spacing now uses the official-like intermediate line height instead of the tighter previous value.',
      'Discrepancy lists flow directly into “or alternatively” without an extra blank paragraph.',
      'Disclaimer line spacing is increased to match the less-dense official signature.',
    ],
  },
  {
    version: '1.2.3',
    date: '7 Sep 2026',
    items: [
      'Signature colours now use sampled official values: Namir Waisberg #B3936E and contact labels #7F7F7F.',
      'Disclaimer uses #D0CECE with a subtle #EEDDD1 peach shadow; the name uses a subtle #E9BF81 shadow.',
    ],
  },
  {
    version: '1.2.2',
    date: '7 Sep 2026',
    items: [
      'Email signature more closely matches the official Gmail version: normal-sized name, fixed 302 px logo, and lighter contact labels.',
      'Disclaimer uses a warm brown-grey and email body spacing is tightened to one empty row after the greeting.',
    ],
  },
  {
    version: '1.2.1',
    date: '7 Sep 2026',
    items: [
      'Gmail MIME keeps the required blank line between headers and body, fixing drafts that arrived with an empty body.',
      'Connected Gmail users push directly through the Gmail API without the obsolete backend fallback notice.',
    ],
  },
  {
    version: '1.2.0',
    date: '7 Sep 2026',
    items: [
      'Gmail drafts keep a real em dash in the subject and include the HTML body (UTF-8 MIME).',
      'Document lists use visible bullet points in the preview and in Gmail.',
      'Workspace header uses a mid navy strip; SYSTEM ONLINE opens this version history.',
    ],
  },
  {
    version: '1.1.0',
    date: '7 Sep 2026',
    items: [
      'Connect Gmail requests a gmail.compose token via Google Identity Services (Firebase login alone has no Gmail token).',
      'Email preview stays on a white page in dark mode, like Affidavit Automation.',
      'Blank line between Namir and Namir Waisberg in the signature.',
      'Clearer Connect Gmail errors for unauthorized domain and disabled Google sign-in.',
    ],
  },
  {
    version: '1.0.2',
    date: '7 Sep 2026',
    items: [
      'Case Maker iframe follows All4One light/dark after the Apps Script theme snippet is deployed.',
      'Nine standardized (DRAFT) email templates in Communications.',
    ],
  },
  {
    version: '1.0.1',
    date: '7 Sep 2026',
    items: [
      'GitHub Pages /docs snapshot rebuilds automatically from main.',
      'Reload prompt when a stale Pages bundle blanks Affidavit or Email tabs.',
    ],
  },
];

function renderVersionPanel() {
  const panel = document.getElementById('app-version-panel');
  if (!panel) return;
  const latest = APP_CHANGELOG[0];
  const history = APP_CHANGELOG.map((entry) => `
    <section class="app-version-entry">
      <div class="app-version-entry-head">
        <strong>v${entry.version}</strong>
        <span>${entry.date}</span>
      </div>
      <ul>
        ${entry.items.map((item) => `<li>${item}</li>`).join('')}
      </ul>
    </section>
  `).join('');

  panel.innerHTML = `
    <div class="app-version-card">
      <p class="app-version-kicker">All4One Command Center</p>
      <p class="app-version-current">Version ${APP_VERSION}</p>
      <p class="app-version-date">${APP_RELEASE_DATE}${latest ? ` · ${latest.items[0]}` : ''}</p>
      <div class="app-version-list">${history}</div>
    </div>
  `;
}

export function initVersionPanel() {
  const badge = document.getElementById('header-status-badge');
  const panel = document.getElementById('app-version-panel');
  if (!badge || !panel) return;

  renderVersionPanel();
  badge.setAttribute('aria-expanded', 'false');
  badge.setAttribute('aria-controls', 'app-version-panel');

  const close = () => {
    panel.classList.add('hidden');
    badge.setAttribute('aria-expanded', 'false');
  };

  badge.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !open);
    badge.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  document.addEventListener('click', (event) => {
    if (panel.classList.contains('hidden')) return;
    if (panel.contains(event.target) || badge.contains(event.target)) return;
    close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
}

window.ALL4ONE_APP_VERSION = APP_VERSION;
