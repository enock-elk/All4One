// Gmail draft creation via Google Identity Services (OAuth).
// Firebase Google sign-in only returns an ID token (email/profile). It does not
// give the Gmail API an access token — especially on GitHub Pages, where COOP
// breaks the Firebase popup helper.

import { captureGoogleIdentity, rememberWorkspaceName } from './workspace-identity.js';

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.compose';
const GMAIL_IDENTITY_SCOPE = 'https://www.googleapis.com/auth/userinfo.profile';
const TOKEN_KEY = 'all4one_gmail_access_token';
const TOKEN_EXP_KEY = 'all4one_gmail_token_exp';
const LINKED_KEY = 'all4one_gmail_linked';
const HINT_KEY = 'all4one_gmail_login_hint';
const CLIENT_ID_CACHE_KEY = 'all4one_google_web_client_id';
const EMAIL_SESSION_KEY = 'all4one_email_tab_visited';
const SILENT_FAIL_KEY = 'all4one_gmail_silent_fails';
// Refresh token sealed by the gmailAuth Cloud Function; only that function can read it.
const SEAL_KEY = 'all4one_gmail_refresh_seal';
const BACKEND_READY_KEY = 'all4one_gmail_backend_ready';
const DEFAULT_GMAIL_AUTH_URL = 'https://us-central1-all4one-nexus.cloudfunctions.net/gmailAuth';

/** Optional override in index.html: window.ALL4ONE_GMAIL_CLIENT_ID = '....apps.googleusercontent.com' */
export function getGmailClientId() {
  return (typeof window !== 'undefined' && window.ALL4ONE_GMAIL_CLIENT_ID) || '';
}

/** Optional override in index.html: window.ALL4ONE_GMAIL_AUTH_URL = 'https://…/gmailAuth' ('' disables it). */
function gmailAuthUrl() {
  if (typeof window !== 'undefined' && typeof window.ALL4ONE_GMAIL_AUTH_URL === 'string') {
    return window.ALL4ONE_GMAIL_AUTH_URL;
  }
  return DEFAULT_GMAIL_AUTH_URL;
}

function loadGisScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Gmail OAuth requires a browser'));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
  });
}

function readStore(store, key) {
  try { return store.getItem(key); } catch { return null; }
}

function writeStore(store, key, value) {
  try { store.setItem(key, value); } catch { /* private mode or a full disk */ }
}

function removeStore(store, key) {
  try { store.removeItem(key); } catch { /* ignore */ }
}

function getCachedToken() {
  const token = readStore(localStorage, TOKEN_KEY) || readStore(sessionStorage, TOKEN_KEY);
  const exp = Number(readStore(localStorage, TOKEN_EXP_KEY) || readStore(sessionStorage, TOKEN_EXP_KEY) || 0);
  if (token && exp > Date.now() + 60_000) {
    if (!readStore(localStorage, TOKEN_KEY)) cacheToken(token, Math.max(60, Math.round((exp - Date.now()) / 1000)));
    return token;
  }
  return null;
}

function cacheToken(token, expiresInSeconds = 3500) {
  const exp = String(Date.now() + expiresInSeconds * 1000);
  writeStore(localStorage, TOKEN_KEY, token);
  writeStore(localStorage, TOKEN_EXP_KEY, exp);
  writeStore(localStorage, LINKED_KEY, '1');
  removeStore(sessionStorage, TOKEN_KEY);
  removeStore(sessionStorage, TOKEN_EXP_KEY);
  clearSilentFails();
}

export function hasPriorGmailGrant() {
  return readStore(localStorage, LINKED_KEY) === '1' || Boolean(readStore(localStorage, TOKEN_KEY)) || hasLastingGmailAccess();
}

/** True when drafts go through the gmailAuth function and need no hourly sign-in. */
export function hasLastingGmailAccess() {
  return Boolean(readStore(localStorage, SEAL_KEY));
}

function clearLastingGmailAccess() {
  removeStore(localStorage, SEAL_KEY);
}

function backendError(status, data) {
  const err = new Error(data?.message || `Gmail connection service error (HTTP ${status}).`);
  err.code = `gmail/${data?.error || 'backend_error'}`;
  err.status = status;
  return err;
}

async function callGmailBackend(action, payload = {}) {
  const url = gmailAuthUrl();
  if (!url) throw backendError(503, { error: 'not_configured', message: 'Lasting Gmail connection is turned off.' });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XmlHttpRequest' },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw backendError(res.status, data);
  return data;
}

/**
 * Checks once per browser session whether the gmailAuth function is deployed
 * and configured. Kept short so Connect still runs inside the click's popup
 * allowance.
 */
async function probeGmailBackend() {
  const cached = readStore(sessionStorage, BACKEND_READY_KEY);
  if (cached === '1' || cached === '0') return cached === '1';
  const url = gmailAuthUrl();
  let ready = false;
  if (url) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 2500) : null;
    try {
      const res = await fetch(url, { method: 'GET', signal: controller?.signal });
      const data = await res.json().catch(() => ({}));
      ready = res.ok && data?.ready === true;
    } catch {
      ready = false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  writeStore(sessionStorage, BACKEND_READY_KEY, ready ? '1' : '0');
  return ready;
}

/** Warm GIS, the OAuth client ID and the backend probe so Connect opens Google quickly. */
export function prepareGmailConnect() {
  if (typeof window === 'undefined') return;
  loadGisScript().catch(() => {});
  discoverGoogleWebClientId().catch(() => {});
  probeGmailBackend().catch(() => {});
}

function loginHint() {
  return readStore(localStorage, HINT_KEY) || '';
}

function rememberLoginHint(email) {
  const clean = String(email || '').trim();
  if (clean.includes('@')) writeStore(localStorage, HINT_KEY, clean);
}

function rememberGmailAccount(accessToken) {
  if (!accessToken) return;
  fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => rememberLoginHint(data?.emailAddress))
    .catch(() => {});
}

export function clearLiveGmailToken() {
  removeStore(localStorage, TOKEN_KEY);
  removeStore(localStorage, TOKEN_EXP_KEY);
  removeStore(sessionStorage, TOKEN_KEY);
  removeStore(sessionStorage, TOKEN_EXP_KEY);
}

export function clearGmailToken() {
  const sealed = readStore(localStorage, SEAL_KEY);
  if (sealed) callGmailBackend('revoke', { sealed }).catch(() => {});
  clearLastingGmailAccess();
  clearLiveGmailToken();
  removeStore(localStorage, LINKED_KEY);
  removeStore(localStorage, HINT_KEY);
}

export function isGmailConnected() {
  return hasLastingGmailAccess() || Boolean(getCachedToken());
}

const GMAIL_RENEW_SOON_MS = 12 * 60 * 1000;

export function gmailTokenExpiresAt() {
  const exp = Number(readStore(localStorage, TOKEN_EXP_KEY) || readStore(sessionStorage, TOKEN_EXP_KEY) || 0);
  return Number.isFinite(exp) ? exp : 0;
}

/** True while a cached token is still valid but inside the renew window. */
export function gmailSessionNeedsRenewSoon(withinMs = GMAIL_RENEW_SOON_MS) {
  if (hasLastingGmailAccess() || !isGmailConnected()) return false;
  const exp = gmailTokenExpiresAt();
  if (!exp) return false;
  const left = exp - Date.now();
  return left > 0 && left <= withinMs;
}

export function markEmailSessionVisited() {
  writeStore(sessionStorage, EMAIL_SESSION_KEY, '1');
}

export function hasEmailSessionVisit() {
  return readStore(sessionStorage, EMAIL_SESSION_KEY) === '1';
}

function silentFailCount() {
  return Number(readStore(sessionStorage, SILENT_FAIL_KEY) || 0);
}

function bumpSilentFail() {
  writeStore(sessionStorage, SILENT_FAIL_KEY, String(silentFailCount() + 1));
}

function clearSilentFails() {
  removeStore(sessionStorage, SILENT_FAIL_KEY);
}

export function shouldOfferGmailConnect() {
  return hasEmailSessionVisit() && silentFailCount() >= 3 && !isGmailConnected();
}

function firebaseApiKey() {
  try {
    return window.firebase?.app?.()?.options?.apiKey || '';
  } catch {
    return '';
  }
}

async function discoverGoogleWebClientId() {
  const configured = getGmailClientId();
  if (configured) return configured;

  const cached = readStore(localStorage, CLIENT_ID_CACHE_KEY) || readStore(sessionStorage, CLIENT_ID_CACHE_KEY);
  if (cached) return cached;

  const apiKey = firebaseApiKey();
  if (!apiKey) return '';

  const continueUri = `${window.location.origin}${window.location.pathname || '/'}`;
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ continueUri, providerId: 'google.com' }),
  });
  const data = await res.json().catch(() => ({}));
  const match = String(data.authUri || '').match(/[?&]client_id=([^&]+)/);
  if (!match) return '';
  const clientId = decodeURIComponent(match[1]);
  writeStore(localStorage, CLIENT_ID_CACHE_KEY, clientId);
  return clientId;
}

export function describeGmailConnectError(err) {
  const code = err?.code || '';
  const message = String(err?.message || '');
  if (/^gmail\/(consent_required|scope_missing|reauth_required|session-expired|lasting-failed)$/.test(code)) {
    return message;
  }
  const host = typeof location !== 'undefined' ? location.hostname : '';
  const domain = host || 'enock-elk.github.io';
  if (
    code === 'auth/unauthorized-domain' ||
    /unauthorized-domain/i.test(message) ||
    /not authorized for OAuth/i.test(message)
  ) {
    return (
      `Firebase will not open Google sign-in from ${domain}. ` +
      `In Firebase Console → Authentication → Settings → Authorized domains, ` +
      `click Add domain and enter "${domain}" (hostname only — no https:// and no /All4One/docs). ` +
      `Wait about a minute, then try Connect Gmail again.`
    );
  }
  if (
    code === 'auth/operation-not-allowed' ||
    /operation-not-allowed/i.test(message) ||
    /sign-in provider is disabled/i.test(message)
  ) {
    return (
      'Google sign-in is turned off for this Firebase project. ' +
      'Anonymous login can still succeed (the silent GUARDIAN line in the console). ' +
      'In Firebase Console → Authentication → Sign-in method, open Google, turn Enable on, ' +
      'choose a project support email, and Save. Then hard-refresh and try Connect Gmail again.'
    );
  }
  if (
    /origin is not allowed|origin_mismatch|The given origin/i.test(message)
  ) {
    return (
      `This site (${domain}) is missing from the Google OAuth web client. ` +
      `In Google Cloud → Google Auth Platform → Clients, open the Web client and add ` +
      `https://${domain} under Authorized JavaScript origins (no path). Save, wait a minute, then try again.`
    );
  }
  if (
    /did not return a Gmail access token/i.test(message) ||
    /access_denied|access token/i.test(message)
  ) {
    return (
      'Google signed you in but did not grant Gmail draft access. ' +
      'Allow “Manage drafts and send emails” on the Google screen. ' +
      'Actuary work accounts can use this Internal app; personal Gmail cannot. ' +
      'Also add this site under Google Auth Platform → Clients → Web client → Authorized JavaScript origins.'
    );
  }
  return message || 'Gmail connection failed.';
}

function extractGoogleAccessToken(result, credential) {
  return (
    credential?.accessToken ||
    result?.credential?.accessToken ||
    result?._tokenResponse?.oauthAccessToken ||
    ''
  );
}

function requestGmailAccessTokenViaGis(clientId, { prompt = 'consent' } = {}) {
  const hint = loginHint();
  return loadGisScript().then(() => new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: `${GMAIL_SCOPE} ${GMAIL_IDENTITY_SCOPE}`,
      ...(hint ? { login_hint: hint } : {}),
      callback: (resp) => {
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error));
          return;
        }
        if (!resp.access_token) {
          reject(new Error('Google sign-in did not return a Gmail access token.'));
          return;
        }
        cacheToken(resp.access_token, Number(resp.expires_in) || 3500);
        captureGoogleIdentity(resp.access_token);
        rememberGmailAccount(resp.access_token);
        resolve(resp.access_token);
      },
      error_callback: (err) => {
        reject(new Error(err?.message || err?.type || 'Gmail sign-in popup was closed.'));
      },
    });
    client.requestAccessToken(hint ? { prompt, login_hint: hint } : { prompt });
  }));
}

function requestGmailCodeViaGis(clientId) {
  const hint = loginHint();
  return loadGisScript().then(() => new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: `${GMAIL_SCOPE} ${GMAIL_IDENTITY_SCOPE}`,
      ux_mode: 'popup',
      ...(hint ? { login_hint: hint } : {}),
      callback: (resp) => {
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error));
          return;
        }
        if (!resp.code) {
          reject(new Error('Google sign-in did not return a Gmail access token.'));
          return;
        }
        resolve(resp.code);
      },
      error_callback: (err) => {
        const closed = new Error(err?.message || err?.type || 'Gmail sign-in popup was closed.');
        closed.code = `gmail/${err?.type || 'popup_closed'}`;
        reject(closed);
      },
    });
    client.requestCode();
  }));
}

/** One consent: the gmailAuth function swaps the code for a refresh token and returns it sealed. */
async function connectLastingGmail(clientId) {
  const code = await requestGmailCodeViaGis(clientId);
  const data = await callGmailBackend('exchange', { code, clientId });
  if (!data?.sealed) throw backendError(502, { error: 'exchange_failed', message: 'Gmail connection service returned no session.' });
  writeStore(localStorage, SEAL_KEY, data.sealed);
  if (data.accessToken) {
    cacheToken(data.accessToken, Number(data.expiresIn) || 3500);
    captureGoogleIdentity(data.accessToken);
    rememberGmailAccount(data.accessToken);
  } else {
    writeStore(localStorage, LINKED_KEY, '1');
    clearSilentFails();
  }
  return data.accessToken || 'lasting';
}

function isUserStop(err) {
  return /^gmail\/(popup_closed|popup_failed_to_open|consent_required|scope_missing)$/.test(err?.code || '') ||
    /access_denied/i.test(String(err?.message || ''));
}

/**
 * Background session checks must never call GIS requestAccessToken.
 * Even prompt:'none' briefly opens a Google window and looks like spam.
 * Validate the cached token with a quiet API call instead.
 */
async function validateCachedGmailToken(token) {
  if (!token) return false;
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      clearSilentFails();
      return true;
    }
    if (res.status === 401) clearLiveGmailToken();
    return false;
  } catch {
    // Offline / blocked — keep the cached token until Connect or Push proves otherwise.
    return true;
  }
}

const LASTING_CHECK_KEY = 'all4one_gmail_lasting_checked_at';
const LASTING_CHECK_EVERY_MS = 15 * 60 * 1000;

async function validateLastingGmailAccess() {
  const last = Number(readStore(sessionStorage, LASTING_CHECK_KEY) || 0);
  if (Date.now() - last < LASTING_CHECK_EVERY_MS) return true;
  try {
    await callGmailBackend('status', { sealed: readStore(localStorage, SEAL_KEY) });
    writeStore(sessionStorage, LASTING_CHECK_KEY, String(Date.now()));
    clearSilentFails();
    return true;
  } catch (err) {
    if (err?.code === 'gmail/reauth_required') {
      clearLastingGmailAccess();
      clearLiveGmailToken();
      return false;
    }
    // Offline or the function is cold/unavailable: keep the connection.
    return true;
  }
}

export async function restoreGmailSession() {
  if (hasLastingGmailAccess()) {
    const ok = await validateLastingGmailAccess();
    if (!ok) bumpSilentFail();
    return ok;
  }
  const token = getCachedToken();
  if (!token) {
    if (hasPriorGmailGrant()) bumpSilentFail();
    return false;
  }
  const ok = await validateCachedGmailToken(token);
  if (!ok) bumpSilentFail();
  return ok;
}

async function requestGmailAccessTokenViaFirebase() {
  const fb = typeof window !== 'undefined' ? window.firebase : null;
  if (!fb?.auth) {
    throw new Error('Firebase is not loaded. Refresh the page and try again.');
  }

  const provider = new fb.auth.GoogleAuthProvider();
  provider.addScope(GMAIL_SCOPE);
  provider.addScope(GMAIL_IDENTITY_SCOPE);
  provider.setCustomParameters({ prompt: 'consent', include_granted_scopes: 'true' });

  const current = fb.auth().currentUser;
  const wasAnonymous = current?.isAnonymous;
  let result;
  try {
    result = wasAnonymous
      ? await current.linkWithPopup(provider)
      : await fb.auth().signInWithPopup(provider);
  } catch (err) {
    if (
      wasAnonymous &&
      (err?.code === 'auth/credential-already-in-use' ||
        err?.code === 'auth/email-already-in-use' ||
        err?.code === 'auth/account-exists-with-different-credential')
    ) {
      result = await fb.auth().signInWithPopup(provider);
    } else {
      throw err;
    }
  }

  const credential = fb.auth.GoogleAuthProvider.credentialFromResult(result);
  const accessToken = extractGoogleAccessToken(result, credential);
  if (!accessToken) {
    throw new Error('Google sign-in did not return a Gmail access token.');
  }

  if (fb.auth().currentUser && !fb.auth().currentUser.isAnonymous) {
    await fb.auth().signOut();
    await fb.auth().signInAnonymously();
  }

  rememberWorkspaceName(result?.user?.displayName || result?.user?.email || '');
  rememberLoginHint(result?.user?.email || '');
  cacheToken(accessToken);
  captureGoogleIdentity(accessToken);
  rememberGmailAccount(accessToken);
  return accessToken;
}

function sessionExpiredError() {
  const expired = new Error('Gmail session expired. Connect Gmail again.');
  expired.code = 'gmail/session-expired';
  return expired;
}

export async function requestGmailAccessToken({ interactive = true, force = false } = {}) {
  if (!force) {
    const cached = getCachedToken();
    if (cached) return cached;
    if (hasLastingGmailAccess() && !interactive) return 'lasting';
  }

  // Non-interactive: never open Google UI. Push/create must use Connect first.
  if (!interactive) throw sessionExpiredError();

  try {
    const clientId = await discoverGoogleWebClientId();
    if (clientId && await probeGmailBackend()) {
      try {
        return await connectLastingGmail(clientId);
      } catch (lastingErr) {
        if (isUserStop(lastingErr)) throw lastingErr;
        console.warn('Lasting Gmail connection failed; using hourly sign-in for this session.', lastingErr);
        writeStore(sessionStorage, BACKEND_READY_KEY, '0');
        const fallback = new Error(
          `Lasting Gmail connection failed (${lastingErr?.message || 'server error'}). ` +
          'Click Connect Gmail again to connect for this session.',
        );
        fallback.code = 'gmail/lasting-failed';
        throw fallback;
      }
    }
    if (clientId) {
      try {
        // Explicit Connect only. After the first grant, prompt '' reuses it
        // without another consent screen.
        return await requestGmailAccessTokenViaGis(clientId, { prompt: hasPriorGmailGrant() ? '' : 'consent' });
      } catch (gisErr) {
        console.warn('Gmail GIS token request failed, trying Firebase popup.', gisErr);
        try {
          return await requestGmailAccessTokenViaFirebase();
        } catch {
          throw gisErr;
        }
      }
    }
    return await requestGmailAccessTokenViaFirebase();
  } catch (err) {
    const wrapped = new Error(describeGmailConnectError(err));
    wrapped.code = err?.code;
    wrapped.cause = err;
    throw wrapped;
  }
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function rfc2047Encode(text) {
  return `=?UTF-8?B?${utf8ToBase64(String(text || ''))}?=`;
}

function foldBase64(b64) {
  return String(b64 || '').replace(/.{1,76}/g, '$&\r\n').trim();
}

export function buildMimeMessage({ to, cc, subject, htmlBody }) {
  const encodedBody = foldBase64(utf8ToBase64(htmlBody || ''));
  const headers = [
    `To: ${to}`,
    cc ? `Cc: ${cc}` : null,
    `Subject: ${rfc2047Encode(subject || '(DRAFT) Email')}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
  ].filter((line) => line !== null);

  // RFC 5322 requires an empty line between headers and body. Do not use
  // filter(Boolean) here: it removes that separator and Gmail parses the
  // encoded HTML as another malformed header, resulting in an empty draft.
  return `${headers.join('\r\n')}\r\n\r\n${encodedBody}`;
}

function toBase64Url(str) {
  return utf8ToBase64(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function postGmailDraft(token, raw) {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: { raw } }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function createGmailDraft({ subject, htmlBody, to, cc }) {
  const raw = toBase64Url(buildMimeMessage({
    to: to || 'namir@actuaryconsulting.co.za',
    cc: cc || 'actuarialteam@actuaryconsulting.co.za',
    subject: subject || '(DRAFT) Email',
    htmlBody: htmlBody || '',
  }));

  if (hasLastingGmailAccess()) {
    try {
      const data = await callGmailBackend('draft', { sealed: readStore(localStorage, SEAL_KEY), raw });
      clearSilentFails();
      return data.draft;
    } catch (err) {
      if (err?.code === 'gmail/reauth_required') {
        clearLastingGmailAccess();
        clearLiveGmailToken();
        throw sessionExpiredError();
      }
      // Backend down: a still-valid browser token can carry this push.
      if (!getCachedToken()) throw err;
      console.warn('Gmail connection service failed; using the browser token.', err);
    }
  }

  const token = getCachedToken();
  if (!token) throw sessionExpiredError();
  const { res, data } = await postGmailDraft(token, raw);
  if (res.status === 401) {
    clearLiveGmailToken();
    throw sessionExpiredError();
  }
  if (!res.ok) {
    throw new Error(data?.error?.message || `Gmail API error (HTTP ${res.status})`);
  }

  return data;
}
