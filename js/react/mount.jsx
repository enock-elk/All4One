import { createRoot } from 'react-dom/client';

let emailRoot = null;
let affidavitRoot = null;

async function mountEmail() {
    const el = document.getElementById('email-root');
    if (!el || emailRoot) return;
    const { default: EmailEngine } = await import('./EmailEngine.jsx');
    emailRoot = createRoot(el);
    emailRoot.render(<EmailEngine />);
}

async function mountAffidavit() {
    const el = document.getElementById('affidavit-root');
    if (!el || affidavitRoot) return;
    const { default: AffidavitAutomation } = await import('./AffidavitAutomation.jsx');
    affidavitRoot = createRoot(el);
    affidavitRoot.render(<AffidavitAutomation />);
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
