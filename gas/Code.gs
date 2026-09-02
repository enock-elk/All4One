/**
 * All4One — Affidavit + Email Generator backend
 * Deploy: Extensions → Apps Script → paste → Deploy → Web app (execute as: Me, access: Anyone)
 */

const SHEET_ID = '1twLeKxFlNOjD5HmCqIqdTPg5qd_34twgOetm6AD5AYc';
const FIRMS_TAB = 'Firms'; // column A=id, B=firm, C=attorney, D=rules JSON
const FEEDBACK_TAB = 'Feedback';

const DRAFT_TO = 'namir@actuaryconsulting.co.za';
const DRAFT_CC = 'actuarialteam@actuaryconsulting.co.za';

function doGet() {
  return ContentService.createTextOutput(JSON.stringify(getFirms_()))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    const action = String(data.action || '').toUpperCase();

    if (action === 'CREATE_DRAFT') {
      return json_(createDraft_(data));
    }

    if (action === 'LOG_FEEDBACK') {
      return json_(logFeedback_(data));
    }

    if (action === 'SYNC_RULES' || data.firm) {
      return json_(syncFirmRules_(data));
    }

    return json_({ status: 'error', message: 'Unknown action. Use CREATE_DRAFT, LOG_FEEDBACK, or SYNC_RULES.' });
  } catch (err) {
    return json_({ status: 'error', message: String(err.message || err) });
  }
}

function createDraft_(data) {
  const subject = data.subject || '(DRAFT) Email';
  const htmlBody = data.htmlBody || '';
  const to = data.to || DRAFT_TO;
  const cc = data.cc || DRAFT_CC;

  if (!htmlBody) {
    throw new Error('htmlBody is required for CREATE_DRAFT');
  }

  GmailApp.createDraft(to, subject, '', { cc: cc, htmlBody: htmlBody });

  return {
    status: 'success',
    message: 'Draft created in your Gmail account. Open Gmail → Drafts to review and send.',
  };
}

function getFirms_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(FIRMS_TAB) || ss.getSheets()[0];
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => String(h).toLowerCase());
  const idCol = header.indexOf('id');
  const firmCol = header.indexOf('firm');
  const attorneyCol = header.indexOf('attorney');
  const rulesCol = header.indexOf('rules');

  return rows.slice(1).filter((r) => r[firmCol >= 0 ? firmCol : 1]).map((row, idx) => ({
    id: String(row[idCol >= 0 ? idCol : 0] || `firm-${idx + 1}`),
    firm: String(row[firmCol >= 0 ? firmCol : 1] || ''),
    attorney: String(row[attorneyCol >= 0 ? attorneyCol : 2] || ''),
    rules: parseRules_(row[rulesCol >= 0 ? rulesCol : 3]),
  }));
}

function syncFirmRules_(data) {
  const firmName = String(data.firm || '').trim();
  if (!firmName) throw new Error('firm is required for SYNC_RULES');

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(FIRMS_TAB) || ss.getSheets()[0];
  const rows = sheet.getDataRange().getValues();
  const header = rows[0].map((h) => String(h).toLowerCase());
  const firmCol = header.indexOf('firm') >= 0 ? header.indexOf('firm') : 1;
  const rulesCol = header.indexOf('rules') >= 0 ? header.indexOf('rules') : 3;

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][firmCol]).trim() === firmName) {
      sheet.getRange(i + 1, rulesCol + 1).setValue(JSON.stringify(data.rules || {}));
      return { status: 'success', message: `Rules synced for ${firmName}` };
    }
  }

  throw new Error('Firm not found in Google Sheet');
}

function logFeedback_(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(FEEDBACK_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(FEEDBACK_TAB);
    sheet.appendRow(['Timestamp', 'User', 'Case', 'Feedback']);
  }
  sheet.appendRow([
    new Date(),
    data.userName || 'Unknown',
    data.caseName || '',
    data.feedback || '',
  ]);
  return { status: 'success', message: 'Feedback logged' };
}

function parseRules_(val) {
  const defaults = { quals: 'Long', linkNo: false, cover: false, obo: false, preSign: false };
  if (!val) return defaults;
  try {
    return Object.assign(defaults, typeof val === 'string' ? JSON.parse(val) : val);
  } catch (_) {
    return defaults;
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
