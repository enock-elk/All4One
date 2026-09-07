const USERNAME_KEY = 'username';
const LOCK_KEY = 'all4one_workspace_locked';

export function getWorkspaceName() {
  return String(localStorage.getItem(USERNAME_KEY) || '').trim();
}

export function rememberWorkspaceName(name) {
  const clean = String(name || '').replace(/\s+/g, ' ').trim();
  if (clean.length < 2) return getWorkspaceName();
  if (!getWorkspaceName()) {
    localStorage.setItem(USERNAME_KEY, clean);
  }
  return getWorkspaceName();
}

export function isWorkspaceLocked() {
  return localStorage.getItem(LOCK_KEY) === 'true';
}

export function setWorkspaceLocked(locked) {
  if (locked) localStorage.setItem(LOCK_KEY, 'true');
  else localStorage.removeItem(LOCK_KEY);
}

export async function captureGoogleIdentity(accessToken) {
  if (getWorkspaceName() || !accessToken) return getWorkspaceName();
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json().catch(() => ({}));
    return rememberWorkspaceName(data.name || data.given_name || '');
  } catch {
    return getWorkspaceName();
  }
}

export function ensureWorkspaceName() {
  const existing = getWorkspaceName();
  if (existing) return Promise.resolve(existing);

  const overlay = document.getElementById('identity-prompt');
  const form = document.getElementById('identity-prompt-form');
  const input = document.getElementById('identity-prompt-input');
  const cancel = document.getElementById('identity-prompt-cancel');
  if (!overlay || !form || !input) return Promise.resolve('');

  overlay.classList.remove('hidden');
  input.value = '';
  window.setTimeout(() => input.focus(), 30);

  return new Promise((resolve) => {
    const finish = (name) => {
      overlay.classList.add('hidden');
      form.removeEventListener('submit', onSubmit);
      cancel?.removeEventListener('click', onCancel);
      resolve(name);
    };
    const onSubmit = (event) => {
      event.preventDefault();
      const name = rememberWorkspaceName(input.value);
      if (name) finish(name);
    };
    const onCancel = () => finish('');
    form.addEventListener('submit', onSubmit);
    cancel?.addEventListener('click', onCancel);
  });
}

window.getWorkspaceName = getWorkspaceName;
window.rememberWorkspaceName = rememberWorkspaceName;
window.ensureWorkspaceName = ensureWorkspaceName;
