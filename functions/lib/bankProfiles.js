/**
 * Bank / layout detection and profile registry for SA statements.
 */

const SUMMARY_PATTERNS = [
    /fee summary/i,
    /money in summary/i,
    /money out summary/i,
    /live better/i,
    /funds received \(credits\)/i,
    /funds used \(debits\)/i,
    /account summary/i,
    /% of utilisation/i,
    /% of funds received/i,
    /balance brought forward/i,
    /statement opening balance/i,
    /opening balance/i,
    /closing balance/i,
    /tax invoice/i,
    /client care/i,
    /unique document no/i,
];

const PROFILES = {
    generic: {
        bankId: 'generic',
        layoutId: 'generic',
        amountModel: 'signed',
        dateModel: 'single',
        numberLocale: 'za-space',
        geminiHints: [
            'South African statement; amounts may use spaces as thousands separators (1 700.00).',
            'Capture amounts exactly after normalizing spaces/commas; do not invent values.',
            'Ignore fee summaries and money-in/out summary sections.',
        ],
    },
    capitec_1date: {
        bankId: 'capitec',
        layoutId: '1date',
        amountModel: 'signed',
        dateModel: 'single',
        numberLocale: 'za-space',
        geminiHints: [
            'Capitec single-date layout.',
            'Amounts look like -R1 700.00 or Digital -1 700.00 — the full value is 1700.00 not 1.',
            'Cellphone / Fees / SMS lines are separate fee transactions when they have their own amount and balance.',
            'Ignore Fee Summary, Money In Summary, Money Out Summary, Live Better blocks.',
        ],
    },
    capitec_2date: {
        bankId: 'capitec',
        layoutId: '2date',
        amountModel: 'money_in_out',
        dateModel: 'dual',
        numberLocale: 'za-space',
        geminiHints: [
            'Capitec dual-date: PostingDate and TransactionDate may both appear — use TransactionDate as date when present.',
            'Columns Money In (R) and Money Out (R): money in => positive amount, money out => negative amount.',
            'Never treat a lone "-1" as the amount when the line contains "-1 700.00" style values.',
        ],
    },
    standard_left_date: {
        bankId: 'standard',
        layoutId: 'left_date',
        amountModel: 'payments_deposits',
        dateModel: 'single',
        numberLocale: 'za-space',
        geminiHints: [
            'Standard Bank left-column date; columns Payments / Deposits / Balance.',
            'Payments are negative; Deposits are positive.',
            'FEE lines following prepaid/card purchases are separate transactions when they carry amount+balance.',
        ],
    },
    standard_mid_date: {
        bankId: 'standard',
        layoutId: 'mid_date',
        amountModel: 'payments_deposits',
        dateModel: 'single',
        numberLocale: 'za-space',
        geminiHints: [
            'Standard Bank mid-column date with 2-row descriptions.',
            'Continuation lines without a new date+balance belong to the previous transaction description.',
            'Debits may appear with trailing minus (1,000.00-).',
        ],
    },
    absa_multirow: {
        bankId: 'absa',
        layoutId: '3row',
        amountModel: 'signed',
        dateModel: 'single',
        numberLocale: 'za-comma',
        geminiHints: [
            'Absa multi-row descriptions: Card No. / merchant / Effective date lines continue the previous transaction.',
            'Decimals may use commas (6 896,75). Fees like Settlement4.40 may appear on the same header line as the purchase.',
            'Only start a new transaction when a posting date and running balance are present.',
        ],
    },
    fnb_crdr: {
        bankId: 'fnb',
        layoutId: '3col_crdr',
        amountModel: 'cr_dr',
        dateModel: 'single',
        numberLocale: 'za-space',
        geminiHints: [
            'FNB Private Clients style: amounts marked Cr (positive) or Dr (negative).',
            'Multi-column descriptions — join continuation fragments into one description.',
            'Skip statement summary credit/debit totals at the top.',
        ],
    },
    nedbank_list: {
        bankId: 'nedbank',
        layoutId: 'tran_list',
        amountModel: 'signed',
        dateModel: 'single',
        numberLocale: 'za-space',
        geminiHints: [
            'Nedbank transaction list. Ignore utilisation charts and account summary percentages.',
            'Capture transaction rows with date, description, amount, running balance only.',
        ],
    },
    tymebank_scan: {
        bankId: 'tymebank',
        layoutId: 'scan',
        amountModel: 'signed',
        dateModel: 'single',
        numberLocale: 'za-space',
        geminiHints: [
            'TymeBank often arrives as a blurry scan — OCR text may be noisy.',
            'Prefer rows that clearly show a date, an amount, and a running balance.',
            'If uncertain about an amount, omit the row rather than inventing.',
        ],
        scanHeavy: true,
    },
    nedbank_scan: {
        bankId: 'nedbank',
        layoutId: 'scan',
        amountModel: 'signed',
        dateModel: 'single',
        numberLocale: 'za-space',
        geminiHints: [
            'Nedbank blurry scan — OCR may be sparse. Extract only confident transaction rows.',
            'Ignore marketing and summary chart text.',
        ],
        scanHeavy: true,
    },
};

function isSummaryLine(text) {
    if (!text) return true;
    return SUMMARY_PATTERNS.some((re) => re.test(text));
}

/**
 * Detect bank+layout from early OCR text and optional UI documentType.
 */
function detectBankProfile(sampleText, documentType, filename = '') {
    const text = `${sampleText || ''}\n${filename || ''}`;
    const lower = text.toLowerCase();

    // Explicit UI hint still allows sub-layout detection
    const isCapitec = /capitec/.test(lower);
    const isStandard = /standard\s*bank|standardbank/.test(lower);
    const isAbsa = /\babsa\b/.test(lower);
    const isFnb = /\bfnb\b|first\s*national/.test(lower);
    const isNedbank = /nedbank/.test(lower);
    const isTyme = /tyme\s*bank|tymebank/.test(lower);

    if (isCapitec) {
        if (/money\s*in\s*\(r\)|posting\s*date|transaction\s*date/i.test(text)) {
            return { ...PROFILES.capitec_2date };
        }
        return { ...PROFILES.capitec_1date };
    }
    if (isStandard) {
        if (/service\s*fee|balance brought forward/i.test(text) && /credits|debits/i.test(text)) {
            return { ...PROFILES.standard_mid_date };
        }
        if (/payments\s+deposits\s+balance/i.test(text) || /pre-paid payment to/i.test(text)) {
            return { ...PROFILES.standard_left_date };
        }
        return { ...PROFILES.standard_left_date };
    }
    if (isAbsa) return { ...PROFILES.absa_multirow };
    if (isFnb) return { ...PROFILES.fnb_crdr };
    if (isTyme) return { ...PROFILES.tymebank_scan };
    if (isNedbank) {
        // Sparse OCR => scan profile
        const alpha = (text.match(/[A-Za-z]/g) || []).length;
        if (alpha < 80) return { ...PROFILES.nedbank_scan };
        return { ...PROFILES.nedbank_list };
    }

    if (documentType === 'bank') {
        return { ...PROFILES.generic };
    }
    return { ...PROFILES.generic };
}

function getProfile(bankId, layoutId) {
    const key = Object.keys(PROFILES).find(
        (k) => PROFILES[k].bankId === bankId && PROFILES[k].layoutId === layoutId
    );
    return key ? { ...PROFILES[key] } : { ...PROFILES.generic };
}

module.exports = {
    PROFILES,
    SUMMARY_PATTERNS,
    isSummaryLine,
    detectBankProfile,
    getProfile,
};
