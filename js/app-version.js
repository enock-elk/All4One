export const APP_VERSION = '1.3.19';
export const APP_RELEASE_DATE = '26 October 2026';

/** Newest first. Shown when SYSTEM ONLINE is clicked. */
export const APP_CHANGELOG = [
  {
    version: '1.3.19',
    date: '26 Oct 2026',
    items: [
      'Push to Gmail requires Subject, Recipient name, Claimant title (not Mr/Ms), Claimant name, and every field in a selected block.',
      'Subject starts with (DRAFT) so you can paste the rest. Copy HTML still works without a subject.',
      'The signature E / W line no longer has extra spaces between the email and website.',
    ],
  },
  {
    version: '1.3.18',
    date: '19 Oct 2026',
    items: [
      'Email drafts have a Reset button that clears the current template fields.',
      'Muted Trello lists no longer fire alerts when the fallback worker is in use.',
      'Gmail no longer prompts or opens Google auth when Communications loads; connect only when you choose.',
      'Accident Page A and Page B sit to the right of Source A when both dates share a document.',
    ],
  },
  {
    version: '1.3.17',
    date: '14 Oct 2026',
    items: [
      'The signature email address uses the same blue as the website link.',
      'The sentence that the calculation depends on the requested information stays with the Wrongful Arrest date-of-incident block.',
      'Gmail renews a previous connection when you come back. Push stays off until that connection is live again.',
      'Trello Watcher keeps Alert type with the sound and start controls.',
    ],
  },
  {
    version: '1.3.16',
    date: '13 Oct 2026',
    items: [
      'Formal and informal earnings can leave out the IP-document list. The Kubheka paragraph is written once, on the first earnings block, and the informal request sentence can be edited.',
      'The 24-hour close is always in the draft.',
      'Clear Bay sits on the right of the bay controls, and the page preview shows one sharp page.',
    ],
  },
  {
    version: '1.3.15',
    date: '12 Oct 2026',
    items: [
      'Trello Watcher and Document Manager controls use the same button style.',
      'Email Generator asks before connecting Gmail, and confirms when the account is connected.',
      'Master LOS starts with only the 24-hour close, thanks the dependants, and can ask for the IP-report documents.',
    ],
  },
  {
    version: '1.3.14',
    date: '12 Oct 2026',
    items: [
      'Salary Inflation carries the LCG mark, and the working stays closed until it is opened.',
      'LOS Dependants Draft asks for the IP-report documents. Death, birth, and marriage certificates are no longer source choices.',
      'A new split range starts on the page after the previous range and runs to the end.',
      'The desktop side menu no longer shows a horizontal scrollbar.',
    ],
  },
  {
    version: '1.3.13',
    date: '12 Oct 2026',
    items: [
      'Salary Inflation takes any year, remembers how often the amount is paid, and shows the factor as fractions.',
      'The email form and preview can be resized, and the preview can be edited before it is copied or pushed.',
      'Clearer payslips can also ask for bank statements, and bullets are Gmail lists.',
      'Master LOE asks for page numbers when both accident dates come from the same document. Master LOS Draft sits under it.',
    ],
  },
  {
    version: '1.3.12',
    date: '12 Oct 2026',
    items: [
      'Phones open every workspace, Dark Mode, Sign Out, and Install app from the header menu.',
      'Salary Inflation brings an amount from one year to another with the LOE December CPI plus the 1% premium.',
      'Trello lists can be muted, the setup is a wide box, the case counter can be dragged, and alert sound and background sound are separate.',
      'Gmail stays connected between visits. Push to Gmail waits until Gmail is connected, and draft notices clear on their own.',
      'The signature email address uses the same grey as E. Kept legacy drafts use the Master LOE closing, and covered drafts are removed.',
    ],
  },
  {
    version: '1.3.11',
    date: '8 Oct 2026',
    items: [
      'The affidavit workspace is labeled Affidavit Generator. The AffidavitAutomation link is unchanged.',
      'Master LOE document names are dropdowns, with Other for a name that is not on the list.',
      'Phones keep the workspaces in a bottom bar. Light mode, sign out, and Install app live in the header menu.',
      'Email and Trello use a phone layout, and All4One can be installed as an app.',
    ],
  },
  {
    version: '1.3.10',
    date: '8 Oct 2026',
    items: [
      'A later request in the Master LOE draft starts with “Also, kindly” when another request is already above it.',
      'Discrepancy in Accident Dates asks for the two dates and lets you pick the document each one comes from.',
      'Trello fullscreen keeps the clock, and the floating board opens tall enough for every watched list.',
      'Phones use a bottom navigation bar, and the email and affidavit workspaces stack instead of sitting side by side.',
    ],
  },
  {
    version: '1.3.9',
    date: '8 Oct 2026',
    items: [
      'Loss of Earnings and Wrongful Arrest are separate openings, so a draft uses only one of them.',
      'The subject can be typed over the automatic subject, and the claimant title is a dropdown.',
      'The note that the calculation increases the claim sits inside the Wrongful Arrest opening.',
      'Trello’s console is a small top-right panel that opens on its own, and the case counter stays two rows high.',
      'Document Manager marks the tool tab you are on.',
    ],
  },
  {
    version: '1.3.8',
    date: '8 Oct 2026',
    items: [
      'Master LOE is the first email template. It opens addressed to the instructing attorneys, and every blank in the selected blocks can be edited.',
      'Request blocks are ticked individually and stitched into one draft. A leading “Also” is kept only when another request already sits above that block.',
      'Trello Watcher keeps the case grid low on the wallpaper, copies the full console log, and no longer washes the wallpaper with a light filter or a dark filter that stops when you scroll.',
    ],
  },
  {
    version: '1.3.7',
    date: '7 Sep 2026',
    items: [
      'Shareable tab links such as /TrelloWatcher and /AffidavitAutomation open that workspace directly.',
      'A first visit from a deep link pins that tab; existing pins are left alone.',
      'Case Maker and Affidavit Automation show loading progress instead of a blank panel.',
    ],
  },
  {
    version: '1.3.6',
    date: '7 Sep 2026',
    items: [
      'The ALL4ONE corner glow is a softer, more gradual yellow wash to match the header’s right-side light.',
      'The sidebar collapse control is a quieter, taller <| glyph instead of a boxed panel icon.',
    ],
  },
  {
    version: '1.3.5',
    date: '7 Sep 2026',
    items: [
      'The workspace opens immediately without a landing-name gate.',
      'Affidavit export asks for a name only when none is saved, then keeps that name on this browser.',
      'Trello and Gmail connections reuse their existing sign-in screens and supply the saved name for affidavit logs when available.',
    ],
  },
  {
    version: '1.3.4',
    date: '7 Sep 2026',
    items: [
      'Expanded sidebar now has a clear corner collapse control that disappears in compact mode.',
      'Each workspace tab has a quiet bottom-right pin control for choosing the default workspace; pins hide when compact.',
      'The ALL4ONE corner control uses a restrained flat treatment while the selected tab keeps its gradient emphasis.',
    ],
  },
  {
    version: '1.3.3',
    date: '7 Sep 2026',
    items: [
      'ALL4ONE branding is integrated into the square corner of the L-shaped shell so it no longer resembles a navigation tab.',
      'The header now uses a larger active-tab title and matching tab icon, with the redundant Workspace label removed.',
      'The remaining sidebar/header seam and vertical divider were removed for a continuous shell surface.',
    ],
  },
  {
    version: '1.3.2',
    date: '7 Sep 2026',
    items: [
      'Sidebar and top header now read as one continuous L-shaped gradient shell with a joined inner accent edge.',
      'Navigation items use raised glass-button surfaces, borders, and shadows for clearer interaction affordance.',
    ],
  },
  {
    version: '1.3.1',
    date: '7 Sep 2026',
    items: [
      'Sidebar and workspace header now use a more intentional layered navy, amber, and blue gradient system.',
      'Navigation states, icon tiles, brand treatment, status badge, and header controls have clearer visual depth without changing behavior.',
    ],
  },
  {
    version: '1.3.0',
    date: '7 Sep 2026',
    items: [
      'Discrepancy values and their matching sources now share one input row.',
      'Claimant earnings requests can add Payslips, Bank statements, and Affidavit entries individually or as one common set, while keeping custom lines editable.',
      'Email usage and affidavit exports are routed to the All4One-Email and All4One-Affidavits tabs in the shared command queue sheet.',
    ],
  },
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
