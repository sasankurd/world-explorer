// Sign in and sign up: Google, Facebook, GitHub, X, or email and password.
// It talks to a Supabase project (free sign-in service) with plain web requests, so there is no extra code library.
// The project's address and public key go in public/auth-config.json (see "Turning on sign-in" in the README).
const $ = (s) => document.querySelector(s);
const KEY = 'we-auth';
let cfg = { url: '', key: '' };
let session = null, user = null, mode = 'in';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const configured = () => !!(cfg.url && cfg.key);
const PROVIDER_NAME = { google: 'Google', facebook: 'Facebook', github: 'GitHub', twitter: 'X', email: 'email' };

async function loadConfig() {
  try {
    const j = await (await fetch('/auth-config.json')).json();
    cfg = { url: String(j.supabaseUrl || '').replace(/\/+$/, ''), key: String(j.anonKey || '') };
  } catch { /* no config file: sign-in stays switched off */ }
}
async function api(path, { method = 'GET', body, token } = {}) {
  const r = await fetch(cfg.url + path, {
    method,
    headers: { apikey: cfg.key, Authorization: 'Bearer ' + (token || cfg.key), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null; try { j = await r.json(); } catch {}
  if (!r.ok) throw new Error(j?.msg || j?.error_description || j?.message || j?.error || `The sign-in service answered ${r.status}`);
  return j;
}

// ---------- keeping the session ----------
const saveSession = (s) => { session = s; try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch {} };
const readSession = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
function fromTokens(j) {
  return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (+j.expires_in || 3600) };
}
async function refresh(s) {
  const j = await api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token } });
  return fromTokens(j);
}
async function loadUser() {
  if (!session) { user = null; return render(); }
  try {
    if (session.expires_at < Date.now() / 1000 + 30 && session.refresh_token) saveSession(await refresh(session));
    user = await api('/auth/v1/user', { token: session.access_token });
  } catch { saveSession(null); user = null; }
  render();
}

// ---------- the header ----------
function nameOf(u) {
  const m = u?.user_metadata || {};
  return m.full_name || m.name || m.user_name || m.preferred_username || (u?.email || '').split('@')[0] || 'You';
}
function render() {
  const out = !user;
  $('#signinbtn').hidden = !out; $('#signupbtn').hidden = !out; $('#userbtn').hidden = out;
  $('#usermenu').hidden = true; $('#userbtn').setAttribute('aria-expanded', 'false');
  if (out) return;
  const m = user.user_metadata || {}, nm = nameOf(user), pic = m.avatar_url || m.picture;
  $('#userbtn').innerHTML = `${pic ? `<img class="av" src="${esc(pic)}" alt="" referrerpolicy="no-referrer">` : `<span class="av">${esc(nm.trim()[0]?.toUpperCase() || '?')}</span>`}<span>${esc(nm.split(' ')[0])}</span>`;
  $('#userbtn').title = 'Your account';
  $('#um-name').textContent = nm; $('#um-mail').textContent = user.email || '';
  const via = user.app_metadata?.provider || 'email';
  $('#um-via').textContent = `Signed in with ${PROVIDER_NAME[via] || via}`;
}
$('#userbtn').addEventListener('click', (e) => {
  e.stopPropagation(); const m = $('#usermenu'); m.hidden = !m.hidden; $('#userbtn').setAttribute('aria-expanded', String(!m.hidden));
  $('#settings').hidden = true; $('#settingsbtn').setAttribute('aria-expanded', 'false');
});
document.addEventListener('click', (e) => { if (!$('#usermenu').hidden && !e.target.closest('#usermenu')) { $('#usermenu').hidden = true; $('#userbtn').setAttribute('aria-expanded', 'false'); } });
$('#signoutbtn').addEventListener('click', async () => {
  const tok = session?.access_token;
  saveSession(null); user = null; render();
  if (tok && configured()) { try { await api('/auth/v1/logout', { method: 'POST', token: tok }); } catch {} }
});

// ---------- the sign in / sign up window ----------
const dlg = $('#authmodal'), msg = $('#au-msg');
const say = (t, kind) => { msg.textContent = t || ''; msg.className = kind || ''; };
function setMode(m) {
  mode = m;
  $('#au-title').textContent = m === 'in' ? 'Sign in' : 'Create your account';
  $('#au-submit').textContent = m === 'in' ? 'Sign in' : 'Sign up';
  $('#au-name-l').hidden = m === 'in';
  $('#au-pass').autocomplete = m === 'in' ? 'current-password' : 'new-password';
  document.querySelectorAll('.au-tabs button').forEach((b) => { const on = b.dataset.mode === m; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  say('');
}
function openModal(m) {
  setMode(m);
  $('#au-setup').hidden = configured();
  if (!dlg.open) dlg.showModal();
  $('#au-email').focus();
}
$('#signinbtn').addEventListener('click', () => openModal('in'));
$('#signupbtn').addEventListener('click', () => openModal('up'));
document.querySelector('.au-tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setMode(b.dataset.mode); });
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // click on the dark area outside

document.querySelector('.au-prov').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-p]'); if (!b) return;
  if (!configured()) { say('Sign-in is not switched on yet. The site owner needs to connect it once (see the note below).', 'bad'); $('#au-setup').hidden = false; $('#au-setup').open = true; return; }
  say(`Taking you to ${PROVIDER_NAME[b.dataset.p]}…`, 'ok');
  const back = encodeURIComponent(location.origin + location.pathname);
  location.href = `${cfg.url}/auth/v1/authorize?provider=${b.dataset.p}&redirect_to=${back}`;
});
$('#au-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!configured()) { say('Sign-in is not switched on yet. The site owner needs to connect it once (see the note below).', 'bad'); $('#au-setup').hidden = false; $('#au-setup').open = true; return; }
  const email = $('#au-email').value.trim(), password = $('#au-pass').value, btn = $('#au-submit');
  btn.disabled = true; say(mode === 'in' ? 'Signing in…' : 'Creating your account…');
  try {
    if (mode === 'up') {
      const j = await api('/auth/v1/signup', { method: 'POST', body: { email, password, data: { full_name: $('#au-name').value.trim() || undefined } } });
      if (j.access_token) { saveSession(fromTokens(j)); await loadUser(); dlg.close(); return; }
      say('Almost done: we sent a message to ' + email + '. Open it and click the link to finish signing up, then sign in here.', 'ok');
    } else {
      const j = await api('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
      saveSession(fromTokens(j)); await loadUser(); dlg.close();
    }
  } catch (err) {
    const t = err.message || 'Something went wrong.';
    say(/invalid login/i.test(t) ? 'That email and password do not match. Check them, or sign up if you are new.' : /already/i.test(t) ? 'That email already has an account. Use Sign in instead.' : /fetch|network/i.test(t) ? 'Could not reach the sign-in service. Check your connection and try again.' : t, 'bad');
  } finally { btn.disabled = false; }
});

// ---------- coming back from Google / Facebook / GitHub / X ----------
async function init() {
  await loadConfig();
  let back = null; try { back = sessionStorage.getItem('we-oauth'); sessionStorage.removeItem('we-oauth'); } catch {}
  if (back) {
    const p = new URLSearchParams(back.replace(/^#/, ''));
    if (p.get('access_token')) saveSession(fromTokens(Object.fromEntries(p)));
    else if (p.get('error_description') || p.get('error')) {
      openModal('in'); say((p.get('error_description') || p.get('error')).replace(/\+/g, ' ') + '. You can try again or use another way to sign in.', 'bad');
    }
  } else session = readSession();
  if (session && configured()) await loadUser(); else { if (session && !configured()) saveSession(null); render(); }
}
window.__auth = { get user() { return user; }, get configured() { return configured(); } };
init();
