// Long-lived Gmail draft access for the Draft Email Generator.
//
// The browser gets an authorization code from Google Identity Services (popup
// code flow). This module exchanges it for a refresh token, seals that token
// with AES-256-GCM, and hands the sealed blob back to the browser. Nothing is
// stored server-side. Later calls send the blob back to create drafts, so the
// user consents once instead of signing in every hour.

const crypto = require('node:crypto');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const DRAFTS_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/drafts';
const GMAIL_COMPOSE_SCOPE = 'https://www.googleapis.com/auth/gmail.compose';
const SEAL_PREFIX = 'v1.';
const MAX_RAW_LENGTH = 20 * 1024 * 1024;
const ALLOWED_ORIGIN = /^(https:\/\/enock-elk\.github\.io|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;

class GmailAuthError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

function isAllowedOrigin(origin) {
    return ALLOWED_ORIGIN.test(String(origin || ''));
}

function sealKey(clientSecret) {
    return Buffer.from(crypto.hkdfSync('sha256', Buffer.from(clientSecret, 'utf8'), 'all4one-gmail-seal', 'v1', 32));
}

function seal(payload, clientSecret) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', sealKey(clientSecret), iv);
    const body = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    return SEAL_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

function unseal(sealed, clientSecret) {
    const text = String(sealed || '');
    if (!text.startsWith(SEAL_PREFIX)) {
        throw new GmailAuthError(401, 'reauth_required', 'Gmail connection is missing. Connect Gmail again.');
    }
    try {
        const buf = Buffer.from(text.slice(SEAL_PREFIX.length), 'base64url');
        const decipher = crypto.createDecipheriv('aes-256-gcm', sealKey(clientSecret), buf.subarray(0, 12));
        decipher.setAuthTag(buf.subarray(12, 28));
        const json = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
        const payload = JSON.parse(json);
        if (!payload?.rt || !payload?.cid) throw new Error('incomplete payload');
        return payload;
    } catch {
        throw new GmailAuthError(401, 'reauth_required', 'Gmail connection could not be read. Connect Gmail again.');
    }
}

async function postForm(fetchImpl, url, params) {
    const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString(),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
}

async function revokeToken(fetchImpl, token) {
    if (!token) return;
    try {
        await postForm(fetchImpl, REVOKE_URL, { token });
    } catch {
        // Best effort: the grant may already be gone.
    }
}

async function exchangeCode({ code, clientId, origin }, { clientSecret, fetchImpl }) {
    if (!code) throw new GmailAuthError(400, 'bad_request', 'Missing authorization code.');
    if (!/\.apps\.googleusercontent\.com$/.test(String(clientId || ''))) {
        throw new GmailAuthError(400, 'bad_request', 'Missing or invalid OAuth client ID.');
    }

    // GIS popup codes are usually redeemed with "postmessage"; newer guidance
    // uses the page origin, so retry with it only on redirect_uri_mismatch.
    let data = null;
    for (const redirectUri of ['postmessage', origin].filter(Boolean)) {
        const result = await postForm(fetchImpl, TOKEN_URL, {
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        });
        data = result.data;
        if (result.res.ok) break;
        if (data?.error !== 'redirect_uri_mismatch') {
            throw new GmailAuthError(400, 'exchange_failed', data?.error_description || data?.error || 'Google rejected the sign-in code.');
        }
    }
    if (!data?.access_token) {
        throw new GmailAuthError(400, 'exchange_failed', data?.error_description || data?.error || 'Google rejected the sign-in code.');
    }

    if (!String(data.scope || '').split(/\s+/).includes(GMAIL_COMPOSE_SCOPE)) {
        throw new GmailAuthError(403, 'scope_missing', 'Google did not grant Gmail draft access. Allow “Manage drafts and send emails” and try again.');
    }

    if (!data.refresh_token) {
        // Google only issues a refresh token with a fresh consent. Revoking the
        // grant makes the next Connect show consent again and return one.
        await revokeToken(fetchImpl, data.access_token);
        throw new GmailAuthError(409, 'consent_required', 'Google did not grant lasting access this time. Click Connect Gmail once more and approve the request.');
    }

    return {
        sealed: seal({ rt: data.refresh_token, cid: clientId, iat: Date.now() }, clientSecret),
        accessToken: data.access_token,
        expiresIn: Number(data.expires_in) || 3500,
    };
}

async function refreshAccessToken(payload, { clientSecret, fetchImpl }) {
    const { res, data } = await postForm(fetchImpl, TOKEN_URL, {
        client_id: payload.cid,
        client_secret: clientSecret,
        refresh_token: payload.rt,
        grant_type: 'refresh_token',
    });
    if (res.ok && data?.access_token) {
        return { accessToken: data.access_token, expiresIn: Number(data.expires_in) || 3500 };
    }
    if (data?.error === 'invalid_grant' || data?.error === 'unauthorized_client' || res.status === 401) {
        throw new GmailAuthError(401, 'reauth_required', 'Gmail access was revoked or expired. Connect Gmail again.');
    }
    throw new GmailAuthError(502, 'google_unavailable', data?.error_description || data?.error || `Google token refresh failed (HTTP ${res.status}).`);
}

async function createDraft({ sealed, raw }, deps) {
    if (!raw || typeof raw !== 'string') throw new GmailAuthError(400, 'bad_request', 'Missing draft message.');
    if (raw.length > MAX_RAW_LENGTH) throw new GmailAuthError(413, 'too_large', 'The draft is too large.');
    const { accessToken } = await refreshAccessToken(unseal(sealed, deps.clientSecret), deps);
    const res = await deps.fetchImpl(DRAFTS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { raw } }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new GmailAuthError(401, 'reauth_required', 'Gmail access was revoked. Connect Gmail again.');
    if (!res.ok) throw new GmailAuthError(502, 'gmail_error', data?.error?.message || `Gmail API error (HTTP ${res.status}).`);
    return { draft: { id: data.id || '', messageId: data.message?.id || '' } };
}

async function routeAction(body, origin, deps) {
    const action = String(body?.action || '');
    if (action === 'exchange') return exchangeCode({ code: body.code, clientId: body.clientId, origin }, deps);
    if (action === 'status') {
        await refreshAccessToken(unseal(body.sealed, deps.clientSecret), deps);
        return { ok: true };
    }
    if (action === 'draft') return createDraft(body, deps);
    if (action === 'revoke') {
        try {
            await revokeToken(deps.fetchImpl, unseal(body.sealed, deps.clientSecret).rt);
        } catch {
            // An unreadable blob has nothing left to revoke.
        }
        return { ok: true };
    }
    throw new GmailAuthError(400, 'bad_request', 'Unknown action.');
}

async function handleGmailAuthRequest(req, res, { clientSecret, fetchImpl = fetch }) {
    const origin = req.headers?.origin || '';
    if (isAllowedOrigin(origin)) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Vary', 'Origin');
        res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
        res.set('Access-Control-Max-Age', '3600');
    }

    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method === 'GET') return res.status(200).json({ ready: Boolean(clientSecret) });
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed', message: 'Use POST.' });

    if (!isAllowedOrigin(origin)) {
        return res.status(403).json({ error: 'forbidden', message: 'This origin may not use Gmail drafts.' });
    }
    if (req.headers['x-requested-with'] !== 'XmlHttpRequest') {
        return res.status(403).json({ error: 'forbidden', message: 'Missing X-Requested-With header.' });
    }
    if (!clientSecret) {
        return res.status(503).json({ error: 'not_configured', message: 'GMAIL_OAUTH_CLIENT_SECRET is not set on the function.' });
    }

    try {
        const result = await routeAction(req.body || {}, origin, { clientSecret, fetchImpl });
        return res.status(200).json(result);
    } catch (err) {
        if (err instanceof GmailAuthError) {
            return res.status(err.status).json({ error: err.code, message: err.message });
        }
        console.error('[gmailAuth] Unexpected error:', err);
        return res.status(500).json({ error: 'internal', message: 'Gmail connection failed on the server.' });
    }
}

module.exports = {
    GmailAuthError,
    handleGmailAuthRequest,
    isAllowedOrigin,
    seal,
    unseal,
};
