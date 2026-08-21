// ============================================================================
// ALL4ONE - BROWSER PDF ENGINE (no Pyodide)
// Scan / merge / unlock / convert / split / compress in JS.
// ============================================================================

const PDFJS_SRC = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
const PDF_LIB_SRC = 'https://cdn.jsdelivr.net/npm/@cantoo/pdf-lib@2.4.2/dist/pdf-lib.min.js';
const JSZIP_SRC = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
const MAMMOTH_SRC = 'https://cdn.jsdelivr.net/npm/mammoth@1.9.0/mammoth.browser.min.js';
const HTML2CANVAS_SRC = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';

let enginePromise = null;

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-all4one-src="${src}"]`);
        if (existing) {
            if (existing.getAttribute('data-loaded') === 'true') return resolve();
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.setAttribute('data-all4one-src', src);
        script.onload = () => {
            script.setAttribute('data-loaded', 'true');
            resolve();
        };
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
    });
}

export function ensurePdfEngine() {
    if (enginePromise) return enginePromise;
    enginePromise = (async () => {
        await Promise.all([loadScript(PDFJS_SRC), loadScript(PDF_LIB_SRC)]);
        if (!window.pdfjsLib || !window.PDFLib?.PDFDocument) {
            throw new Error('PDF libraries failed to initialize.');
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        return true;
    })().catch((err) => {
        enginePromise = null;
        throw err;
    });
    return enginePromise;
}

export function warmupPdfEngine() {
    const run = () => ensurePdfEngine().catch((err) => {
        console.warn('PDF engine warmup failed:', err);
    });
    if ('requestIdleCallback' in window) {
        requestIdleCallback(run, { timeout: 1500 });
    } else {
        setTimeout(run, 0);
    }
}

async function ensureZipLib() {
    await loadScript(JSZIP_SRC);
    if (!window.JSZip) throw new Error('JSZip failed to load.');
}

async function ensureDocxLibs() {
    await Promise.all([loadScript(MAMMOTH_SRC), loadScript(HTML2CANVAS_SRC)]);
    if (!window.mammoth) throw new Error('Mammoth failed to load.');
    if (!window.html2canvas) throw new Error('html2canvas failed to load.');
}

function parsePasswords(passwordsStr) {
    return String(passwordsStr || '')
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
}

function toUint8(bytes) {
    return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
}

function isPasswordError(err) {
    const name = err?.name || '';
    const message = err?.message || '';
    return /password/i.test(name) || /password/i.test(message) || /encrypt/i.test(message);
}

function isPngBytes(bytes) {
    const b = toUint8(bytes);
    return b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
}

async function openPdfJs(bytes, passwords = []) {
    const pdfjsLib = window.pdfjsLib;
    const data = toUint8(bytes);
    const candidates = ['', ...passwords];
    let lastErr = null;

    for (const password of candidates) {
        try {
            const task = pdfjsLib.getDocument({
                data: data.slice(0),
                password,
                useSystemFonts: true,
            });
            return await task.promise;
        } catch (err) {
            lastErr = err;
            if (!isPasswordError(err)) throw err;
        }
    }

    throw lastErr || new Error('File is encrypted. Unlock first.');
}

async function extractFirstPageText(bytes, passwords) {
    const pdf = await openPdfJs(bytes, passwords);
    try {
        if (pdf.numPages < 1) return '';
        const page = await pdf.getPage(1);
        const content = await page.getTextContent();
        return content.items.map((item) => item.str).join(' ');
    } finally {
        await pdf.destroy();
    }
}

const MONTHS = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function pad2(n) {
    return String(n).padStart(2, '0');
}

function formatYmd(year, monthIndex, day) {
    const y = year < 100 ? (year >= 70 ? 1900 + year : 2000 + year) : year;
    if (!y || monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
    const dt = new Date(Date.UTC(y, monthIndex, day));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== monthIndex || dt.getUTCDate() !== day) return null;
    return `${y}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function standardizeDate(dateStr) {
    if (!dateStr) return null;
    const clean = String(dateStr).replace(/\s+/g, ' ').trim();
    const numeric = clean.replace(/[./]/g, '-');

    let m = numeric.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (m) return formatYmd(+m[3], +m[2] - 1, +m[1]) || dateStr;

    m = numeric.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return formatYmd(+m[1], +m[2] - 1, +m[3]) || dateStr;

    m = clean.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})$/);
    if (m) {
        const monthIndex = MONTHS[m[2].toLowerCase()];
        if (monthIndex !== undefined) return formatYmd(+m[3], monthIndex, +m[1]) || dateStr;
    }

    return dateStr;
}

function parseDateStandardBank(text) {
    const periodMatch = text.match(/Statement\s+from\s+.*?\s+to\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
    if (periodMatch) return standardizeDate(periodMatch[1]);
    return null;
}

function parseDatePayslip(text) {
    const rangeMatch = text.match(/(\d{2}[./-]\d{2}[./-]\d{4})\s*(?:-|to)\s*(\d{2}[./-]\d{2}[./-]\d{4})/i);
    if (rangeMatch) return standardizeDate(rangeMatch[2]);

    const periodSingle = text.match(/Pay\s+Period:?\s*(\d{2}[./-]\d{2}[./-]\d{4})/i);
    if (periodSingle) return standardizeDate(periodSingle[1]);

    return null;
}

function parseDateGeneric(text) {
    const monthNames = '(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)';
    const named = text.match(new RegExp(`\\b(\\d{1,2}\\s+${monthNames}\\s+\\d{4})\\b`, 'i'));
    if (named) return standardizeDate(named[1]);

    const numeric = text.match(/\b(\d{4}[/-]\d{2}[/-]\d{2})\b|\b(\d{2}[./-]\d{2}[./-]\d{4})\b/);
    if (numeric) return standardizeDate(numeric[1] || numeric[2]);

    return 'Date not found';
}

export async function scanPdfDate(arrayBuffer, docType, passwordsStr = '') {
    try {
        await ensurePdfEngine();
        const text = await extractFirstPageText(arrayBuffer, parsePasswords(passwordsStr));
        if (!text.trim()) return { success: true, date: 'No text found (Scanned?)' };

        let dateFound = null;
        if (docType === 'bank') dateFound = parseDateStandardBank(text);
        else if (docType === 'payslip') dateFound = parseDatePayslip(text);

        if (!dateFound) dateFound = parseDateGeneric(text);
        return { success: true, date: dateFound };
    } catch (err) {
        const message = isPasswordError(err)
            ? 'File is encrypted. Unlock first.'
            : (err.message || String(err));
        return { success: false, error: message };
    }
}

async function loadPdfLibDoc(bytes, passwords = []) {
    const { PDFDocument } = window.PDFLib;
    const data = toUint8(bytes);
    try {
        return { doc: await PDFDocument.load(data), encrypted: false };
    } catch (err) {
        if (!isPasswordError(err) && !/encrypt/i.test(err?.message || '')) throw err;
        const candidates = ['', ...passwords];
        for (const password of candidates) {
            try {
                return { doc: await PDFDocument.load(data, { password }), encrypted: true };
            } catch (_) {
                // try next password
            }
        }
        throw new Error('File is encrypted. Unlock first or enter the password.');
    }
}

export async function mergePdfs(fileEntries, passwordsStr = '') {
    try {
        await ensurePdfEngine();
        const { PDFDocument } = window.PDFLib;
        const merged = await PDFDocument.create();
        const passwords = parsePasswords(passwordsStr);

        for (const entry of fileEntries) {
            const { doc } = await loadPdfLibDoc(entry.bytes, passwords);
            const pages = await merged.copyPages(doc, doc.getPageIndices());
            pages.forEach((page) => merged.addPage(page));
        }

        const bytes = await merged.save({ useObjectStreams: false });
        return { success: true, bytes };
    } catch (err) {
        return { success: false, error: err.message || String(err) };
    }
}

export async function unlockPdf(arrayBuffer, passwordsStr = '') {
    try {
        await ensurePdfEngine();
        const passwords = parsePasswords(passwordsStr);
        const { doc, encrypted } = await loadPdfLibDoc(arrayBuffer, passwords);
        if (!encrypted) {
            return { success: true, is_encrypted: false, bytes: toUint8(arrayBuffer) };
        }
        const unlocked = await doc.save({ useObjectStreams: false });
        return { success: true, is_encrypted: true, bytes: unlocked };
    } catch (err) {
        const message = isPasswordError(err) || /encrypt/i.test(err?.message || '')
            ? 'No passwords matched'
            : (err.message || String(err));
        return { success: false, error: message };
    }
}

export async function mapLimit(items, limit, worker) {
    const executing = new Set();
    const results = [];
    for (const item of items) {
        const p = Promise.resolve().then(() => worker(item));
        results.push(p);
        executing.add(p);
        const cleanup = () => executing.delete(p);
        p.then(cleanup, cleanup);
        if (executing.size >= limit) await Promise.race(executing);
    }
    return Promise.all(results);
}

function canvasToJpegBytes(canvas, quality = 0.7) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
            if (!blob) {
                try {
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    const binary = atob(dataUrl.split(',')[1] || '');
                    const out = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
                    resolve(out);
                } catch (err) {
                    reject(err);
                }
                return;
            }
            resolve(new Uint8Array(await blob.arrayBuffer()));
        }, 'image/jpeg', quality);
    });
}

function loadImageElement(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to decode image.'));
        img.src = src;
    });
}

function bytesToObjectUrl(bytes, mime = 'application/octet-stream') {
    return URL.createObjectURL(new Blob([toUint8(bytes)], { type: mime }));
}

export async function renderPageThumbnails(bytes, passwordsStr = '', scale = 0.28) {
    await ensurePdfEngine();
    const pdf = await openPdfJs(bytes, parsePasswords(passwordsStr));
    const thumbs = [];
    try {
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.floor(viewport.width));
            canvas.height = Math.max(1, Math.floor(viewport.height));
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            thumbs.push({
                pageIndex: i - 1,
                thumbUrl: canvas.toDataURL('image/jpeg', 0.72),
            });
        }
    } finally {
        await pdf.destroy();
    }
    return thumbs;
}

export async function renderImageThumbnail(bytes, mime = 'image/jpeg') {
    const url = bytesToObjectUrl(bytes, mime);
    try {
        const img = await loadImageElement(url);
        const max = 280;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.72);
    } finally {
        URL.revokeObjectURL(url);
    }
}

async function embedImageInPdf(pdf, bytes, mime) {
    const data = toUint8(bytes);
    if (isPngBytes(data) || String(mime || '').includes('png')) {
        return pdf.embedPng(data);
    }
    return pdf.embedJpg(data);
}

export async function imagesToPdf(imageEntries) {
    try {
        await ensurePdfEngine();
        const { PDFDocument } = window.PDFLib;
        const pdf = await PDFDocument.create();
        for (const entry of imageEntries) {
            const image = await embedImageInPdf(pdf, entry.bytes, entry.mime);
            const page = pdf.addPage([image.width, image.height]);
            page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
            if (entry.rotation) {
                page.setRotation(window.PDFLib.degrees(((entry.rotation % 360) + 360) % 360));
            }
        }
        return { success: true, bytes: await pdf.save({ useObjectStreams: false }) };
    } catch (err) {
        return { success: false, error: err.message || String(err) };
    }
}

export async function buildPdfFromPages(pageItems, passwordsStr = '') {
    try {
        await ensurePdfEngine();
        const { PDFDocument, degrees } = window.PDFLib;
        const out = await PDFDocument.create();
        const passwords = parsePasswords(passwordsStr);
        const docCache = new Map();

        for (const item of pageItems) {
            if (item.kind === 'image') {
                const image = await embedImageInPdf(out, item.bytes, item.mime);
                const page = out.addPage([image.width, image.height]);
                page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
                if (item.rotation) {
                    page.setRotation(degrees(((item.rotation % 360) + 360) % 360));
                }
                continue;
            }

            let src = docCache.get(item.fileId);
            if (!src) {
                src = (await loadPdfLibDoc(item.bytes, passwords)).doc;
                docCache.set(item.fileId, src);
            }
            const [copied] = await out.copyPages(src, [item.pageIndex]);
            if (item.rotation) {
                const current = copied.getRotation().angle || 0;
                copied.setRotation(degrees((((current + item.rotation) % 360) + 360) % 360));
            }
            out.addPage(copied);
        }

        return { success: true, bytes: await out.save({ useObjectStreams: false }) };
    } catch (err) {
        return { success: false, error: err.message || String(err) };
    }
}

export function fixedLengthRanges(totalPages, length) {
    const n = Math.max(1, Number(length) || 1);
    const ranges = [];
    for (let i = 1; i <= totalPages; i += n) {
        ranges.push({ from: i, to: Math.min(totalPages, i + n - 1) });
    }
    return ranges;
}

export async function splitPageItems(pageItems, ranges, passwordsStr = '') {
    try {
        const files = [];
        for (const range of ranges) {
            const from = Math.max(1, Number(range.from) || 1);
            const to = Math.max(from, Number(range.to) || from);
            const slice = pageItems.slice(from - 1, to);
            if (!slice.length) continue;
            const built = await buildPdfFromPages(slice, passwordsStr);
            if (!built.success) return built;
            files.push({
                name: `split_${from}-${Math.min(to, pageItems.length)}.pdf`,
                bytes: built.bytes,
            });
        }
        if (!files.length) return { success: false, error: 'No pages in the selected ranges.' };
        return { success: true, files };
    } catch (err) {
        return { success: false, error: err.message || String(err) };
    }
}

async function renderPdfPageToCanvas(bytes, pageIndex, { scale = 1.4, rotation = 0, passwords = [] } = {}) {
    const pdf = await openPdfJs(bytes, passwords);
    try {
        const page = await pdf.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale, rotation });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        return canvas;
    } finally {
        await pdf.destroy();
    }
}

export async function pdfPagesToJpegs(pageItems, { quality = 0.85, scale = 1.5, passwordsStr = '' } = {}) {
    try {
        await ensurePdfEngine();
        const files = [];
        const passwords = parsePasswords(passwordsStr);

        for (let i = 0; i < pageItems.length; i++) {
            const item = pageItems[i];
            let canvas;
            if (item.kind === 'image') {
                const url = bytesToObjectUrl(item.bytes, item.mime || 'image/jpeg');
                try {
                    const img = await loadImageElement(url);
                    canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    if (item.rotation) {
                        canvas.width = (item.rotation % 180 === 0) ? img.width : img.height;
                        canvas.height = (item.rotation % 180 === 0) ? img.height : img.width;
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.translate(canvas.width / 2, canvas.height / 2);
                        ctx.rotate((item.rotation * Math.PI) / 180);
                        ctx.drawImage(img, -img.width / 2, -img.height / 2);
                    } else {
                        ctx.drawImage(img, 0, 0);
                    }
                } finally {
                    URL.revokeObjectURL(url);
                }
            } else {
                canvas = await renderPdfPageToCanvas(item.bytes, item.pageIndex, {
                    scale,
                    rotation: item.rotation || 0,
                    passwords,
                });
            }
            const jpeg = await canvasToJpegBytes(canvas, quality);
            files.push({
                name: `page_${String(i + 1).padStart(3, '0')}.jpg`,
                bytes: jpeg,
            });
        }
        return { success: true, files };
    } catch (err) {
        return { success: false, error: err.message || String(err) };
    }
}

function clamp(n, min, max) {
    const x = Number(n);
    if (!Number.isFinite(x)) return min;
    return Math.min(max, Math.max(min, x));
}

export async function renderPagePreview(item, { scale = 2, passwordsStr = '' } = {}) {
    await ensurePdfEngine();
    if (item.kind === 'image') {
        const url = bytesToObjectUrl(item.bytes, item.mime || 'image/jpeg');
        try {
            const img = await loadImageElement(url);
            const rot = ((item.rotation || 0) % 360 + 360) % 360;
            const canvas = document.createElement('canvas');
            const swap = rot === 90 || rot === 270;
            canvas.width = swap ? img.height : img.width;
            canvas.height = swap ? img.width : img.height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((rot * Math.PI) / 180);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);
            return canvas.toDataURL('image/jpeg', 0.92);
        } finally {
            URL.revokeObjectURL(url);
        }
    }
    const canvas = await renderPdfPageToCanvas(item.bytes, item.pageIndex, {
        scale,
        rotation: item.rotation || 0,
        passwords: parsePasswords(passwordsStr),
    });
    return canvas.toDataURL('image/jpeg', 0.92);
}

export async function compressPages(pageItems, {
    quality = 0.8,
    scale = 2,
    passwordsStr = '',
    sourceBytes = 0,
} = {}) {
    const pdfJsDocs = [];
    try {
        await ensurePdfEngine();
        const { PDFDocument } = window.PDFLib;
        const jpegQuality = clamp(quality ?? 0.8, 0.4, 0.95);
        const renderScale = clamp(scale ?? 2, 0.8, 3.5);
        const passwords = parsePasswords(passwordsStr);
        const out = await PDFDocument.create();
        const docCache = new Map();

        for (const item of pageItems) {
            if (item.kind === 'image') {
                const url = bytesToObjectUrl(item.bytes, item.mime || 'image/jpeg');
                try {
                    const img = await loadImageElement(url);
                    const canvas = document.createElement('canvas');
                    const rot = ((item.rotation || 0) % 360 + 360) % 360;
                    const swap = rot === 90 || rot === 270;
                    canvas.width = Math.max(1, swap ? img.height : img.width);
                    canvas.height = Math.max(1, swap ? img.width : img.height);
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.translate(canvas.width / 2, canvas.height / 2);
                    ctx.rotate((rot * Math.PI) / 180);
                    ctx.drawImage(img, -img.width / 2, -img.height / 2);
                    const jpeg = await canvasToJpegBytes(canvas, jpegQuality);
                    const image = await out.embedJpg(jpeg);
                    const page = out.addPage([image.width, image.height]);
                    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
                } finally {
                    URL.revokeObjectURL(url);
                }
                continue;
            }

            let pdf = docCache.get(item.fileId);
            if (!pdf) {
                pdf = await openPdfJs(item.bytes, passwords);
                docCache.set(item.fileId, pdf);
                pdfJsDocs.push(pdf);
            }
            const page = await pdf.getPage(item.pageIndex + 1);
            const rotation = item.rotation || 0;
            const baseVp = page.getViewport({ scale: 1, rotation });
            const renderVp = page.getViewport({ scale: renderScale, rotation });
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.floor(renderVp.width));
            canvas.height = Math.max(1, Math.floor(renderVp.height));
            await page.render({ canvasContext: canvas.getContext('2d'), viewport: renderVp }).promise;
            const jpeg = await canvasToJpegBytes(canvas, jpegQuality);
            const image = await out.embedJpg(jpeg);
            const pdfPage = out.addPage([baseVp.width, baseVp.height]);
            pdfPage.drawImage(image, { x: 0, y: 0, width: baseVp.width, height: baseVp.height });
        }

        const bytes = await out.save({ useObjectStreams: true });
        const compressedBytes = bytes.length;
        if (sourceBytes && compressedBytes >= sourceBytes) {
            return {
                success: true,
                bytes: null,
                skipped: true,
                originalBytes: sourceBytes,
                compressedBytes,
                keptOriginal: true,
            };
        }

        return {
            success: true,
            bytes,
            skipped: false,
            originalBytes: sourceBytes || compressedBytes,
            compressedBytes,
            keptOriginal: false,
        };
    } catch (err) {
        return { success: false, error: err.message || String(err) };
    } finally {
        await Promise.all(pdfJsDocs.map((pdf) => pdf.destroy().catch(() => {})));
    }
}

export async function docxToPdf(arrayBuffer) {
    try {
        await ensurePdfEngine();
        await ensureDocxLibs();
        const buf = arrayBuffer instanceof Uint8Array
            ? arrayBuffer.buffer.slice(arrayBuffer.byteOffset, arrayBuffer.byteOffset + arrayBuffer.byteLength)
            : arrayBuffer;
        const result = await window.mammoth.convertToHtml({ arrayBuffer: buf });
        const container = document.createElement('div');
        container.style.cssText = [
            'position:fixed',
            'left:-12000px',
            'top:0',
            'width:794px',
            'padding:48px 56px',
            'background:#fff',
            'color:#111',
            'font-family:Times New Roman,Times,serif',
            'font-size:16px',
            'line-height:1.45',
            'z-index:-1',
        ].join(';');
        container.innerHTML = result.value || '<p></p>';
        document.body.appendChild(container);

        const canvas = await window.html2canvas(container, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
        });
        document.body.removeChild(container);

        const { PDFDocument } = window.PDFLib;
        const pdf = await PDFDocument.create();
        const pageWidth = 595;
        const pageHeight = 842;
        const sliceHeight = Math.max(1, Math.floor(canvas.width * (pageHeight / pageWidth)));
        let y = 0;
        let pageNo = 0;
        while (y < canvas.height) {
            const h = Math.min(sliceHeight, canvas.height - y);
            const slice = document.createElement('canvas');
            slice.width = canvas.width;
            slice.height = h;
            slice.getContext('2d').drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
            const jpeg = await canvasToJpegBytes(slice, 0.85);
            const image = await pdf.embedJpg(jpeg);
            const drawnH = h * (pageWidth / canvas.width);
            const page = pdf.addPage([pageWidth, pageHeight]);
            page.drawImage(image, { x: 0, y: pageHeight - drawnH, width: pageWidth, height: drawnH });
            y += sliceHeight;
            pageNo += 1;
            if (pageNo > 80) break;
        }
        return { success: true, bytes: await pdf.save({ useObjectStreams: false }) };
    } catch (err) {
        return { success: false, error: err.message || String(err) };
    }
}

export async function zipFiles(fileEntries) {
    await ensureZipLib();
    const zip = new window.JSZip();
    for (const entry of fileEntries) {
        zip.file(entry.name, entry.bytes);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    return blob;
}
