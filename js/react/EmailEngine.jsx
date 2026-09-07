import React, { useState, useEffect, useMemo } from 'react';
import { 
  Mail, 
  Send, 
  Copy, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Plus,
  Minus
} from 'lucide-react';
import { AC_LOGO_DATA_URI } from './ac-logo-b64.js';
import {
  createGmailDraft,
  isGmailConnected,
  requestGmailAccessToken,
  clearGmailToken,
  describeGmailConnectError,
} from '../gmail-draft.js';
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbw-M9kVkSSXKuJ49tohaconx99-l5VcbU1xSNeUTccX2gs0prok3LltyTyO7mdNKtm8/exec";

const INPUT_CLASS = "w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:border-amber-500 dark:text-white transition-all";

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
    <strong style="color: ${SIG.label};">E</strong>&nbsp;<a href="mailto:namir@actuaryconsulting.co.za" style="color: ${SIG.link}; text-decoration: underline;">namir@actuaryconsulting.co.za</a>&nbsp;&nbsp;&nbsp;
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
const PROCEED_HYPHEN = 'We will be able to proceed with the actuarial calculations once the above-mentioned information has been provided.';
const PROCEED_SPACE = 'We will be able to proceed with the actuarial calculations once the above mentioned information has been provided.';
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

function htmlList(items, emptyPlaceholder) {
  const cleaned = (Array.isArray(items) ? items : []).map((item) => String(item || '').trim()).filter(Boolean);
  const source = cleaned.length ? cleaned : [emptyPlaceholder];
  const rows = source.map((item) => (
    `<tr>` +
      `<td valign="top" style="width:18px; padding:0 8px 2px 0; font-family: Verdana, Geneva, sans-serif; font-size:13px; color:#000; line-height:1.35;">&#8226;</td>` +
      `<td valign="top" style="padding:0 0 2px 0; font-family: Verdana, Geneva, sans-serif; font-size:13px; color:#000; line-height:1.35;">${escapeHtml(item)}</td>` +
    `</tr>`
  )).join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0 4px; border-collapse:collapse;">${rows}</table>`;
}

function inTheLine(value, source, valuePlaceholder, sourcePlaceholder) {
  return `${filled(value, valuePlaceholder)} in the ${filled(source, sourcePlaceholder)}.`;
}

function ipDateLine(date, page, datePlaceholder, pagePlaceholder) {
  return `${filled(date, datePlaceholder)} in the IP report (Page ${filled(page, pagePlaceholder)}).`;
}

function thankYouLoe(claimantHtml) {
  return `Thank you for requesting a Loss of Earnings calculation for ${claimantHtml}.`;
}

function orIdDocumentLine(gender) {
  return `or alternatively, kindly provide a copy of ${possessivePronoun(gender)} ID document.`;
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
      vars[field.key] = field.type === 'lines' ? [''] : '';
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
    id: 'loe-report',
    name: 'Standard LOE Dispatch',
    subject: 'Actuarial Report: <<Claimant Name>> / <<Case Ref>>',
    body: `Dear <<Attorney First Name>>,\n\nAttached please find our Actuarial Report calculating the Loss of Earnings in respect of <<Claimant Name>>.\n\nOur fee note is attached for your kind attention. Please ensure payment is processed within <<Payment Terms>> days.\n\nShould you require any amendments or further scenarios, please do not hesitate to contact our offices.\n\nKind regards,\nNamir`
  },
  {
    id: 'info-req',
    name: 'Missing Information Request',
    subject: 'URGENT INFO REQUIRED: <<Claimant Name>>',
    body: `Dear <<Attorney First Name>>\n\nThank you for requesting a Loss of Earnings calculation for <<Claimant Name>>.\n\nKindly assist us by confirming the following outstanding information:\n<<Missing Information Details>>\n\nWe will be able to proceed with the actuarial calculations once the above-mentioned information has been provided.\n\nKind regards\nNamir`
  },
  {
    id: 'amendment',
    name: 'Amended Report Dispatch',
    subject: 'AMENDED Actuarial Report: <<Claimant Name>>',
    body: `Dear <<Attorney First Name>>,\n\nAs requested, please find attached the AMENDED Actuarial Report for <<Claimant Name>>.\n\nThe amendments reflect the following changes:\n<<Amendment Details>>\n\nWe trust you find the above in order.\n\nKind regards,\nNamir`
  },
  {
    id: 'draft-earnings',
    name: '(DRAFT) Request for claimant earnings',
    fields: [
      ATTORNEY_FIELD,
      CLAIMANT_FIELD,
      GENDER_FIELD,
      { key: 'attorneyFirm', label: 'Attorney firm', type: 'text', placeholder: 'e.g. Yonela Bodlani Attorneys' },
      {
        key: 'documentLines',
        label: 'Documents requested',
        type: 'lines',
        placeholder: 'Type a custom earnings document…',
        presets: EARNINGS_DOCUMENT_PRESETS,
      },
    ],
    compile(vars) {
      const attorney = htmlField(vars, 'attorneyFirstName', '[Attorney]');
      const shortName = escapeHtml(claimantShortLabel(vars));
      const firm = htmlField(vars, 'attorneyFirm', '[Attorney firm]');
      const bodyHtml = [
        `Dear ${attorney}`,
        'I trust you are well.',
        `Kindly note that we are undertaking Loss of Earnings Calculations for <strong>${shortName}</strong> on behalf of ${firm}.`,
        KUBHEKA_APN_HTML,
        `Kindly assist us by providing the following documents referenced in your report:${htmlList(vars.documentLines, '[Documents requested]')}`,
        'We will provide the report within 24 hours once the abovementioned information is provided and no further information is required.',
        SIGN_OFF,
      ].join('<br/><br/>');
      return { subject: draftSubject(this.name, claimantShortLabel(vars)), bodyHtml };
    },
  },
  {
    id: 'draft-disc-accident-first-name',
    name: '(DRAFT) Discrepancy in Accident Date & First Name',
    fields: [
      ATTORNEY_FIELD,
      CLAIMANT_FIELD,
      GENDER_FIELD,
      { key: 'dateA', label: 'Date A', type: 'text', placeholder: 'e.g. 14 July 2020', row: 'date-a' },
      { key: 'dateASource', label: 'Source A', type: 'text', placeholder: 'e.g. RAF report', row: 'date-a' },
      { key: 'dateB', label: 'Date B', type: 'text', placeholder: 'e.g. 13 July 2020', row: 'date-b' },
      { key: 'dateBSource', label: 'Source B', type: 'text', placeholder: 'e.g. IP report', row: 'date-b' },
      { key: 'nameA', label: 'Spelling A', type: 'text', placeholder: 'e.g. Rofhiwa', row: 'name-a' },
      { key: 'nameASource', label: 'Source A', type: 'text', placeholder: 'e.g. Instruction letter', row: 'name-a' },
      { key: 'nameB', label: 'Spelling B', type: 'text', placeholder: 'e.g. Rofhiwe', row: 'name-b' },
      { key: 'nameBSource', label: 'Source B', type: 'text', placeholder: 'e.g. IP report', row: 'name-b' },
    ],
    compile(vars) {
      const attorney = htmlField(vars, 'attorneyFirstName', '[Attorney]');
      const shortName = escapeHtml(claimantShortLabel(vars));
      const bodyHtml = [
        `Dear ${attorney}`,
        thankYouLoe(shortName),
        `Kindly assist us by confirming the correct date of accident.${htmlList([
          inTheLine(vars.dateA, vars.dateASource, '[Date A]', '[Source A]'),
          inTheLine(vars.dateB, vars.dateBSource, '[Date B]', '[Source B]'),
        ], '[Date discrepancy]')}`,
        `Also kindly assist us by confirming the correct spelling of the claimant\u2019s name.${htmlListWithIdFollowup([
          inTheLine(vars.nameA, vars.nameASource, '[Spelling A]', '[Source A]'),
          inTheLine(vars.nameB, vars.nameBSource, '[Spelling B]', '[Source B]'),
        ], '[Name discrepancy]', vars.gender)}`,
        PROCEED_HYPHEN,
        SIGN_OFF,
      ].join('<br/><br/>');
      return { subject: draftSubject(this.name, claimantShortLabel(vars)), bodyHtml };
    },
  },
  {
    id: 'draft-missing-gender',
    name: '(DRAFT) Missing Gender Info',
    fields: [
      ATTORNEY_FIELD,
      CLAIMANT_FIELD,
    ],
    compile(vars) {
      const attorney = htmlField(vars, 'attorneyFirstName', '[Attorney]');
      const fullName = escapeHtml(claimantFullLabel(vars));
      const bodyHtml = [
        `Dear ${attorney}`,
        'I trust that you are well.',
        `Kindly confirm whether ${fullName} is a male or female.`,
        PROCEED_SPACE,
        SIGN_OFF,
      ].join('<br/><br/>');
      return { subject: draftSubject(this.name, claimantFullLabel(vars)), bodyHtml };
    },
  },
  {
    id: 'draft-missing-accident-date',
    name: '(DRAFT) Missing Accident Date',
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
        PROCEED_SPACE,
        SIGN_OFF,
      ].join('<br/><br/>');
      return { subject: draftSubject(this.name, claimantShortLabel(vars)), bodyHtml };
    },
  },
  {
    id: 'draft-disc-surname',
    name: '(DRAFT) Discrepancy in Surname',
    fields: [
      ATTORNEY_FIELD,
      CLAIMANT_FIELD,
      GENDER_FIELD,
      { key: 'surnameA', label: 'Surname A', type: 'text', placeholder: 'e.g. Sethlabane', row: 'surname-a' },
      { key: 'surnameASource', label: 'Source A', type: 'text', placeholder: 'e.g. OT report', row: 'surname-a' },
      { key: 'surnameB', label: 'Surname B', type: 'text', placeholder: 'e.g. Setlhabane', row: 'surname-b' },
      { key: 'surnameBSource', label: 'Source B', type: 'text', placeholder: 'e.g. IP report', row: 'surname-b' },
    ],
    compile(vars) {
      const attorney = htmlField(vars, 'attorneyFirstName', '[Attorney]');
      const shortName = escapeHtml(claimantShortLabel(vars));
      const bodyHtml = [
        `Dear ${attorney}`,
        thankYouLoe(shortName),
        `Kindly assist us by confirming the correct spelling of the claimant\u2019s surname.${htmlListWithIdFollowup([
          inTheLine(vars.surnameA, vars.surnameASource, '[Surname A]', '[Source A]'),
          inTheLine(vars.surnameB, vars.surnameBSource, '[Surname B]', '[Source B]'),
        ], '[Surname discrepancy]', vars.gender)}`,
        PROCEED_HYPHEN,
        SIGN_OFF,
      ].join('<br/><br/>');
      return { subject: draftSubject(this.name, claimantShortLabel(vars)), bodyHtml };
    },
  },
  {
    id: 'draft-disc-first-name',
    name: '(DRAFT) Discrepancy in First Name',
    fields: [
      ATTORNEY_FIELD,
      CLAIMANT_FIELD,
      GENDER_FIELD,
      { key: 'nameA', label: 'Spelling A', type: 'text', placeholder: 'e.g. Sipiwe', row: 'name-a' },
      { key: 'nameASource', label: 'Source A', type: 'text', placeholder: 'e.g. Email', row: 'name-a' },
      { key: 'nameB', label: 'Spelling B', type: 'text', placeholder: 'e.g. Simphiwe', row: 'name-b' },
      { key: 'nameBSource', label: 'Source B', type: 'text', placeholder: 'e.g. IP report', row: 'name-b' },
    ],
    compile(vars) {
      const attorney = htmlField(vars, 'attorneyFirstName', '[Attorney]');
      const shortName = escapeHtml(claimantShortLabel(vars));
      const bodyHtml = [
        `Dear ${attorney}`,
        thankYouLoe(shortName),
        `Kindly assist us by confirming the correct spelling of the claimant\u2019s name.${htmlListWithIdFollowup([
          inTheLine(vars.nameA, vars.nameASource, '[Spelling A]', '[Source A]'),
          inTheLine(vars.nameB, vars.nameBSource, '[Spelling B]', '[Source B]'),
        ], '[Name discrepancy]', vars.gender)}`,
        PROCEED_HYPHEN,
        SIGN_OFF,
      ].join('<br/><br/>');
      return { subject: draftSubject(this.name, claimantShortLabel(vars)), bodyHtml };
    },
  },
  {
    id: 'draft-link-not-opening',
    name: '(DRAFT) Link Not Opening',
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
  {
    id: 'draft-disc-accident-dates-ip',
    name: '(DRAFT) Discrepancy in Accident Dates within IP',
    fields: [
      ATTORNEY_FIELD,
      CLAIMANT_FIELD,
      GENDER_FIELD,
      { key: 'dateA', label: 'Date A', type: 'text', placeholder: 'e.g. 15 January 2015', row: 'date-a' },
      { key: 'dateAPage', label: 'Page A', type: 'text', placeholder: 'e.g. 6', row: 'date-a' },
      { key: 'dateB', label: 'Date B', type: 'text', placeholder: 'e.g. 15 January 2020', row: 'date-b' },
      { key: 'dateBPage', label: 'Page B', type: 'text', placeholder: 'e.g. 8', row: 'date-b' },
    ],
    compile(vars) {
      const attorney = htmlField(vars, 'attorneyFirstName', '[Attorney]');
      const shortName = escapeHtml(claimantShortLabel(vars));
      const bodyHtml = [
        `Dear ${attorney}`,
        thankYouLoe(shortName),
        `Kindly assist us by confirming the correct date of accident.${htmlList([
          ipDateLine(vars.dateA, vars.dateAPage, '[Date A]', '[Page A]'),
          ipDateLine(vars.dateB, vars.dateBPage, '[Date B]', '[Page B]'),
        ], '[Date discrepancy]')}`,
        PROCEED_HYPHEN,
        SIGN_OFF,
      ].join('<br/><br/>');
      return { subject: draftSubject(this.name, claimantShortLabel(vars)), bodyHtml };
    },
  },
  {
    id: 'draft-no-ip-report',
    name: '(DRAFT) No IP Report',
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
        'Kindly note that we require an Industrial Psychologist report in order to perform Loss of Earnings calculations.',
        'Kindly assist by providing an Industrial Psychologist report.',
        PROCEED_SPACE,
        SIGN_OFF,
      ].join('<br/><br/>');
      return { subject: draftSubject(this.name, claimantShortLabel(vars)), bodyHtml };
    },
  },
];

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

  const selectedTemplate = TEMPLATES.find((t) => t.id === selectedTemplateId) || TEMPLATES[0];

  useEffect(() => {
    const template = TEMPLATES.find(t => t.id === selectedTemplateId) || TEMPLATES[0];

    if (template.fields) {
      setParsedKeys({ subject: [], body: [] });
      setVariables(initialVariables(template));
      setStatus({ msg: '', type: '' });
      return;
    }

    setParsedKeys({
      subject: extractPlaceholderKeys(template.subject),
      body: extractPlaceholderKeys(template.body),
    });
    setVariables(initialVariables(template));
    setStatus({ msg: '', type: '' });
  }, [selectedTemplateId]);

  const handleVarChange = (key, val) => {
    setVariables(prev => ({ ...prev, [key]: val }));
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

  const logEmailUsage = (action, deliveryChannel) => {
    const payload = {
      action: 'LOG_EMAIL_USAGE',
      userName: localStorage.getItem('username') || 'Unknown User',
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      claimant: variables.claimantFullName || variables['Claimant Name'] || '',
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
    try {
      const blobHtml = new Blob([compiledContent.htmlBody], { type: "text/html" });
      const blobText = new Blob([compiledContent.htmlBody.replace(/<[^>]*>?/gm, '')], { type: "text/plain" });
      const data = [new ClipboardItem({ "text/plain": blobText, "text/html": blobHtml })];

      navigator.clipboard.write(data).then(() => {
        setStatus({ msg: 'Rich text copied! Paste directly into Gmail.', type: 'success' });
        logEmailUsage('Copy HTML', 'Clipboard');
        setTimeout(() => setStatus({ msg: '', type: '' }), 3000);
      });
    } catch (err) {
      navigator.clipboard.writeText(compiledContent.htmlBody.replace(/<br\/>/g, '\n').replace(/<[^>]*>?/gm, ''));
      setStatus({ msg: 'Plain text copied to clipboard.', type: 'success' });
      logEmailUsage('Copy plain text', 'Clipboard');
    }
  };

  const connectGmail = async () => {
    setStatus({ msg: 'Connecting Google account for Gmail drafts...', type: 'info' });
    try {
      await requestGmailAccessToken();
      setGmailLinked(true);
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

  const pushDraftViaGmailApi = async () => {
    await createGmailDraft({
      subject: compiledContent.subject,
      htmlBody: compiledContent.htmlBody,
    });
    logEmailUsage('Push to Gmail', 'Gmail OAuth');
    setStatus({
      msg: 'Draft created in your Gmail account. Open Gmail → Drafts to review and send.',
      type: 'success',
    });
  };

  const pushToGmail = async () => {
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
        htmlBody: compiledContent.htmlBody,
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
  const structuredRows = structuredFields
    ? structuredFields.reduce((rows, field) => {
        const previous = rows[rows.length - 1];
        if (field.row && previous?.[0]?.row === field.row) {
          previous.push(field);
        } else {
          rows.push([field]);
        }
        return rows;
      }, [])
    : null;
  const fieldCount = structuredFields ? structuredFields.length : allUniqueKeys.length;

  const renderStructuredField = (field) => {
    if (field.type === 'select') {
      return (
        <select
          value={variables[field.key] || ''}
          onChange={(e) => handleVarChange(field.key, e.target.value)}
          className={`${INPUT_CLASS} appearance-none cursor-pointer`}
        >
          <option value="">Select {field.label.toLowerCase()}</option>
          {(field.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
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
                className={INPUT_CLASS}
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

    return (
      <input
        type="text"
        value={variables[field.key] || ''}
        onChange={(e) => handleVarChange(field.key, e.target.value)}
        placeholder={field.placeholder || `Enter ${field.label}...`}
        className={INPUT_CLASS}
      />
    );
  };

  return (
    <div className="h-full flex overflow-hidden bg-slate-50 dark:bg-slate-900/50">
      
      {/* COLUMN 1: TEMPLATE & VARIABLES */}
      <div className="w-[380px] shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-800 z-10">
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
                {TEMPLATES.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                2. Template Variables
              </label>
              <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-2 py-1 rounded-full border border-amber-500/20">
                {fieldCount} DETECTED
              </span>
            </div>

            {structuredFields ? (
              <div className="space-y-4">
                {structuredRows.map((row) => (
                  <div
                    key={row.map((field) => field.key).join('-')}
                    className={row.length > 1 ? 'grid grid-cols-2 gap-2' : ''}
                  >
                    {row.map((field) => (
                      <div key={field.key} className="min-w-0">
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">{field.label}</label>
                        {renderStructuredField(field)}
                      </div>
                    ))}
                  </div>
                ))}
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

      {/* COLUMN 2: LIVE PREVIEW & EXPORT */}
      <div className="flex-1 flex flex-col relative bg-slate-200/60 dark:bg-[#0f172a]">
        <div className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold tracking-wide uppercase text-slate-500 dark:text-slate-400">HTML Compiled</span>
          </div>
          <div className="flex gap-3">
            {gmailLinked ? (
              <button
                type="button"
                onClick={disconnectGmail}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                title="Disconnect Gmail OAuth"
              >
                <CheckCircle2 className="w-4 h-4" /> Gmail connected
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
              disabled={isPushing}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50"
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

            <div
              className="email-preview-body p-8 text-sm text-black leading-relaxed min-h-[400px] outline-none"
              dangerouslySetInnerHTML={{ __html: compiledContent.htmlBody }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
