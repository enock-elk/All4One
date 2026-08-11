/**
 * Soft balance audit — flags only; never rewrites captured amounts.
 * ASCII labels only (Excel-safe, no emoji mojibake).
 */

const STATUS = {
    BASE: 'VERIFIED (BASE)',
    VERIFIED: 'VERIFIED',
    MISMATCH: 'MATH MISMATCH',
    MISSING: 'MISSING DATA',
};

/**
 * @param {Array<{amount?: number, balance?: number}>} ledger
 * @returns {{ ledger: Array, verifiedCount: number, flaggedCount: number, missingCount: number }}
 */
function softAuditLedger(ledger) {
    if (!Array.isArray(ledger) || ledger.length === 0) {
        return { ledger: [], verifiedCount: 0, flaggedCount: 0, missingCount: 0 };
    }

    let verifiedCount = 0;
    let flaggedCount = 0;
    let missingCount = 0;

    const out = ledger.map((row) => ({ ...row }));
    out[0].verification = STATUS.BASE;

    for (let i = 1; i < out.length; i++) {
        const prev = out[i - 1];
        const curr = out[i];

        if (prev.balance == null || curr.balance == null || curr.amount == null) {
            curr.verification = STATUS.MISSING;
            missingCount++;
            continue;
        }

        const expected = Number(prev.balance) + Number(curr.amount);
        if (Math.abs(expected - Number(curr.balance)) > 0.05) {
            curr.verification = STATUS.MISMATCH;
            flaggedCount++;
        } else {
            curr.verification = STATUS.VERIFIED;
            verifiedCount++;
        }
    }

    return { ledger: out, verifiedCount, flaggedCount, missingCount };
}

module.exports = { softAuditLedger, STATUS };
