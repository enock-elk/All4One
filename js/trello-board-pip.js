// Compact Trello board overlay — Document PiP (YouTube-style) with window.open fallback.

const PIP_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    font-family: "Segoe UI", system-ui, sans-serif;
    background: #0b1220;
    color: #f1f5f9;
    font-size: 14px;
    overflow: hidden;
  }
  body.is-minimized .pip-body { display: none; }
  .hdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    background: rgba(2,6,23,0.95);
    -webkit-app-region: drag;
    app-region: drag;
    user-select: none;
  }
  .hdr-title { display: flex; align-items: center; gap: 7px; font-weight: 800; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #f8fafc; }
  .dot { width: 8px; height: 8px; border-radius: 999px; background: #34d399; animation: pulse 1.4s infinite; flex-shrink: 0; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
  .hdr-actions { display: flex; gap: 4px; -webkit-app-region: no-drag; app-region: no-drag; }
  .hdr-btn {
    border: 1px solid rgba(255,255,255,0.16);
    background: rgba(255,255,255,0.06);
    color: #e2e8f0;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    min-width: 28px;
    height: 26px;
    padding: 0 7px;
    cursor: pointer;
    line-height: 1;
  }
  .hdr-btn:hover { background: rgba(255,255,255,0.14); color: #fff; }
  .pip-body { display: flex; flex-direction: column; min-height: 0; flex: 1; }
  .meta {
    padding: 8px 12px 9px;
    font-size: 13px;
    font-weight: 600;
    color: #cbd5e1;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    background: rgba(15,23,42,0.65);
  }
  .meta strong { color: #38bdf8; font-size: 15px; font-weight: 800; }
  .rows { overflow-y: auto; max-height: calc(100vh - 88px); padding: 6px 8px 10px; }
  .row { border-radius: 8px; margin-bottom: 4px; }
  .row-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 6px;
    border-radius: 8px;
  }
  .row-head:hover { background: rgba(255,255,255,0.04); }
  .count {
    flex-shrink: 0;
    min-width: 34px;
    height: 28px;
    padding: 0 8px;
    border: 1px solid rgba(56,189,248,0.45);
    border-radius: 7px;
    background: rgba(14,165,233,0.2);
    color: #e0f2fe;
    font-weight: 800;
    font-size: 14px;
    cursor: pointer;
    line-height: 26px;
    text-align: center;
  }
  .count:hover { background: rgba(14,165,233,0.32); }
  .count.is-open { background: rgba(14,165,233,0.42); color: #fff; }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
    font-size: 14px;
    color: #f1f5f9;
  }
  .cases { display: none; padding: 2px 6px 6px 48px; }
  .cases.open { display: block; }
  .case { font-size: 12px; color: #94a3b8; line-height: 1.45; padding: 4px 0; border-top: 1px dashed rgba(255,255,255,0.08); }
  .case:first-child { border-top: none; }
  .empty { padding: 14px 10px; color: #94a3b8; font-size: 13px; font-style: italic; text-align: center; }
`;

const POPUP_NAME = 'All4OneTrelloBoard';
const PIP_WIDTH = 280;
const PIP_MIN_HEIGHT = 160;
const PIP_MAX_HEIGHT = 480;
const PIP_MINIMIZED_HEIGHT = 42;
const ROW_HEIGHT = 38;

function calcHeight(bucketCount, minimized = false) {
    if (minimized) return PIP_MINIMIZED_HEIGHT;
    return Math.min(PIP_MAX_HEIGHT, Math.max(PIP_MIN_HEIGHT, 78 + bucketCount * ROW_HEIGHT));
}

function buildShellHtml(buckets, total, escapeHtml, minimized) {
    const rows = buckets.length
        ? buckets.map((bucket, idx) => {
            const cards = Array.isArray(bucket.cards) ? bucket.cards : [];
            const count = bucket.count ?? cards.length;
            const caseHtml = cards.length
                ? cards.map((name) => `<div class="case">${escapeHtml(name)}</div>`).join('')
                : '<div class="case">No active cases</div>';
            return `
                <div class="row" data-row="${idx}">
                  <div class="row-head">
                    <button type="button" class="count" data-count="${idx}" title="Show cases">${escapeHtml(String(count))}</button>
                    <span class="name" title="${escapeHtml(bucket.name)}">${escapeHtml(bucket.name)}</span>
                  </div>
                  <div class="cases" data-cases="${idx}">${caseHtml}</div>
                </div>`;
        }).join('')
        : '<div class="empty">No lists watched</div>';

    return `
      <div class="hdr">
        <div class="hdr-title"><span class="dot"></span><span>Trello</span></div>
        <div class="hdr-actions">
          <button type="button" class="hdr-btn" data-action="minimize" title="${minimized ? 'Restore' : 'Minimize'}">${minimized ? '▢' : '−'}</button>
          <button type="button" class="hdr-btn" data-action="focus">App</button>
          <button type="button" class="hdr-btn" data-action="close">×</button>
        </div>
      </div>
      <div class="pip-body">
        <div class="meta"><strong>${escapeHtml(String(total))}</strong> cases total</div>
        <div class="rows" id="pip-rows">${rows}</div>
      </div>`;
}

function wireDocument(doc, { onClose, onFocusApp, onMinimizeToggle, escapeHtml }) {
    if (!doc || doc.__all4onePipWired) return;
    doc.__all4onePipWired = true;

    doc.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('[data-action="close"]');
        if (closeBtn) {
            onClose?.();
            return;
        }
        const focusBtn = e.target.closest('[data-action="focus"]');
        if (focusBtn) {
            onFocusApp?.();
            return;
        }
        const minimizeBtn = e.target.closest('[data-action="minimize"]');
        if (minimizeBtn) {
            onMinimizeToggle?.();
            return;
        }
        const countBtn = e.target.closest('.count');
        if (countBtn) {
            const idx = countBtn.getAttribute('data-count');
            const panel = doc.querySelector(`[data-cases="${idx}"]`);
            const isOpen = panel?.classList.contains('open');
            doc.querySelectorAll('.cases').forEach((el) => el.classList.remove('open'));
            doc.querySelectorAll('.count').forEach((el) => el.classList.remove('is-open'));
            if (panel && !isOpen) {
                panel.classList.add('open');
                countBtn.classList.add('is-open');
            }
        }
    });
}

function injectStyles(doc) {
    if (!doc || doc.getElementById('all4one-pip-style')) return;
    const style = doc.createElement('style');
    style.id = 'all4one-pip-style';
    style.textContent = PIP_CSS;
    doc.head.appendChild(style);
}

function mountIntoDocument(doc, buckets, escapeHtml, minimized) {
    injectStyles(doc);
    const total = buckets.reduce((sum, b) => sum + (Number(b.count) || 0), 0);
    doc.body.innerHTML = buildShellHtml(buckets, total, escapeHtml, minimized);
    doc.body.classList.toggle('is-minimized', minimized);
    doc.body.style.margin = '0';
}

export function createBoardPip({ escapeHtml, onFocusApp, onClose }) {
    let pipWindow = null;
    let popupWindow = null;
    let latestBuckets = [];
    let expandedRow = null;
    let isMinimized = false;

    function activeWindow() {
        if (pipWindow && !pipWindow.closed) return pipWindow;
        if (popupWindow && !popupWindow.closed) return popupWindow;
        return null;
    }

    function isOpen() {
        return Boolean(activeWindow());
    }

    function resizeActiveWindow() {
        const win = activeWindow();
        if (!win) return;
        const height = calcHeight(latestBuckets.length, isMinimized);
        try {
            win.resizeTo(PIP_WIDTH, height);
        } catch (_) {
            // PiP windows may not support resizeTo in all browsers
        }
    }

    function close() {
        try { pipWindow?.close(); } catch (_) { /* ignore */ }
        pipWindow = null;
        try { popupWindow?.close(); } catch (_) { /* ignore */ }
        popupWindow = null;
        expandedRow = null;
        isMinimized = false;
        onClose?.();
    }

    function toggleMinimized() {
        isMinimized = !isMinimized;
        render(latestBuckets);
        resizeActiveWindow();
    }

    function render(buckets = latestBuckets) {
        latestBuckets = buckets || [];
        if (!isOpen()) return;

        const targetDoc = activeWindow()?.document;
        if (!targetDoc) return;

        const openCases = targetDoc.querySelector('.cases.open');
        expandedRow = openCases?.getAttribute('data-cases') ?? null;

        mountIntoDocument(targetDoc, latestBuckets, escapeHtml, isMinimized);
        wireDocument(targetDoc, {
            onClose: close,
            onFocusApp,
            onMinimizeToggle: toggleMinimized,
            escapeHtml,
        });

        if (expandedRow !== null && !isMinimized) {
            targetDoc.querySelector(`[data-cases="${expandedRow}"]`)?.classList.add('open');
            targetDoc.querySelector(`[data-count="${expandedRow}"]`)?.classList.add('is-open');
        }

        resizeActiveWindow();
    }

    async function open(buckets = []) {
        latestBuckets = buckets || [];
        if (isOpen()) {
            render(latestBuckets);
            return 'update';
        }

        const height = calcHeight(latestBuckets.length, isMinimized);

        if (window.documentPictureInPicture) {
            try {
                pipWindow = await window.documentPictureInPicture.requestWindow({
                    width: PIP_WIDTH,
                    height,
                });
                mountIntoDocument(pipWindow.document, latestBuckets, escapeHtml, isMinimized);
                wireDocument(pipWindow.document, {
                    onClose: close,
                    onFocusApp,
                    onMinimizeToggle: toggleMinimized,
                    escapeHtml,
                });
                pipWindow.addEventListener('pagehide', () => {
                    pipWindow = null;
                    onClose?.();
                });
                return 'pip';
            } catch (err) {
                console.warn('Document PiP unavailable:', err);
            }
        }

        const features = [
            `width=${PIP_WIDTH}`,
            `height=${height}`,
            'menubar=no',
            'toolbar=no',
            'location=no',
            'status=no',
            'resizable=yes',
            'scrollbars=no',
        ].join(',');

        popupWindow = window.open('about:blank', POPUP_NAME, features);
        if (!popupWindow) return 'blocked';

        popupWindow.document.open();
        popupWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Trello Board</title></head><body></body></html>`);
        popupWindow.document.close();
        mountIntoDocument(popupWindow.document, latestBuckets, escapeHtml, isMinimized);
        wireDocument(popupWindow.document, {
            onClose: close,
            onFocusApp,
            onMinimizeToggle: toggleMinimized,
            escapeHtml,
        });

        popupWindow.addEventListener('beforeunload', () => {
            popupWindow = null;
            onClose?.();
        });

        return 'popup';
    }

    return { open, close, render, isOpen };
}
