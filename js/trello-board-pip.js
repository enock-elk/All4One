// Compact Trello board overlay — Document PiP (YouTube-style) with window.open fallback.

const PIP_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    font-family: "Segoe UI", system-ui, sans-serif;
    background: #0b1220;
    color: #e2e8f0;
    font-size: 11px;
    overflow: hidden;
  }
  .hdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 5px 7px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    background: rgba(2,6,23,0.9);
    -webkit-app-region: drag;
    app-region: drag;
    user-select: none;
  }
  .hdr-title { display: flex; align-items: center; gap: 5px; font-weight: 800; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; }
  .dot { width: 6px; height: 6px; border-radius: 999px; background: #34d399; animation: pulse 1.4s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
  .hdr-actions { display: flex; gap: 3px; -webkit-app-region: no-drag; app-region: no-drag; }
  .hdr-btn {
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.05);
    color: #cbd5e1;
    border-radius: 5px;
    font-size: 9px;
    font-weight: 700;
    padding: 2px 5px;
    cursor: pointer;
  }
  .hdr-btn:hover { background: rgba(255,255,255,0.12); }
  .meta { padding: 3px 8px 4px; font-size: 9px; color: #64748b; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .meta strong { color: #38bdf8; }
  .rows { overflow-y: auto; max-height: calc(100vh - 52px); padding: 3px 5px 6px; }
  .row { border-radius: 6px; margin-bottom: 2px; }
  .row-head { display: flex; align-items: center; gap: 5px; padding: 3px 4px; }
  .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; color: #cbd5e1; }
  .count {
    flex-shrink: 0;
    min-width: 22px;
    height: 20px;
    padding: 0 5px;
    border: 1px solid rgba(56,189,248,0.35);
    border-radius: 5px;
    background: rgba(14,165,233,0.15);
    color: #7dd3fc;
    font-weight: 800;
    font-size: 10px;
    cursor: pointer;
    line-height: 18px;
  }
  .count:hover { background: rgba(14,165,233,0.28); }
  .count.is-open { background: rgba(14,165,233,0.35); color: #e0f2fe; }
  .cases { display: none; padding: 0 4px 4px 8px; }
  .cases.open { display: block; }
  .case { font-size: 9.5px; color: #94a3b8; line-height: 1.35; padding: 2px 0; border-top: 1px dashed rgba(255,255,255,0.06); }
  .case:first-child { border-top: none; }
  .empty { padding: 10px 8px; color: #64748b; font-style: italic; text-align: center; }
`;

const POPUP_NAME = 'All4OneTrelloBoard';
const PIP_WIDTH = 216;
const PIP_MIN_HEIGHT = 128;
const PIP_MAX_HEIGHT = 380;
const ROW_HEIGHT = 26;

function calcHeight(bucketCount) {
    return Math.min(PIP_MAX_HEIGHT, Math.max(PIP_MIN_HEIGHT, 54 + bucketCount * ROW_HEIGHT));
}

function buildShellHtml(buckets, total, escapeHtml) {
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
                    <span class="name" title="${escapeHtml(bucket.name)}">${escapeHtml(bucket.name)}</span>
                    <button type="button" class="count" data-count="${idx}" title="Show cases">${escapeHtml(String(count))}</button>
                  </div>
                  <div class="cases" data-cases="${idx}">${caseHtml}</div>
                </div>`;
        }).join('')
        : '<div class="empty">No lists watched</div>';

    return `
      <div class="hdr">
        <div class="hdr-title"><span class="dot"></span><span>Trello</span></div>
        <div class="hdr-actions">
          <button type="button" class="hdr-btn" data-action="focus">App</button>
          <button type="button" class="hdr-btn" data-action="close">×</button>
        </div>
      </div>
      <div class="meta"><strong>${escapeHtml(String(total))}</strong> cases total</div>
      <div class="rows" id="pip-rows">${rows}</div>`;
}

function wireDocument(doc, { onClose, onFocusApp, escapeHtml }) {
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

function mountIntoDocument(doc, buckets, escapeHtml) {
    injectStyles(doc);
    const total = buckets.reduce((sum, b) => sum + (Number(b.count) || 0), 0);
    doc.body.innerHTML = buildShellHtml(buckets, total, escapeHtml);
    doc.body.style.margin = '0';
}

export function createBoardPip({ escapeHtml, onFocusApp, onClose }) {
    let pipWindow = null;
    let popupWindow = null;
    let latestBuckets = [];
    let expandedRow = null;

    function isOpen() {
        return Boolean(
            (pipWindow && !pipWindow.closed)
            || (popupWindow && !popupWindow.closed),
        );
    }

    function close() {
        try { pipWindow?.close(); } catch (_) { /* ignore */ }
        pipWindow = null;
        try { popupWindow?.close(); } catch (_) { /* ignore */ }
        popupWindow = null;
        expandedRow = null;
        onClose?.();
    }

    function render(buckets = latestBuckets) {
        latestBuckets = buckets || [];
        if (!isOpen()) return;

        const targetDoc = (pipWindow && !pipWindow.closed)
            ? pipWindow.document
            : (popupWindow && !popupWindow.closed ? popupWindow.document : null);
        if (!targetDoc) return;

        const openCases = targetDoc.querySelector('.cases.open');
        expandedRow = openCases?.getAttribute('data-cases') ?? null;

        mountIntoDocument(targetDoc, latestBuckets, escapeHtml);
        wireDocument(targetDoc, { onClose: close, onFocusApp, escapeHtml });

        if (expandedRow !== null) {
            targetDoc.querySelector(`[data-cases="${expandedRow}"]`)?.classList.add('open');
            targetDoc.querySelector(`[data-count="${expandedRow}"]`)?.classList.add('is-open');
        }
    }

    async function open(buckets = []) {
        latestBuckets = buckets || [];
        if (isOpen()) {
            render(latestBuckets);
            return 'update';
        }

        const height = calcHeight(latestBuckets.length);

        if (window.documentPictureInPicture) {
            try {
                pipWindow = await window.documentPictureInPicture.requestWindow({
                    width: PIP_WIDTH,
                    height,
                });
                mountIntoDocument(pipWindow.document, latestBuckets, escapeHtml);
                wireDocument(pipWindow.document, { onClose: close, onFocusApp, escapeHtml });
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
        mountIntoDocument(popupWindow.document, latestBuckets, escapeHtml);
        wireDocument(popupWindow.document, { onClose: close, onFocusApp, escapeHtml });

        popupWindow.addEventListener('beforeunload', () => {
            popupWindow = null;
            onClose?.();
        });

        return 'popup';
    }

    return { open, close, render, isOpen };
}
