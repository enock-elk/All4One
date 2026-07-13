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
// 1. Go to Google Cloud Console -> Document AI -> Processors
// 2. Create a "Form Parser" or "Custom Extractor"
// 3. Copy its ID here (It looks like a random hex string, e.g., 'a1b2c3d4e5f6g7h8')
const PROJECT_ID = process.env.GCP_PROJECT || 'all4one-nexus';
const LOCATION = 'us'; // Leave as 'us' unless you specifically created it in 'eu'
const PROCESSOR_ID = 'd819bce83399c5a8'; 

// ============================================================================
// MAIN ENDPOINT: extractBankData
// ============================================================================
exports.extractBankData = functions.https.onRequest((req, res) => {
    // 1. Wrap the entire request in CORS to allow browser fetch()
    cors(req, res, async () => {
        try {
            // Enforce POST method
            if (req.method !== 'POST') {
                return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
            }

            const { filename, documentType, documentBase64 } = req.body;

            if (!documentBase64) {
                return res.status(400).json({ error: 'Missing documentBase64 in payload.' });
            }

            console.log(`[Document AI Bridge] Initiating processing for: ${filename} (Type: ${documentType})`);

            // 2. Construct the full resource name of the Document AI Processor
            const name = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`;

            // 3. Configure the Document AI Request
            const request = {
                name,
                rawDocument: {
                    content: documentBase64,
                    mimeType: 'application/pdf',
                },
            };

            // 4. Fire the Request to Google Cloud
            const [result] = await client.processDocument(request);
            const { document } = result;

            console.log(`[Document AI Bridge] Successfully analyzed ${filename}. Extracting tables...`);

            // 5. Mathematical Extraction: Convert Google's Layout Coordinates to CSV
            let csvContent = "";
            let tablesFound = 0;
            
            if (document.pages) {
                for (const page of document.pages) {
                    if (page.tables) {
                        for (const table of page.tables) {
                            tablesFound++;
                            
                            // A. Extract Header Rows
                            if (table.headerRows) {
                                for (const row of table.headerRows) {
                                    const rowData = row.cells.map(cell => {
                                        const text = extractText(cell.layout.textAnchor, document.text);
                                        return `"${text.replace(/"/g, '""').trim()}"`; // Escape CSV quotes
                                    });
                                    csvContent += rowData.join(',') + '\n';
                                }
                            }
                            
                            // B. Extract Body Rows
                            if (table.bodyRows) {
                                for (const row of table.bodyRows) {
                                    const rowData = row.cells.map(cell => {
                                        const text = extractText(cell.layout.textAnchor, document.text);
                                        return `"${text.replace(/"/g, '""').trim()}"`; // Escape CSV quotes
                                    });
                                    csvContent += rowData.join(',') + '\n';
                                }
                            }
                            // Add a blank line to separate distinct tables
                            csvContent += '\n'; 
                        }
                    }
                }
            }

            // 6. Graceful Fallback
            if (tablesFound === 0) {
                csvContent = "No tabular data was detected by the AI in this document.";
            }

            console.log(`[Document AI Bridge] Complete. Found ${tablesFound} tables.`);
            
            // 7. Return payload to the Frontend
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
// HELPER: Text Anchor Extractor
// Document AI returns text indexes (e.g., char 5 to 10), not the raw strings directly.
// This function splices the master string using those indexes.
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
    
    // Clean up invisible newlines inside table cells so they don't break the CSV structure
    return extracted.replace(/\n/g, ' '); 
}