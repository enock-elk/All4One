// ============================================================================
// ALL4ONE COMMAND CENTER - FIREBASE CLOUD FUNCTION BRIDGE
// Securely proxies Base64 PDF payloads to Google Cloud Document AI
// ============================================================================

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;

// Initialize Firebase Admin (Required for Cloud Functions)
admin.initializeApp();

// Initialize the Document AI Client
const client = new DocumentProcessorServiceClient();

// ============================================================================
// ⚠️ CONFIGURATION - YOU MUST UPDATE THIS BEFORE DEPLOYING ⚠️
// ============================================================================
const PROJECT_ID = process.env.GCP_PROJECT || 'all4one-nexus';
const LOCATION = 'us'; 
const PROCESSOR_ID = 'd819bce83399c5a8'; 

// ============================================================================
// MAIN ENDPOINT: extractBankData
// ============================================================================
exports.extractBankData = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            if (req.method !== 'POST') {
                return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
            }

            // --- SECURITY GUARD ---
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                console.warn(`[Document AI Bridge] Blocked unauthenticated request from IP: ${req.ip}`);
                return res.status(401).json({ error: 'Unauthorized: Missing or invalid token.' });
            }

            const idToken = authHeader.split('Bearer ')[1];
            let decodedToken;
            try {
                decodedToken = await admin.auth().verifyIdToken(idToken);
                console.log(`[Document AI Bridge] Authorized payload for UID: ${decodedToken.uid}`);
            } catch (authErr) {
                console.error("[Document AI Bridge] Invalid Token:", authErr);
                return res.status(403).json({ error: 'Forbidden: Expired or invalid token.' });
            }
            // --- END SECURITY GUARD ---

            const { filename, documentType, documentBase64 } = req.body;

            if (!documentBase64) {
                return res.status(400).json({ error: 'Missing documentBase64 in payload.' });
            }

            console.log(`[Document AI Bridge] Initiating processing for: ${filename} (Type: ${documentType})`);

            const name = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`;

            const request = {
                name,
                rawDocument: {
                    content: documentBase64,
                    mimeType: 'application/pdf',
                },
            };

            const [result] = await client.processDocument(request);
            const { document } = result;

            console.log(`[Document AI Bridge] Successfully analyzed ${filename}. Sanitizing data matrix...`);

            // 5. Mathematical Extraction
            let csvContent = "";
            let tablesFound = 0;
            
            if (document.pages) {
                for (const page of document.pages) {
                    if (page.tables) {
                        for (const table of page.tables) {
                            tablesFound++;
                            let rawTableMatrix = [];
                            
                            // A. Extract Header Rows
                            if (table.headerRows) {
                                for (const row of table.headerRows) {
                                    rawTableMatrix.push(row.cells.map(cell => extractText(cell.layout.textAnchor, document.text).trim()));
                                }
                            }
                            
                            // B. Extract Body Rows
                            if (table.bodyRows) {
                                for (const row of table.bodyRows) {
                                    rawTableMatrix.push(row.cells.map(cell => extractText(cell.layout.textAnchor, document.text).trim()));
                                }
                            }

                            // --- C. GUARDIAN SANITIZER ---
                            const sanitizedMatrix = sanitizeTableMatrix(rawTableMatrix);

                            // D. Build Pristine CSV String
                            for (const row of sanitizedMatrix) {
                                const escapedRow = row.map(cell => `"${cell.replace(/"/g, '""')}"`);
                                csvContent += escapedRow.join(',') + '\n';
                            }
                            csvContent += '\n'; // Separate tables
                        }
                    }
                }
            }

            if (tablesFound === 0) {
                csvContent = "No tabular data was detected by the AI in this document.";
            }

            console.log(`[Document AI Bridge] Complete. Found ${tablesFound} tables.`);
            
            return res.status(200).json({
                success: true,
                filename: filename,
                tableCount: tablesFound,
                csvData: csvContent
            });

        } catch (error) {
            console.error("[Document AI Bridge] CRITICAL ERROR:", error);
            return res.status(500).json({ 
                error: error.message || 'Internal Server Error during Document AI processing.' 
            });
        }
    });
});

// ============================================================================
// HELPER: Matrix Sanitizer (Column Shift & Footer Fix using Financial Signatures)
// ============================================================================
function sanitizeTableMatrix(matrix) {
    if (!matrix || matrix.length === 0) return matrix;

    const headerLength = matrix[0].length;
    let cleanedMatrix = [];
    
    for (let i = 0; i < matrix.length; i++) {
        let row = matrix[i];

        // 1. Header Cleanup (Fix OCR typos)
        if (i === 0) {
            row = row.map(h => h.replace("Transactio n", "Transaction").replace(/\r?\n/g, " ").trim());
            cleanedMatrix.push(row);
            continue;
        }

        // 2. Financial Signature Pruning
        // A row is kept if it has a Date, a financial keyword (like 'opening balance'), or a currency pattern.
        const col0 = row[0] || '';
        const hasDate = /^[\d\-\/]+$/.test(col0.trim()); 
        const hasKeyword = row.some(cell => /opening|balance|brought forward|b\/f|closing|statement/i.test(cell));
        const hasCurrency = row.some(cell => /(?:^|\s)-?\d{1,3}(?:[,\s]?\d{3})*\.\d{2}(?:\s|$)/.test(cell));

        if (!hasDate && !hasKeyword && !hasCurrency) {
            continue; // Violently drop address blocks, page numbers, and random bank metadata
        }

        // 3. Spatial Un-Merging (Fixing column shifts)
        if (row.length < headerLength) {
            let newRow = [];
            let hasSplit = false;

            for (let j = 0; j < row.length; j++) {
                const cell = row[j];
                
                // Match two currency values merged by a space (e.g., "0.00 107.00")
                const doubleCurrencyMatch = cell.match(/^([-\d,]+\.\d{2})\s+([-\d,]+\.\d{2})$/);
                // Match Date and Description merged (e.g., "20250901 Grub bite Hatfield")
                const dateDescMatch = cell.match(/^(\d{8})\s+(.+)$/);

                if (!hasSplit && doubleCurrencyMatch) {
                    newRow.push(doubleCurrencyMatch[1]);
                    newRow.push(doubleCurrencyMatch[2]);
                    hasSplit = true;
                } else if (!hasSplit && dateDescMatch && j < 3) {
                    newRow.push(dateDescMatch[1]);
                    newRow.push(dateDescMatch[2]);
                    hasSplit = true;
                } else {
                    newRow.push(cell);
                }
            }
            
            // 4. Final Alignment Padding
            // If the row is STILL short after regex splitting, pad empty columns with "0.00" before the Balance column
            while (newRow.length < headerLength) {
                newRow.splice(newRow.length - 1, 0, "0.00"); 
            }

            row = newRow;
        }

        cleanedMatrix.push(row);
    }

    return cleanedMatrix;
}

// ============================================================================
// HELPER: Text Anchor Extractor
// ============================================================================
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
    
    return extracted.replace(/\n/g, ' '); 
}