// ============================================================================
// ALL4ONE - PDF DOCUMENT MANAGER (page Holding Bay + local tools)
// ============================================================================

import {
    ensurePdfEngine,
    warmupPdfEngine,
    scanPdfDate,
    unlockPdf,
    mapLimit,
    renderPageThumbnails,
    renderImageThumbnail,
    buildPdfFromPages,
    splitPageItems,
    fixedLengthRanges,
    compressPages,
    pdfPagesToJpegs,
    imagesToPdf,
    docxToPdf,
    zipFiles,
} from './pdf-engine.js';

const EXCEL_PIN = '10101';

document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('pdf-dropzone');
    const fileInput = document.getElementById('pdf-file-input');
    const pageGrid = document.getElementById('pdf-page-grid');
    const emptyState = document.getElementById('pdf-empty-state');
    const fileStrip = document.getElementById('pdf-file-strip');
    const selectAllCheckbox = document.getElementById('pdf-select-all');
    const statsCount = document.getElementById('pdf-stats-count');
    const btnClearBay = document.getElementById('btn-clear-bay');
    const docTypeSelect = document.getElementById('pdf-doc-type');
    const passwordInput = document.getElementById('pdf-password-input');

    const btnUnlock = document.getElementById('btn-unlock-pdf');
    const btnScan = document.getElementById('btn-scan-pdf');
    const btnMerge = document.getElementById('btn-merge-pdf');
    const btnExtractExcel = document.getElementById('btn-extract-excel');
    const btnSplit = document.getElementById('btn-split-pdf');
    const btnCompress = document.getElementById('btn-compress-pdf');
    const btnJpgToPdf = document.getElementById('btn-jpg-to-pdf');
    const btnPdfToJpg = document.getElementById('btn-pdf-to-jpg');
    const btnWordToPdf = document.getElementById('btn-word-to-pdf');

    const pinModal = document.getElementById('excel-pin-modal');
    const pinInput = document.getElementById('excel-pin-input');
    const pinError = document.getElementById('excel-pin-error');
    const pinSubmit = document.getElementById('excel-pin-submit');
    const pinCancel = document.getElementById('excel-pin-cancel');

    const headerStatusText = document.getElementById('header-status-text');
    const headerStatusDot = document.getElementById('header-status-dot');

    let files = [];
    let pages = [];
    let activeTool = 'merge';
    let splitMode = 'custom';
    let excelPinUnlocked = false;
    let pendingExtract = false;
    let fileSeq = 0;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function passwords() {
        return passwordInput ? passwordInput.value : '';
    }

    function includedPages() {
        return pages.filter((p) => p.included);
    }

    function setHeaderStatus(label, tone = 'ok') {
        if (headerStatusText) headerStatusText.textContent = label;
        if (!headerStatusDot) return;
        headerStatusDot.classList.remove('bg-emerald-500', 'bg-amber-500', 'bg-rose-500');
        headerStatusDot.classList.add(tone === 'error' ? 'bg-rose-500' : tone === 'busy' ? 'bg-amber-500' : 'bg-emerald-500');
    }

    async function readyPdfEngine() {
        try {
            if (!window.pdfjsLib || !window.PDFLib?.PDFDocument) {
                setHeaderStatus('LOADING PDF TOOLS...', 'busy');
            }
            await ensurePdfEngine();
            setHeaderStatus('SYSTEM ONLINE', 'ok');
        } catch (err) {
            console.error('PDF engine failed to load:', err);
            setHeaderStatus('PDF ENGINE ERROR', 'error');
            throw err;
        }
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function downloadBytes(bytes, filename, mime) {
        downloadBlob(new Blob([bytes], { type: mime }), filename);
    }

    function classifyFile(file) {
        const name = (file.name || '').toLowerCase();
        const type = file.type || '';
        if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
        if (type.startsWith('image/') || /\.(jpe?g|png)$/i.test(name)) return 'image';
        if (name.endsWith('.docx') || type.includes('wordprocessingml')) return 'docx';
        return null;
    }

    function pageSpecs(list) {
        return list.map((p) => {
            const fileObj = files.find((f) => f.id === p.fileId);
            return {
                fileId: p.fileId,
                kind: p.kind === 'image' ? 'image' : 'pdf',
                pageIndex: p.pageIndex,
                rotation: p.rotation || 0,
                bytes: fileObj?.bytes,
                mime: fileObj?.mime,
            };
        });
    }

    function refreshIcons() {
        if (window.lucide) lucide.createIcons();
    }

    function updateSelectAllState() {
        selectAllCheckbox.disabled = pages.length === 0;
        selectAllCheckbox.checked = pages.length > 0 && pages.every((p) => p.included);
    }

    function isBankProfile() {
        return docTypeSelect && docTypeSelect.value === 'bank';
    }

    function updateExtractButton() {
        const hasWork = files.some((f) => f.kind === 'pdf' || f.origin === 'docx');
        const allow = isBankProfile() && hasWork;
        if (!btnExtractExcel) return;
        btnExtractExcel.disabled = !allow;
        btnExtractExcel.title = allow
            ? (excelPinUnlocked ? 'Powered by Google Document AI' : 'PIN required')
            : 'Choose Document Type Profile: Bank Statements';
    }

    function toggleActionButtons() {
        const hasPages = pages.length > 0;
        const hasIncluded = includedPages().length > 0;
        btnUnlock.disabled = !files.some((f) => f.kind === 'pdf');
        if (btnScan) btnScan.disabled = !files.some((f) => f.kind === 'pdf');
        btnClearBay.disabled = !hasPages && files.length === 0;
        if (btnMerge) btnMerge.disabled = !hasIncluded;
        if (btnSplit) btnSplit.disabled = !hasIncluded;
        if (btnCompress) btnCompress.disabled = !hasIncluded;
        if (btnJpgToPdf) btnJpgToPdf.disabled = !includedPages().some((p) => p.kind === 'image');
        if (btnPdfToJpg) btnPdfToJpg.disabled = !includedPages().some((p) => p.kind !== 'image');
        if (btnWordToPdf) btnWordToPdf.disabled = !includedPages().some((p) => p.origin === 'docx');
        updateExtractButton();
        updateSplitSummary();
    }

    function renderFileStrip() {
        if (!files.length) {
            fileStrip.classList.add('hidden');
            fileStrip.innerHTML = '';
            return;
        }
        fileStrip.classList.remove('hidden');
        fileStrip.innerHTML = files.map((f) => {
            const status = f.status === 'unlocked'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                : f.status === 'error'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
            return `
                <div class="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs max-w-full">
                    <span class="font-medium truncate max-w-[10rem]" title="${escapeHtml(f.file.name)}">${escapeHtml(f.file.name)}</span>
                    <span class="px-1.5 py-0.5 rounded ${status}">${escapeHtml(f.status)}</span>
                    ${f.detectedDate ? `<span class="text-slate-500">${escapeHtml(f.detectedDate)}</span>` : ''}
                    <button type="button" class="file-download text-slate-400 hover:text-blue-500" data-file-id="${f.id}" title="Download">
                        <i data-lucide="download" class="w-3.5 h-3.5"></i>
                    </button>
                    <button type="button" class="file-remove text-slate-400 hover:text-rose-500" data-file-id="${f.id}" title="Remove file">
                        <i data-lucide="x" class="w-3.5 h-3.5"></i>
                    </button>
                </div>`;
        }).join('');

        fileStrip.querySelectorAll('.file-remove').forEach((btn) => {
            btn.addEventListener('click', () => removeFile(btn.getAttribute('data-file-id')));
        });
        fileStrip.querySelectorAll('.file-download').forEach((btn) => {
            btn.addEventListener('click', () => {
                const fileObj = files.find((f) => f.id === btn.getAttribute('data-file-id'));
                if (!fileObj?.bytes) return;
                const mime = fileObj.kind === 'image' ? (fileObj.mime || 'image/jpeg') : 'application/pdf';
                downloadBytes(fileObj.bytes, fileObj.file.name, mime);
            });
        });
        refreshIcons();
    }

    function renderPages() {
        const cards = pageGrid.querySelectorAll('.page-card');
        cards.forEach((el) => el.remove());

        if (!pages.length) {
            emptyState.classList.remove('hidden');
            statsCount.textContent = '0 pages';
            updateSelectAllState();
            toggleActionButtons();
            renderFileStrip();
            return;
        }

        emptyState.classList.add('hidden');
        const included = includedPages().length;
        statsCount.textContent = `${pages.length} page${pages.length === 1 ? '' : 's'} · ${included} included · ${files.length} file${files.length === 1 ? '' : 's'}`;

        pages.forEach((page, index) => {
            const fileObj = files.find((f) => f.id === page.fileId);
            const card = document.createElement('div');
            card.className = 'page-card relative bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-2 cursor-move hover:border-blue-400 transition-colors';
            card.draggable = true;
            card.dataset.index = String(index);
            card.innerHTML = `
                <input type="checkbox" class="page-include absolute top-3 left-3 z-10 w-4 h-4 rounded border-slate-300 text-blue-600" ${page.included ? 'checked' : ''} title="Include in export">
                <button type="button" class="page-rotate absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/90 dark:bg-slate-800 shadow-sm text-slate-600 hover:text-blue-600" title="Rotate">
                    <i data-lucide="rotate-cw" class="w-4 h-4"></i>
                </button>
                <div class="aspect-[3/4] bg-white dark:bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center mt-6 mb-2">
                    ${page.thumbUrl
                        ? `<img src="${page.thumbUrl}" alt="" class="max-h-full max-w-full object-contain" style="transform: rotate(${page.rotation || 0}deg)">`
                        : `<span class="text-[10px] text-slate-400">Loading…</span>`}
                </div>
                <p class="text-[10px] font-medium text-slate-700 dark:text-slate-200 truncate" title="${escapeHtml(fileObj?.file.name || '')}">${escapeHtml(fileObj?.file.name || '')}</p>
                <p class="text-[10px] text-slate-400">Page ${page.pageIndex + 1}</p>
            `;
            pageGrid.appendChild(card);
        });

        attachPageListeners();
        updateSelectAllState();
        toggleActionButtons();
        renderFileStrip();
        refreshIcons();
    }

    function attachPageListeners() {
        pageGrid.querySelectorAll('.page-include').forEach((cb) => {
            cb.addEventListener('change', (e) => {
                const idx = Number(e.target.closest('.page-card').dataset.index);
                pages[idx].included = e.target.checked;
                updateSelectAllState();
                toggleActionButtons();
                statsCount.textContent = `${pages.length} page${pages.length === 1 ? '' : 's'} · ${includedPages().length} included · ${files.length} file${files.length === 1 ? '' : 's'}`;
            });
        });

        pageGrid.querySelectorAll('.page-rotate').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const idx = Number(e.currentTarget.closest('.page-card').dataset.index);
                pages[idx].rotation = ((pages[idx].rotation || 0) + 90) % 360;
                renderPages();
            });
        });

        let draggedIndex = null;
        pageGrid.querySelectorAll('.page-card').forEach((card) => {
            card.addEventListener('dragstart', (e) => {
                draggedIndex = Number(card.dataset.index);
                card.classList.add('opacity-50');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(draggedIndex));
            });
            card.addEventListener('dragend', () => {
                card.classList.remove('opacity-50');
                draggedIndex = null;
            });
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                card.classList.add('ring-2', 'ring-blue-500');
            });
            card.addEventListener('dragleave', () => {
                card.classList.remove('ring-2', 'ring-blue-500');
            });
            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.classList.remove('ring-2', 'ring-blue-500');
                const dropIndex = Number(card.dataset.index);
                if (draggedIndex === null || draggedIndex === dropIndex) return;
                const [item] = pages.splice(draggedIndex, 1);
                pages.splice(dropIndex, 0, item);
                renderPages();
            });
        });
    }

    function removeFile(fileId) {
        pages = pages.filter((p) => p.fileId !== fileId);
        files = files.filter((f) => f.id !== fileId);
        renderPages();
    }

    async function addPdfFile(file, bytes, origin = 'pdf') {
        const id = `f_${Date.now()}_${fileSeq++}`;
        const fileObj = {
            id,
            file,
            kind: 'pdf',
            origin,
            status: 'pending',
            detectedDate: null,
            bytes,
            mime: 'application/pdf',
        };
        files.push(fileObj);
        renderFileStrip();
        try {
            await readyPdfEngine();
            const thumbs = await renderPageThumbnails(bytes, passwords());
            thumbs.forEach((thumb) => {
                pages.push({
                    id: `${id}_${thumb.pageIndex}`,
                    fileId: id,
                    pageIndex: thumb.pageIndex,
                    rotation: 0,
                    included: true,
                    thumbUrl: thumb.thumbUrl,
                    kind: 'pdf',
                    origin,
                });
            });
            fileObj.status = 'ready';
        } catch (err) {
            fileObj.status = 'error';
            console.warn(`Failed to preview ${file.name}:`, err);
        }
        renderPages();
    }

    async function addImageFile(file, bytes) {
        const id = `f_${Date.now()}_${fileSeq++}`;
        const mime = file.type || (file.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
        const fileObj = {
            id,
            file,
            kind: 'image',
            origin: 'image',
            status: 'ready',
            detectedDate: null,
            bytes,
            mime,
        };
        files.push(fileObj);
        const thumbUrl = await renderImageThumbnail(bytes, mime);
        pages.push({
            id: `${id}_0`,
            fileId: id,
            pageIndex: 0,
            rotation: 0,
            included: true,
            thumbUrl,
            kind: 'image',
            origin: 'image',
        });
        renderPages();
    }

    async function handleFilesAdded(fileList) {
        const incoming = Array.from(fileList || []);
        if (!incoming.length) return;
        setHeaderStatus('LOADING FILES...', 'busy');
        for (const file of incoming) {
            const kind = classifyFile(file);
            if (!kind) continue;
            if (files.some((f) => f.file.name === file.name)) continue;
            try {
                const bytes = new Uint8Array(await file.arrayBuffer());
                if (kind === 'pdf') {
                    await addPdfFile(file, bytes, 'pdf');
                } else if (kind === 'image') {
                    await addImageFile(file, bytes);
                } else if (kind === 'docx') {
                    setHeaderStatus('CONVERTING WORD...', 'busy');
                    const converted = await docxToPdf(bytes);
                    if (!converted.success) {
                        alert(`Could not convert ${file.name}: ${converted.error}`);
                        continue;
                    }
                    const pdfName = file.name.replace(/\.docx$/i, '.pdf');
                    const pdfFile = new File([converted.bytes], pdfName, { type: 'application/pdf' });
                    await addPdfFile(pdfFile, converted.bytes, 'docx');
                }
            } catch (err) {
                console.error(err);
                alert(`Failed to add ${file.name}: ${err.message}`);
            }
        }
        setHeaderStatus('SYSTEM ONLINE', 'ok');
    }

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
        dropzone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.add('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
            dropzone.classList.remove('border-slate-300', 'dark:border-slate-600');
        });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
            dropzone.classList.add('border-slate-300', 'dark:border-slate-600');
        });
    });

    dropzone.addEventListener('drop', (e) => handleFilesAdded(e.dataTransfer.files));
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', function () {
        handleFilesAdded(this.files);
        this.value = '';
    });

    selectAllCheckbox.addEventListener('change', (e) => {
        const checked = e.target.checked;
        pages.forEach((p) => { p.included = checked; });
        renderPages();
    });

    btnClearBay.addEventListener('click', () => {
        if (!confirm('Clear the holding bay?')) return;
        files = [];
        pages = [];
        renderPages();
    });

    const toolMeta = {
        merge: { title: 'Merge PDF', hint: 'Included pages are combined in the current grid order.' },
        split: { title: 'Split PDF', hint: 'Split the included page sequence using custom ranges or a fixed length.' },
        compress: { title: 'Compress PDF', hint: 'Rebuild included pages as compressed JPEGs in a smaller PDF.' },
        convert: { title: 'Convert', hint: 'JPG ↔ PDF and Word → PDF. Word layout is approximate in the browser.' },
    };

    function setActiveTool(tool) {
        activeTool = tool;
        document.querySelectorAll('.pdf-tool-btn').forEach((btn) => {
            const on = btn.getAttribute('data-tool') === tool;
            btn.classList.toggle('text-white', on);
            btn.classList.toggle('bg-slate-800', on);
            btn.classList.toggle('text-slate-600', !on);
            btn.classList.toggle('dark:text-slate-300', !on);
            btn.classList.toggle('hover:bg-slate-100', !on);
            btn.classList.toggle('dark:hover:bg-slate-700', !on);
        });
        document.getElementById('pdf-tool-title').textContent = toolMeta[tool].title;
        document.getElementById('pdf-tool-hint').textContent = toolMeta[tool].hint;
        ['merge', 'split', 'compress', 'convert'].forEach((name) => {
            document.getElementById(`panel-${name}`).classList.toggle('hidden', name !== tool);
        });
        refreshIcons();
    }

    document.querySelectorAll('.pdf-tool-btn').forEach((btn) => {
        btn.addEventListener('click', () => setActiveTool(btn.getAttribute('data-tool')));
    });

    function splitRangesFromUi() {
        return Array.from(document.querySelectorAll('.split-range-row')).map((row) => ({
            from: Number(row.querySelector('.split-from').value) || 1,
            to: Number(row.querySelector('.split-to').value) || 1,
        }));
    }

    function addSplitRange(from = 1, to = Math.max(1, includedPages().length)) {
        const wrap = document.getElementById('split-ranges');
        const row = document.createElement('div');
        row.className = 'split-range-row flex items-center gap-2';
        row.innerHTML = `
            <input type="number" min="1" class="split-from w-full px-2 py-1.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg" value="${from}">
            <span class="text-xs text-slate-400">to</span>
            <input type="number" min="1" class="split-to w-full px-2 py-1.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg" value="${to}">
            <button type="button" class="split-remove text-slate-400 hover:text-rose-500" title="Remove range">
                <i data-lucide="x" class="w-4 h-4"></i>
            </button>
        `;
        row.querySelector('.split-remove').addEventListener('click', () => {
            row.remove();
            updateSplitSummary();
        });
        row.querySelectorAll('input').forEach((input) => input.addEventListener('input', updateSplitSummary));
        wrap.appendChild(row);
        refreshIcons();
        updateSplitSummary();
    }

    function updateSplitSummary() {
        const summary = document.getElementById('split-summary');
        if (!summary) return;
        const total = includedPages().length;
        if (splitMode === 'fixed') {
            const n = Math.max(1, Number(document.getElementById('split-fixed-length').value) || 1);
            const count = total ? Math.ceil(total / n) : 0;
            summary.textContent = total
                ? `Included pages will be split into files of ${n} pages. ${count} PDF${count === 1 ? '' : 's'} will be created.`
                : 'Include pages in the Holding Bay to split.';
            return;
        }
        const ranges = splitRangesFromUi();
        summary.textContent = total
            ? `${ranges.length} custom range${ranges.length === 1 ? '' : 's'} over ${total} included page${total === 1 ? '' : 's'}.`
            : 'Include pages in the Holding Bay to split.';
    }

    function setSplitMode(mode) {
        splitMode = mode;
        document.querySelectorAll('.split-mode-btn').forEach((btn) => {
            const on = btn.getAttribute('data-split-mode') === mode;
            btn.classList.toggle('border-blue-500', on);
            btn.classList.toggle('bg-blue-50', on);
            btn.classList.toggle('dark:bg-blue-900/20', on);
            btn.classList.toggle('border-slate-200', !on);
            btn.classList.toggle('dark:border-slate-600', !on);
        });
        document.getElementById('split-custom-wrap').classList.toggle('hidden', mode !== 'custom');
        document.getElementById('split-fixed-wrap').classList.toggle('hidden', mode !== 'fixed');
        updateSplitSummary();
    }

    document.querySelectorAll('.split-mode-btn').forEach((btn) => {
        btn.addEventListener('click', () => setSplitMode(btn.getAttribute('data-split-mode')));
    });
    document.getElementById('btn-add-range').addEventListener('click', () => addSplitRange());
    document.getElementById('split-fixed-length').addEventListener('input', updateSplitSummary);
    document.getElementById('compress-quality').addEventListener('input', (e) => {
        document.getElementById('compress-quality-label').textContent = `${e.target.value}%`;
    });

    addSplitRange(1, 1);
    setActiveTool('merge');

    warmupPdfEngine();

    async function withBusyButton(button, busyLabel, work) {
        const original = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>${busyLabel}</span>`;
        refreshIcons();
        try {
            await work();
        } finally {
            button.innerHTML = original;
            button.disabled = false;
            refreshIcons();
            toggleActionButtons();
        }
    }

    btnUnlock.addEventListener('click', async () => {
        const pw = passwords();
        if (!pw) return alert('Please enter at least one password to try.');
        await withBusyButton(btnUnlock, 'Processing...', async () => {
            await readyPdfEngine();
            const jobs = files.filter((f) => f.kind === 'pdf');
            await mapLimit(jobs, 2, async (fileObj) => {
                const result = await unlockPdf(fileObj.bytes, pw);
                if (!result.success) {
                    fileObj.status = 'error';
                    return;
                }
                if (result.is_encrypted) {
                    fileObj.bytes = result.bytes;
                    const newName = fileObj.file.name.replace(/\.pdf$/i, '_unlocked.pdf');
                    fileObj.file = new File([result.bytes], newName, { type: 'application/pdf' });
                }
                fileObj.status = 'unlocked';
                pages = pages.filter((p) => p.fileId !== fileObj.id);
                const thumbs = await renderPageThumbnails(fileObj.bytes, pw);
                thumbs.forEach((thumb) => {
                    pages.push({
                        id: `${fileObj.id}_${thumb.pageIndex}`,
                        fileId: fileObj.id,
                        pageIndex: thumb.pageIndex,
                        rotation: 0,
                        included: true,
                        thumbUrl: thumb.thumbUrl,
                        kind: 'pdf',
                        origin: fileObj.origin,
                    });
                });
            });
            renderPages();
        });
    });

    btnScan.addEventListener('click', async () => {
        const docType = docTypeSelect.value;
        await withBusyButton(btnScan, 'Scanning...', async () => {
            await readyPdfEngine();
            const jobs = files.filter((f) => f.kind === 'pdf');
            await mapLimit(jobs, 2, async (fileObj) => {
                const result = await scanPdfDate(fileObj.bytes, docType, passwords());
                if (result.success) {
                    fileObj.detectedDate = result.date;
                    if (fileObj.status === 'error') fileObj.status = 'ready';
                } else {
                    fileObj.status = 'error';
                    fileObj.detectedDate = result.error;
                }
            });
            files.sort((a, b) => {
                if (!a.detectedDate) return 1;
                if (!b.detectedDate) return -1;
                return String(a.detectedDate).localeCompare(String(b.detectedDate));
            });
            const order = new Map(files.map((f, i) => [f.id, i]));
            pages.sort((a, b) => {
                const fa = order.get(a.fileId) ?? 0;
                const fb = order.get(b.fileId) ?? 0;
                if (fa !== fb) return fa - fb;
                return a.pageIndex - b.pageIndex;
            });
            renderPages();
        });
    });

    btnMerge.addEventListener('click', async () => {
        const selected = includedPages();
        if (!selected.length) return alert('No pages selected to merge.');
        await withBusyButton(btnMerge, 'Merging...', async () => {
            await readyPdfEngine();
            const result = await buildPdfFromPages(pageSpecs(selected), passwords());
            if (!result.success) {
                alert(`Merge failed: ${result.error}`);
                return;
            }
            downloadBytes(result.bytes, `Merged_History_${Date.now()}.pdf`, 'application/pdf');
            alert('Merge complete. File downloaded.');
        });
    });

    btnSplit.addEventListener('click', async () => {
        const selected = includedPages();
        if (!selected.length) return alert('Include at least one page to split.');
        await withBusyButton(btnSplit, 'Splitting...', async () => {
            const ranges = splitMode === 'fixed'
                ? fixedLengthRanges(selected.length, document.getElementById('split-fixed-length').value)
                : splitRangesFromUi();
            const result = await splitPageItems(pageSpecs(selected), ranges, passwords());
            if (!result.success) {
                alert(`Split failed: ${result.error}`);
                return;
            }
            if (result.files.length === 1) {
                downloadBytes(result.files[0].bytes, result.files[0].name, 'application/pdf');
            } else {
                const zip = await zipFiles(result.files);
                downloadBlob(zip, `split_${Date.now()}.zip`);
            }
            alert('Split complete.');
        });
    });

    btnCompress.addEventListener('click', async () => {
        const selected = includedPages();
        if (!selected.length) return alert('Include at least one page to compress.');
        await withBusyButton(btnCompress, 'Compressing...', async () => {
            const quality = Number(document.getElementById('compress-quality').value) / 100;
            const result = await compressPages(pageSpecs(selected), { quality, passwordsStr: passwords() });
            if (!result.success) {
                alert(`Compress failed: ${result.error}`);
                return;
            }
            downloadBytes(result.bytes, `compressed_${Date.now()}.pdf`, 'application/pdf');
            alert('Compress complete.');
        });
    });

    btnJpgToPdf.addEventListener('click', async () => {
        const selected = includedPages().filter((p) => p.kind === 'image');
        if (!selected.length) return alert('Include at least one JPG/PNG page.');
        await withBusyButton(btnJpgToPdf, 'Converting...', async () => {
            const result = await imagesToPdf(pageSpecs(selected));
            if (!result.success) {
                alert(`JPG to PDF failed: ${result.error}`);
                return;
            }
            downloadBytes(result.bytes, `images_${Date.now()}.pdf`, 'application/pdf');
        });
    });

    btnPdfToJpg.addEventListener('click', async () => {
        const selected = includedPages().filter((p) => p.kind !== 'image');
        if (!selected.length) return alert('Include at least one PDF page.');
        await withBusyButton(btnPdfToJpg, 'Exporting...', async () => {
            const result = await pdfPagesToJpegs(pageSpecs(selected), { passwordsStr: passwords() });
            if (!result.success) {
                alert(`PDF to JPG failed: ${result.error}`);
                return;
            }
            if (result.files.length === 1) {
                downloadBytes(result.files[0].bytes, result.files[0].name, 'image/jpeg');
            } else {
                const zip = await zipFiles(result.files);
                downloadBlob(zip, `pages_${Date.now()}.zip`);
            }
        });
    });

    btnWordToPdf.addEventListener('click', async () => {
        const selected = includedPages().filter((p) => p.origin === 'docx');
        if (!selected.length) return alert('Add a .docx file first. It is converted when dropped into the bay.');
        await withBusyButton(btnWordToPdf, 'Exporting...', async () => {
            const result = await buildPdfFromPages(pageSpecs(selected), passwords());
            if (!result.success) {
                alert(`Word to PDF failed: ${result.error}`);
                return;
            }
            downloadBytes(result.bytes, `word_${Date.now()}.pdf`, 'application/pdf');
        });
    });

    function arrayBufferToBase64(buffer) {
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        const chunkSize = 8192;
        const chunks = [];
        for (let i = 0; i < bytes.length; i += chunkSize) {
            chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
        }
        return window.btoa(chunks.join(''));
    }

    function openPinModal() {
        pinError.classList.add('hidden');
        pinInput.value = '';
        pinModal.classList.remove('hidden');
        pinInput.focus();
    }

    function closePinModal() {
        pinModal.classList.add('hidden');
        pendingExtract = false;
    }

    async function runExtract() {
        const pdfFiles = files.filter((f) => f.kind === 'pdf');
        const selectedFiles = pdfFiles.filter((f) => pages.some((p) => p.fileId === f.id && p.included));
        if (!selectedFiles.length) return alert('Include at least one page from a PDF.');

        await withBusyButton(btnExtractExcel, 'Initializing Assembly Line...', async () => {
            const placeholderTabs = selectedFiles.map(() => {
                try { return window.open('about:blank', '_blank'); } catch (_) { return null; }
            });
            const openedSheetUrls = [];
            const lastExtractStats = [];
            try {
                for (let i = 0; i < selectedFiles.length; i++) {
                    const fileObj = selectedFiles[i];
                    btnExtractExcel.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Processing File ${i + 1} of ${selectedFiles.length}...</span>`;
                    refreshIcons();

                    const filePages = pages.filter((p) => p.fileId === fileObj.id && p.included);
                    let payloadBytes = fileObj.bytes;
                    if (filePages.length !== pages.filter((p) => p.fileId === fileObj.id).length || filePages.some((p) => p.rotation)) {
                        const rebuilt = await buildPdfFromPages(pageSpecs(filePages), passwords());
                        if (!rebuilt.success) throw new Error(rebuilt.error);
                        payloadBytes = rebuilt.bytes;
                    }

                    const authToken = await window.getGuardianAuthToken();
                    if (!authToken) {
                        throw new Error('Authentication token missing. Please lock and unlock the workspace to establish a secure session.');
                    }

                    const response = await fetch('https://us-central1-all4one-nexus.cloudfunctions.net/extractBankData', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${authToken}`,
                        },
                        body: JSON.stringify({
                            filename: fileObj.file.name,
                            documentType: docTypeSelect.value,
                            documentBase64: arrayBufferToBase64(payloadBytes),
                        }),
                    });

                    let data;
                    try {
                        data = await response.json();
                    } catch (_) {
                        throw new Error(`Server returned a non-JSON response (HTTP ${response.status}).`);
                    }
                    if (!response.ok) throw new Error(data.error || 'Unknown error during AI extraction.');

                    const tab = placeholderTabs[i];
                    if (data.sheetUrl) {
                        openedSheetUrls.push(data.sheetUrl);
                        if (tab && !tab.closed) tab.location.href = data.sheetUrl;
                    } else if (data.csvData) {
                        try { if (tab && !tab.closed) tab.close(); } catch (_) {}
                        downloadBytes(new TextEncoder().encode(data.csvData), `Extracted_${fileObj.file.name.replace(/\.pdf$/i, '')}.csv`, 'text/csv;charset=utf-8;');
                    } else {
                        throw new Error('Backend did not return a Google Sheets URL or CSV data.');
                    }

                    lastExtractStats.push({
                        file: fileObj.file.name,
                        rows: data.tableCount || 0,
                        mismatches: data.flaggedCount || 0,
                        profile: data.bankId ? `${data.bankId}/${data.layoutId || '?'}` : 'unknown',
                        mode: data.outputMode || 'unknown',
                    });
                }

                const statsNote = lastExtractStats.length
                    ? '\n\n' + lastExtractStats.map((s) => `${s.file}: ${s.rows} rows, ${s.mismatches} MATH MISMATCH, profile ${s.profile} (${s.mode})`).join('\n')
                    : '';
                alert(`Assembly Line Complete! Processed ${selectedFiles.length} file(s).${statsNote}`);
            } catch (err) {
                placeholderTabs.forEach((tab) => {
                    try { if (tab && !tab.closed && tab.location.href === 'about:blank') tab.close(); } catch (_) {}
                });
                console.error(err);
                alert(`A critical error occurred during AI extraction: ${err.message}`);
            }
        });
    }

    btnExtractExcel.addEventListener('click', () => {
        if (!isBankProfile()) return alert('Extract to Excel is only available for Bank Statements.');
        if (!excelPinUnlocked) {
            pendingExtract = true;
            openPinModal();
            return;
        }
        runExtract();
    });

    pinCancel.addEventListener('click', closePinModal);
    pinSubmit.addEventListener('click', () => {
        if (pinInput.value.trim() !== EXCEL_PIN) {
            pinError.classList.remove('hidden');
            return;
        }
        excelPinUnlocked = true;
        pinModal.classList.add('hidden');
        const shouldRun = pendingExtract;
        pendingExtract = false;
        updateExtractButton();
        if (shouldRun) runExtract();
    });
    pinInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') pinSubmit.click();
        if (e.key === 'Escape') closePinModal();
    });

    docTypeSelect.addEventListener('change', updateExtractButton);

    renderPages();
});
