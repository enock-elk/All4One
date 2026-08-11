/**
 * Profile-aware Gemini normalization + mismatch-only repair.
 */

const { normalizeLedger } = require('./zaAmounts');

const GEMINI_BATCH_SIZE = 40;

function coerceLedgerArray(parsed) {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
        const nested = parsed.transactions || parsed.data || parsed.ledger || parsed.results || parsed.items;
        if (Array.isArray(nested)) return nested;
    }
    return null;
}

function buildNormalizationPrompt(blocks, profile) {
    const hints = (profile.geminiHints || []).map((h, i) => `${i + 1}. ${h}`).join('\n');
    return `You are a South African bank-statement normalizer for bank=${profile.bankId} layout=${profile.layoutId}.
Convert the OCR transaction blocks into a strict JSON array (top-level array only).

Target schema:
[
  {
    "date": "YYYY-MM-DD",
    "description": "string",
    "amount": number,
    "balance": number
  }
]

CAPTURE-FIRST RULES (critical):
- Capture amounts exactly as on the statement after locale normalize (spaces/commas). Never invent amounts.
- "1 700.00" or "-R1 700.00" is 1700 or -1700 — NEVER -1.
- Money In / Credits / Cr => positive amount. Money Out / Debits / Dr / trailing minus => negative.
- amountModel=${profile.amountModel}; dateModel=${profile.dateModel}; numberLocale=${profile.numberLocale}.
- Multi-line description fragments in one block belong to ONE transaction.
- Ignore summaries, rewards, fee-summary totals, addresses, page headers.
- Sort ascending by date (oldest first).
- If a block is not a real ledger transaction with an amount, omit it.

Bank-specific hints:
${hints}

Blocks:
${JSON.stringify(blocks)}`;
}

function buildRepairPrompt(rows, profile) {
    return `You repair ONLY mis-parsed South African bank transaction rows for ${profile.bankId}/${profile.layoutId}.
These rows failed a soft balance check (prev.balance + amount ≈ balance). Re-read description text and fix amount/balance/date if OCR split amounts like "-1 700.00" into -1.

Return a JSON array of corrected rows with the SAME length and order. Do not invent transactions. Capture-first: only fix clear parse errors.

Rows:
${JSON.stringify(rows)}`;
}

async function normalizeBlocksWithGemini(model, allBlocks, profile) {
    const batches = [];
    for (let i = 0; i < allBlocks.length; i += GEMINI_BATCH_SIZE) {
        batches.push(allBlocks.slice(i, i + GEMINI_BATCH_SIZE));
    }

    let combined = [];
    for (let b = 0; b < batches.length; b++) {
        console.log(`[Assembly Line] Gemini batch ${b + 1}/${batches.length} (${batches[b].length} blocks) profile=${profile.bankId}/${profile.layoutId}`);
        const geminiResponse = await model.generateContent(buildNormalizationPrompt(batches[b], profile));
        const rawJsonText = geminiResponse.response.text().replace(/```json|```/g, '').trim();
        let parsed;
        try {
            parsed = JSON.parse(rawJsonText);
        } catch (_) {
            throw new Error(`Gemini batch ${b + 1} returned invalid JSON. Extraction aborted.`);
        }
        const ledger = coerceLedgerArray(parsed);
        if (!ledger) {
            throw new Error(`Gemini batch ${b + 1} did not return a JSON array of transactions.`);
        }
        combined = combined.concat(ledger);
    }

    combined = normalizeLedger(combined);
    combined.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    return combined;
}

/**
 * Re-ask Gemini only for MATH MISMATCH rows (scan-heavy / noisy OCR).
 */
async function repairMismatchedRows(model, ledger, profile) {
    const indexes = [];
    const badRows = [];
    ledger.forEach((row, idx) => {
        if (row.verification === 'MATH MISMATCH') {
            indexes.push(idx);
            badRows.push({
                date: row.date,
                description: row.description,
                amount: row.amount,
                balance: row.balance,
            });
        }
    });

    if (badRows.length === 0) return ledger;

    console.log(`[Assembly Line] Gemini mismatch repair for ${badRows.length} row(s)...`);
    try {
        const geminiResponse = await model.generateContent(buildRepairPrompt(badRows, profile));
        const rawJsonText = geminiResponse.response.text().replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(rawJsonText);
        const fixed = coerceLedgerArray(parsed);
        if (!fixed || fixed.length !== badRows.length) {
            console.warn('[Assembly Line] Mismatch repair size mismatch; keeping originals.');
            return ledger;
        }

        const out = ledger.map((r) => ({ ...r }));
        const normalizedFixed = normalizeLedger(fixed);
        indexes.forEach((ledgerIndex, i) => {
            const f = normalizedFixed[i];
            if (!f) return;
            out[ledgerIndex] = {
                ...out[ledgerIndex],
                date: f.date ?? out[ledgerIndex].date,
                description: f.description ?? out[ledgerIndex].description,
                amount: f.amount ?? out[ledgerIndex].amount,
                balance: f.balance ?? out[ledgerIndex].balance,
            };
        });
        return out;
    } catch (err) {
        console.warn('[Assembly Line] Mismatch repair failed:', err.message);
        return ledger;
    }
}

module.exports = {
    coerceLedgerArray,
    buildNormalizationPrompt,
    normalizeBlocksWithGemini,
    repairMismatchedRows,
    GEMINI_BATCH_SIZE,
};
