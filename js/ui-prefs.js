// Shared workspace UI: pin/default tab, sidebar collapse, status badge, toasts

export const PREF_DEFAULT_TAB = 'all4one_default_tab';
export const PREF_SIDEBAR_COLLAPSED = 'all4one_sidebar_collapsed';

export const TAB_META = {
    'pdf-manager': { label: 'Document Manager', short: 'PDF tools & file bay' },
    dashboard: { label: 'Trello Watcher', short: 'Board activity monitor' },
    casemaker: { label: 'Case Maker', short: 'RyanGPT case builder' },
    affidavits: { label: 'Affidavit Automation', short: 'Expert affidavit drafts' },
    emails: { label: 'Draft Email Generator', short: 'Client email templates' },
};

export const NAV_TAB_ORDER = Object.keys(TAB_META);

let activeTabId = 'pdf-manager';

export function getDefaultTab() {
    const saved = localStorage.getItem(PREF_DEFAULT_TAB);
    return saved && TAB_META[saved] ? saved : 'pdf-manager';
}

export function setDefaultTab(tabId) {
    if (!TAB_META[tabId]) return;
    localStorage.setItem(PREF_DEFAULT_TAB, tabId);
    reorderSidebarNav(tabId);
    syncHeaderPin(tabId);
    syncSidebarPinMarkers();
}

export function reorderSidebarNav(pinnedTabId = getDefaultTab()) {
    const nav = document.getElementById('sidebar-nav');
    if (!nav) return;
    const buttons = [...nav.querySelectorAll('.tab-btn')];
    const order = [pinnedTabId, ...NAV_TAB_ORDER.filter((id) => id !== pinnedTabId)];
    order.forEach((id) => {
        const btn = buttons.find((b) => b.getAttribute('data-tab') === id);
        if (btn) nav.appendChild(btn);
    });
}

export function syncHeaderPin(tabId = activeTabId) {
    const btn = document.getElementById('header-pin-btn');
    const icon = document.getElementById('header-pin-icon');
    if (!btn || !icon) return;
    const isPinned = getDefaultTab() === tabId;
    btn.classList.toggle('is-pinned', isPinned);
    btn.title = isPinned ? 'Pinned as default workspace' : 'Pin as default workspace';
    icon.setAttribute('data-lucide', isPinned ? 'pin' : 'pin-off');
    if (window.lucide) window.lucide.createIcons();
}

export function syncSidebarPinMarkers() {
    const pinned = getDefaultTab();
    document.querySelectorAll('#sidebar-nav .tab-btn').forEach((btn) => {
        const tabId = btn.getAttribute('data-tab');
        btn.classList.toggle('is-pinned-tab', tabId === pinned);
    });
}

export function setAppStatus(label = 'SYSTEM ONLINE', tone = 'ok') {
    const headerStatusText = document.getElementById('header-status-text');
    const headerStatusDot = document.getElementById('header-status-dot');
    const headerStatusBadge = document.getElementById('header-status-badge');
    if (headerStatusText) headerStatusText.textContent = label;

    if (!headerStatusDot || !headerStatusBadge) return;

    headerStatusDot.classList.remove('bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'animate-pulse');
    headerStatusBadge.classList.remove(
        'bg-emerald-500/10', 'border-emerald-500/20',
        'bg-amber-500/10', 'border-amber-500/20',
        'bg-rose-500/10', 'border-rose-500/20',
    );
    headerStatusText.classList.remove(
        'text-emerald-600', 'dark:text-emerald-400',
        'text-amber-600', 'dark:text-amber-400',
        'text-rose-600', 'dark:text-rose-400',
    );

    if (tone === 'error') {
        headerStatusDot.classList.add('bg-rose-500');
        headerStatusBadge.classList.add('bg-rose-500/10', 'border-rose-500/20');
        headerStatusText.classList.add('text-rose-600', 'dark:text-rose-400');
    } else if (tone === 'busy') {
        headerStatusDot.classList.add('bg-amber-500', 'animate-pulse');
        headerStatusBadge.classList.add('bg-amber-500/10', 'border-amber-500/20');
        headerStatusText.classList.add('text-amber-600', 'dark:text-amber-400');
    } else {
        headerStatusDot.classList.add('bg-emerald-500', 'animate-pulse');
        headerStatusBadge.classList.add('bg-emerald-500/10', 'border-emerald-500/20');
        headerStatusText.classList.add('text-emerald-600', 'dark:text-emerald-400');
    }
}

export function isSidebarCollapsed() {
    return localStorage.getItem(PREF_SIDEBAR_COLLAPSED) === 'true';
}

export function setSidebarCollapsed(collapsed) {
    localStorage.setItem(PREF_SIDEBAR_COLLAPSED, collapsed ? 'true' : 'false');
    const sidebar = document.getElementById('app-sidebar');
    if (!sidebar) return;

    sidebar.classList.toggle('is-collapsed', collapsed);

    const brand = document.getElementById('sidebar-brand-toggle');
    if (brand) {
        brand.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
        brand.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }
}

export function expandSidebar() {
    setSidebarCollapsed(false);
}

export function collapseSidebar() {
    setSidebarCollapsed(true);
}

export function initHeaderPin() {
    const btn = document.getElementById('header-pin-btn');
    btn?.addEventListener('click', () => {
        if (getDefaultTab() === activeTabId) return;
        setDefaultTab(activeTabId);
        showAppToast(`${TAB_META[activeTabId].label} pinned — opens first on login.`);
    });
    syncHeaderPin(activeTabId);
}

export function initSidebarCollapse() {
    const brand = document.getElementById('sidebar-brand-toggle');
    brand?.addEventListener('click', () => {
        setSidebarCollapsed(!isSidebarCollapsed());
    });

    setSidebarCollapsed(isSidebarCollapsed());
    syncSidebarPinMarkers();
    reorderSidebarNav(getDefaultTab());
}

export function onWorkspaceTabActivated(tabId) {
    activeTabId = tabId;
    syncHeaderPin(tabId);
    setAppStatus('SYSTEM ONLINE', 'ok');
}

export function initWorkspacePrefs() {
    initHeaderPin();
    initSidebarCollapse();
}

let toastTimer = null;

export function showAppToast(message, duration = 2600) {
    const el = document.getElementById('app-toast');
    if (!el) return;
    hideActionToast();
    el.textContent = message;
    el.classList.remove('hidden');
    el.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
}

export function showActionToast({ message, primaryLabel, onPrimary, secondaryLabel = 'Not now', onSecondary }) {
    const el = document.getElementById('app-toast-actions');
    const msg = document.getElementById('app-toast-actions-msg');
    const primary = document.getElementById('app-toast-actions-primary');
    const secondary = document.getElementById('app-toast-actions-secondary');
    if (!el || !msg || !primary || !secondary) return;

    document.getElementById('app-toast')?.classList.add('hidden');

    msg.textContent = message;
    primary.textContent = primaryLabel;
    secondary.textContent = secondaryLabel;

    const close = () => el.classList.add('hidden');

    const onPrimaryClick = () => {
        close();
        onPrimary?.();
    };
    const onSecondaryClick = () => {
        close();
        onSecondary?.();
    };

    primary.replaceWith(primary.cloneNode(true));
    secondary.replaceWith(secondary.cloneNode(true));

    document.getElementById('app-toast-actions-primary')?.addEventListener('click', onPrimaryClick, { once: true });
    document.getElementById('app-toast-actions-secondary')?.addEventListener('click', onSecondaryClick, { once: true });

    el.classList.remove('hidden');
    el.style.opacity = '1';
}

export function hideActionToast() {
    document.getElementById('app-toast-actions')?.classList.add('hidden');
}

window.setAppStatus = setAppStatus;
