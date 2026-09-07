/**
 * ==========================================
 * Affidavit Automation + All4One Backend
 * V5.0 - Guardian compatibility edition
 * ==========================================
 *
 * Backward compatibility:
 * - Existing affidavit projects keep using the active spreadsheet's
 *   "Attoneys & Preferences" tab.
 * - Existing LOG_FEEDBACK calls keep dual-writing to Feedback and
 *   Copy of Feedback in the legacy feedback workbook.
 * - All4One identifies itself with source: "ALL4ONE" and writes its
 *   affidavit history to the new All4One-Affidavits tab instead.
 * - All4One email usage writes to All4One-Email.
 *
 * Deploy by editing the existing web-app deployment and selecting
 * Version → New version so its /exec URL does not change.
 */

const SHEET_NAME = 'Attoneys & Preferences';

const CONFIG = {
  LEGACY_FEEDBACK_SHEET_ID: '1twLeKxFlNOjD5HmCqIqdTPg5qd_34twgOetm6AD5AYc',
  LEGACY_FEEDBACK_TAB_NAME: 'Feedback',
  LEGACY_LOCKED_FEEDBACK_TAB_NAME: 'Copy of Feedback',
  ALL4ONE_USAGE_SHEET_ID: '14PwX3IqOdiU-_iF_dNxYRkH-adHYIkdRXiCWgfhBK00',
  ALL4ONE_EMAIL_TAB_NAME: 'All4One-Email',
  ALL4ONE_AFFIDAVIT_TAB_NAME: 'All4One-Affidavits',
  DRAFT_TO: 'namir@actuaryconsulting.co.za',
  DRAFT_CC: 'actuarialteam@actuaryconsulting.co.za',
};

/**
 * Existing projects use this endpoint to load attorney preferences.
 */
function doGet() {
  try {
    return json_(getAttorneys_());
  } catch (error) {
    return json_({ error: String(error.message || error) });
  }
}

/**
 * Routes both legacy payloads and the newer All4One actions.
 */
function doPost(e) {
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || '{}');
    const action = String(payload.action || '').toUpperCase();

    if (action === 'CREATE_DRAFT') {
      return json_(createDraft_(payload));
    }

    if (action === 'LOG_EMAIL_USAGE') {
      return json_(logEmailUsage_(payload));
    }

    if (action === 'LOG_FEEDBACK') {
      return json_(logFeedback_(payload));
    }

    if (action === 'SYNC_RULES' || payload.firm) {
      return json_(syncFirmRules_(payload));
    }

    return json_({
      status: 'error',
      message: 'Unknown action. Use CREATE_DRAFT, LOG_EMAIL_USAGE, LOG_FEEDBACK, or SYNC_RULES.',
    });
  } catch (error) {
    return json_({ status: 'error', message: String(error.message || error) });
  }
}

// Kept for compatibility with callers that issue an OPTIONS request.
function doOptions() {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

function createDraft_(data) {
  const subject = data.subject || '(DRAFT) Email';
  const htmlBody = data.htmlBody || '';
  const to = data.to || CONFIG.DRAFT_TO;
  const cc = data.cc || CONFIG.DRAFT_CC;

  if (!htmlBody) {
    throw new Error('htmlBody is required for CREATE_DRAFT');
  }

  GmailApp.createDraft(to, subject, '', { cc: cc, htmlBody: htmlBody });

  return {
    status: 'success',
    message: 'Draft created in your Gmail account. Open Gmail → Drafts to review and send.',
  };
}

function getAttorneys_() {
  const sheet = getPreferencesSheet_();
  const rows = sheet.getDataRange().getValues();
  const attorneys = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const firmName = row[0];
    if (!firmName) continue;

    attorneys.push({
      id: String(firmName).toLowerCase().replace(/[^a-z0-9]/g, '_'),
      firm: firmName,
      attorney: row[1] || '',
      rules: {
        quals: row[2] || 'Short',
        linkNo: isEnabled_(row[3], ['YES']),
        cover: isEnabled_(row[4], ['YES']),
        obo: isEnabled_(row[5], ['ALLOW', 'YES']),
        preSign: isEnabled_(row[6], ['YES']),
      },
    });
  }

  return attorneys;
}

function syncFirmRules_(data) {
  const firmName = String(data.firm || '').trim();
  if (!firmName) throw new Error('firm is required for SYNC_RULES');

  const sheet = getPreferencesSheet_();
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === firmName) {
      const rowIndex = i + 1;
      const rules = data.rules || {};
      sheet.getRange(rowIndex, 3).setValue(rules.quals || 'Short');
      sheet.getRange(rowIndex, 4).setValue(rules.linkNo ? 'Yes' : 'No');
      sheet.getRange(rowIndex, 5).setValue(rules.cover ? 'Yes' : 'No');
      sheet.getRange(rowIndex, 6).setValue(rules.obo ? 'Allow' : 'Block');

      // Column G is optional. Existing six-column sheets remain unchanged.
      if (sheet.getLastColumn() >= 7 || Object.prototype.hasOwnProperty.call(rules, 'preSign')) {
        sheet.getRange(rowIndex, 7).setValue(rules.preSign ? 'Yes' : 'No');
      }

      return { status: 'success', rowUpdated: rowIndex };
    }
  }

  throw new Error('Firm not found in Google Sheet');
}

function getPreferencesSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('This script must remain bound to the attorney preferences spreadsheet.');
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" was not found.`);
  return sheet;
}

function isEnabled_(value, acceptedWords) {
  if (value === true) return true;
  return acceptedWords.indexOf(String(value || '').trim().toUpperCase()) !== -1;
}

/**
 * Legacy callers have no source field and retain the original dual-write.
 * All4One sends source: "ALL4ONE" and writes only to its migrated log.
 */
function logFeedback_(payload) {
  if (String(payload.source || '').toUpperCase() === 'ALL4ONE') {
    return logAll4OneAffidavit_(payload);
  }
  return logLegacyFeedback_(payload);
}

function logLegacyFeedback_(payload) {
  const ss = SpreadsheetApp.openById(CONFIG.LEGACY_FEEDBACK_SHEET_ID);
  const publicSheet = ss.getSheetByName(CONFIG.LEGACY_FEEDBACK_TAB_NAME);
  const lockedSheet = ss.getSheetByName(CONFIG.LEGACY_LOCKED_FEEDBACK_TAB_NAME);

  if (!publicSheet && !lockedSheet) {
    throw new Error('Feedback tabs not found. Please ensure tabs exist in the linked Sheet.');
  }

  const stamp = usageStamp_(Session.getScriptTimeZone());
  const row = [
    payload.userName || 'Unknown User',
    stamp.date,
    stamp.time,
    payload.caseName || 'Unknown',
    payload.feedback || '',
    '',
  ];

  withDocumentLock_(function () {
    if (publicSheet) publicSheet.appendRow(row);
    if (lockedSheet) lockedSheet.appendRow(row);
  });

  return { status: 'SUCCESS', message: 'Feedback safely stored in vault.' };
}

function logAll4OneAffidavit_(payload) {
  const ss = SpreadsheetApp.openById(CONFIG.ALL4ONE_USAGE_SHEET_ID);
  const sheet = getOrCreateSheet_(
    ss,
    CONFIG.ALL4ONE_AFFIDAVIT_TAB_NAME,
    ['Affidavit Author', 'Date', 'Time', 'Case Name', 'Before Feedback']
  );
  const stamp = usageStamp_(ss.getSpreadsheetTimeZone());
  const row = [
    payload.userName || 'Unknown User',
    stamp.date,
    stamp.time,
    payload.caseName || 'Unknown',
    payload.feedback || '',
  ];

  withDocumentLock_(function () {
    sheet.appendRow(row);
  });

  return { status: 'SUCCESS', message: 'All4One affidavit usage logged.' };
}

function logEmailUsage_(data) {
  const ss = SpreadsheetApp.openById(CONFIG.ALL4ONE_USAGE_SHEET_ID);
  const sheet = getOrCreateSheet_(
    ss,
    CONFIG.ALL4ONE_EMAIL_TAB_NAME,
    [
      'Email Author',
      'Date',
      'Time',
      'Template',
      'Claimant',
      'Subject',
      'Action',
      'Status',
      'Delivery Channel',
      'App Version',
    ]
  );
  const stamp = usageStamp_(ss.getSpreadsheetTimeZone());
  const row = [
    data.userName || 'Unknown',
    stamp.date,
    stamp.time,
    data.templateName || data.templateId || '',
    data.claimant || '',
    data.subject || '',
    data.usageAction || '',
    data.status || '',
    data.deliveryChannel || '',
    data.appVersion || '',
  ];

  withDocumentLock_(function () {
    sheet.appendRow(row);
  });

  return { status: 'success', message: 'Email usage logged' };
}

function getOrCreateSheet_(ss, tabName, headers) {
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) sheet = ss.insertSheet(tabName);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function usageStamp_(timezone) {
  const now = new Date();
  const zone = timezone || Session.getScriptTimeZone();
  return {
    date: Utilities.formatDate(now, zone, 'yyyy-MM-dd'),
    time: Utilities.formatDate(now, zone, 'HH:mm:ss'),
  };
}

function withDocumentLock_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    callback();
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
