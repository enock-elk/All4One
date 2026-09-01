// Shared workspace UI: default tab preference + toast helpers

export const PREF_DEFAULT_TAB = 'all4one_default_tab';

export const TAB_META = {
    'pdf-manager': { label: 'Document Manager', short: 'PDF tools & file bay' },
    dashboard: { label: 'Trello Watcher', short: 'Board activity monitor' },
    casemaker: { label: 'Case Maker', short: 'RyanGPT case builder' },
    affidavits: { label: 'Affidavit Automation', short: 'Expert affidavit drafts' },
    emails: { label: 'Draft Email Generator', short: 'Client email templates' },
};

export function getDefaultTab() {
    const saved = localStorage.getItem(PREF_DEFAULT_TAB);
    return saved && TAB_META[saved] ? saved : 'pdf-manager';
}

export function setDefaultTab(tabId) {
    if (!TAB_META[tabId]) return;
    localStorage.setItem(PREF_DEFAULT_TAB, tabId);
    syncDefaultTabButtons();
}

export function syncDefaultTabButtons() {
    const current = getDefaultTab();
    document.querySelectorAll('[data-default-tab-btn]').forEach((btn) => {
        const tabId = btn.getAttribute('data-default-tab-btn');
        const isDefault = tabId === current;
        btn.classList.toggle('is-default', isDefault);
        const label = TAB_META[tabId]?.label || tabId;
        btn.innerHTML = isDefault
            ? `<i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i><span>Default workspace</span>`
            : `<i data-lucide="star" class="w-3.5 h-3.5"></i><span>Set ${label} as default</span>`;
    });
    if (window.lucide) window.lucide.createIcons();
}

function workspacePrefsMarkup(tabId) {
    const meta = TAB_META[tabId];
    if (!meta) return '';
    return `
        <div class="workspace-prefs" data-workspace-prefs="${tabId}">
            <div class="workspace-prefs-copy">
                <div class="workspace-prefs-title">Startup workspace</div>
                <div class="workspace-prefs-desc">Choose which tool opens automatically when you sign in.</div>
            </div>
            <button type="button" class="workspace-prefs-btn" data-default-tab-btn="${tabId}" aria-label="Set ${meta.label} as default workspace"></button>
        </div>
    `;
}

export function mountWorkspacePrefs() {
    document.querySelectorAll('[data-workspace-prefs-slot]').forEach((slot) => {
        const tabId = slot.getAttribute('data-workspace-prefs-slot');
        slot.innerHTML = workspacePrefsMarkup(tabId);
    });
}

export function initWorkspacePrefs() {
    mountWorkspacePrefs();
    document.querySelectorAll('[data-default-tab-btn]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-default-tab-btn');
            if (getDefaultTab() === tabId) return;
            setDefaultTab(tabId);
            showAppToast(`${TAB_META[tabId].label} will open on login.`);
        });
    });
    syncDefaultTabButtons();
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
