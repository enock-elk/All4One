import { createRoot } from 'react-dom/client';

let emailRoot = null;
let affidavitRoot = null;

function showReloadNeeded(el, label) {
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;padding:2rem;text-align:center;font-family:ui-sans-serif,system-ui,sans-serif;">
        <div>
          <p style="margin:0 0 0.75rem;font-weight:700;color:#0f172a;">${label} needs a refresh</p>
          <p style="margin:0 0 1.25rem;font-size:0.875rem;color:#64748b;max-width:22rem;">
            A new site build replaced this tab’s script. Reload once to pick it up.
          </p>
          <button type="button" onclick="location.reload()"
            style="padding:0.65rem 1.1rem;border-radius:0.75rem;background:#d97706;color:#0f172a;font-weight:700;border:0;cursor:pointer;">
            Reload
          </button>
        </div>
      </div>
    `;
}

async function mountEmail() {
    const el = document.getElementById('email-root');
    if (!el || emailRoot) return;
    try {
        const { default: EmailEngine } = await import('./EmailEngine.jsx');
        emailRoot = createRoot(el);
        emailRoot.render(<EmailEngine />);
    } catch (err) {
        console.error('Email Generator failed to load', err);
        showReloadNeeded(el, 'Email Generator');
    }
}

async function mountAffidavit() {
    const el = document.getElementById('affidavit-root');
    if (!el || affidavitRoot) return;
    try {
        const { default: AffidavitAutomation } = await import('./AffidavitAutomation.jsx');
        affidavitRoot = createRoot(el);
        affidavitRoot.render(<AffidavitAutomation />);
    } catch (err) {
        console.error('Affidavit Automation failed to load', err);
        showReloadNeeded(el, 'Affidavit Automation');
    }
}

export function registerReactTabs() {
    document.addEventListener('tab-activated', (e) => {
        const tab = e.detail;
        requestAnimationFrame(() => {
            if (tab === 'emails') void mountEmail();
            if (tab === 'affidavits') void mountAffidavit();
        });
    });
}
