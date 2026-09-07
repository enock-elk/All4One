// Sync RyanGPT Case Maker (Apps Script iframe) with All4One dark/light mode.
// The widget is cross-origin, so the parent can only request a theme change.
// Case Maker must apply it — paste gas/casemaker-theme-sync.js into that project.

import { markTabReady, showWorkspaceLoader, updateWorkspaceLoader } from './workspace-loader.js';

const CASEMAKER_HOST_SUFFIXES = ['script.google.com', 'script.googleusercontent.com'];

function isCaseMakerOrigin(origin) {
    try {
        const host = new URL(origin).hostname;
        return CASEMAKER_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
    } catch {
        return false;
    }
}

export function getAll4OneTheme() {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

let caseMakerSource = null;
let caseMakerOrigin = '';
let caseMakerReady = false;

export function postCaseMakerTheme() {
    if (!caseMakerSource) return;
    const theme = getAll4OneTheme();
    const target = caseMakerOrigin || '*';
    try {
        caseMakerSource.postMessage({ type: 'casemaker:ack' }, target);
        caseMakerSource.postMessage({ type: 'casemaker:theme', theme }, target);
    } catch {
        // Cross-origin reply can fail if the inner frame navigated away.
    }
}

function onHostMessage(event) {
    if (!isCaseMakerOrigin(event.origin)) return;
    const type = event.data && event.data.type;
    if (type !== 'casemaker:ready') return;
    caseMakerSource = event.source;
    caseMakerOrigin = event.origin;
    caseMakerReady = true;
    markTabReady('casemaker');
    postCaseMakerTheme();
    document.dispatchEvent(new CustomEvent('casemaker-ready'));
}

// Register immediately — Case Maker announces ready on a timer, but the first
// ping can arrive before DOMContentLoaded if the iframe starts during parse.
window.addEventListener('message', onHostMessage);

export function loadCaseMakerFrameIfNeeded() {
    const iframe = document.getElementById('casemaker-frame');
    if (!iframe) return;
    const base = iframe.getAttribute('data-src');
    if (!base) return;
    if (caseMakerReady && iframe.getAttribute('src')) {
        markTabReady('casemaker');
        return;
    }
    if (iframe.getAttribute('src')) return;
    showWorkspaceLoader('casemaker', 16, 'Connecting to RyanGPT…');
    iframe.src = `${base}?theme=${encodeURIComponent(getAll4OneTheme())}`;
}

export function initCaseMakerThemeSync() {
    const iframe = document.getElementById('casemaker-frame');
    if (iframe) {
        iframe.addEventListener('load', () => {
            if (!caseMakerReady) {
                updateWorkspaceLoader('casemaker', 78, 'Finishing Case Maker…');
            }
            window.setTimeout(postCaseMakerTheme, 400);
            window.setTimeout(() => {
                if (!caseMakerReady) markTabReady('casemaker');
            }, 12000);
        });
    }
}
