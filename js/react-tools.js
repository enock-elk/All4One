import { mountEmail, mountAffidavit } from './react/mount.jsx';

document.addEventListener('tab-activated', (e) => {
    const tab = e.detail;
    if (tab === 'emails') mountEmail();
    if (tab === 'affidavits') mountAffidavit();
});
