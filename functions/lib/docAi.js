/**
 * Document AI helpers: retry/backoff for throttle, processor config.
 */

const DEFAULT_LOCATION = process.env.DOCUMENT_AI_LOCATION || 'us';
// Prefer OCR/Layout processor via env; fall back to legacy Form Parser id for continuity.
const DEFAULT_PROCESSOR_ID =
    process.env.DOCUMENT_AI_PROCESSOR_ID ||
    process.env.DOCUMENT_AI_OCR_PROCESSOR_ID ||
    'd819bce83399c5a8';

function processorName(projectId, location = DEFAULT_LOCATION, processorId = DEFAULT_PROCESSOR_ID) {
    return `projects/${projectId}/locations/${location}/processors/${processorId}`;
}

function isThrottleError(err) {
    const msg = `${err?.message || ''} ${err?.details || ''}`;
    return /throttl|quota exceeded|RESOURCE_EXHAUSTED|429|rate limit/i.test(msg);
}

async function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

/**
 * processDocument with exponential backoff on throttle.
 */
async function processDocumentWithRetry(client, request, { maxAttempts = 4 } = {}) {
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const [result] = await client.processDocument(request);
            return result;
        } catch (err) {
            lastErr = err;
            if (!isThrottleError(err) || attempt === maxAttempts) throw err;
            const delay = Math.min(15000, 1000 * 2 ** attempt);
            console.warn(`[Document AI] Throttled (attempt ${attempt}/${maxAttempts}); retry in ${delay}ms`);
            await sleep(delay);
        }
    }
    throw lastErr;
}

module.exports = {
    DEFAULT_LOCATION,
    DEFAULT_PROCESSOR_ID,
    processorName,
    isThrottleError,
    processDocumentWithRetry,
};
