/**
 * Profile-driven transaction grouping from Document AI lines/tables.
 */

const { isSummaryLine } = require('./bankProfiles');
const { extractAmountTokens } = require('./zaAmounts');

// Header-ish dates for SA banks
const DATE_RE =
    /\b(?:\d{1,2}\s*[\/\-.]\s*\d{1,2}\s*[\/\-.]\s*\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}|\d{4}-\d{2}-\d{2})\b/i;

const CONTINUATION_RE =
    /^(card\s*no|effective|settlement|notifyme|fee\s*-|sms\s*notif|page\s+\d)/i;

function extractText(textAnchor, fullText) {
    if (!textAnchor || !textAnchor.textSegments || textAnchor.textSegments.length === 0) {
        return '';
    }
    let extracted = '';
    for (const segment of textAnchor.textSegments) {
        const startIndex = segment.startIndex || 0;
        const endIndex = segment.endIndex;
        extracted += fullText.substring(startIndex, endIndex);
    }
    return extracted.replace(/\n/g, ' ').trim();
}

function lineLooksLikeTxnHeader(text, profile) {
    if (!text || isSummaryLine(text)) return false;
    if (!DATE_RE.test(text)) return false;
    if (CONTINUATION_RE.test(text.trim())) return false;

    const tokens = extractAmountTokens(text);
    // Need at least one money-like token (amount and/or balance)
    if (tokens.length === 0) {
        // Capitec/SB sometimes split amount to next line — allow date+payment keywords
        if (/payment|transfer|withdrawal|purchase|debit|credit|fee|salary|deposit/i.test(text)) {
            return true;
        }
        return false;
    }
    return true;
}

function isContinuationLine(text, profile) {
    if (!text || isSummaryLine(text)) return false;
    if (CONTINUATION_RE.test(text.trim())) return true;

    // Absa / SB / FNB detail lines usually lack a leading date
    if (!DATE_RE.test(text)) {
        // Still skip pure noise
        if (text.length < 3) return false;
        if (/^\d+\s*of\s*\d+$/i.test(text)) return false;
        return true;
    }

    // Dual-date Capitec: second date on same txn is not a new header if no balance-like pair
    if (profile.dateModel === 'dual' && DATE_RE.test(text)) {
        const tokens = extractAmountTokens(text);
        return tokens.length < 1;
    }

    return false;
}

/**
 * Collect ordered lines from a Document AI document page.
 */
function collectLinesFromDocument(document) {
    const lines = [];
    if (!document || !document.pages) return lines;

    document.pages.forEach((page, pageIndex) => {
        if (page.tables && page.tables.length) {
            for (const table of page.tables) {
                const rows = [...(table.headerRows || []), ...(table.bodyRows || [])];
                for (const row of rows) {
                    const cells = (row.cells || []).map((cell) =>
                        extractText(cell.layout && cell.layout.textAnchor, document.text)
                    );
                    const joined = cells.filter(Boolean).join(' | ').trim();
                    if (joined) {
                        lines.push({ pageIndex, text: joined, fromTable: true });
                    }
                }
            }
        }

        if (page.lines) {
            for (const line of page.lines) {
                const text = extractText(line.layout && line.layout.textAnchor, document.text);
                if (text) lines.push({ pageIndex, text, fromTable: false });
            }
        }
    });

    return lines;
}

/**
 * Group OCR lines into transaction blocks using the bank profile.
 * @returns {string[]}
 */
function groupTransactionBlocks(allLines, profile) {
    const blocks = [];
    let current = '';

    for (const { text } of allLines) {
        const trimmed = text.trim();
        if (!trimmed) continue;
        if (isSummaryLine(trimmed) && !lineLooksLikeTxnHeader(trimmed, profile)) {
            continue;
        }

        if (lineLooksLikeTxnHeader(trimmed, profile)) {
            if (current.trim()) blocks.push(current.trim());
            current = trimmed + ' ';
            continue;
        }

        if (current && isContinuationLine(trimmed, profile)) {
            current += trimmed + ' ';
            continue;
        }

        // Orphan non-header before first txn — skip (headers/addresses)
        if (!current) continue;

        // Fallback: append weak continuations
        if (!DATE_RE.test(trimmed) || profile.scanHeavy) {
            current += trimmed + ' ';
        }
    }

    if (current.trim()) blocks.push(current.trim());
    return blocks;
}

/**
 * Merge Document AI chunk documents into grouped blocks.
 */
function groupFromDocAiDocuments(documents, profile) {
    const allLines = [];
    for (const doc of documents) {
        allLines.push(...collectLinesFromDocument(doc));
    }
    return groupTransactionBlocks(allLines, profile);
}

module.exports = {
    extractText,
    collectLinesFromDocument,
    groupTransactionBlocks,
    groupFromDocAiDocuments,
    DATE_RE,
};
