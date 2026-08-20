// ============================================================================
// ALL4ONE - BROWSER PDF ENGINE (no Pyodide)
// Scan / merge / unlock in JS. Replaces the ~30MB Python WASM runtime.
// ============================================================================

const PDFJS_SRC = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
const PDF_LIB_SRC = 'https://cdn.jsdelivr.net/npm/@cantoo/pdf-lib@2.4.2/dist/pdf-lib.min.js';

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
