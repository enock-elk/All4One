// ============================================================================
// ALL4ONE COMMAND CENTER - FIREBASE CLOUD FUNCTION BRIDGE (GUARDIAN V3)
// Bank-aware Assembly Line: Chunk -> Document AI OCR -> Profile group -> Gemini -> Soft audit -> Sheets/CSV
// ============================================================================

const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
const { PDFDocument } = require('pdf-lib');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { google } = require('googleapis');

const { detectBankProfile } = require('./lib/bankProfiles');
const { groupFromDocAiDocuments, collectLinesFromDocument } = require('./lib/groupTransactions');
const { softAuditLedger } = require('./lib/softAudit');
const { normalizeLedger } = require('./lib/zaAmounts');
const { normalizeBlocksWithGemini, repairMismatchedRows } = require('./lib/geminiNormalize');
const { DEFAULT_LOCATION, DEFAULT_PROCESSOR_ID, processorName, processDocumentWithRetry } = require('./lib/docAi');

if (!admin.apps.length) {
    admin.initializeApp();
}

let docAiClient;
function getDocAiClient() {
    if (!docAiClient) {
        docAiClient = new DocumentProcessorServiceClient();
    }
    return docAiClient;
}

const PROJECT_ID = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'all4one-nexus';
const LOCATION = DEFAULT_LOCATION;
const PROCESSOR_ID = DEFAULT_PROCESSOR_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

exports.extractBankData = onRequest({ timeoutSeconds: 540, memory: '2GiB' }, (req, res) => {
    cors(req, res, async () => {
        try {
            if (req.method !== 'POST') {
                return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
            }

            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Unauthorized: Missing or invalid token.' });
            }

            const idToken = authHeader.split('Bearer ')[1];
            let decodedToken;
            try {
                decodedToken = await admin.auth().verifyIdToken(idToken);
                console.log(`[Document AI Bridge] Authorized payload for UID: ${decodedToken.uid}`);
            } catch (authErr) {
                console.error('[Document AI Bridge] Invalid Token:', authErr);
                return res.status(403).json({ error: 'Forbidden: Expired or invalid token.' });
            }

            if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
                return res.status(500).json({
                    error: 'Server misconfiguration: GEMINI_API_KEY is missing. Set it in the function environment before extracting.'
                });
            }

            const { filename, documentType, documentBase64 } = req.body;
            if (!documentBase64) {
                return res.status(400).json({ error: 'Missing documentBase64 in payload.' });
            }

            console.log(`[Assembly Line] Initiating processing for: ${filename} (Type: ${documentType})`);
            console.log(`[Assembly Line] Document AI processor: ${PROCESSOR_ID} @ ${LOCATION}`);

            // 1. PDF CHUNKING
            console.log('[Assembly Line] Step 1: Chunking PDF...');
            const pdfBytes = Buffer.from(documentBase64, 'base64');

            let pdfDoc;
            try {
                pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
            } catch (loadErr) {
                console.error('[Assembly Line] PDF load failed:', loadErr);
                return res.status(400).json({
                    error: 'Could not open PDF. If the file is password-protected, unlock it in the Holding Bay first, then retry extraction.'
                });
            }

            const totalPages = pdfDoc.getPageCount();
            if (totalPages === 0) {
                return res.status(400).json({ error: 'PDF contains no pages.' });
            }

            const CHUNK_SIZE = 10;
            const chunksBase64 = [];
            for (let i = 0; i < totalPages; i += CHUNK_SIZE) {
                const chunkDoc = await PDFDocument.create();
                const endPage = Math.min(i + CHUNK_SIZE, totalPages);
                const pageIndices = Array.from({ length: endPage - i }, (_, k) => i + k);
                const copiedPages = await chunkDoc.copyPages(pdfDoc, pageIndices);
                copiedPages.forEach((page) => chunkDoc.addPage(page));
                chunksBase64.push(await chunkDoc.saveAsBase64());
            }
            console.log(`[Assembly Line] PDF split into ${chunksBase64.length} chunk(s), ${totalPages} page(s).`);

            // 2. DOCUMENT AI OCR (with retry) + collect documents
            console.log('[Assembly Line] Step 2: Document AI OCR...');
            const documents = [];
            let sampleText = '';

            for (let i = 0; i < chunksBase64.length; i++) {
                console.log(`[Assembly Line] Document AI chunk ${i + 1}/${chunksBase64.length}...`);
                const request = {
                    name: processorName(PROJECT_ID, LOCATION, PROCESSOR_ID),
                    rawDocument: {
                        content: chunksBase64[i],
                        mimeType: 'application/pdf',
                    },
                };

                let result;
                try {
                    result = await processDocumentWithRetry(getDocAiClient(), request);
                } catch (docAiErr) {
                    throw taggedError('Document AI', docAiErr, [
                        'Enable Cloud Document AI API on all4one-nexus',
                        'Grant the Cloud Functions service account roles/documentai.apiUser',
                        'Set DOCUMENT_AI_PROCESSOR_ID to an OCR/Layout processor in the US region if Form Parser keeps throttling'
                    ]);
                }

                const { document } = result;
                if (document) {
                    documents.push(document);
                    if (i === 0) {
                        sampleText = (document.text || '').slice(0, 8000);
                    }
                }
            }

            // Sparse OCR => treat as scan-heavy for detection
            const totalOcrChars = documents.reduce((n, d) => n + ((d.text && d.text.length) || 0), 0);
            if (totalOcrChars < 120) {
                sampleText += '\n[SCAN_HEAVY_SPARSE_OCR]';
            }

            // 3. BANK PROFILE DETECTION + GROUPING
            const profile = detectBankProfile(sampleText, documentType, filename || '');
            console.log(`[Assembly Line] Detected profile: ${profile.bankId}/${profile.layoutId} (scanHeavy=${!!profile.scanHeavy})`);

            let isolatedTransactionBlocks = groupFromDocAiDocuments(documents, profile);
            console.log(`[Assembly Line] Grouped ${isolatedTransactionBlocks.length} transaction block(s).`);

            if (isolatedTransactionBlocks.length === 0) {
                // Last resort: dump non-empty lines for Gemini on scan-heavy docs
                if (profile.scanHeavy || totalOcrChars > 0) {
                    const loose = [];
                    for (const doc of documents) {
                        for (const line of collectLinesFromDocument(doc)) {
                            if (line.text && line.text.length > 8) loose.push(line.text);
                        }
                    }
                    if (loose.length) {
                        console.log(`[Assembly Line] Fallback loose lines for Gemini: ${loose.length}`);
                        isolatedTransactionBlocks = loose.slice(0, 200);
                    }
                }
            }

            if (isolatedTransactionBlocks.length === 0) {
                return res.status(422).json({
                    error: 'No transaction-like text blocks were found. The PDF may be image-only without OCR coverage, or not a bank statement.'
                });
            }

            // 4. GEMINI NORMALIZATION (profile-aware)
            console.log('[Assembly Line] Step 3: Gemini normalization...');
            const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({
                model: 'gemini-2.5-flash',
                generationConfig: { responseMimeType: 'application/json' }
            });

            let normalizedLedger;
            try {
                normalizedLedger = await normalizeBlocksWithGemini(model, isolatedTransactionBlocks, profile);
            } catch (geminiErr) {
                throw taggedError('Gemini', geminiErr, [
                    'Confirm GEMINI_API_KEY is set on the Cloud Function',
                    'Retry later if Gemini returned 503 high demand'
                ]);
            }

            normalizedLedger = normalizeLedger(normalizedLedger);

            // 5. SOFT AUDIT (ASCII, capture-first)
            console.log('[Assembly Line] Step 4: Soft audit...');
            let audit = softAuditLedger(normalizedLedger);

            // Scan-heavy / mismatch repair pass
            if (audit.flaggedCount > 0 && (profile.scanHeavy || audit.flaggedCount / Math.max(audit.ledger.length, 1) > 0.15)) {
                const repaired = await repairMismatchedRows(model, audit.ledger, profile);
                audit = softAuditLedger(normalizeLedger(repaired));
            }

            normalizedLedger = audit.ledger;
            console.log(`[Assembly Line] Audit: verified=${audit.verifiedCount} mismatch=${audit.flaggedCount} missing=${audit.missingCount}`);

            // 6. OUTPUT
            console.log('[Assembly Line] Step 5: Output...');
            const safeName = String(filename || 'document').replace(/\.pdf$/i, '').replace(/[^\w\- ]+/g, '_');
            const sheetData = [
                ['Date', 'Description', 'Amount', 'Balance', 'Audit Status']
            ];
            normalizedLedger.forEach((row) => {
                sheetData.push([
                    row.date ?? '',
                    row.description ?? '',
                    row.amount ?? 0,
                    row.balance ?? 0,
                    row.verification ?? ''
                ]);
            });

            const meta = {
                bankId: profile.bankId,
                layoutId: profile.layoutId,
                verifiedCount: audit.verifiedCount,
                flaggedCount: audit.flaggedCount,
                missingCount: audit.missingCount,
            };

            try {
                const auth = new google.auth.GoogleAuth({
                    scopes: [
                        'https://www.googleapis.com/auth/spreadsheets',
                        'https://www.googleapis.com/auth/drive.file'
                    ]
                });
                const sheets = google.sheets({ version: 'v4', auth });
                const drive = google.drive({ version: 'v3', auth });

                const sheetRes = await sheets.spreadsheets.create({
                    requestBody: {
                        properties: {
                            title: `All4One_Captured_${safeName}_${new Date().getTime()}`
                        }
                    }
                });

                const spreadsheetId = sheetRes.data.spreadsheetId;
                const spreadsheetUrl = sheetRes.data.spreadsheetUrl;
                const firstSheetTitle = sheetRes.data.sheets?.[0]?.properties?.title || 'Sheet1';

                try {
                    await drive.permissions.create({
                        fileId: spreadsheetId,
                        requestBody: { role: 'reader', type: 'anyone' }
                    });
                } catch (shareErr) {
                    console.warn('[Assembly Line] Could not make Sheet public:', shareErr.message);
                }

                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `'${firstSheetTitle}'!A1`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: sheetData }
                });

                console.log(`[Assembly Line] Success! Sheet: ${spreadsheetUrl}`);
                return res.status(200).json({
                    success: true,
                    filename,
                    tableCount: normalizedLedger.length,
                    sheetUrl: spreadsheetUrl,
                    outputMode: 'sheets',
                    ...meta,
                });
            } catch (sheetsErr) {
                console.warn('[Assembly Line] Sheets unavailable, CSV fallback:', sheetsErr.message);
                // UTF-8 BOM for Excel
                const csvBody = sheetData.map((row) =>
                    row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
                ).join('\n');
                const csvData = `\uFEFF${csvBody}`;

                return res.status(200).json({
                    success: true,
                    filename,
                    tableCount: normalizedLedger.length,
                    csvData,
                    outputMode: 'csv',
                    warning: 'Google Sheets unavailable for this service account; CSV returned instead.',
                    ...meta,
                });
            }
        } catch (error) {
            console.error('[Assembly Line] CRITICAL ERROR:', error);
            return res.status(500).json({
                error: error.message || 'Internal Server Error during AI processing.'
            });
        }
    });
});

function taggedError(step, err, hints = []) {
    const base = err?.message || String(err);
    const hintText = hints.length ? ` Fix: ${hints.join('; ')}.` : '';
    const e = new Error(`[${step}] ${base}${hintText}`);
    e.cause = err;
    return e;
}
