import { createRoot } from 'react-dom/client';
import {
    beginLazyTabLoad,
    driftWorkspaceLoader,
    hideWorkspaceLoader,
    isTabReady,
    markTabReady,
    updateWorkspaceLoader,
} from '../workspace-loader.js';

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

async function mountLazyPanel(tabId, el, importer, label) {
    if (!el) return;
    if (tabId === 'emails' && emailRoot) {
        markTabReady(tabId);
        return;
    }
    if (tabId === 'affidavits' && affidavitRoot) {
        markTabReady(tabId);
        return;
    }

    beginLazyTabLoad(tabId, `Downloading ${label}…`);
    try {
        updateWorkspaceLoader(tabId, 28, `Downloading ${label}…`);
        driftWorkspaceLoader(tabId, 30, 68, 8000, `Downloading ${label}…`);
        const { default: Panel } = await importer();
        updateWorkspaceLoader(tabId, 82, `Starting ${label}…`);
        const root = createRoot(el);
        root.render(<Panel />);
        if (tabId === 'emails') emailRoot = root;
        if (tabId === 'affidavits') affidavitRoot = root;
        requestAnimationFrame(() => markTabReady(tabId));
    } catch (err) {
        console.error(`${label} failed to load`, err);
        hideWorkspaceLoader(tabId);
        showReloadNeeded(el, label);
    }
}

async function mountEmail() {
    const el = document.getElementById('email-root');
    if (!el || emailRoot) {
        if (emailRoot) markTabReady('emails');
        return;
    }
    await mountLazyPanel('emails', el, () => import('./EmailEngine.jsx'), 'Email Generator');
}

async function mountAffidavit() {
    const el = document.getElementById('affidavit-root');
    if (!el || affidavitRoot) {
        if (affidavitRoot) markTabReady('affidavits');
        return;
    }
    await mountLazyPanel('affidavits', el, () => import('./AffidavitAutomation.jsx'), 'Affidavit Automation');
}

function prefetchReactTabs() {
    if (!isTabReady('affidavits')) void import('./AffidavitAutomation.jsx');
    if (!isTabReady('emails')) void import('./EmailEngine.jsx');
}

export function registerReactTabs() {
    document.addEventListener('tab-activated', (e) => {
        const tab = e.detail;
        requestAnimationFrame(() => {
            if (tab === 'emails') void mountEmail();
            if (tab === 'affidavits') void mountAffidavit();
        });
    });

    const idle = window.requestIdleCallback || ((fn) => window.setTimeout(fn, 700));
    idle(() => prefetchReactTabs());

    document.addEventListener('pointerenter', (event) => {
        const btn = event.target?.closest?.('.tab-btn[data-tab="affidavits"], .tab-btn[data-tab="emails"]');
        if (btn) prefetchReactTabs();
    }, true);
}
