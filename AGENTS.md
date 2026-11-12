# All4One — Agent handbook

Read this first in any new Cursor session on this repo. It is the source of truth for architecture, sheet logging, deploy pitfalls, and “do not break” conventions.

Related standalone product (legacy):  
`C:\Users\enock\OneDrive\Documents\GitHub\Affidavit Automation\Source Code` — older Affidavit-only app that this Command Center largely absorbed. Prefer All4One for new work.

---

## What this product is

**All4One Command Center** — internal SPA for Actuary Consulting: PDF/document bay, Trello watcher, Case Maker iframe, Affidavit Generator, Draft Email Generator, Salary Inflation.

- **Repo / Pages root for agents:** this folder (`…/All4One/Source Code`).
- **Live site:** GitHub Pages from the committed **`docs/`** snapshot on `main` (legacy “publish branch folder” Pages — not Actions-only Pages yet).
- **Stack:** Vite + React 19 (affidavit + email tabs) + vanilla JS modules for the rest; Google Apps Script web app for sheets/prefs/draft helpers; optional Firebase functions / Gmail OAuth.

Version / changelog: `js/app-version.js` + `package.json` (bump both when shipping user-visible changes).

---

## Directory map (edit source, not the snapshot)

| Path | Role |
|------|------|
| `index.html`, `public/`, `js/` | App shell + most tools (edit these) |
| `js/react/AffidavitAutomation.jsx` | Affidavit Generator UI + Word export + Feedback log |
| `js/react/EmailEngine.jsx` | Draft Email Generator + Gmail push + Email Log |
| `js/gmail-draft.js` | Gmail OAuth / draft MIME |
| `js/workspace-identity.js` | Workspace display name (`localStorage` key `username`) |
| `js/app-version.js` | `APP_VERSION` + changelog shown in UI |
| `gas/Code.gs` | **Must be manually redeployed** to the live Apps Script web app |
| `docs/` | **Generated** GitHub Pages bundle — do not hand-edit; rebuild |
| `dist/` | Vite output (also generated) |
| `AffidavitAutomation/`, `EmailGenerator/`, etc. | Deep-link stub folders/shells |
| `functions/`, `workers/`, `firebase.json` | Backend/worker pieces |
| `.github/workflows/pages.yml` | On `main` push: `npm run build` and commit refreshed `docs/` |

**Commands**

```bash
npm ci
npm run build          # icons → vite → sync docs/ → deep-link stubs
npm run dev            # Vite ~5500
```

After changing `js/` or React sources that users hit on Pages: bump version, `npm run build`, commit `docs/` (or let the Pages workflow rebuild — see pitfalls).

---

## Tabs ↔ code

| UI tab | Tab id | Main code |
|--------|--------|-----------|
| Document Manager | `pdf-manager` | `js/pdf-*.js`, shell in `index.html` |
| Trello Watcher | `dashboard` | `js/trello.js`, `js/trello-*.js` |
| Case Maker | `casemaker` | iframe → separate GAS URL; `js/casemaker*.js` |
| Affidavit Generator | `affidavits` | `js/react/AffidavitAutomation.jsx` |
| Draft Email Generator | `emails` | `js/react/EmailEngine.jsx` |
| Salary Inflation | `salary` | `js/salary-*.js` |

Nav metadata: `js/ui-prefs.js` (`TAB_META`).

---

## Google Sheets + Apps Script (critical)

### Shared workbook (audit trail)

**Spreadsheet:** [Automating Master Affidavit Creation](https://docs.google.com/spreadsheets/d/1twLeKxFlNOjD5HmCqIqdTPg5qd_34twgOetm6AD5AYc)  
**ID:** `1twLeKxFlNOjD5HmCqIqdTPg5qd_34twgOetm6AD5AYc`  
(defined in `gas/Code.gs` as `LEGACY_FEEDBACK_SHEET_ID`)

| Tab | Purpose | Client action |
|-----|---------|---------------|
| **Feedback** (+ **Copy of Feedback**) | Affidavit export / skip feedback — same columns as the old Affidavit Automation app | `LOG_FEEDBACK` |
| **Email Log** | Slim email audit (author, date, time, case name, email type, action) | `LOG_EMAIL_USAGE` |
| **Attorneys & Preferences** (typo in GAS: `Attoneys & Preferences`) | Firm rules for affidavits — bound sheet / `doGet` | GET + rule sync POSTs |

Feedback columns (historical): Author | Date | Time | Case name (`Plaintiff v Defendant (Case: …)`) | Feedback text (often `Feedback Skipped`).

Email Log columns (current slim shape): Email Author | Date | Time | Case Name | Email Type | Action (`Copy HTML` / `Push to Gmail`, etc.).

### Web app URL (do not casually rotate)

Affidavit + Email clients post to the **same** deployment:

```
https://script.google.com/macros/s/AKfycbw-M9kVkSSXKuJ49tohaconx99-l5VcbU1xSNeUTccX2gs0prok3LltyTyO7mdNKtm8/exec
```

- Affidavit: `GOOGLE_API_URL` in `AffidavitAutomation.jsx`
- Email: `GAS_API_URL` in `EmailEngine.jsx`
- Server source of truth in-repo: `gas/Code.gs`

**Case Maker iframe** uses a **different** Apps Script URL (in `index.html` / docs HTML `data-src=…`). Do not confuse the two.

### Payload contracts

**CORS trick:** POST with `Content-Type: text/plain;charset=utf-8` and `JSON.stringify(body)` — avoids browser preflight. Do not switch to `application/json` without testing.

**Affidavit feedback** (`handleFeedbackSubmit`):

```json
{
  "action": "LOG_FEEDBACK",
  "userName": "<workspace name>",
  "caseName": "PLAINTIFF v DEFENDANT (Case: …)",
  "feedback": "Feedback Skipped | <user text>"
}
```

- **Do not** send `source: "ALL4ONE"` for affidavits. Older GAS routed that to a different workbook/tab. Current `Code.gs` always uses legacy Feedback dual-write, but omitting `source` matches the old Affidavit Automation client and stays safe across deployments.

**Email usage** (`logEmailUsage`):

```json
{
  "action": "LOG_EMAIL_USAGE",
  "userName": "<workspace name or Unknown User>",
  "caseName": "<claimant or (no claimant)>",
  "emailType": "<draft label — opening — blocks…>",
  "usageAction": "Copy HTML | Push to Gmail | …"
}
```

No subject/body in the log (privacy / slim audit).

### Deploying `gas/Code.gs` (pitfall #1)

Committing `gas/Code.gs` **does not** update production. Someone with access to the Apps Script project must:

1. Paste/sync `gas/Code.gs` into the bound script project.
2. **Deploy → Manage deployments → Edit** the existing web app → **New version**.
3. Keep the same `/exec` URL (changing the URL breaks both generators until clients are updated).

If Email Log stays empty after a client change, the live script is almost certainly an old revision.

Attorney preferences sheet must remain the script’s **active/bound** spreadsheet (`getActiveSpreadsheet()` / `Attoneys & Preferences`). Feedback/Email Log are opened by ID on the Master Affidavit workbook.

---

## Workspace identity

- Display name lives in `localStorage` key **`username`** (`js/workspace-identity.js`).
- Affidavit export prompts via `ensureWorkspaceName()` before logging.
- Email logging uses `getWorkspaceName() || 'Unknown User'` (does not always block).
- Do not reintroduce a separate `currentUser` key unless you migrate both readers and writers.

---

## Gmail

- Push drafts: `js/gmail-draft.js` (OAuth). Prefer user-connected Gmail over GAS `CREATE_DRAFT` when linked.
- Do not open Google sign-in on tab load; only on explicit **Connect Gmail** (and controlled renew paths). Unprompted popups are a regression.
- OAuth client authorized origins must include the live Pages hostname.

### Lasting connection (`gmailAuth` Cloud Function)

Browser-only Google tokens last one hour and have no refresh token, so users had to reconnect several times a day. The lasting path:

1. **Connect Gmail** opens the GIS *code* popup (`initCodeClient`, `ux_mode: 'popup'`).
2. `functions/lib/gmailAuth.js` (exported as `gmailAuth` in `functions/index.js`) swaps the code for a refresh token. It seals the token with AES-256-GCM, using a key derived from the client secret, and returns the sealed blob.
3. The browser keeps the blob in `localStorage` key `all4one_gmail_refresh_seal`. **Push to Gmail** posts `{action:'draft', sealed, raw}`. The function refreshes the access token and creates the draft. Nothing is stored server-side.
4. If Google returns no refresh token because the account already granted the scope, the function revokes that grant and returns `409 consent_required`. The user clicks Connect once more and gets the consent screen plus a refresh token.
5. `invalid_grant` (access removed in the Google account, or a password change) returns `401 reauth_required`. The client clears the blob and shows **Reconnect Gmail**.

The client probes `GET …/gmailAuth` once per tab session (`{ready:true}`). If the function is missing or not configured, Connect falls back to the hourly token flow. That flow passes `prompt: ''` after the first grant, so a renew normally skips the consent screen. Override or disable the URL with `window.ALL4ONE_GMAIL_AUTH_URL` (empty string disables it).

**One-time setup (needs Firebase project owner on `all4one-nexus`):**

```bash
firebase functions:secrets:set GMAIL_OAUTH_CLIENT_SECRET   # Web client secret of the OAuth client the app uses
firebase deploy --only functions:gmailAuth
```

- The secret must belong to the **same** OAuth client ID the browser uses. That is either `window.ALL4ONE_GMAIL_CLIENT_ID` or the Firebase auto-created Web client, which is found via Identity Toolkit. It is shown in Firebase Console → Authentication → Sign-in method → Google → Web SDK configuration.
- Keep the OAuth consent screen **Internal** (Workspace). An External app in *Testing* status expires refresh tokens after 7 days.
- Rotating the client secret invalidates every sealed blob, so users reconnect once.
- POSTs use `Content-Type: application/json` plus `X-Requested-With: XmlHttpRequest`. The function allows only the Pages origin and localhost (CORS allowlist). This is the Cloud Function, not GAS, so the `text/plain` rule does not apply here.
- Tests: `cd functions && npm run test:gmail`.

---

## Build / Pages pitfalls

1. **`docs/` is the live app** for branch-based Pages. Editing only `js/` without a rebuild leaves github.io on stale hashed bundles.
2. **Workflow** `.github/workflows/pages.yml` rebuilds and commits `docs/` on `main` pushes that are **not** `docs/**`-only. Concurrent local `docs/` commits + CI rebuilds often cause **rebase conflicts** on hashed `docs/assets/*` — resolve by keeping source fixes, then `npm run build` and continue.
3. Root / deep-link HTML may **redirect** into `docs/`. Prefer changing source + rebuild over patching one HTML copy.
4. Service worker (`sw.js` / `docs/sw.js`): prefer network for HTML and hashed JS so deploys are not stuck on stale caches; there is a reload prompt for blank Affidavit/Email tabs after a new build.

---

## Trello Watcher notes

- Auto-download of watch run `.txt` logs is **paused**: `SAVE_WATCH_RUN_TXT = false` in `js/trello.js`. Flip that flag to re-enable; logic remains in place.
- Muted lists should not fire alerts when the fallback worker is in use (see changelog / `trello.js`).

---

## Versioning & commits

- Bump **`package.json`** and **`js/app-version.js`** together; add a short changelog entry (newest first).
- Prefer `main` for shippable fixes after build.
- Do not force-push `main`. If push rejects: `git pull --rebase`, resolve `docs/` via rebuild, then push.
- Do not commit secrets, OAuth client secrets, or personal tokens.

---

## Quick regression checklist

After Affidavit / Email / GAS changes:

- [ ] Affidavit Word export still downloads.
- [ ] Export/skip appends a row on **Feedback** (and vault copy if present).
- [ ] Email Copy HTML / Push appends a row on **Email Log** (not Feedback).
- [ ] POST still uses `text/plain;charset=utf-8`.
- [ ] No Google popup until Connect Gmail.
- [ ] `npm run build` and Pages/`docs/` reflect the change (or CI rebuild succeeded).
- [ ] If GAS logic changed: **new deployment version** of the existing web app.

---

## Historical traps (do not repeat)

| Mistake | Why it hurts |
|---------|----------------|
| Logging email with `LOG_FEEDBACK` | Pollutes Feedback with draft noise; Email Log stays empty |
| Sending Affidavit `source: "ALL4ONE"` against old GAS | Wrote to a different All4One usage workbook instead of Master Feedback |
| Assuming repo `gas/Code.gs` is live | Sheets behavior only changes after Apps Script redeploy |
| Hand-editing `docs/assets/*.js` | Overwritten on next build; source of truth is `js/` |
| Rotating the `/exec` URL without updating both JSX constants | One tool logs; the other 404s/silently fails |
| Using `Content-Type: application/json` for GAS POSTs | CORS preflight failures in browsers |

Legacy Affidavit Automation client pattern (still the model for Feedback): POST `LOG_FEEDBACK` without `source` to the shared `/exec` URL — see that repo’s `src/AffidavitAutomation.jsx` if you need a side-by-side.

---

## When unsure

1. Prefer reading `gas/Code.gs` + the two React entry files over guessing sheet IDs.
2. Prefer matching existing POST shapes over inventing new `action` values without updating GAS + deploy.
3. Keep Feedback and Email Log on spreadsheet `1twLeKxFlNOjD5HmCqIqdTPg5qd_34twgOetm6AD5AYc` unless product owners explicitly migrate.
