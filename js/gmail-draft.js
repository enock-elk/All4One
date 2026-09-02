// Gmail draft creation via Google Identity Services (OAuth) — fallback when GAS lacks CREATE_DRAFT.

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.compose';
const TOKEN_KEY = 'all4one_gmail_access_token';
const TOKEN_EXP_KEY = 'all4one_gmail_token_exp';

/** Set in index.html: window.ALL4ONE_GMAIL_CLIENT_ID = '....apps.googleusercontent.com' */
export function getGmailClientId() {
  return (typeof window !== 'undefined' && window.ALL4ONE_GMAIL_CLIENT_ID) || '';
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

function getCachedToken() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const exp = Number(sessionStorage.getItem(TOKEN_EXP_KEY) || 0);
  if (token && exp > Date.now() + 60_000) return token;
  return null;
}

function cacheToken(token, expiresInSeconds = 3500) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(TOKEN_EXP_KEY, String(Date.now() + expiresInSeconds * 1000));
}

export function clearGmailToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_EXP_KEY);
}

export function isGmailConnected() {
  return Boolean(getCachedToken());
}

async function requestGmailAccessTokenViaFirebase() {
  const fb = typeof window !== 'undefined' ? window.firebase : null;
  if (!fb?.auth) {
    throw new Error('Firebase is not loaded. Refresh the page and try again.');
  }

  const provider = new fb.auth.GoogleAuthProvider();
  provider.addScope(GMAIL_SCOPE);
  provider.setCustomParameters({ prompt: 'consent' });

  const wasAnonymous = fb.auth().currentUser?.isAnonymous;
  const result = await fb.auth().signInWithPopup(provider);
  const credential = fb.auth.GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;

  if (!accessToken) {
    throw new Error('Google sign-in did not return a Gmail access token.');
  }

  if (wasAnonymous) {
    await fb.auth().signOut();
    await fb.auth().signInAnonymously();
  }

  cacheToken(accessToken);
  return accessToken;
}

export async function requestGmailAccessToken() {
  const cached = getCachedToken();
  if (cached) return cached;

  const clientId = getGmailClientId();
  if (clientId) {
    await loadGisScript();
    return new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GMAIL_SCOPE,
        callback: (resp) => {
          if (resp.error) {
            reject(new Error(resp.error_description || resp.error));
            return;
          }
          cacheToken(resp.access_token, Number(resp.expires_in) || 3500);
          resolve(resp.access_token);
        },
      });
      client.requestAccessToken({ prompt: 'consent' });
    });
  }

  return requestGmailAccessTokenViaFirebase();
}

function buildMimeMessage({ to, cc, subject, htmlBody }) {
  const lines = [
    `To: ${to}`,
    cc ? `Cc: ${cc}` : null,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    htmlBody,
  ].filter(Boolean);
  return lines.join('\r\n');
}

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createGmailDraft({ subject, htmlBody, to, cc }) {
  const token = await requestGmailAccessToken();
  const raw = toBase64Url(buildMimeMessage({
    to: to || 'namir@actuaryconsulting.co.za',
    cc: cc || 'actuarialteam@actuaryconsulting.co.za',
    subject: subject || '(DRAFT) Email',
    htmlBody: htmlBody || '',
  }));

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: { raw } }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) clearGmailToken();
    throw new Error(data?.error?.message || `Gmail API error (HTTP ${res.status})`);
  }

  return data;
}
