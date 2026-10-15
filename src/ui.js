// Header and Layers-tab behaviour: the Settings menu, the animations switch, the layer rows and short name tips on icon buttons.
import { initLang } from './i18n.js';
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
const tzbtn = $('#tzbtn');
// Time: straight on/off for the zone lines and the clock in each country, no extra window
tzbtn.addEventListener('click', () => {
  const app = window.__app, on = !(window.__tz?.enabled || app?.timeMode);
  window.__tz?.set(on); app?.setTimeMode(on);
});
// Stats and Real size live in the top bar; they press the (hidden) rows that hold the real logic
$('#statstop').addEventListener('click', () => { $('#statsrow').click(); });
$('#sizetop').addEventListener('click', () => $('#sizebtn').click());
// Statistics and Historical maps are modes of the map, so these two rows follow the real state
const statsRow = $('#statsrow'), histRow = $('#historyrow');
// when Statistics opens, bring its controls into view inside the panel
const focusStats = () => {};
statsRow.addEventListener('click', () => {
  const app = window.__app; if (!app) return;
  if (app.statsOn && !window.__history?.active) app.setStats(false); else if (window.__history?.active) { $('#sb-groups [data-back]')?.click(); } else { app.setStats(true); }
});
histRow.addEventListener('click', () => {
  const app = window.__app; if (!app) return;
  if (window.__history?.active) { app.setStats(false); return; }
  if (!app.statsOn) app.setStats(true);
  let tries = 0; const go = () => { const b = $('#sb-groups [data-history]'); if (b) { if (!b.classList.contains('on')) b.click(); focusStats(); } else if (tries++ < 30) setTimeout(go, 100); }; go();
});
$('#viralsrow').addEventListener('click', () => window.__app?.setVirals(!window.__app.viralsOn));
window.addEventListener('virals-layer', (e) => { $('#viralsrow').classList.toggle('on', !!e.detail); });
$('#playrow').addEventListener('click', () => $('#playtop').click());

const rows = [...lmenu.querySelectorAll('.lr:not(.act)')];
function syncModes() {
  const app = window.__app, stats = !!app?.statsOn, hist = !!window.__history?.active || document.body.classList.contains('history');
  statsRow.classList.toggle('on', stats && !hist); histRow.classList.toggle('on', hist);
  syncTz();
}
function count() {
  const n = rows.filter((r) => r.classList.contains('on')).length;
  lcount.textContent = n; lcount.hidden = !n;
  rows.forEach((r) => r.setAttribute('aria-pressed', String(r.classList.contains('on'))));
}
const syncTz = () => { const on = !!(window.__tz?.enabled || window.__app?.timeMode); tzbtn.classList.toggle('on', on); tzbtn.setAttribute('aria-pressed', String(on)); count(); };
const mirror = (row, btn) => { const f = () => { const on = row.classList.contains('on'); btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', String(on)); }; new MutationObserver(f).observe(row, { attributes: true, attributeFilter: ['class'] }); f(); };
mirror($('#statsrow'), $('#statstop')); mirror($('#sizebtn'), $('#sizetop'));
window.addEventListener('tz-change', syncTz);
const ob = new MutationObserver(syncModes);
rows.forEach((r) => ob.observe(r, { attributes: true, attributeFilter: ['class'] }));
new MutationObserver(syncModes).observe(document.body, { attributes: true, attributeFilter: ['class', 'data-view'] });
window.addEventListener('view-change', syncModes);
window.addEventListener('stats-layer', syncModes);
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

// Hide / show the floating statistics controls without turning the statistic off
{
  const bar = $('#statbar'), hb = $('#sb-hide');
  const fold = (on) => { bar.classList.toggle('folded', on); hb.setAttribute('aria-expanded', String(!on)); $('.sbh-t', hb).textContent = on ? 'Show statistics' : 'Hide'; $('.sbh-i', hb).textContent = on ? '▾' : '▴'; };
  hb.addEventListener('click', () => fold(!bar.classList.contains('folded')));
  new MutationObserver(() => { if (!bar.hidden) fold(false); }).observe(bar, { attributes: true, attributeFilter: ['hidden'] }); // opens fresh each time
}

initLang();

// Resize the floating statistics panel: drag the corner grip (or use the arrow keys on it); double-click resets. The size is remembered.
{
  const bar = $('#statbar'), KEY = 'we-statsize';
  const grip = document.createElement('button');
  grip.type = 'button'; grip.id = 'sb-grip'; grip.title = 'Drag to resize (double-click to reset)'; grip.setAttribute('aria-label', 'Resize the statistics panel. Use the arrow keys, or drag.');
  grip.style.touchAction = 'none';
  bar.append(grip);
  const limits = () => ({ minW: 300, minH: 120, maxW: Math.max(300, bar.parentElement.clientWidth - 24), maxH: Math.max(120, bar.parentElement.clientHeight - 140) });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let size = null; try { size = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
  const apply = () => {
    if (!size || bar.classList.contains('folded')) { bar.style.width = ''; bar.style.maxHeight = ''; bar.style.height = ''; return; }
    const L = limits();
    bar.style.width = clamp(size.w, L.minW, L.maxW) + 'px';
    bar.style.maxHeight = 'none'; bar.style.height = clamp(size.h, L.minH, L.maxH) + 'px';
  };
  const save = () => { try { size ? localStorage.setItem(KEY, JSON.stringify(size)) : localStorage.removeItem(KEY); } catch {} };
  let d = null;
  grip.addEventListener('pointerdown', (e) => { const r = bar.getBoundingClientRect(); d = { x: e.clientX, y: e.clientY, w: r.width, h: r.height }; grip.setPointerCapture(e.pointerId); e.preventDefault(); });
  grip.addEventListener('pointermove', (e) => { if (!d) return; size = { w: d.w + (e.clientX - d.x) * 2, h: d.h + (e.clientY - d.y) }; apply(); }); // the panel stays centred, so width changes on both sides
  const end = () => { if (d) { d = null; save(); } };
  grip.addEventListener('pointerup', end); grip.addEventListener('pointercancel', end);
  grip.addEventListener('dblclick', () => { size = null; apply(); save(); });
  grip.addEventListener('keydown', (e) => {
    const k = { ArrowRight: [40, 0], ArrowLeft: [-40, 0], ArrowDown: [0, 24], ArrowUp: [0, -24] }[e.key]; if (!k) return;
    e.preventDefault(); const r = bar.getBoundingClientRect(); size = { w: r.width + k[0], h: r.height + k[1] }; apply(); save();
  });
  new MutationObserver(apply).observe(bar, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', apply);
  apply();
}
