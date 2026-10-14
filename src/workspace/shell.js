// Workspace shell: the left panel (a bottom sheet on phones), its three tabs, the detail view for a selected
// country or place, and how all of that stays out of the map's way.
// Other modules talk to it through window.__workspace and window.__layout (how much of the map the panel covers).
import './toast.js';

while (!window.__app) await new Promise((r) => setTimeout(r, 25));
const app = window.__app;
const $ = (s, r = document) => r.querySelector(s);
const side = $('#side'), main = $('main'), body = document.body;
const panel = $('#panel'), pdetail = $('#pdetail'), results = $('#results'), input = $('#search');
const mobile = matchMedia('(max-width: 700px)');
const TABS = ['projects', 'layers'];
const pref = (v) => { try { return v === undefined ? localStorage.getItem('we-side') : localStorage.setItem('we-side', v); } catch { return null; } };

let tab = 'projects';
let desktopOpen = true; // on computers the panel is fixed open; only the phone sheet opens and closes
let snap = 'closed'; // phones: closed | half | full

const landing = () => body.classList.contains('landing');
const isOpen = () => (mobile.matches ? snap !== 'closed' : desktopOpen);

function render() {
  const open = isOpen() && !landing();
  side.dataset.open = String(open);
  side.dataset.snap = mobile.matches ? snap : '';
  side.inert = !open;
  main.style.setProperty('--rail', !mobile.matches && open ? side.offsetWidth + 12 + 'px' : '0px');
  main.style.setProperty('--sheet', mobile.matches && open ? side.offsetHeight + 'px' : '0px');
  for (const t of TABS) {
    const on = t === tab, b = $('#tab-' + t), s = $('#sv-' + t);
    b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; s.hidden = !on;
  }
  document.querySelectorAll('#topnav button').forEach((b) => { const on = open && b.dataset.tab === tab; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
  const col = $('#side-collapse');
  col.setAttribute('aria-expanded', String(open));
  $('.sc-tx', col).textContent = mobile.matches ? 'Close' : 'Hide';
  $('.sc-ic', col).textContent = mobile.matches ? '✕' : '‹';
  const so = $('#side-open'); so.hidden = open || mobile.matches || landing(); so.setAttribute('aria-expanded', 'false');
  window.dispatchEvent(new CustomEvent('layout-change'));
}

function setTab(name, { open = true } = {}) {
  if (!TABS.includes(name)) return;
  tab = name;
  // choosing a tab leaves any country or place details that were covering it
  if (open && !landing()) { if (!panel.hidden) app.closePanel(); if (!pdetail.hidden) { pdetail.hidden = true; app.clearPin?.(); } }
  if (open) { if (mobile.matches) { if (snap === 'closed') snap = 'half'; } else desktopOpen = true; }
  render();
  window.dispatchEvent(new CustomEvent('workspace-tab', { detail: name }));
}
function openPanel() { if (mobile.matches) { if (snap === 'closed') snap = 'half'; } else { desktopOpen = true; pref('open'); } render(); }
function closePanel() { if (mobile.matches) snap = 'closed'; render(); } // fixed open on computers

// ---------- tabs ----------
$('#side-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
$('#side-tabs').addEventListener('keydown', (e) => {
  const i = TABS.indexOf(tab); let n = -1;
  if (e.key === 'ArrowRight') n = (i + 1) % TABS.length; else if (e.key === 'ArrowLeft') n = (i + TABS.length - 1) % TABS.length;
  else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = TABS.length - 1;
  if (n < 0) return; e.preventDefault(); setTab(TABS[n]); $('#tab-' + TABS[n]).focus();
});
$('#topnav').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]'); if (!b) return;
  if (landing()) { window.__landing?.hide(); }
  // on phones, pressing the tab that is already open closes the sheet again
  if (mobile.matches && snap !== 'closed' && tab === b.dataset.tab && !landing()) { closePanel(); return; }
  setTab(b.dataset.tab);
  if (!landing()) $('#sv-' + b.dataset.tab).focus({ preventScroll: true });
});
$('#side-collapse').addEventListener('click', closePanel);
$('#side-open').addEventListener('click', () => { openPanel(); $('#side-collapse').focus(); });

// ---------- phone sheet: drag the handle, or tap it to switch between half and full height ----------
const grab = $('#side-grab-btn');
let drag = null;
grab.addEventListener('pointerdown', (e) => {
  if (!mobile.matches) return;
  grab.setPointerCapture(e.pointerId);
  drag = { y: e.clientY, h: side.offsetHeight, moved: false };
});
grab.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dy = drag.y - e.clientY; if (Math.abs(dy) > 6) drag.moved = true; if (!drag.moved) return;
  side.classList.add('dragging');
  side.style.height = Math.max(60, Math.min(innerHeight * 0.9, drag.h + dy)) + 'px';
});
const endDrag = () => {
  if (!drag) return;
  const moved = drag.moved, h = side.offsetHeight / innerHeight;
  drag = null; side.classList.remove('dragging'); side.style.height = '';
  if (moved) { snap = h < 0.22 ? 'closed' : h < 0.68 ? 'half' : 'full'; render(); }
};
grab.addEventListener('pointerup', endDrag); grab.addEventListener('pointercancel', endDrag);
grab.addEventListener('click', () => { if (drag?.moved) return; snap = snap === 'full' ? 'half' : 'full'; render(); });

// ---------- details: a selected country or place replaces the tab content until it is closed ----------
function syncDetail() {
  const d = !panel.hidden ? 'country' : !pdetail.hidden ? 'place' : '';
  if (d) { side.dataset.detail = d; $('#side-body').scrollTop = 0; } else delete side.dataset.detail;
  render();
}
new MutationObserver(syncDetail).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
new MutationObserver(syncDetail).observe(pdetail, { attributes: true, attributeFilter: ['hidden'] });
window.addEventListener('country-open', () => { if (!landing()) { if (mobile.matches) snap = snap === 'full' ? 'full' : 'half'; else desktopOpen = true; render(); } });
window.addEventListener('place-select', () => { if (!landing()) openPanel(); });

// ---------- search results appear in the panel ----------
new MutationObserver(() => {
  const has = results.children.length > 0;
  side.dataset.search = has ? '1' : '';
  if (has) openPanel(); else render();
}).observe(results, { childList: true });
input.addEventListener('input', () => { if (input.value.trim() && !landing()) openPanel(); });

// ---------- misc ----------
mobile.addEventListener('change', render);
new ResizeObserver(() => { if (!mobile.matches) render(); }).observe(side);
new MutationObserver(render).observe(body, { attributes: true, attributeFilter: ['class'] });

window.__layout = {
  get left() { return !mobile.matches && isOpen() && !landing() ? side.offsetWidth + 12 : 0; },
  get bottom() { return mobile.matches && isOpen() && !landing() ? side.offsetHeight : 0; },
};
window.__workspace = { setTab, open: openPanel, close: closePanel, get tab() { return tab; }, get isOpen() { return isOpen(); } };
render();

// "Skip to the map" link for keyboard users
document.querySelector('.skip')?.addEventListener('click', (e) => { e.preventDefault(); (document.querySelector('#map canvas') || main).focus?.(); });
