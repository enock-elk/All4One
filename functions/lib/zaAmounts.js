/**
 * South African bank amount / locale helpers.
 * Capture-first: normalize notation only; never invent values.
 */

/**
 * Parse ZA money strings:
 *  -R1 700.00 | R1,700.00 | 6 896,75 | 1700.00- | 12 000.00 Cr
 * @returns {number|null}
 */
function parseZaAmount(raw) {
    if (raw == null || raw === '') return null;
    let s = String(raw).trim();
    if (!s) return null;

    let sign = 1;
    if (/^\(.*\)$/.test(s)) {
        sign = -1;
        s = s.slice(1, -1).trim();
    }
    if (/cr\b/i.test(s) && !/dr\b/i.test(s)) {
        // credit token — positive unless already negative
    } else if (/\bdr\b/i.test(s)) {
        sign = -1;
    }

    // Strip Cr/Dr tokens before stripping currency R (so "Cr" is not left as "C")
    s = s.replace(/\b(cr|dr)\b/gi, '').trim();
    s = s.replace(/(^|[\s(+-])R(?=\s*\d)/gi, '$1');
    // Strip leading labels: "Digital -1 700.00" -> "-1 700.00"
    s = s.replace(/^[^\d+\-(]+/, '').trim();

    if (s.endsWith('-')) {
        sign = -1;
        s = s.slice(0, -1).trim();
    }
    if (s.startsWith('-') || s.startsWith('+')) {
        if (s.startsWith('-')) sign = -1;
        s = s.slice(1).trim();
    }

    // Comma decimal (European/ZA Absa style): 6 896,75
    if (/,\d{1,2}$/.test(s) && !s.includes('.')) {
        s = s.replace(/\s/g, '').replace(',', '.');
    } else {
        // Space or comma thousands with dot decimal: 1 700.00 / 1,700.00
        s = s.replace(/[\s,]/g, '');
    }

    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return sign * n;
}

/**
 * Pull the most likely monetary tokens from a messy OCR line.
 * Prefers amounts with decimal parts; avoids bare page numbers.
 */
function extractAmountTokens(text) {
    if (!text) return [];
    const re = /[-+]?\(?R?\s?\d{1,3}(?:[\s,]\d{3})*(?:[.,]\d{2})?\)?(?:\s*-)?(?:\s*(?:Cr|Dr))?/gi;
    const hits = text.match(re) || [];
    return hits
        .map((h) => ({ raw: h.trim(), value: parseZaAmount(h) }))
        .filter((h) => h.value != null && Math.abs(h.value) >= 0.01);
}

/**
 * Normalize a ledger row's amount/balance fields in place (capture-first).
 */
function normalizeLedgerRow(row) {
    if (!row || typeof row !== 'object') return row;
    if (typeof row.amount === 'string') {
        const parsed = parseZaAmount(row.amount);
        if (parsed != null) row.amount = parsed;
    }
    if (typeof row.balance === 'string') {
        const parsed = parseZaAmount(row.balance);
        if (parsed != null) row.balance = parsed;
    }
    // Collapse OCR splits like amount -1 with "700.00" left in description
    if (typeof row.amount === 'number' && Math.abs(row.amount) <= 1 && row.description) {
        const tokens = extractAmountTokens(row.description);
        const big = tokens.find((t) => Math.abs(t.value) >= 10);
        if (big) {
            // Keep sign from parsed amount if negative / out
            row.amount = row.amount < 0 ? -Math.abs(big.value) : big.value;
            row.description = row.description.replace(big.raw, ' ').replace(/\s+/g, ' ').trim();
        }
    }
    return row;
}

function normalizeLedger(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => normalizeLedgerRow({ ...r }));
}

module.exports = {
    parseZaAmount,
    extractAmountTokens,
    normalizeLedgerRow,
    normalizeLedger,
};
