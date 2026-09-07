// Gmail draft creation via Google Identity Services (OAuth).
// Firebase Google sign-in only returns an ID token (email/profile). It does not
// give the Gmail API an access token — especially on GitHub Pages, where COOP
// breaks the Firebase popup helper.

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.compose';
const TOKEN_KEY = 'all4one_gmail_access_token';
const TOKEN_EXP_KEY = 'all4one_gmail_token_exp';
const CLIENT_ID_CACHE_KEY = 'all4one_google_web_client_id';

/** Optional override in index.html: window.ALL4ONE_GMAIL_CLIENT_ID = '....apps.googleusercontent.com' */
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

  const cached = sessionStorage.getItem(CLIENT_ID_CACHE_KEY);
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
  sessionStorage.setItem(CLIENT_ID_CACHE_KEY, clientId);
  return clientId;
}

export function describeGmailConnectError(err) {
  const code = err?.code || '';
  const message = String(err?.message || '');
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

function requestGmailAccessTokenViaGis(clientId) {
  return loadGisScript().then(() => new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GMAIL_SCOPE,
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
        resolve(resp.access_token);
      },
      error_callback: (err) => {
        reject(new Error(err?.message || err?.type || 'Gmail sign-in popup was closed.'));
      },
    });
    client.requestAccessToken({ prompt: 'consent' });
  }));
}

async function requestGmailAccessTokenViaFirebase() {
  const fb = typeof window !== 'undefined' ? window.firebase : null;
  if (!fb?.auth) {
    throw new Error('Firebase is not loaded. Refresh the page and try again.');
  }

  const provider = new fb.auth.GoogleAuthProvider();
  provider.addScope(GMAIL_SCOPE);
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

  cacheToken(accessToken);
  return accessToken;
}

export async function requestGmailAccessToken() {
  const cached = getCachedToken();
  if (cached) return cached;

  try {
    const clientId = await discoverGoogleWebClientId();
    if (clientId) {
      try {
        return await requestGmailAccessTokenViaGis(clientId);
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
