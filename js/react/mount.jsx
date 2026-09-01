import { createRoot } from 'react-dom/client';
import EmailEngine from './EmailEngine.jsx';
import AffidavitAutomation from './AffidavitAutomation.jsx';

let emailRoot = null;
let affidavitRoot = null;

export function mountEmail() {
    const el = document.getElementById('email-root');
    if (!el || emailRoot) return;
    emailRoot = createRoot(el);
    emailRoot.render(<EmailEngine />);
}

export function mountAffidavit() {
    const el = document.getElementById('affidavit-root');
    if (!el || affidavitRoot) return;
    affidavitRoot = createRoot(el);
    affidavitRoot.render(<AffidavitAutomation />);
}
