const test = require('node:test');
const assert = require('node:assert');

const { handleGmailAuthRequest, seal, unseal } = require('../lib/gmailAuth');

const SECRET = 'test-client-secret';
const CLIENT_ID = '123-abc.apps.googleusercontent.com';
const ORIGIN = 'https://enock-elk.github.io';
const COMPOSE = 'https://www.googleapis.com/auth/gmail.compose';

function fakeRes() {
    return {
        statusCode: 0,
        headers: {},
        body: undefined,
        set(key, value) { this.headers[key] = value; return this; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
        send(body) { this.body = body; return this; },
    };
}

function post(body, { origin = ORIGIN, xrw = 'XmlHttpRequest' } = {}) {
    return { method: 'POST', headers: { origin, 'x-requested-with': xrw }, body };
}

function fakeGoogle(routes) {
    const calls = [];
    const fetchImpl = async (url, init = {}) => {
        const params = Object.fromEntries(new URLSearchParams(init.body || ''));
        calls.push({ url, params, init });
        const reply = routes(url, params, init);
        return {
            ok: reply.status >= 200 && reply.status < 300,
            status: reply.status,
            json: async () => reply.body,
        };
    };
    return { fetchImpl, calls };
}

async function run(req, fetchImpl, clientSecret = SECRET) {
    const res = fakeRes();
    await handleGmailAuthRequest(req, res, { clientSecret, fetchImpl });
    return res;
}

test('seal round-trips and rejects tampering', () => {
    const sealed = seal({ rt: 'refresh-1', cid: CLIENT_ID }, SECRET);
    assert.deepStrictEqual(unseal(sealed, SECRET).rt, 'refresh-1');
    assert.throws(() => unseal(sealed, 'other-secret'), { code: 'reauth_required' });
    assert.throws(() => unseal(`${sealed.slice(0, -2)}AA`, SECRET), { code: 'reauth_required' });
});

test('exchange returns a sealed refresh token and an access token', async () => {
    const google = fakeGoogle(() => ({
        status: 200,
        body: { access_token: 'access-1', expires_in: 3599, refresh_token: 'refresh-1', scope: `${COMPOSE} profile` },
    }));
    const res = await run(post({ action: 'exchange', code: 'code-1', clientId: CLIENT_ID }), google.fetchImpl);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.accessToken, 'access-1');
    assert.strictEqual(unseal(res.body.sealed, SECRET).rt, 'refresh-1');
    assert.strictEqual(google.calls[0].params.redirect_uri, 'postmessage');
    assert.strictEqual(google.calls[0].params.client_secret, SECRET);
    assert.strictEqual(res.headers['Access-Control-Allow-Origin'], ORIGIN);
});

test('exchange retries with the page origin on redirect_uri_mismatch', async () => {
    const google = fakeGoogle((url, params) => (params.redirect_uri === 'postmessage'
        ? { status: 400, body: { error: 'redirect_uri_mismatch' } }
        : { status: 200, body: { access_token: 'a', refresh_token: 'r', scope: COMPOSE } }));
    const res = await run(post({ action: 'exchange', code: 'c', clientId: CLIENT_ID }), google.fetchImpl);
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(google.calls.map((c) => c.params.redirect_uri), ['postmessage', ORIGIN]);
});

test('exchange without a refresh token revokes the grant and asks for consent', async () => {
    const google = fakeGoogle((url) => (url.includes('/revoke')
        ? { status: 200, body: {} }
        : { status: 200, body: { access_token: 'access-2', scope: COMPOSE } }));
    const res = await run(post({ action: 'exchange', code: 'c', clientId: CLIENT_ID }), google.fetchImpl);
    assert.strictEqual(res.statusCode, 409);
    assert.strictEqual(res.body.error, 'consent_required');
    assert.ok(google.calls.some((c) => c.url.includes('/revoke') && c.params.token === 'access-2'));
});

test('exchange without Gmail scope is refused', async () => {
    const google = fakeGoogle(() => ({ status: 200, body: { access_token: 'a', refresh_token: 'r', scope: 'profile' } }));
    const res = await run(post({ action: 'exchange', code: 'c', clientId: CLIENT_ID }), google.fetchImpl);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.error, 'scope_missing');
});

test('draft refreshes the token and creates the Gmail draft', async () => {
    const sealed = seal({ rt: 'refresh-1', cid: CLIENT_ID }, SECRET);
    const google = fakeGoogle((url) => (url.includes('/token')
        ? { status: 200, body: { access_token: 'fresh', expires_in: 3599 } }
        : { status: 200, body: { id: 'draft-1', message: { id: 'msg-1' } } }));
    const res = await run(post({ action: 'draft', sealed, raw: 'cmF3' }), google.fetchImpl);
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.body.draft, { id: 'draft-1', messageId: 'msg-1' });
    assert.strictEqual(google.calls[0].params.grant_type, 'refresh_token');
    assert.strictEqual(google.calls[1].init.headers.Authorization, 'Bearer fresh');
    assert.strictEqual(JSON.parse(google.calls[1].init.body).message.raw, 'cmF3');
});

test('revoked refresh token reports reauth_required', async () => {
    const sealed = seal({ rt: 'gone', cid: CLIENT_ID }, SECRET);
    const google = fakeGoogle(() => ({ status: 400, body: { error: 'invalid_grant' } }));
    const res = await run(post({ action: 'status', sealed }), google.fetchImpl);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.error, 'reauth_required');
});

test('revoke calls Google with the refresh token', async () => {
    const sealed = seal({ rt: 'refresh-9', cid: CLIENT_ID }, SECRET);
    const google = fakeGoogle(() => ({ status: 200, body: {} }));
    const res = await run(post({ action: 'revoke', sealed }), google.fetchImpl);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(google.calls[0].params.token, 'refresh-9');
});

test('unknown origins and missing CSRF header are refused', async () => {
    const google = fakeGoogle(() => ({ status: 200, body: {} }));
    const badOrigin = await run(post({ action: 'status' }, { origin: 'https://evil.example' }), google.fetchImpl);
    assert.strictEqual(badOrigin.statusCode, 403);
    assert.strictEqual(badOrigin.headers['Access-Control-Allow-Origin'], undefined);
    const noHeader = await run(post({ action: 'status' }, { xrw: '' }), google.fetchImpl);
    assert.strictEqual(noHeader.statusCode, 403);
    assert.strictEqual(google.calls.length, 0);
});

test('GET reports readiness and OPTIONS answers preflight', async () => {
    const google = fakeGoogle(() => ({ status: 200, body: {} }));
    const ready = await run({ method: 'GET', headers: { origin: ORIGIN } }, google.fetchImpl);
    assert.deepStrictEqual(ready.body, { ready: true });
    const notReady = await run({ method: 'GET', headers: { origin: ORIGIN } }, google.fetchImpl, '');
    assert.deepStrictEqual(notReady.body, { ready: false });
    const preflight = await run({ method: 'OPTIONS', headers: { origin: ORIGIN } }, google.fetchImpl);
    assert.strictEqual(preflight.statusCode, 204);
    assert.match(preflight.headers['Access-Control-Allow-Headers'], /X-Requested-With/);
});
