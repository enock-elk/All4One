import React, { useState, useEffect, useMemo } from 'react';
import { 
  Mail, 
  Send, 
  Copy, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  FileText
} from 'lucide-react';
import { AC_LOGO_DATA_URI } from './ac-logo-b64.js';
import {
  createGmailDraft,
  isGmailConnected,
  requestGmailAccessToken,
  clearGmailToken,
} from '../gmail-draft.js';
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbw-M9kVkSSXKuJ49tohaconx99-l5VcbU1xSNeUTccX2gs0prok3LltyTyO7mdNKtm8/exec";

// Brand colours from official Actuary Consulting signature
const SIG = {
  tan: '#A98C68',
  logoTan: '#B6946A',
  logoGrey: '#8D8D8D',
  label: '#555555',
  text: '#777777',
  link: '#1155cc',
  disclaimer: '#999999',
};

// Logo native 930×268 — width tracks address line via table layout below

// Signature HTML with embedded transparent logo image
const getSignatureHtml = () => `
<br>
<div style="font-family: Verdana, Geneva, sans-serif; line-height: 1.35; color: ${SIG.tan};">
  <p style="margin: 0; font-size: 12pt; font-weight: bold; color: ${SIG.tan};">Namir Waisberg</p>
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
      <img src="${AC_LOGO_DATA_URI}" alt="Actuary Consulting" width="302" style="display: block; width: 100%; max-width: 100%; height: auto; border: 0;" />
    </td>
  </tr>
</table>
<p style="margin: 0; font-family: Verdana, Geneva, sans-serif; font-size: 7.5pt; color: ${SIG.disclaimer}; text-align: justify; line-height: 1.35;">
  The information contained in this email is confidential and may be subject to legal privilege. The content of this email, which may include one or more attachments, is strictly confidential, and is intended solely for the use of the named recipient/s. If you are not the intended recipient, you cannot use, copy, distribute, disclose or retain the email or any part of its contents or take any action in reliance on it. If you have received this email in error, please email the sender by replying to this message and to permanently delete it and all attachments from your computer. All reasonable precautions have been taken to ensure that no viruses are present in this email and the company cannot accept responsibility for any loss or damage arising from the use of this email or attachments.
</p>
`;

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
  }
];

export default function EmailEngine() {
  const [selectedTemplateId, setSelectedTemplateId] = useState(TEMPLATES[0].id);
  const [variables, setVariables] = useState({});
  const [parsedKeys, setParsedKeys] = useState({ subject: [], body: [] });
  const [status, setStatus] = useState({ msg: '', type: '' });
  const [isPushing, setIsPushing] = useState(false);
  const [gmailLinked, setGmailLinked] = useState(() => isGmailConnected());

  useEffect(() => {
    const template = TEMPLATES.find(t => t.id === selectedTemplateId) || TEMPLATES[0];
    const regex = /<<([^>]+)>>/g;
    
    const subjectKeys = [];
    let match;
    while ((match = regex.exec(template.subject)) !== null) {
      if (!subjectKeys.includes(match[1])) subjectKeys.push(match[1]);
    }

    const bodyKeys = [];
    while ((match = regex.exec(template.body)) !== null) {
      if (!bodyKeys.includes(match[1])) bodyKeys.push(match[1]);
    }

    setParsedKeys({ subject: subjectKeys, body: bodyKeys });

    const newVars = {};
    [...subjectKeys, ...bodyKeys].forEach(key => {
      newVars[key] = '';
    });
    setVariables(newVars);
    setStatus({ msg: '', type: '' });
  }, [selectedTemplateId]);

  const handleVarChange = (key, val) => {
    setVariables(prev => ({ ...prev, [key]: val }));
  };

  const compiledContent = useMemo(() => {
    const template = TEMPLATES.find(t => t.id === selectedTemplateId) || TEMPLATES[0];
    
    let compSubject = template.subject;
    let compBody = template.body;

    Object.keys(variables).forEach(key => {
      const val = variables[key] || `[${key}]`; 
      const replaceRegex = new RegExp(`<<${key}>>`, 'g');
      compSubject = compSubject.replace(replaceRegex, val);
      compBody = compBody.replace(replaceRegex, val);
    });

    const htmlBody = `<div style="font-family: Verdana, Geneva, sans-serif; font-size: 13px; color: #000; line-height: 1.5;">${compBody.replace(/\n/g, '<br/>')}${getSignatureHtml()}</div>`;

    return { subject: compSubject, htmlBody };
  }, [selectedTemplateId, variables]);

  const copyToClipboard = () => {
    try {
      const blobHtml = new Blob([compiledContent.htmlBody], { type: "text/html" });
      const blobText = new Blob([compiledContent.htmlBody.replace(/<[^>]*>?/gm, '')], { type: "text/plain" });
      const data = [new ClipboardItem({ "text/plain": blobText, "text/html": blobHtml })];

      navigator.clipboard.write(data).then(() => {
        setStatus({ msg: 'Rich text copied! Paste directly into Gmail.', type: 'success' });
        setTimeout(() => setStatus({ msg: '', type: '' }), 3000);
      });
    } catch (err) {
      navigator.clipboard.writeText(compiledContent.htmlBody.replace(/<br\/>/g, '\n').replace(/<[^>]*>?/gm, ''));
      setStatus({ msg: 'Plain text copied to clipboard.', type: 'success' });
    }
  };

  const connectGmail = async () => {
    setStatus({ msg: 'Connecting Google account for Gmail drafts...', type: 'info' });
    try {
      await requestGmailAccessToken();
      setGmailLinked(true);
      setStatus({ msg: 'Gmail connected. You can push drafts directly.', type: 'success' });
    } catch (err) {
      setStatus({ msg: err?.message || 'Gmail connection failed.', type: 'error' });
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
    setStatus({
      msg: 'Draft created in your Gmail account. Open Gmail → Drafts to review and send.',
      type: 'success',
    });
  };

  const pushToGmail = async () => {
    setIsPushing(true);
    setStatus({ msg: 'Pushing draft to Gmail...', type: 'info' });

    try {
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
      const msg = err?.message || 'unknown error';
      if (/oauth|gmail|token|configured/i.test(msg)) {
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
                {allUniqueKeys.length} DETECTED
              </span>
            </div>

            {allUniqueKeys.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No dynamic variables detected.</p>
            ) : (
              <div className="space-y-4">
                {allUniqueKeys.map(key => (
                  <div key={key}>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">{key}</label>
                    {key.toLowerCase().includes('list') || key.toLowerCase().includes('details') ? (
                      <textarea 
                        value={variables[key]}
                        onChange={(e) => handleVarChange(key, e.target.value)}
                        placeholder={`Enter ${key}...`}
                        rows="4"
                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:border-amber-500 dark:text-white transition-all resize-none"
                      />
                    ) : (
                      <input 
                        type="text" 
                        value={variables[key]}
                        onChange={(e) => handleVarChange(key, e.target.value)}
                        placeholder={`Enter ${key}...`}
                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:border-amber-500 dark:text-white transition-all"
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
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col self-start">
            <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-4 border-b border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center gap-4 mb-3">
                <span className="text-slate-400 dark:text-slate-500 font-medium text-sm w-16">To</span>
                <div className="flex-1 border-b border-slate-200 dark:border-slate-700 pb-1">
                  <span className="text-sm text-slate-700 dark:text-slate-300 italic">Recipient selected in Gmail...</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-slate-400 dark:text-slate-500 font-medium text-sm w-16">Subject</span>
                <div className="flex-1 font-semibold text-slate-800 dark:text-slate-100 text-lg border-b border-slate-200 dark:border-slate-700 pb-1">
                  {compiledContent.subject}
                </div>
              </div>
            </div>

            <div 
              className="p-8 text-sm text-slate-800 dark:text-slate-200 leading-relaxed min-h-[400px] outline-none"
              dangerouslySetInnerHTML={{ __html: compiledContent.htmlBody }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
