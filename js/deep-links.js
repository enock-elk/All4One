import { TAB_META, getDefaultTab, hasExplicitPinnedTab, setDefaultTab } from './ui-prefs.js';

const DEEP_LINK_STORAGE = 'all4one_deep_link';
const BASE_SEGMENTS = new Set(['all4one', 'docs']);

export const TAB_SLUGS = {
    'pdf-manager': 'DocumentManager',
    dashboard: 'TrelloWatcher',
    casemaker: 'CaseMaker',
    affidavits: 'AffidavitAutomation',
    emails: 'EmailGenerator',
};

const SLUG_ALIASES = {
    documentmanager: 'pdf-manager',
    'document-manager': 'pdf-manager',
    pdfmanager: 'pdf-manager',
    'pdf-manager': 'pdf-manager',
    pdf: 'pdf-manager',
    files: 'pdf-manager',

    trellowatcher: 'dashboard',
    trelowatcher: 'dashboard',
    'trello-watcher': 'dashboard',
    trello: 'dashboard',
    dashboard: 'dashboard',
    boards: 'dashboard',

    casemaker: 'casemaker',
    'case-maker': 'casemaker',
    ryangpt: 'casemaker',
    'ryan-gpt': 'casemaker',

    affidavitautomation: 'affidavits',
    'affidavit-automation': 'affidavits',
    affidavits: 'affidavits',
    affidavit: 'affidavits',

    emailgenerator: 'emails',
    'email-generator': 'emails',
    draftemailgenerator: 'emails',
    'draft-email-generator': 'emails',
    emails: 'emails',
    email: 'emails',
    communications: 'emails',
};

function normalizeToken(value) {
    return String(value || '')
        .trim()
        .replace(/\/+$/, '')
        .replace(/\.html$/i, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
}

export function tabIdFromSlug(value) {
    const compact = normalizeToken(value);
    if (!compact || BASE_SEGMENTS.has(compact)) return '';
    if (TAB_META[value]) return value;
    return SLUG_ALIASES[compact] || SLUG_ALIASES[String(value || '').toLowerCase()] || '';
}

export function getRouteBase() {
    const parts = location.pathname.split('/').filter(Boolean);
    const keep = [];
    for (const part of parts) {
        if (BASE_SEGMENTS.has(part.toLowerCase())) keep.push(part);
        else break;
    }
    return keep.length ? `/${keep.join('/')}` : '';
}

export function tabHref(tabId) {
    const slug = TAB_SLUGS[tabId] || TAB_SLUGS[getDefaultTab()];
    return `${getRouteBase()}/${slug}`;
}

function tokenFromPath(pathname) {
    const parts = String(pathname || '').split('/').filter(Boolean);
    while (parts.length) {
        const last = parts.pop();
        if (!last || last.toLowerCase() === 'index.html') continue;
        if (BASE_SEGMENTS.has(last.toLowerCase())) return '';
        return last;
    }
    return '';
}

function tokenFromHash(hash) {
    return String(hash || '').replace(/^#\/?/, '').split(/[/?#]/)[0];
}

function readStoredDeepLink() {
    try {
        const stored = sessionStorage.getItem(DEEP_LINK_STORAGE);
        if (!stored) return '';
        sessionStorage.removeItem(DEEP_LINK_STORAGE);
        return stored;
    } catch {
        return '';
    }
}

function tabFromUrlParts(pathname, search, hash) {
    const queryTab = tabIdFromSlug(new URLSearchParams(String(search || '').replace(/^\?/, '')).get('tab'));
    if (queryTab) return queryTab;
    const hashTab = tabIdFromSlug(tokenFromHash(hash));
    if (hashTab) return hashTab;
    return tabIdFromSlug(tokenFromPath(pathname));
}

export function resolveIncomingTab() {
    // The address bar always wins. Session storage is only a 404-bounce fallback
    // when the current path has no tab slug (for example /All4One/docs/).
    const live = tabFromUrlParts(location.pathname, location.search, location.hash);
    if (live) {
        try { sessionStorage.removeItem(DEEP_LINK_STORAGE); } catch { /* ignore */ }
        return live;
    }

    const stored = readStoredDeepLink();
    if (!stored) return '';
    try {
        const url = new URL(stored, location.origin);
        return tabFromUrlParts(url.pathname, url.search, url.hash);
    } catch {
        return tabFromUrlParts(stored, '', '');
    }
}

export function applyFirstVisitPin(tabId) {
    if (!TAB_META[tabId] || hasExplicitPinnedTab()) return false;
    setDefaultTab(tabId);
    return true;
}

export function syncTabUrl(tabId, { replace = false } = {}) {
    if (!TAB_META[tabId]) return;
    const next = tabHref(tabId);
    const current = `${location.pathname.replace(/\/$/, '') || '/'}`;
    const target = next.replace(/\/$/, '') || '/';
    if (current === target && !location.hash && !new URLSearchParams(location.search).get('tab')) return;
    const method = replace ? 'replaceState' : 'pushState';
    history[method]({ tab: tabId }, '', next);
}

export function bindTabHistory(activateTab) {
    window.addEventListener('popstate', (event) => {
        const tabId = event.state?.tab || resolveIncomingTab() || getDefaultTab();
        activateTab(tabId, { skipHistory: true });
    });
}

export function rememberDeepLinkForPages(path) {
    try {
        sessionStorage.setItem(DEEP_LINK_STORAGE, path);
    } catch {
        // Private mode can block storage; the pathname still works after a SPA fallback.
    }
}
