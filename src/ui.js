// Header and Layers-tab behaviour: the Settings menu, the animations switch, the layer rows and short name tips on icon buttons.
const $ = (s, r = document) => r.querySelector(s);

// ---------- settings menu ----------
const sbtn = $('#settingsbtn'), menu = $('#settings');
const setMenu = (open) => { menu.hidden = !open; sbtn.setAttribute('aria-expanded', String(open)); };
sbtn.addEventListener('click', (e) => { e.stopPropagation(); setMenu(menu.hidden); $('#usermenu').hidden = true; });
document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('#settings')) setMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); sbtn.focus(); } });
// the names switch is controlled by main.js; keep its screen-reader state in step with how it looks
const names = $('#names');
const syncNames = () => names.setAttribute('aria-checked', String(names.classList.contains('on')));
new MutationObserver(syncNames).observe(names, { attributes: true, attributeFilter: ['class'] });
// animations on or off (remembered)
const anim = $('#anim');
function setAnim(on, save) {
  document.body.classList.toggle('noanim', !on); anim.classList.toggle('on', on); anim.setAttribute('aria-checked', String(on));
  if (save) try { localStorage.setItem('animations', on ? 'on' : 'off'); } catch {}
}
let animOn = true; try { animOn = localStorage.getItem('animations') !== 'off'; } catch {}
setAnim(animOn, false);
anim.addEventListener('click', () => setAnim(!anim.classList.contains('on'), true));

// ---------- layers and tools (rows in the Layers tab) ----------
const lmenu = $('#layers'), lcount = $('#layercount');
const tzbtn = $('#tzbtn'), tzpanel = $('#timepanel');
tzbtn.addEventListener('click', () => $(tzpanel.hidden ? '#timepanel-open' : '#timepanel-close').click());
// Statistics and Historical maps are modes of the map, so these two rows follow the real state
const statsRow = $('#statsrow'), histRow = $('#historyrow');
statsRow.addEventListener('click', () => {
  const app = window.__app; if (!app) return;
  if (app.view === 'stats') $('#maptypes [data-k="political"]').click(); else $('#views [data-view="stats"]').click();
});
histRow.addEventListener('click', () => {
  const app = window.__app; if (!app) return;
  if (window.__history?.active) { $('#maptypes [data-k="political"]').click(); return; }
  if (app.view !== 'stats') $('#views [data-view="stats"]').click();
  let tries = 0; const go = () => { const b = $('#sb-groups [data-history]'); if (b) { if (!b.classList.contains('on')) b.click(); } else if (tries++ < 30) setTimeout(go, 100); }; go();
});
$('#playrow').addEventListener('click', () => $('#playtop').click());

const rows = [...lmenu.querySelectorAll('.lr:not(.act)')];
function syncModes() {
  const app = window.__app, stats = app?.view === 'stats', hist = !!window.__history?.active || document.body.classList.contains('history');
  statsRow.classList.toggle('on', stats && !hist); histRow.classList.toggle('on', hist);
  count();
}
function count() {
  const n = rows.filter((r) => r.classList.contains('on')).length;
  lcount.textContent = n; lcount.hidden = !n;
  rows.forEach((r) => r.setAttribute('aria-pressed', String(r.classList.contains('on'))));
}
const syncTz = () => { tzbtn.classList.toggle('on', !tzpanel.hidden); count(); };
const ob = new MutationObserver(syncModes);
rows.forEach((r) => ob.observe(r, { attributes: true, attributeFilter: ['class'] }));
new MutationObserver(syncTz).observe(tzpanel, { attributes: true, attributeFilter: ['hidden'] });
new MutationObserver(syncModes).observe(document.body, { attributes: true, attributeFilter: ['class', 'data-view'] });
window.addEventListener('view-change', syncModes);
syncTz(); syncModes();

// ---------- the name that appears under an icon-only header button when the mouse rests on it ----------
const tipEl = document.createElement('div'); tipEl.id = 'hdrtip'; tipEl.setAttribute('role', 'tooltip'); tipEl.hidden = true; document.body.append(tipEl);
document.querySelectorAll('#playtop, #signinbtn, #settingsbtn').forEach((el) => {
  el.dataset.tip ||= el.getAttribute('aria-label') || el.querySelector('.lb,.lbl')?.textContent || el.title;
  el.removeAttribute('title'); // the native hint would show a second box
  const show = (e) => {
    if (e.pointerType === 'touch') return;
    tipEl.textContent = el.dataset.tip; tipEl.hidden = false;
    const r = el.getBoundingClientRect(), w = tipEl.offsetWidth;
    tipEl.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    tipEl.style.top = r.bottom + 8 + 'px';
    tipEl.classList.add('show');
  };
  const hide = () => { tipEl.classList.remove('show'); tipEl.hidden = true; };
  el.addEventListener('pointerenter', show); el.addEventListener('pointerleave', hide); el.addEventListener('pointerdown', hide);
  el.addEventListener('focus', (e) => { if (el.matches(':focus-visible')) show(e); }); el.addEventListener('blur', hide);
});
