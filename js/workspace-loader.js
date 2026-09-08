import { TAB_META } from './ui-prefs.js';

const readyTabs = new Set();
const timers = new Map();
const shownAt = new Map();

function loaderId(tabId) {
    return `${tabId}-loader`;
}

function ensureLoader(tabId) {
    const tab = document.getElementById(`tab-${tabId}`);
    if (!tab) return null;
    let el = document.getElementById(loaderId(tabId));
    if (el) return el;

    tab.classList.add('relative');
    const label = TAB_META[tabId]?.label || 'Workspace';
    el = document.createElement('div');
    el.id = loaderId(tabId);
    el.className = 'workspace-loader hidden';
    el.innerHTML = `
      <div class="workspace-loader-card">
        <div class="workspace-loader-mark" aria-hidden="true"></div>
        <p class="workspace-loader-kicker">Loading workspace</p>
        <p class="workspace-loader-title">${label}</p>
        <p class="workspace-loader-status" data-loader-status>Preparing…</p>
        <div class="workspace-loader-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="${label} loading progress">
          <div class="workspace-loader-bar" data-loader-bar></div>
        </div>
        <p class="workspace-loader-pct" data-loader-pct>0%</p>
      </div>
    `;
    tab.prepend(el);
    return el;
}

export function isTabReady(tabId) {
    return readyTabs.has(tabId);
}

export function markTabReady(tabId) {
    readyTabs.add(tabId);
    const elapsed = performance.now() - (shownAt.get(tabId) || performance.now());
    const wait = Math.max(0, 520 - elapsed);
    updateWorkspaceLoader(tabId, 100, 'Ready');
    window.setTimeout(() => {
        hideWorkspaceLoader(tabId);
        shownAt.delete(tabId);
    }, wait);
}

export function showWorkspaceLoader(tabId, percent = 8, status = 'Opening…') {
    if (readyTabs.has(tabId)) return;
    const el = ensureLoader(tabId);
    if (!el) return;
    el.classList.remove('hidden');
    if (!shownAt.has(tabId)) shownAt.set(tabId, performance.now());
    updateWorkspaceLoader(tabId, percent, status);
}

export function updateWorkspaceLoader(tabId, percent, status) {
    const timer = timers.get(tabId);
    if (timer) {
        cancelAnimationFrame(timer);
        timers.delete(tabId);
    }
    const el = document.getElementById(loaderId(tabId));
    if (!el || el.classList.contains('hidden')) return;
    const value = Math.max(0, Math.min(100, Math.round(percent)));
    const bar = el.querySelector('[data-loader-bar]');
    const pct = el.querySelector('[data-loader-pct]');
    const label = el.querySelector('[data-loader-status]');
    const track = el.querySelector('[role="progressbar"]');
    if (bar) bar.style.width = `${value}%`;
    if (pct) pct.textContent = `${value}%`;
    if (label && status) label.textContent = status;
    if (track) track.setAttribute('aria-valuenow', String(value));
}

export function hideWorkspaceLoader(tabId) {
    const timer = timers.get(tabId);
    if (timer) {
        cancelAnimationFrame(timer);
        timers.delete(tabId);
    }
    const el = document.getElementById(loaderId(tabId));
    if (!el) return;
    updateWorkspaceLoader(tabId, 100, 'Ready');
    window.setTimeout(() => el.classList.add('hidden'), 220);
}

export function driftWorkspaceLoader(tabId, from, to, duration, status) {
    if (readyTabs.has(tabId)) return;
    const start = performance.now();
    const previous = timers.get(tabId);
    if (previous) cancelAnimationFrame(previous);

    const tick = (now) => {
        if (readyTabs.has(tabId)) return;
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - (1 - t) * (1 - t);
        updateWorkspaceLoader(tabId, from + (to - from) * eased, status);
        if (t < 1) timers.set(tabId, requestAnimationFrame(tick));
        else timers.delete(tabId);
    };
    timers.set(tabId, requestAnimationFrame(tick));
}

export function beginLazyTabLoad(tabId, status) {
    if (readyTabs.has(tabId)) return false;
    showWorkspaceLoader(tabId, 10, status || `Opening ${TAB_META[tabId]?.label || 'workspace'}…`);
    driftWorkspaceLoader(tabId, 12, 62, 9000, status || 'Loading files…');
    return true;
}
