import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { 
  Mail, 
  Send, 
  Copy, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Plus,
  Minus,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import { AC_LOGO_DATA_URI } from './ac-logo-b64.js';
import { getWorkspaceName } from '../workspace-identity.js';
import {
  createGmailDraft,
  isGmailConnected,
  requestGmailAccessToken,
  restoreGmailSession,
  clearGmailToken,
  hasPriorGmailGrant,
  describeGmailConnectError,
  markEmailSessionVisited,
  shouldOfferGmailConnect,
} from '../gmail-draft.js';
import { showAppToast } from '../ui-prefs.js';
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbw-M9kVkSSXKuJ49tohaconx99-l5VcbU1xSNeUTccX2gs0prok3LltyTyO7mdNKtm8/exec";

const INPUT_CLASS = "w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:border-amber-500 dark:text-white transition-all";
const INPUT_BLOCKING_CLASS = "w-full p-3 rounded-xl border border-rose-300/80 dark:border-rose-400/50 bg-rose-50/50 dark:bg-rose-950/20 text-sm outline-none focus:border-rose-400 dark:text-white transition-all";
const CHROME_CLASS = "flex items-stretch rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden focus-within:border-amber-500 transition-all";
const CHROME_BLOCKING_CLASS = "flex items-stretch rounded-xl border border-rose-300/80 dark:border-rose-400/50 bg-rose-50/50 dark:bg-rose-950/20 overflow-hidden focus-within:border-rose-400 transition-all";
const CHROME_INNER = "border-0 bg-transparent text-sm outline-none dark:text-white";

// Brand colours from official Actuary Consulting signature
const SIG = {
  tan: '#B3936E',
  nameShadow: '#E9BF81',
  logoTan: '#B6946A',
  logoGrey: '#8D8D8D',
  label: '#7F7F7F',
  text: '#7F7F7F',
  link: '#1155cc',
  disclaimer: '#D0CECE',
  disclaimerShadow: '#EEDDD1',
};

// Logo native 930×268 — width tracks address line via table layout below

// Signature HTML with embedded transparent logo image
const getSignatureHtml = () => `
<br>
<br>
<div style="font-family: Verdana, Geneva, sans-serif; line-height: 1.35; color: ${SIG.tan};">
  <p style="margin: 0; font-size: 10pt; font-weight: bold; color: ${SIG.tan}; text-shadow: 0.25px 0.25px 0 ${SIG.nameShadow};">Namir Waisberg</p>
  <p style="margin: 0; font-size: 10pt; font-weight: normal; color: ${SIG.tan};">Managing Director</p>
  <p style="margin: 0; font-size: 9pt; font-weight: normal; color: ${SIG.tan};">BEconSc (Cum Laude) BSc Hons (Cum Laude) (Wits) Actuary CFA</p>
</div>
<div style="font-family: Verdana, Geneva, sans-serif; font-size: 9pt; line-height: 1.55; margin-top: 10px;">
  <p style="margin: 0; color: ${SIG.text};">
    <strong style="color: ${SIG.label};">T</strong>&nbsp;011 463 0313&nbsp;&nbsp;&nbsp;
    <strong style="color: ${SIG.label};">M</strong>&nbsp;082 374 5552
  </p>
  <p style="margin: 0; color: ${SIG.text};">
    <strong style="color: ${SIG.label};">E</strong>&nbsp;<a href="mailto:namir@actuaryconsulting.co.za" style="color: ${SIG.link}; text-decoration: underline;">namir@actuaryconsulting.co.za</a>&nbsp;
    <strong style="color: ${SIG.label};">W</strong>&nbsp;<a href="https://actuaryconsulting.co.za" target="_blank" rel="noopener noreferrer" style="color: ${SIG.link}; text-decoration: underline;">actuaryconsulting.co.za</a>
  </p>
</div>
<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-top: 2px;">
  <tr>
    <td style="font-family: Verdana, Geneva, sans-serif; font-size: 9pt; line-height: 1.55; color: ${SIG.text}; white-space: nowrap;">
      <strong style="color: ${SIG.label};">A</strong>&nbsp;Corner 5<sup style="font-size: 0.75em; vertical-align: super;">th</sup> &amp; Maude Street, Sandown, Sandton, 2031
    </td>
  </tr>
  <tr>
    <td style="padding-top: 10px; line-height: 0; font-size: 0;">
      <img src="${AC_LOGO_DATA_URI}" alt="Actuary Consulting" width="302" style="display: block; width: 302px; max-width: 100%; height: auto; border: 0;" />
    </td>
  </tr>
</table>
<p style="margin: 0; font-family: Verdana, Geneva, sans-serif; font-size: 7.5pt; color: ${SIG.disclaimer}; text-shadow: 0.25px 0.25px 0 ${SIG.disclaimerShadow}; text-align: justify; line-height: 1.65;">
  The information contained in this email is confidential and may be subject to legal privilege. The content of this email, which may include one or more attachments, is strictly confidential, and is intended solely for the use of the named recipient/s. If you are not the intended recipient, you cannot use, copy, distribute, disclose or retain the email or any part of its contents or take any action in reliance on it. If you have received this email in error, please email the sender by replying to this message and to permanently delete it and all attachments from your computer. All reasonable precautions have been taken to ensure that no viruses are present in this email and the company cannot accept responsibility for any loss or damage arising from the use of this email or attachments.
</p>
`;

const KUBHEKA_APN_HTML = 'In accordance with the precedent set by the court in <em>Kubheka v RAF</em> (5 November 2025) and the Advisory Practice Note issued by the Actuarial Society of South Africa (APN 702), we are required to obtain all available supporting documentation related to earnings referenced in the Industrial Psychologist report. Compliance with these requirements is important to ensure adherence to professional standards.';
const TURNAROUND = 'We will provide the report within 24 hours once the abovementioned information is provided and no further information is required.';
const SIGN_OFF = 'Kind regards<br/>Namir';
const GENDER_OPTIONS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
];

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function filled(value, placeholder) {
  const trimmed = String(value ?? '').trim();
  return trimmed || placeholder;
}

function htmlField(vars, key, placeholder) {
  return escapeHtml(filled(vars[key], placeholder));
}

function formatClaimantShortName(fullName, gender) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const title = gender === 'Female' ? 'Ms' : gender === 'Male' ? 'Mr' : '';
  let core;
  if (parts.length === 1) {
    core = parts[0];
  } else {
    const surname = parts[parts.length - 1];
    const initials = parts.slice(0, -1).map((part) => part.charAt(0).toUpperCase()).join('');
    core = `${initials} ${surname}`;
  }
  return title ? `${title} ${core}` : core;
}

function possessivePronoun(gender) {
  if (gender === 'Female') return 'her';
  if (gender === 'Male') return 'his';
  return '[his/her]';
}

function claimantShortLabel(vars) {
  return formatClaimantShortName(vars.claimantFullName, vars.gender) || '[Claimant]';
}

function claimantFullLabel(vars) {
  return filled(vars.claimantFullName, '[Claimant]');
}

function draftSubject(draftName, claimantLabel) {
  return `${draftName} \u2014 ${claimantLabel}`;
}

function gmailBulletList(items) {
  const rows = (Array.isArray(items) ? items : []).filter((item) => String(item || '').trim()).map((item) => (
    `<li dir="ltr" style="margin-left:15px"><div>${item}</div></li>`
  )).join('');
  if (!rows) return '';
  return `<ul style="margin-top:0;margin-bottom:0">${rows}</ul>`;
}

function htmlList(items, emptyPlaceholder) {
  const cleaned = (Array.isArray(items) ? items : []).map((item) => String(item || '').trim()).filter(Boolean);
  const source = cleaned.length ? cleaned : [emptyPlaceholder];
  return gmailBulletList(source.map((item) => escapeHtml(item)));
}

function inTheLine(value, source, valuePlaceholder, sourcePlaceholder) {
  return `${filled(value, valuePlaceholder)} in the ${filled(source, sourcePlaceholder)}.`;
}

function thankYouLoe(claimantHtml) {
  return `Thank you for requesting a Loss of Earnings calculation for <strong>${claimantHtml}</strong>.`;
}

function orIdDocumentLine(gender) {
  return `or alternatively, kindly provide a copy of ${possessivePronoun(gender)} ID document.`;
}

function orIdDocumentPronoun(pronoun) {
  return `or alternatively, kindly provide a copy of ${pronoun} ID document.`;
}

function withPeriod(text) {
  const value = String(text || '').trim();
  if (!value) return value;
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function htmlRichList(items) {
  return gmailBulletList((Array.isArray(items) ? items : []).filter(Boolean));
}

function sameDocument(left, right) {
  const a = String(left || '').trim().toLowerCase();
  const b = String(right || '').trim().toLowerCase();
  return Boolean(a && b && a === b);
}

function boldReportLine(value, source, valuePlaceholder, sourcePlaceholder, page) {
  const pageText = String(page || '').trim();
  const pageHtml = pageText ? ` (Page ${escapeHtml(pageText)})` : '';
  return `<strong>${escapeHtml(filled(value, valuePlaceholder))}</strong> in the ${escapeHtml(filled(source, sourcePlaceholder))}${pageHtml}.`;
}

const SURNAME_PARTICLES = new Set([
  'van', 'von', 'de', 'del', 'der', 'den', 'da', 'di', 'la', 'le', 'du', 'dos', 'das',
  'ter', 'ten', 'op', 'af', 'zu', 'zur', 'bin', 'al', 'el', 'st', 'sint',
]);

function tokenLooksLikeInitials(token) {
  const clean = String(token || '').replace(/\./g, '').trim();
  return /^[A-Za-z]{1,4}$/.test(clean) && clean === clean.toUpperCase();
}

/** "Tanaka Christopher Mokgoro" → "TC Mokgoro"; "Tanaka van Niekerk" → "T van Niekerk"; "TC Mokgoro" stays. */
function formatClaimantDisplayName(rawName) {
  const parts = String(rawName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts.join(' ');
  if (tokenLooksLikeInitials(parts[0])) return parts.join(' ');

  const given = [];
  let index = 0;
  while (index < parts.length - 1) {
    const next = parts[index + 1].toLowerCase().replace(/\./g, '');
    if (SURNAME_PARTICLES.has(next)) {
      given.push(parts[index]);
      index += 1;
      break;
    }
    if (index === parts.length - 2) {
      given.push(parts[index]);
      index += 1;
      break;
    }
    given.push(parts[index]);
    index += 1;
  }
  const surname = parts.slice(index).join(' ');
  if (!given.length || !surname) return parts.join(' ');
  const initials = given.map((part) => part.charAt(0).toUpperCase()).join('');
  return `${initials} ${surname}`;
}

function masterClaimantHtml(vars) {
  const title = filled(vars.claimantTitle, 'Mr/Ms');
  const name = formatClaimantDisplayName(filled(vars.claimantName, '[Claimant]'));
  return `<strong>${escapeHtml(title)} ${escapeHtml(name)}</strong>`;
}

function masterClaimantLabel(vars) {
  return `${filled(vars.claimantTitle, 'Mr/Ms')} ${formatClaimantDisplayName(filled(vars.claimantName, '[Claimant]'))}`;
}

function masterPronoun(vars) {
  const chosen = String(vars.idPronoun || '').trim();
  if (chosen) return chosen;
  const title = String(vars.claimantTitle || '').trim().toLowerCase();
  if (title === 'ms' || title === 'mrs' || title === 'miss') return 'her';
  if (title === 'mr') return 'his';
  return 'his/her';
}

function kubhekaParagraph(hasPriorRequest) {
  if (!hasPriorRequest) return KUBHEKA_APN_HTML;
  return `Also, ${KUBHEKA_APN_HTML.charAt(0).toLowerCase()}${KUBHEKA_APN_HTML.slice(1)}`;
}

function requestLead(hasPriorRequest) {
  return hasPriorRequest ? 'Also, kindly' : 'Kindly';
}

const REPORT_SOURCES = [
  'OT report',
  'IP report',
  'Instruction Email',
  'Instruction Letter',
  'RAF Report',
  'Ortho Report',
  'Hospital records',
  'Medico-legal report',
];

const LOS_SOURCES = [
  ...REPORT_SOURCES,
  'Post-mortem report',
  'Inquest report',
  'Proof of dependency',
  'Letter of authority',
  'SAPS accident report',
];

function reportSourceField(key, label, defaultValue, extra = {}) {
  return {
    key,
    label,
    type: 'source',
    default: defaultValue,
    options: REPORT_SOURCES,
    ...extra,
  };
}

const INFORMAL_REQUEST_DEFAULT = 'Please also provide the post-accident proof of earnings showing she earned [amount] per month as a self-employed informal trader from [period] to date:';

const INFORMAL_EARNINGS_PROOF = [
  'Previous clients.',
  'Previous suppliers.',
  'Previous employees.',
  'Previous co-workers.',
  'Competitors.',
  'Other independent persons with direct knowledge of the claimant\u2019s business activities.',
];

const FORMAL_EARNINGS_PROOF = [
  'Payslips',
  'Tax returns',
  'Annual Financial statements',
  'Bank statements',
  'An employer certificate',
  'An affidavit from the employer confirming the claimant\'s earnings.',
];

function fieldIsVisible(field, variables) {
  if (field.loeOnly && variables?.audience === 'incident') return false;
  if (field.showWhen && variables?.[field.showWhen.key] !== field.showWhen.equals) return false;
  if (field.sameSource) {
    const [left, right] = field.sameSource;
    if (!sameDocument(variables?.[left], variables?.[right])) return false;
  }
  return true;
}

function subjectHasContent(value) {
  return Boolean(String(value || '').replace(/^\(DRAFT\)\s*/i, '').trim());
}

function fieldHasValue(field, variables) {
  const value = variables?.[field.key];
  if (field.type === 'lines') {
    return (Array.isArray(value) ? value : []).some((line) => String(line || '').trim());
  }
  if (field.type === 'toggle') return true;
  return Boolean(String(value ?? '').trim());
}

/** Required before Push to Gmail. Copy HTML can skip Subject. */
function collectGmailPushErrors(template, variables, { requireSubject = true } = {}) {
  const fields = template?.fields || [];
  if (!fields.length) return { keys: [], labels: [] };

  const keys = new Set();
  const labels = [];
  const mark = (key, label) => {
    if (key) keys.add(key);
    if (label && !labels.includes(label)) labels.push(label);
  };
  const byKey = Object.fromEntries(fields.map((field) => [field.key, field]));

  if (requireSubject && byKey.subject && !subjectHasContent(variables.subject)) {
    mark('subject', 'Subject');
  }
  if (byKey.recipientName && !String(variables.recipientName || '').trim()) {
    mark('recipientName', 'Recipient name');
  }
  if (byKey.claimantTitle) {
    const title = String(variables.claimantTitle || '').trim();
    if (!title || title === 'Mr/Ms') {
      mark('claimantTitle', 'Claimant title');
      mark('claimantName', 'Claimant');
    }
  }
  if (byKey.claimantName && !String(variables.claimantName || '').trim()) {
    mark('claimantName', 'Claimant name');
    mark('claimantTitle', 'Claimant');
  }

  fields
    .filter((field) => field.type === 'toggle' && variables?.[field.key] && fieldIsVisible(field, variables))
    .forEach((toggle) => {
      let toggleHasGap = false;
      fields
        .filter((field) => field.showWhen?.key === toggle.key && field.showWhen?.equals === true)
        .forEach((field) => {
          if (!fieldIsVisible(field, variables)) return;
          if (field.type === 'toggle') return;
          if (field.key === 'idPronoun') return;
          if (!fieldHasValue(field, variables)) {
            mark(field.key, `${toggle.label}: ${field.label}`);
            toggleHasGap = true;
          }
        });
      if (toggleHasGap) mark(toggle.key, toggle.label);
    });

  return { keys: [...keys], labels };
}

function htmlListWithIdFollowup(items, emptyPlaceholder, gender) {
  return `${htmlList(items, emptyPlaceholder)}${orIdDocumentLine(gender)}`;
}

function wrapCompiledEmail(subject, bodyHtml) {
  return {
    subject,
    htmlBody: `<div style="font-family: Verdana, Geneva, sans-serif; font-size: 13px; color: #000; line-height: 1.35;">${bodyHtml}${getSignatureHtml()}</div>`,
  };
}

function extractPlaceholderKeys(text) {
  const keys = [];
  const regex = /<<([^>]+)>>/g;
  let match;
  while ((match = regex.exec(text || '')) !== null) {
    if (!keys.includes(match[1])) keys.push(match[1]);
  }
  return keys;
}

function initialVariables(template) {
  if (template.fields) {
    const vars = {};
    template.fields.forEach((field) => {
      if (field.type === 'lines') vars[field.key] = Array.isArray(field.default) && field.default.length ? [...field.default] : [''];
      else if (field.type === 'toggle') vars[field.key] = Boolean(field.default);
      else vars[field.key] = field.default ?? '';
    });
    return vars;
  }
  const keys = [...extractPlaceholderKeys(template.subject), ...extractPlaceholderKeys(template.body)];
  const vars = {};
  keys.forEach((key) => {
    vars[key] = '';
  });
  return vars;
}

function compilePlaceholderTemplate(template, variables) {
  let compSubject = template.subject;
  let compBody = template.body;

  Object.keys(variables).forEach((key) => {
    const val = variables[key] || `[${key}]`;
    const replaceRegex = new RegExp(`<<${key}>>`, 'g');
    compSubject = compSubject.replace(replaceRegex, val);
    compBody = compBody.replace(replaceRegex, val);
  });

  return wrapCompiledEmail(compSubject, compBody.replace(/\n/g, '<br/>'));
}

const ATTORNEY_FIELD = { key: 'attorneyFirstName', label: 'Attorney first name', type: 'text', placeholder: 'e.g. Ntembeko' };
const CLAIMANT_FIELD = { key: 'claimantFullName', label: 'Claimant full name', type: 'text', placeholder: 'e.g. Arnold Moses Monashane' };
const GENDER_FIELD = { key: 'gender', label: 'Gender', type: 'select', options: GENDER_OPTIONS };
const EARNINGS_DOCUMENT_PRESETS = [
  { label: 'Payslips', value: 'Payslips dated: ' },
  { label: 'Bank statements', value: 'Bank statements for the period: ' },
  { label: 'Affidavit', value: 'Affidavit confirming earnings' },
];

const TEMPLATES = [
  {
    id: 'draft-master-loe',
    name: '(DRAFT) Master LOE',
    menuLabel: 'Master LOE Draft',
    intro: 'Tick only the blocks this email needs. Notes under each block stay in the form and are left out of the draft. A block that starts with “Also” uses that word only when another request is already above it; otherwise it starts with “Kindly” or “In accordance”. The 24-hour close is always included. The Kubheka paragraph is written once, on the first earnings block.',
    fields: [
      {
        key: 'subject',
        label: 'Subject',
        type: 'text',
        default: '(DRAFT) ',
        placeholder: '(DRAFT) paste the rest of the subject…',
        guidance: '(DRAFT) is filled for you. Paste the rest of the subject after it. Required for Push to Gmail; Copy HTML does not need it.',
      },
      { key: 'recipientName', label: 'Recipient name', type: 'text', placeholder: 'e.g. Ntembeko' },
      {
        key: 'audience',
        label: 'Opening',
        type: 'select',
        default: 'attorneys',
        accordion: true,
        guidance: 'Loss of Earnings and Wrongful Arrest are separate openings. Only one is used in the draft.',
        options: [
          { value: 'attorneys', label: 'Loss of Earnings — instructing attorneys' },
          { value: 'ip', label: 'Loss of Earnings — IP or others' },
          { value: 'incident', label: 'Wrongful Arrest — date of incident not provided' },
        ],
      },
      {
        key: 'claimantTitle',
        label: 'Title',
        type: 'select',
        default: 'Mr/Ms',
        row: 'claimant',
        edge: true,
        options: [
          { value: 'Mr/Ms', label: 'Mr/Ms' },
          { value: 'Mr', label: 'Mr' },
          { value: 'Ms', label: 'Ms' },
          { value: 'Mrs', label: 'Mrs' },
        ],
      },
      {
        key: 'claimantName',
        label: 'Claimant',
        type: 'text',
        placeholder: 'e.g. Tanaka Christopher Mokgoro',
        row: 'claimant',
      },
      {
        key: 'attorneyFirm',
        label: 'On behalf of',
        type: 'text',
        placeholder: 'e.g. Yonela Bodlani Attorneys',
        showWhen: { key: 'audience', equals: 'ip' },
        guidance: 'Written into the IP or others greeting only.',
      },
      {
        key: 'secNoIp',
        label: 'No IP report',
        type: 'toggle',
        guidance: 'Use if no Industrial Psychologist report was provided.',
        loeOnly: true,
      },
      {
        key: 'secAccident',
        label: 'Confirm the date of accident',
        type: 'toggle',
        guidance: 'Use to confirm the date of accident.',
        loeOnly: true,
      },
      {
        key: 'accidentOt',
        label: 'Accident date A',
        type: 'text',
        placeholder: 'e.g. 14 July 2020',
        row: 'accident-a',
        showWhen: { key: 'secAccident', equals: true },
        nested: true,
        loeOnly: true,
      },
      reportSourceField('accidentOtSource', 'Source A', 'OT report', {
        row: 'accident-a',
        showWhen: { key: 'secAccident', equals: true },
        nested: true,
        loeOnly: true,
        pageKey: 'accidentOtPage',
      }),
      {
        key: 'accidentIp',
        label: 'Accident date B',
        type: 'text',
        placeholder: 'e.g. 13 July 2020',
        row: 'accident-b',
        showWhen: { key: 'secAccident', equals: true },
        nested: true,
        loeOnly: true,
      },
      reportSourceField('accidentIpSource', 'Source B', 'IP report', {
        row: 'accident-b',
        showWhen: { key: 'secAccident', equals: true },
        nested: true,
        loeOnly: true,
        pageKey: 'accidentIpPage',
      }),
      {
        key: 'accidentOtPage',
        label: 'Page A',
        type: 'text',
        placeholder: 'e.g. 6',
        showWhen: { key: 'secAccident', equals: true },
        sameSource: ['accidentOtSource', 'accidentIpSource'],
        nested: true,
        embedded: true,
        loeOnly: true,
      },
      {
        key: 'accidentIpPage',
        label: 'Page B',
        type: 'text',
        placeholder: 'e.g. 8',
        showWhen: { key: 'secAccident', equals: true },
        sameSource: ['accidentOtSource', 'accidentIpSource'],
        nested: true,
        embedded: true,
        loeOnly: true,
      },
      {
        key: 'secDob',
        label: 'Confirm date of birth',
        type: 'toggle',
        guidance: 'Use to confirm a discrepancy in the claimant’s date of birth.',
        loeOnly: true,
      },
      {
        key: 'dobOt',
        label: 'Date of birth A',
        type: 'text',
        placeholder: 'e.g. 4 March 1988',
        row: 'dob-a',
        showWhen: { key: 'secDob', equals: true },
        nested: true,
        loeOnly: true,
      },
      reportSourceField('dobOtSource', 'Source A', 'OT report', {
        row: 'dob-a',
        showWhen: { key: 'secDob', equals: true },
        nested: true,
        loeOnly: true,
        pageKey: 'dobOtPage',
      }),
      {
        key: 'dobIp',
        label: 'Date of birth B',
        type: 'text',
        placeholder: 'e.g. 4 March 1989',
        row: 'dob-b',
        showWhen: { key: 'secDob', equals: true },
        nested: true,
        loeOnly: true,
      },
      reportSourceField('dobIpSource', 'Source B', 'IP report', {
        row: 'dob-b',
        showWhen: { key: 'secDob', equals: true },
        nested: true,
        loeOnly: true,
        pageKey: 'dobIpPage',
      }),
      {
        key: 'dobOtPage',
        label: 'Page A',
        type: 'text',
        placeholder: 'e.g. 6',
        showWhen: { key: 'secDob', equals: true },
        sameSource: ['dobOtSource', 'dobIpSource'],
        nested: true,
        embedded: true,
        loeOnly: true,
      },
      {
        key: 'dobIpPage',
        label: 'Page B',
        type: 'text',
        placeholder: 'e.g. 8',
        showWhen: { key: 'secDob', equals: true },
        sameSource: ['dobOtSource', 'dobIpSource'],
        nested: true,
        embedded: true,
        loeOnly: true,
      },
      {
        key: 'secName',
        label: 'Confirm name or surname spelling',
        type: 'toggle',
        guidance: 'Use to confirm the spelling of the claimant’s name or surname. Starts with “Also, kindly” only when another request is above it.',
        loeOnly: true,
      },
      {
        key: 'nameOt',
        label: 'Spelling A',
        type: 'text',
        placeholder: 'e.g. Nkosi',
        row: 'name-a',
        showWhen: { key: 'secName', equals: true },
        nested: true,
        loeOnly: true,
      },
      reportSourceField('nameOtSource', 'Source A', 'OT report', {
        row: 'name-a',
        showWhen: { key: 'secName', equals: true },
        nested: true,
        loeOnly: true,
      }),
      {
        key: 'nameIp',
        label: 'Spelling B',
        type: 'text',
        placeholder: 'e.g. Nkosi',
        row: 'name-b',
        showWhen: { key: 'secName', equals: true },
        nested: true,
        loeOnly: true,
      },
      reportSourceField('nameIpSource', 'Source B', 'IP report', {
        row: 'name-b',
        showWhen: { key: 'secName', equals: true },
        nested: true,
        loeOnly: true,
      }),
      {
        key: 'idPronoun',
        label: 'ID document pronoun',
        type: 'select',
        showWhen: { key: 'secName', equals: true },
        nested: true,
        loeOnly: true,
        guidance: 'Used in “or alternatively, kindly provide a copy of his/her ID document”. Leave on “Match the title” to follow Mr or Ms.',
        options: [
          { value: '', label: 'Match the title' },
          { value: 'his', label: 'his' },
          { value: 'her', label: 'her' },
        ],
      },
      {
        key: 'secPayslips',
        label: 'Clearer payslips or bank statements',
        type: 'toggle',
        guidance: 'Use when the payslips or bank statements provided are illegible.',
        loeOnly: true,
      },
      {
        key: 'clearerDocs',
        label: 'Which documents',
        type: 'select',
        default: 'payslips',
        showWhen: { key: 'secPayslips', equals: true },
        nested: true,
        loeOnly: true,
        options: [
          { value: 'payslips', label: 'Payslips' },
          { value: 'bank statements', label: 'Bank statements' },
          { value: 'payslips and bank statements', label: 'Payslips and bank statements' },
        ],
      },
      {
        key: 'secFormal',
        label: 'Formal earnings proof',
        type: 'toggle',
        guidance: 'Use to obtain proof of earnings for formal employment. The Kubheka paragraph is included here when this is the first earnings block.',
        loeOnly: true,
      },
      {
        key: 'secFormalDocs',
        label: 'Documents referenced in the IP report',
        type: 'toggle',
        guidance: 'Optional. Leave this off to leave that document list out of the draft.',
        showWhen: { key: 'secFormal', equals: true },
        nested: true,
        loeOnly: true,
      },
      {
        key: 'formalDocs',
        label: 'Documents',
        type: 'lines',
        placeholder: 'Type a document from the IP report…',
        presets: EARNINGS_DOCUMENT_PRESETS,
        showWhen: { key: 'secFormalDocs', equals: true },
        nested: true,
        loeOnly: true,
      },
      {
        key: 'formalEarnings',
        label: 'Formal earnings and period',
        type: 'text',
        placeholder: 'e.g. R3 000 per month while working as a Domestic worker for Ms Zungu until the date of the accident',
        showWhen: { key: 'secFormal', equals: true },
        nested: true,
        loeOnly: true,
      },
      {
        key: 'secInformal',
        label: 'Informal earnings proof',
        type: 'toggle',
        guidance: 'Use to ask for proof of earnings for informal or self-employed work. The Kubheka paragraph is not repeated when the formal block above already includes it.',
        loeOnly: true,
      },
      {
        key: 'secInformalDocs',
        label: 'Documents referenced in the IP report',
        type: 'toggle',
        guidance: 'Optional. Leave this off to leave that document list out of the draft.',
        showWhen: { key: 'secInformal', equals: true },
        nested: true,
        loeOnly: true,
      },
      {
        key: 'informalDocs',
        label: 'Documents',
        type: 'lines',
        placeholder: 'Type a document from the IP report…',
        presets: EARNINGS_DOCUMENT_PRESETS,
        showWhen: { key: 'secInformalDocs', equals: true },
        nested: true,
        loeOnly: true,
      },
      {
        key: 'informalRequest',
        label: 'Informal earnings request',
        type: 'textarea',
        default: INFORMAL_REQUEST_DEFAULT,
        placeholder: INFORMAL_REQUEST_DEFAULT,
        guidance: 'This sentence is written into the draft as you type it.',
        showWhen: { key: 'secInformal', equals: true },
        nested: true,
        loeOnly: true,
      },
      {
        key: 'calculationType',
        label: 'Calculation type',
        type: 'text',
        placeholder: 'Wrongful Arrest',
        showWhen: { key: 'audience', equals: 'incident' },
        guidance: 'Used in the Wrongful Arrest thank-you. Leave blank for Wrongful Arrest.',
      },
    ],
    compile(vars) {
      const recipient = escapeHtml(filled(vars.recipientName, 'XXXXX'));
      const claimant = masterClaimantHtml(vars);
      const wrongfulArrest = vars.audience === 'incident';
      const parts = [`Dear ${recipient}`];

      if (wrongfulArrest) {
        const calculation = escapeHtml(filled(vars.calculationType, 'Wrongful Arrest'));
        parts.push(`Thank you for requesting a ${calculation} calculation for ${claimant}.`);
        parts.push('The date of incident was not provided. Kindly assist by providing the date of incident.');
        parts.push('Kindly note that the calculation is dependent on the information we have requested since it will directly increase the claim.');
      } else if (vars.audience === 'ip') {
        const firm = escapeHtml(filled(vars.attorneyFirm, 'XXXXX Attorneys'));
        parts.push(`Kindly note that we are undertaking Loss of Earnings Calculations for ${claimant} on behalf of <strong>${firm}</strong>.`);
      } else {
        parts.push(`Thank you for requesting a Loss of Earnings calculation for ${claimant}.`);
      }

      let hasPriorRequest = false;
      const pushRequest = (html) => {
        parts.push(html);
        hasPriorRequest = true;
      };

      if (!wrongfulArrest && vars.secNoIp) {
        pushRequest([
          `${requestLead(hasPriorRequest)} note that we require an Industrial Psychologist report in order to perform Loss of Earnings calculations.`,
          'Kindly assist by providing an Industrial Psychologist report.',
        ].join('<br/><br/>'));
      }

      if (!wrongfulArrest && vars.secAccident) {
        const sameAccidentSource = sameDocument(vars.accidentOtSource, vars.accidentIpSource);
        pushRequest(`${requestLead(hasPriorRequest)} assist us by confirming the correct date of accident.${htmlRichList([
          boldReportLine(vars.accidentOt, vars.accidentOtSource, '[date]', 'OT report', sameAccidentSource ? vars.accidentOtPage : ''),
          boldReportLine(vars.accidentIp, vars.accidentIpSource, '[date]', 'IP report', sameAccidentSource ? vars.accidentIpPage : ''),
        ])}`);
      }

      if (!wrongfulArrest && vars.secDob) {
        const sameDobSource = sameDocument(vars.dobOtSource, vars.dobIpSource);
        pushRequest(`${requestLead(hasPriorRequest)} assist us by confirming the claimant\u2019s date of birth.${htmlRichList([
          boldReportLine(vars.dobOt, vars.dobOtSource, '[date of birth]', 'OT report', sameDobSource ? vars.dobOtPage : ''),
          boldReportLine(vars.dobIp, vars.dobIpSource, '[date of birth]', 'IP report', sameDobSource ? vars.dobIpPage : ''),
        ])}`);
      }

      if (!wrongfulArrest && vars.secName) {
        pushRequest(`${requestLead(hasPriorRequest)} assist us by confirming the correct spelling of the claimant\u2019s name.${htmlRichList([
          boldReportLine(vars.nameOt, vars.nameOtSource, '[spelling]', 'OT report'),
          boldReportLine(vars.nameIp, vars.nameIpSource, '[spelling]', 'IP report'),
        ])}${orIdDocumentPronoun(masterPronoun(vars))}`);
      }

      if (!wrongfulArrest && vars.secPayslips) {
        const documents = {
          payslips: 'payslips',
          'bank statements': 'bank statements',
          'payslips and bank statements': 'payslips and bank statements',
        }[vars.clearerDocs] || 'payslips';
        pushRequest(`The ${documents} provided for ${claimant} are illegible. Will you please provide clearer copies of all ${documents} in your possession?`);
      }

      let kubhekaUsed = false;
      const takeKubheka = () => {
        if (kubhekaUsed) return '';
        kubhekaUsed = true;
        return kubhekaParagraph(hasPriorRequest);
      };

      if (!wrongfulArrest && vars.secFormal) {
        const chunks = [];
        if (vars.secFormalDocs) {
          chunks.push(`${requestLead(hasPriorRequest)} assist us by providing the following documents referenced in the IP report:${htmlList(vars.formalDocs, '[Document referenced in the IP report]')}`);
        }
        chunks.push(`We note that the claimant was earning the following:${htmlList([withPeriod(filled(vars.formalEarnings, '[earnings description]'))], '[earnings description]')}`);
        const kubheka = takeKubheka();
        if (kubheka) chunks.push(kubheka);
        chunks.push(`Acceptable proof of earnings may include:${htmlList(FORMAL_EARNINGS_PROOF, '')}`);
        pushRequest(chunks.join('<br/><br/>'));
      }

      if (!wrongfulArrest && vars.secInformal) {
        const chunks = [];
        if (vars.secInformalDocs) {
          chunks.push(`${requestLead(hasPriorRequest)} assist us by providing the following documents referenced in the IP report:${htmlList(vars.informalDocs, '[Document referenced in the IP report]')}`);
        }
        chunks.push(escapeHtml(filled(vars.informalRequest, INFORMAL_REQUEST_DEFAULT)));
        const kubheka = takeKubheka();
        if (kubheka) chunks.push(kubheka);
        chunks.push(`Acceptable proof of self-employed earnings if no formal records can be provided may include affidavits or confirmation from:${htmlList(INFORMAL_EARNINGS_PROOF, '')}`);
        pushRequest(chunks.join('<br/><br/>'));
      }

      parts.push(TURNAROUND);
      parts.push(SIGN_OFF);

      const generatedSubject = draftSubject(this.name, masterClaimantLabel(vars));
      const typedSubject = String(vars.subject || '').trim();
      return {
        subject: subjectHasContent(typedSubject) ? typedSubject : generatedSubject,
        bodyHtml: parts.join('<br/><br/>'),
      };
    },
  },
  {
    id: 'draft-master-los',
    name: '(DRAFT) Master LOS',
    menuLabel: 'Master LOS Draft',
    intro: 'The 24-hour close is always included. The thank-you is for the dependants. Page numbers appear when both accident dates come from the same document.',
    fields: [
      {
        key: 'subject',
        label: 'Subject',
        type: 'text',
        default: '(DRAFT) ',
        placeholder: '(DRAFT) paste the rest of the subject…',
        guidance: '(DRAFT) is filled for you. Paste the rest of the subject after it. Required for Push to Gmail; Copy HTML does not need it.',
      },
      { key: 'recipientName', label: 'Recipient name', type: 'text', placeholder: 'e.g. Ntembeko' },
      {
        key: 'audience',
        label: 'Opening',
        type: 'select',
        default: 'attorneys',
        accordion: true,
        guidance: 'The thank-you goes to the instructing attorneys. The other opening is for an IP or someone else.',
        options: [
          { value: 'attorneys', label: 'Loss of Support — instructing attorneys' },
          { value: 'ip', label: 'Loss of Support — IP or others' },
        ],
      },
      {
        key: 'claimantTitle',
        label: 'Title',
        type: 'select',
        default: 'Ms',
        row: 'claimant',
        edge: true,
        options: [
          { value: 'Mr/Ms', label: 'Mr/Ms' },
          { value: 'Mr', label: 'Mr' },
          { value: 'Ms', label: 'Ms' },
          { value: 'Mrs', label: 'Mrs' },
        ],
      },
      {
        key: 'claimantName',
        label: 'Claimant',
        type: 'text',
        placeholder: 'e.g. Tanaka Christopher Mokgoro',
        row: 'claimant',
      },
      {
        key: 'attorneyFirm',
        label: 'Attorney firm',
        type: 'text',
        placeholder: 'e.g. Yonela Bodlani Attorneys',
        showWhen: { key: 'audience', equals: 'ip' },
        guidance: 'Written into the IP or others greeting only.',
      },
      {
        key: 'secAccident',
        label: 'Confirm the date of accident',
        type: 'toggle',
        guidance: 'Use to confirm the date of accident.',
      },
      {
        key: 'accidentOt',
        label: 'Accident date A',
        type: 'text',
        placeholder: 'e.g. 14 July 2020',
        row: 'accident-a',
        showWhen: { key: 'secAccident', equals: true },
        nested: true,
      },
      reportSourceField('accidentOtSource', 'Source A', 'Post-mortem report', {
        row: 'accident-a',
        showWhen: { key: 'secAccident', equals: true },
        nested: true,
        options: LOS_SOURCES,
        pageKey: 'accidentOtPage',
      }),
      {
        key: 'accidentIp',
        label: 'Accident date B',
        type: 'text',
        placeholder: 'e.g. 13 July 2020',
        row: 'accident-b',
        showWhen: { key: 'secAccident', equals: true },
        nested: true,
      },
      reportSourceField('accidentIpSource', 'Source B', 'IP report', {
        row: 'accident-b',
        showWhen: { key: 'secAccident', equals: true },
        nested: true,
        options: LOS_SOURCES,
        pageKey: 'accidentIpPage',
      }),
      {
        key: 'accidentOtPage',
        label: 'Page A',
        type: 'text',
        placeholder: 'e.g. 6',
        showWhen: { key: 'secAccident', equals: true },
        sameSource: ['accidentOtSource', 'accidentIpSource'],
        nested: true,
        embedded: true,
      },
      {
        key: 'accidentIpPage',
        label: 'Page B',
        type: 'text',
        placeholder: 'e.g. 8',
        showWhen: { key: 'secAccident', equals: true },
        sameSource: ['accidentOtSource', 'accidentIpSource'],
        nested: true,
        embedded: true,
      },
      {
        key: 'secIpDocs',
        label: 'Dependants documents',
        type: 'toggle',
        guidance: 'Asks for the documents in the IP report, then notes that the calculation depends on them.',
      },
      {
        key: 'ipDocs',
        label: 'Documents',
        type: 'lines',
        placeholder: 'Type a document from the IP report…',
        showWhen: { key: 'secIpDocs', equals: true },
        nested: true,
        default: [
          'Copy of payslip.',
          'Copy of the deceased’s death certificate.',
          'Copy of the post-mortem report.',
        ],
      },
    ],
    compile(vars) {
      const recipient = escapeHtml(filled(vars.recipientName, 'XXXXX'));
      const claimant = masterClaimantHtml(vars);
      const parts = [`Dear ${recipient}`];
      let hasPriorRequest = false;
      if (vars.audience === 'ip') {
        const firm = escapeHtml(filled(vars.attorneyFirm, 'XXXXX Attorneys'));
        parts.push(`Kindly note that we are undertaking Loss of Support Calculations for ${claimant} on behalf of <strong>${firm}</strong>.`);
      } else {
        parts.push(`Thank you for requesting a Loss of Support calculation for the dependants of ${claimant}.`);
      }
      if (vars.secAccident) {
        const sameAccidentSource = sameDocument(vars.accidentOtSource, vars.accidentIpSource);
        parts.push(`${requestLead(hasPriorRequest)} assist us by confirming the correct date of accident.${htmlRichList([
          boldReportLine(vars.accidentOt, vars.accidentOtSource, '[date]', 'Post-mortem report', sameAccidentSource ? vars.accidentOtPage : ''),
          boldReportLine(vars.accidentIp, vars.accidentIpSource, '[date]', 'IP report', sameAccidentSource ? vars.accidentIpPage : ''),
        ])}`);
        hasPriorRequest = true;
      }
      if (vars.secIpDocs) {
        parts.push(`${requestLead(hasPriorRequest)} assist us by providing the following documents referenced in the IP report:${htmlList(vars.ipDocs, '[Document referenced in the IP report]')}`);
        parts.push('Kindly note that the calculation is dependent on the information we have requested since it will directly increase the claim.');
        hasPriorRequest = true;
      }
      parts.push(TURNAROUND);
      parts.push(SIGN_OFF);
      const generatedSubject = draftSubject(this.name, masterClaimantLabel(vars));
      const typedSubject = String(vars.subject || '').trim();
      return {
        subject: subjectHasContent(typedSubject) ? typedSubject : generatedSubject,
        bodyHtml: parts.join('<br/><br/>'),
      };
    },
  },
  {
    id: 'info-req',
    name: 'Missing Information Request',
    legacy: true,
    fields: [
      ATTORNEY_FIELD,
      CLAIMANT_FIELD,
      {
        key: 'missingDetails',
        label: 'Outstanding information',
        type: 'lines',
        placeholder: 'Type an outstanding item…',
      },
    ],
    compile(vars) {
      const attorney = htmlField(vars, 'attorneyFirstName', '[Attorney]');
      const claimant = escapeHtml(filled(vars.claimantFullName, '[Claimant]'));
      const bodyHtml = [
        `Dear ${attorney}`,
        thankYouLoe(claimant),
        `Kindly assist us by confirming the following outstanding information:${htmlList(vars.missingDetails, '[Outstanding information]')}`,
        TURNAROUND,
        SIGN_OFF,
      ].join('<br/><br/>');
      return { subject: `URGENT INFO REQUIRED: ${filled(vars.claimantFullName, '[Claimant]')}`, bodyHtml };
    },
  },
  {
    id: 'draft-missing-gender',
    name: '(DRAFT) Missing Gender Info',
    menuLabel: '(Legacy draft) Missing Gender Info',
    legacy: true,
    fields: [
      ATTORNEY_FIELD,
      CLAIMANT_FIELD,
    ],
    compile(vars) {
      const attorney = htmlField(vars, 'attorneyFirstName', '[Attorney]');
      const fullName = escapeHtml(claimantFullLabel(vars));
      const bodyHtml = [
        `Dear ${attorney}`,
        thankYouLoe(fullName),
        `Kindly confirm whether <strong>${fullName}</strong> is a male or female.`,
        TURNAROUND,
        SIGN_OFF,
      ].join('<br/><br/>');
      return { subject: draftSubject(this.name, claimantFullLabel(vars)), bodyHtml };
    },
  },
  {
    id: 'draft-missing-accident-date',
    name: '(DRAFT) Missing Accident Date',
    menuLabel: '(Legacy draft) Missing Accident Date',
    legacy: true,
    fields: [
      ATTORNEY_FIELD,
      CLAIMANT_FIELD,
      GENDER_FIELD,
    ],
    compile(vars) {
      const attorney = htmlField(vars, 'attorneyFirstName', '[Attorney]');
      const shortName = escapeHtml(claimantShortLabel(vars));
      const bodyHtml = [
        `Dear ${attorney}`,
        thankYouLoe(shortName),
        'The date of accident was not provided. Kindly assist by providing the date of accident.',
        TURNAROUND,
        SIGN_OFF,
      ].join('<br/><br/>');
      return { subject: draftSubject(this.name, claimantShortLabel(vars)), bodyHtml };
    },
  },
  {
    id: 'draft-link-not-opening',
    name: '(DRAFT) Link Not Opening',
    menuLabel: '(Legacy draft) Link Not Opening',
    legacy: true,
    fields: [
      { key: 'contactFirstName', label: 'Contact first name', type: 'text', placeholder: 'e.g. Pelisa' },
    ],
    compile(vars) {
      const contact = htmlField(vars, 'contactFirstName', '[Name]');
      const bodyHtml = [
        `Good day ${contact}`,
        'Thank you for your email.',
        'Please kindly note we are unable to view the link. Please kindly share access openly.',
        'Apologies for any inconvience.',
        SIGN_OFF,
      ].join('<br/><br/>');
      return { subject: this.name, bodyHtml };
    },
  },
];

const EditablePreview = memo(function EditablePreview({ html, previewRef }) {
  useEffect(() => {
    const node = previewRef.current;
    if (!node) return;
    node.innerHTML = html;
  }, [html, previewRef]);

  return (
    <div
      ref={previewRef}
      className="email-preview-body p-8 pt-3 text-sm text-black leading-relaxed min-h-[400px] outline-none"
      contentEditable
      suppressContentEditableWarning
      spellCheck
      aria-label="Email text"
    />
  );
});

const EMAIL_SPLIT_KEY = 'all4one_email_inputs_width';

function readEmailInputsWidth() {
  const saved = Number(localStorage.getItem(EMAIL_SPLIT_KEY));
  return Number.isFinite(saved) && saved >= 280 ? saved : 380;
}

export default function EmailEngine() {
  const [selectedTemplateId, setSelectedTemplateId] = useState(TEMPLATES[0].id);
  const [variables, setVariables] = useState(() => initialVariables(TEMPLATES[0]));
  const [parsedKeys, setParsedKeys] = useState(() => ({
    subject: extractPlaceholderKeys(TEMPLATES[0].subject),
    body: extractPlaceholderKeys(TEMPLATES[0].body),
  }));
  const [status, setStatus] = useState({ msg: '', type: '' });
  const [isPushing, setIsPushing] = useState(false);
  const [gmailLinked, setGmailLinked] = useState(() => isGmailConnected());
  const [sourceMode, setSourceMode] = useState({});
  const [blockingKeys, setBlockingKeys] = useState([]);
  const [openingOpen, setOpeningOpen] = useState(false);
  const [recipientConfirm, setRecipientConfirm] = useState('');
  const [inputsWidth, setInputsWidth] = useState(readEmailInputsWidth);
  const inputsWidthRef = useRef(inputsWidth);
  const previewRef = useRef(null);

  useEffect(() => {
    // Email-tab visitors only. Cached token on load; never open Google UI here.
    markEmailSessionVisited();
    setGmailLinked(isGmailConnected());
  }, []);

  useEffect(() => {
    let cancel = false;
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      if (isGmailConnected()) {
        setGmailLinked(true);
        return;
      }
      if (!hasPriorGmailGrant()) {
        setGmailLinked(false);
        return;
      }
      // Silent renew only — no consent UI (prompt: 'none').
      const ok = await restoreGmailSession();
      if (cancel) return;
      setGmailLinked(ok);
      if (!ok && shouldOfferGmailConnect()) {
        setStatus({
          msg: 'Gmail is not connected quietly. Click Connect Gmail when you need drafts.',
          type: 'info',
        });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancel = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    if (!status.msg) return undefined;
    const ms = status.type === 'error' ? 8000 : 4000;
    const timer = window.setTimeout(() => setStatus({ msg: '', type: '' }), ms);
    return () => window.clearTimeout(timer);
  }, [status]);

  const selectedTemplate = TEMPLATES.find((t) => t.id === selectedTemplateId) || TEMPLATES[0];

  useEffect(() => {
    const template = TEMPLATES.find(t => t.id === selectedTemplateId) || TEMPLATES[0];

    if (template.fields) {
      setParsedKeys({ subject: [], body: [] });
      setVariables(initialVariables(template));
      setSourceMode({});
      setBlockingKeys([]);
      setOpeningOpen(false);
      setRecipientConfirm('');
      setStatus({ msg: '', type: '' });
      return;
    }

    setParsedKeys({
      subject: extractPlaceholderKeys(template.subject),
      body: extractPlaceholderKeys(template.body),
    });
    setVariables(initialVariables(template));
    setSourceMode({});
    setBlockingKeys([]);
    setOpeningOpen(false);
    setRecipientConfirm('');
    setStatus({ msg: '', type: '' });
  }, [selectedTemplateId]);

  const handleVarChange = (key, val) => {
    setVariables((prev) => {
      const next = { ...prev, [key]: val };
      if (key === 'secFormal' && !val) next.secFormalDocs = false;
      if (key === 'secInformal' && !val) next.secInformalDocs = false;
      return next;
    });
    setBlockingKeys((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : prev));
    if (key === 'recipientName') setRecipientConfirm('');
    if (key === 'audience' && val !== 'attorneys') setOpeningOpen(true);
  };

  const checkRecipientFirstName = () => {
    const value = String(variables.recipientName || '').trim();
    const parts = value.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      setRecipientConfirm(parts[0]);
    } else {
      setRecipientConfirm('');
    }
  };

  const handleLineChange = (key, index, value) => {
    setVariables((prev) => {
      const next = [...(prev[key] || [''])];
      next[index] = value;
      return { ...prev, [key]: next };
    });
  };

  const addLine = (key) => {
    setVariables((prev) => ({ ...prev, [key]: [...(prev[key] || ['']), ''] }));
  };

  const addPresetLines = (key, values) => {
    setVariables((prev) => {
      const current = [...(prev[key] || [''])];
      const retained = current.filter((line) => String(line || '').trim());
      return { ...prev, [key]: [...retained, ...values] };
    });
  };

  const removeLine = (key, index) => {
    setVariables((prev) => {
      const curr = [...(prev[key] || [''])];
      if (curr.length <= 1) return { ...prev, [key]: [''] };
      return { ...prev, [key]: curr.filter((_, i) => i !== index) };
    });
  };

  const compiledContent = useMemo(() => {
    const template = TEMPLATES.find(t => t.id === selectedTemplateId) || TEMPLATES[0];
    if (typeof template.compile === 'function') {
      const { subject, bodyHtml } = template.compile(variables);
      return wrapCompiledEmail(subject, bodyHtml);
    }
    return compilePlaceholderTemplate(template, variables);
  }, [selectedTemplateId, variables]);

  const currentHtmlBody = () => previewRef.current?.innerHTML || compiledContent.htmlBody;

  const setSplitWidth = (next, boundsWidth) => {
    const max = Math.max(280, (boundsWidth || next) - 320);
    const width = Math.round(Math.min(max, Math.max(280, next)));
    inputsWidthRef.current = width;
    setInputsWidth(width);
    try { localStorage.setItem(EMAIL_SPLIT_KEY, String(width)); } catch { /* private mode */ }
  };

  const beginSplitDrag = (event) => {
    if (window.matchMedia('(max-width: 860px)').matches) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = inputsWidthRef.current;
    const root = handle.parentElement;
    const move = (ev) => {
      setSplitWidth(startWidth + (ev.clientX - startX), root.getBoundingClientRect().width);
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  };

  const nudgeSplit = (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const root = event.currentTarget.parentElement;
    const delta = event.key === 'ArrowRight' ? 24 : -24;
    setSplitWidth(inputsWidthRef.current + delta, root.getBoundingClientRect().width);
  };

  const logEmailUsage = (action, deliveryChannel) => {
    const payload = {
      action: 'LOG_EMAIL_USAGE',
      userName: getWorkspaceName() || 'Unknown User',
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      claimant: variables.claimantFullName || variables.claimantName || variables['Claimant Name'] || '',
      subject: compiledContent.subject,
      usageAction: action,
      status: 'Success',
      deliveryChannel,
      appVersion: window.ALL4ONE_APP_VERSION || '',
    };

    fetch(GAS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    }).catch((err) => console.warn('Email usage log failed', err));
  };

  const copyToClipboard = () => {
    const missing = collectGmailPushErrors(selectedTemplate, variables, { requireSubject: false });
    if (missing.keys.length) {
      setBlockingKeys(missing.keys);
      setStatus({
        msg: 'Complete the highlighted fields before copying.',
        type: 'error',
      });
      return;
    }
    setBlockingKeys([]);

    const htmlBody = currentHtmlBody();
    try {
      const blobHtml = new Blob([htmlBody], { type: "text/html" });
      const blobText = new Blob([htmlBody.replace(/<[^>]*>?/gm, '')], { type: "text/plain" });
      const data = [new ClipboardItem({ "text/plain": blobText, "text/html": blobHtml })];

      navigator.clipboard.write(data).then(() => {
        setStatus({ msg: 'Rich text copied! Paste directly into Gmail.', type: 'success' });
        logEmailUsage('Copy HTML', 'Clipboard');
        setTimeout(() => setStatus({ msg: '', type: '' }), 3000);
      });
    } catch (err) {
      navigator.clipboard.writeText(htmlBody.replace(/<br\/>/g, '\n').replace(/<[^>]*>?/gm, ''));
      setStatus({ msg: 'Plain text copied to clipboard.', type: 'success' });
      logEmailUsage('Copy plain text', 'Clipboard');
    }
  };

  const connectGmail = async () => {
    setStatus({ msg: 'Connecting Google account for Gmail drafts...', type: 'info' });
    try {
      await requestGmailAccessToken();
      setGmailLinked(true);
      showAppToast('Gmail connected. You can push drafts to this account.');
      setStatus({ msg: 'Gmail connected. You can push drafts directly.', type: 'success' });
    } catch (err) {
      setStatus({ msg: describeGmailConnectError(err), type: 'error' });
    }
  };

  const disconnectGmail = () => {
    clearGmailToken();
    setGmailLinked(false);
    setStatus({ msg: 'Gmail disconnected.', type: 'info' });
  };

  const resetDraftFields = () => {
    const template = TEMPLATES.find((t) => t.id === selectedTemplateId) || TEMPLATES[0];
    setVariables(initialVariables(template));
    setSourceMode({});
    setStatus({ msg: 'Draft fields cleared.', type: 'info' });
  };

  const pushDraftViaGmailApi = async () => {
    await createGmailDraft({
      subject: compiledContent.subject,
      htmlBody: currentHtmlBody(),
    });
    logEmailUsage('Push to Gmail', 'Gmail OAuth');
    setStatus({
      msg: 'Draft created in your Gmail account. Open Gmail → Drafts to review and send.',
      type: 'success',
    });
  };

  const pushToGmail = async () => {
    if (!gmailLinked) {
      setStatus({ msg: 'Connect Gmail before pushing a draft.', type: 'error' });
      return;
    }

    const missing = collectGmailPushErrors(selectedTemplate, variables);
    if (missing.keys.length) {
      setBlockingKeys(missing.keys);
      setStatus({
        msg: 'Complete the highlighted fields before Push to Gmail.',
        type: 'error',
      });
      return;
    }
    setBlockingKeys([]);

    setIsPushing(true);
    setStatus({ msg: 'Pushing draft to Gmail...', type: 'info' });

    try {
      // Once the user has connected Gmail, use that account directly. The
      // Apps Script deployment may be an older revision and is unrelated to
      // the user's OAuth-backed Gmail drafts.
      if (gmailLinked) {
        await pushDraftViaGmailApi();
        return;
      }

      const payload = {
        action: 'CREATE_DRAFT',
        subject: compiledContent.subject,
        htmlBody: currentHtmlBody(),
      };

      const res = await fetch(GAS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });

      let result;
      try {
        result = await res.json();
      } catch {
        result = null;
      }

      const ok = String(result?.status || '').toLowerCase() === 'success';
      if (ok) {
        logEmailUsage('Push to Gmail', 'Apps Script');
        setStatus({
          msg: result.message || 'Draft created in your Gmail account!',
          type: 'success',
        });
        return;
      }

      const gasError = result?.message || `HTTP ${res.status}`;
      const needsOAuthFallback =
        /firm not found/i.test(gasError) ||
        /unknown action/i.test(gasError) ||
        !result;

      if (needsOAuthFallback) {
        setStatus({ msg: 'Backend draft handler unavailable — using Gmail OAuth...', type: 'info' });
        await pushDraftViaGmailApi();
        setGmailLinked(true);
        return;
      }

      setStatus({
        msg: `Failed to push draft via GAS: ${gasError}`,
        type: 'error',
      });
    } catch (err) {
      console.error(err);
      if (!isGmailConnected()) setGmailLinked(false);
      const msg = describeGmailConnectError(err);
      if (/oauth|gmail|token|configured|authorized domain|sign-in method/i.test(msg)) {
        setStatus({
          msg: `${msg} Click "Connect Gmail" first, or redeploy gas/Code.gs on Apps Script.`,
          type: 'error',
        });
      } else {
        setStatus({
          msg: `Failed to create Gmail draft: ${msg}`,
          type: 'error',
        });
      }
    } finally {
      setIsPushing(false);
    }
  };

  const allUniqueKeys = [...new Set([...parsedKeys.subject, ...parsedKeys.body])];
  const structuredFields = selectedTemplate.fields || null;
  const visibleFields = structuredFields
    ? structuredFields.filter((field) => fieldIsVisible(field, variables) && !field.embedded)
    : null;
  const structuredRows = visibleFields
    ? visibleFields.reduce((rows, field) => {
        const previous = rows[rows.length - 1];
        if (field.row && previous?.[0]?.row === field.row) {
          previous.push(field);
        } else {
          rows.push([field]);
        }
        return rows;
      }, [])
    : null;
  const fieldCount = visibleFields ? visibleFields.length : allUniqueKeys.length;

  const inputClassFor = (fieldKey) => (blockingKeys.includes(fieldKey) ? INPUT_BLOCKING_CLASS : INPUT_CLASS);
  const chromeClassFor = (...keys) => (
    keys.some((key) => blockingKeys.includes(key)) ? CHROME_BLOCKING_CLASS : CHROME_CLASS
  );

  const renderPageSlot = (pageField) => {
    if (!pageField) return null;
    return (
      <>
        <div className="w-px self-stretch bg-slate-200 dark:bg-slate-600 shrink-0" aria-hidden="true" />
        <input
          type="text"
          value={variables[pageField.key] || ''}
          onChange={(e) => handleVarChange(pageField.key, e.target.value)}
          placeholder={pageField.placeholder || 'Pg'}
          aria-label={pageField.label}
          className={`${CHROME_INNER} w-[3.25rem] shrink-0 px-2 py-3 text-center`}
        />
      </>
    );
  };

  const renderClaimantChrome = (titleField, nameField) => {
    const nameValue = variables[nameField.key] || '';
    return (
      <div className="space-y-2">
        <div className={chromeClassFor(titleField.key, nameField.key)}>
          <select
            value={variables[titleField.key] || ''}
            onChange={(e) => handleVarChange(titleField.key, e.target.value)}
            aria-label={titleField.label}
            className={`${CHROME_INNER} shrink-0 w-[5.5rem] px-3 py-3 appearance-none cursor-pointer font-medium`}
          >
            {(titleField.options || []).map((opt) => (
              <option key={`${titleField.key}-${opt.value || 'empty'}`} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="w-px self-stretch bg-slate-200 dark:bg-slate-600 shrink-0" aria-hidden="true" />
          <input
            type="text"
            value={nameValue}
            onChange={(e) => handleVarChange(nameField.key, e.target.value)}
            placeholder={nameField.placeholder || 'Enter claimant name...'}
            aria-label={nameField.label}
            className={`${CHROME_INNER} min-w-0 flex-1 px-3 py-3`}
          />
        </div>
        {String(nameValue).trim() ? (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            In the email: <span className="font-semibold text-slate-700 dark:text-slate-200">{formatClaimantDisplayName(nameValue)}</span>
          </p>
        ) : null}
      </div>
    );
  };

  const renderStructuredField = (field) => {
    if (field.type === 'toggle') {
      const on = Boolean(variables[field.key]);
      const blocked = blockingKeys.includes(field.key);
      return (
        <label className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${blocked ? 'border-rose-300/80 dark:border-rose-400/50' : on ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40'}`}>
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => handleVarChange(field.key, e.target.checked)}
            className="mt-0.5 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{field.label}</span>
            {field.guidance ? (
              <span className="block text-[11px] leading-snug text-slate-500 dark:text-slate-400 mt-0.5">{field.guidance}</span>
            ) : null}
          </span>
        </label>
      );
    }

    if (field.type === 'select') {
      const options = field.options || [];
      const hasEmptyOption = options.some((opt) => opt.value === '');
      const selectEl = (
        <select
          value={variables[field.key] || ''}
          onChange={(e) => handleVarChange(field.key, e.target.value)}
          className={`${inputClassFor(field.key)} appearance-none cursor-pointer`}
        >
          {!hasEmptyOption && field.default == null ? <option value="">Select {field.label.toLowerCase()}</option> : null}
          {options.map((opt) => (
            <option key={`${field.key}-${opt.value || 'empty'}`} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
      if (!field.accordion) return selectEl;
      const current = options.find((opt) => opt.value === (variables[field.key] || field.default))?.label || field.label;
      return (
        <div className={`rounded-xl border ${blockingKeys.includes(field.key) ? 'border-rose-300/80 dark:border-rose-400/50' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40'}`}>
          <button
            type="button"
            onClick={() => setOpeningOpen((open) => !open)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
          >
            <span className="min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">{field.label}</span>
              <span className="block text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{current}</span>
            </span>
            <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${openingOpen ? 'rotate-180' : ''}`} />
          </button>
          {openingOpen ? (
            <div className="px-3 pb-3 space-y-2 border-t border-slate-100 dark:border-slate-700 pt-2">
              {field.guidance ? (
                <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">{field.guidance}</p>
              ) : null}
              {selectEl}
            </div>
          ) : null}
        </div>
      );
    }

    if (field.type === 'source') {
      const value = variables[field.key] || '';
      const options = field.options || [];
      const known = options.includes(value);
      const isOther = sourceMode[field.key] === 'other' || (value && !known);
      const pageField = field.pageKey
        ? structuredFields?.find((item) => item.key === field.pageKey)
        : null;
      const pageVisible = Boolean(pageField && fieldIsVisible(pageField, variables));
      const pageKeys = pageVisible ? [pageField.key] : [];

      if (isOther) {
        return (
          <div className={chromeClassFor(field.key, ...pageKeys)}>
            <button
              type="button"
              title="Choose a built-in document type"
              onClick={() => {
                setSourceMode((prev) => ({ ...prev, [field.key]: 'list' }));
                handleVarChange(field.key, '');
              }}
              className={`${CHROME_INNER} shrink-0 px-3 py-3 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer`}
            >
              Other
            </button>
            <div className="w-px self-stretch bg-slate-200 dark:bg-slate-600 shrink-0" aria-hidden="true" />
            <input
              type="text"
              value={known ? '' : value}
              onChange={(e) => handleVarChange(field.key, e.target.value)}
              placeholder="Type the document name"
              className={`${CHROME_INNER} min-w-0 flex-1 px-3 py-3`}
            />
            {pageVisible ? renderPageSlot(pageField) : null}
          </div>
        );
      }

      return (
        <div className={chromeClassFor(field.key, ...pageKeys)}>
          <select
            value={value}
            onChange={(e) => {
              const next = e.target.value;
              if (next === '__other__') {
                setSourceMode((prev) => ({ ...prev, [field.key]: 'other' }));
                handleVarChange(field.key, '');
              } else {
                setSourceMode((prev) => ({ ...prev, [field.key]: 'list' }));
                handleVarChange(field.key, next);
              }
            }}
            className={`${CHROME_INNER} min-w-0 flex-1 px-3 py-3 appearance-none cursor-pointer`}
          >
            {!value ? <option value="">Select a document</option> : null}
            {options.map((opt) => (
              <option key={`${field.key}-${opt}`} value={opt}>{opt}</option>
            ))}
            <option value="__other__">Other…</option>
          </select>
          {pageVisible ? renderPageSlot(pageField) : null}
        </div>
      );
    }

    if (field.type === 'lines') {
      const lines = Array.isArray(variables[field.key]) ? variables[field.key] : [''];
      return (
        <div className="space-y-2">
          {field.presets?.length ? (
            <div className="rounded-xl border border-amber-200/80 dark:border-amber-700/50 bg-amber-50/70 dark:bg-amber-950/20 p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Quick add</span>
                <button
                  type="button"
                  onClick={() => addPresetLines(field.key, field.presets.map((preset) => preset.value))}
                  className="text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:underline"
                >
                  + Common set
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {field.presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => addPresetLines(field.key, [preset.value])}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold border border-amber-200 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-all"
                  >
                    + {preset.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {lines.map((line, idx) => (
            <div key={`${field.key}-${idx}`} className="flex items-center gap-2">
              <input
                type="text"
                value={line}
                onChange={(e) => handleLineChange(field.key, idx, e.target.value)}
                placeholder={field.placeholder || `Enter ${field.label}...`}
                className={inputClassFor(field.key)}
              />
              <button
                type="button"
                onClick={() => removeLine(field.key, idx)}
                className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all shrink-0"
                title="Remove line"
              >
                <Minus size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => addLine(field.key)}
            className="flex items-center justify-center gap-2 w-full text-xs font-bold px-4 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-all"
          >
            <Plus className="w-4 h-4" /> Add custom line
          </button>
        </div>
      );
    }

    if (field.type === 'textarea') {
      return (
        <textarea
          value={variables[field.key] || ''}
          onChange={(e) => handleVarChange(field.key, e.target.value)}
          placeholder={field.placeholder || `Enter ${field.label}...`}
          rows={3}
          className={`${inputClassFor(field.key)} resize-y`}
        />
      );
    }

    return (
      <div className="space-y-2">
        <input
          type="text"
          value={variables[field.key] || ''}
          onChange={(e) => handleVarChange(field.key, e.target.value)}
          onBlur={field.key === 'recipientName' ? checkRecipientFirstName : undefined}
          placeholder={field.key === 'subject'
            ? draftSubject(selectedTemplate.name, masterClaimantLabel(variables))
            : (field.placeholder || `Enter ${field.label}...`)}
          className={inputClassFor(field.key)}
        />
        {field.key === 'recipientName' && recipientConfirm ? (
          <div className="rounded-xl border border-amber-300/80 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-[11px] text-slate-700 dark:text-slate-200 space-y-2">
            <p>Recipient should be a first name only. Use <strong>{recipientConfirm}</strong>?</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  handleVarChange('recipientName', recipientConfirm);
                  setRecipientConfirm('');
                }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500 text-slate-900"
              >
                Use {recipientConfirm}
              </button>
              <button
                type="button"
                onClick={() => setRecipientConfirm('')}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-slate-300 dark:border-slate-600"
              >
                Keep as typed
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const rowLayoutClass = (row) => {
    if (row.length <= 1) return '';
    if (row.some((field) => field.edge)) return 'flex items-end gap-2';
    if (row.some((field) => field.compact)) return 'flex flex-wrap items-end gap-2';
    return 'grid grid-cols-2 gap-2';
  };

  const fieldCellClass = (field, row) => {
    const nested = row.length === 1 && field.nested ? 'pl-3 border-l-2 border-amber-200 dark:border-amber-800' : '';
    if (field.edge) return `min-w-0 w-[6.5rem] shrink-0 ${nested}`;
    if (field.compact) return `min-w-0 w-[4.75rem] shrink-0 ${nested}`;
    if (row.some((item) => item.edge || item.compact)) return `min-w-0 flex-1 basis-[8rem] ${nested}`;
    return `min-w-0 ${nested}`;
  };

  return (
    <div className="email-split relative h-full flex overflow-hidden bg-slate-50 dark:bg-slate-900/50">
      {/* COLUMN 1: TEMPLATE & VARIABLES */}
      <div className="email-inputs shrink-0 flex flex-col bg-white dark:bg-slate-800 z-10" style={{ width: inputsWidth }}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-1 text-slate-800 dark:text-slate-100">
            <Mail className="text-amber-500 w-5 h-5" /> Communications
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Dynamic email routing and dispatch</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scroll">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400">
              1. Select Template
            </label>
            <div className="relative">
               <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                 <FileText size={16} />
               </span>
              <select 
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full pl-9 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-medium outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-900 dark:text-white transition-all appearance-none cursor-pointer"
              >
                {TEMPLATES.filter((t) => !t.legacy).map((t) => (
                  <option key={t.id} value={t.id}>{t.menuLabel || t.name}</option>
                ))}
                <optgroup label="Legacy Drafts">
                  {TEMPLATES.filter((t) => t.legacy).map((t) => (
                    <option key={t.id} value={t.id}>{t.menuLabel || t.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            {selectedTemplate.intro ? (
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{selectedTemplate.intro}</p>
            ) : null}
          </div>

          <div className="p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center justify-between gap-2 mb-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                2. Template Variables
              </label>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={resetDraftFields}
                  title="Clear all fields for this draft"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-all"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
                <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-2 py-1 rounded-full border border-amber-500/20">
                  {fieldCount} DETECTED
                </span>
              </div>
            </div>

            {structuredFields ? (
              <div className="space-y-4">
                {structuredRows.map((row) => {
                  const titleField = row.find((field) => field.key === 'claimantTitle');
                  const nameField = row.find((field) => field.key === 'claimantName');
                  if (titleField && nameField) {
                    return (
                      <div key="claimant-chrome" className="min-w-0">
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Claimant</label>
                        {renderClaimantChrome(titleField, nameField)}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={row.map((field) => field.key).join('-')}
                      className={rowLayoutClass(row)}
                    >
                      {row.map((field) => (
                        <div
                          key={field.key}
                          className={fieldCellClass(field, row)}
                        >
                          {field.type === 'toggle' || field.accordion ? null : (
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">{field.label}</label>
                          )}
                          {field.type !== 'toggle' && !field.accordion && field.guidance ? (
                            <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400 mb-1">{field.guidance}</p>
                          ) : null}
                          {renderStructuredField(field)}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : allUniqueKeys.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No dynamic variables detected.</p>
            ) : (
              <div className="space-y-4">
                {allUniqueKeys.map(key => (
                  <div key={key}>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">{key}</label>
                    {key.toLowerCase().includes('list') || key.toLowerCase().includes('details') ? (
                      <textarea 
                        value={variables[key] || ''}
                        onChange={(e) => handleVarChange(key, e.target.value)}
                        placeholder={`Enter ${key}...`}
                        rows="4"
                        className={`${INPUT_CLASS} resize-none`}
                      />
                    ) : (
                      <input 
                        type="text" 
                        value={variables[key] || ''}
                        onChange={(e) => handleVarChange(key, e.target.value)}
                        placeholder={`Enter ${key}...`}
                        className={INPUT_CLASS}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className="email-split-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the form and the preview"
        aria-valuemin={280}
        aria-valuenow={Math.round(inputsWidth)}
        tabIndex={0}
        onPointerDown={beginSplitDrag}
        onKeyDown={nudgeSplit}
      />

      {/* COLUMN 2: LIVE PREVIEW & EXPORT */}
      <div className="flex-1 min-w-0 flex flex-col relative bg-slate-200/60 dark:bg-[#0f172a]">
        <div className="workspace-toolbar h-16 shrink-0 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold tracking-wide uppercase text-slate-500 dark:text-slate-400">HTML Compiled</span>
          </div>
          <div className="workspace-actions flex gap-3">
            {gmailLinked ? (
              <button
                type="button"
                onClick={disconnectGmail}
                className="px-2 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                title="Disconnect Gmail so a different account can be used"
              >
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={connectGmail}
                title="Requests Gmail draft access for your Actuary work Google account. The site hostname must be listed on the OAuth web client’s Authorized JavaScript origins."
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95"
              >
                <Mail className="w-4 h-4" /> Connect Gmail
              </button>
            )}
            <button 
              onClick={copyToClipboard} 
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95"
            >
              <Copy className="w-4 h-4" /> Copy HTML
            </button>
            <button 
              onClick={pushToGmail} 
              disabled={!gmailLinked || isPushing}
              title={gmailLinked ? 'Create a Gmail draft' : 'Connect Gmail to push this draft'}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 disabled:cursor-not-allowed disabled:active:scale-100 ${gmailLinked ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 disabled:opacity-50' : 'bg-slate-300 text-slate-500 shadow-none dark:bg-slate-700 dark:text-slate-400'}`}
            >
              {isPushing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} 
              Push to Gmail
            </button>
          </div>
        </div>

        {status.msg && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 max-w-[min(90%,42rem)] px-4">
            <div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-start gap-2 text-sm font-bold border ${
              status.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-100 border-emerald-200 dark:border-emerald-800' :
              status.type === 'error' ? 'bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-100 border-rose-200 dark:border-rose-800' :
              'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 border-blue-200 dark:border-blue-800'
            }`}>
              <span className="shrink-0 mt-0.5">
                {status.type === 'success' ? <CheckCircle2 size={18} /> : status.type === 'error' ? <AlertCircle size={18} /> : <RefreshCw size={18} className="animate-spin" />}
              </span>
              <span className="leading-snug">{status.msg}</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-8 custom-scroll flex justify-center">
          <div className="w-full max-w-3xl bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col self-start" style={{ colorScheme: 'light' }}>
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-4 mb-3">
                <span className="text-slate-400 font-medium text-sm w-16">To</span>
                <div className="flex-1 border-b border-slate-200 pb-1">
                  <span className="text-sm text-slate-700 italic">Recipient selected in Gmail...</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-slate-400 font-medium text-sm w-16">Subject</span>
                <div className="flex-1 font-semibold text-slate-800 text-lg border-b border-slate-200 pb-1">
                  {compiledContent.subject}
                </div>
              </div>
            </div>

            <EditablePreview html={compiledContent.htmlBody} previewRef={previewRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
