/**
 * Offline golden checks for multi-bank extraction foundations.
 * Run: npm test (from functions/)
 *
 * Does NOT call Document AI / Gemini — validates detect, amounts, grouping, soft audit.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { parseZaAmount, normalizeLedgerRow } = require('../../lib/zaAmounts');
const { detectBankProfile } = require('../../lib/bankProfiles');
const { groupTransactionBlocks } = require('../../lib/groupTransactions');
const { softAuditLedger, STATUS } = require('../../lib/softAudit');

const fixturesPath = path.join(__dirname, 'fixtures.json');
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));

let passed = 0;
let failed = 0;

function check(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  PASS  ${name}`);
    } catch (err) {
        failed++;
        console.error(`  FAIL  ${name}: ${err.message}`);
    }
}

console.log('Golden suite — multi-bank foundations\n');

// --- Core amount cases ---
check('parseZaAmount space thousands', () => {
    assert.strictEqual(parseZaAmount('-R1 700.00'), -1700);
    assert.strictEqual(parseZaAmount('1 700.00'), 1700);
    assert.strictEqual(parseZaAmount('12 000.00'), 12000);
});

check('parseZaAmount comma decimal', () => {
    assert.strictEqual(parseZaAmount('6 896,75'), 6896.75);
});

check('parseZaAmount trailing minus / Cr Dr', () => {
    assert.strictEqual(parseZaAmount('1,000.00-'), -1000);
    assert.strictEqual(parseZaAmount('14,343.06 Cr'), 14343.06);
    assert.strictEqual(parseZaAmount('962.25 Dr'), -962.25);
});

check('normalizeLedgerRow repairs -1 from 1 700 description', () => {
    const row = normalizeLedgerRow({
        amount: -1,
        description: 'Banking App Immediate Payment: Da Dludla Digital -1 700.00',
        balance: 7008.82,
    });
    assert.ok(Math.abs(row.amount) >= 1000, `expected large amount, got ${row.amount}`);
});

check('softAudit ASCII labels only', () => {
    const { ledger, flaggedCount } = softAuditLedger([
        { date: '2024-01-01', amount: 0, balance: 100 },
        { date: '2024-01-02', amount: -10, balance: 90 },
        { date: '2024-01-03', amount: -5, balance: 50 },
    ]);
    assert.strictEqual(ledger[0].verification, STATUS.BASE);
    assert.strictEqual(ledger[1].verification, STATUS.VERIFIED);
    assert.strictEqual(ledger[2].verification, STATUS.MISMATCH);
    assert.strictEqual(flaggedCount, 1);
    assert.ok(!ledger[2].verification.includes('⚠'));
});

// --- Per-fixture profile detection ---
for (const fix of fixtures.fixtures) {
    check(`detect ${fix.id}`, () => {
        const profile = detectBankProfile(fix.detectText, 'bank', fix.filename || fix.sampleFile);
        assert.strictEqual(profile.bankId, fix.expectProfile.bankId, `bankId ${profile.bankId}`);
        assert.strictEqual(profile.layoutId, fix.expectProfile.layoutId, `layoutId ${profile.layoutId}`);
    });

    if (fix.amountCases) {
        for (const ac of fix.amountCases) {
            check(`${fix.id} amount ${ac.raw}`, () => {
                assert.strictEqual(parseZaAmount(ac.raw), ac.expect);
            });
        }
    }

    if (fix.grouping) {
        check(`${fix.id} multi-row grouping`, () => {
            const profile = detectBankProfile(fix.detectText, 'bank', fix.sampleFile);
            const lines = fix.grouping.lines.map((text) => ({ pageIndex: 0, text }));
            const blocks = groupTransactionBlocks(lines, profile);
            assert.ok(
                blocks.length >= fix.grouping.minBlocks,
                `expected >= ${fix.grouping.minBlocks} blocks, got ${blocks.length}: ${JSON.stringify(blocks)}`
            );
            // First Absa purchase should absorb Card No continuation
            if (fix.id === 'absa_3row') {
                assert.ok(blocks[0].includes('Superspar') || blocks[0].includes('Card No'), 'continuation missing');
            }
        });
    }
}

console.log(`\nDone: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
