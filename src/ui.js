// Header animations: sliding glow pill on the view tabs, click ripple, and a scan sweep across the map.
const views = document.querySelector('#views');
const pill = views.querySelector('.pill');
const scan = document.querySelector('#scan');

function syncPill(snap) {
  const on = views.querySelector('button.on');
  if (!on) return;
  if (snap) pill.classList.add('snap');
  pill.style.width = on.offsetWidth + 'px';
  pill.style.transform = `translateX(${on.offsetLeft}px)`;
  if (snap) { pill.offsetWidth; pill.classList.remove('snap'); }
}
function sweep() {
  scan.classList.remove('go'); scan.offsetWidth; scan.classList.add('go');
}
syncPill(true);
document.fonts?.ready.then(() => syncPill(true));
window.addEventListener('resize', () => syncPill(true));
window.addEventListener('globe-change', () => requestAnimationFrame(() => syncPill(false)));
views.addEventListener('click', (e) => { if (e.target.closest('button')) { requestAnimationFrame(() => syncPill(false)); sweep(); } });
document.querySelector('#maptheme').addEventListener('change', sweep);
document.querySelector('#basemap').addEventListener('change', sweep);

document.querySelector('header').addEventListener('pointerdown', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const r = b.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2.4;
  const s = document.createElement('span');
  s.className = 'rip'; s.style.cssText = `left:${e.clientX - r.left}px;top:${e.clientY - r.top}px;width:${size}px;height:${size}px`;
  b.appendChild(s); setTimeout(() => s.remove(), 700);
});

// ---------- settings menu ----------
const sbtn = document.querySelector('#settingsbtn'), menu = document.querySelector('#settings');
const setMenu = (open) => { menu.hidden = !open; sbtn.setAttribute('aria-expanded', String(open)); };
sbtn.addEventListener('click', (e) => { e.stopPropagation(); setMenu(menu.hidden); document.querySelector('#usermenu').hidden = true; });
document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('#settings')) setMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); sbtn.focus(); } });
// the names switch is controlled by main.js; keep its screen-reader state in step with how it looks
const names = document.querySelector('#names');
const syncNames = () => names.setAttribute('aria-checked', String(names.classList.contains('on')));
new MutationObserver(syncNames).observe(names, { attributes: true, attributeFilter: ['class'] });
// animations on or off (remembered)
const anim = document.querySelector('#anim');
function setAnim(on, save) {
  document.body.classList.toggle('noanim', !on); anim.classList.toggle('on', on); anim.setAttribute('aria-checked', String(on));
  if (save) try { localStorage.setItem('animations', on ? 'on' : 'off'); } catch {}
}
let animOn = true; try { animOn = localStorage.getItem('animations') !== 'off'; } catch {}
setAnim(animOn, false);
anim.addEventListener('click', () => setAnim(!anim.classList.contains('on'), true));

// ---------- layers and tools menu ----------
const lbtn = document.querySelector('#layersbtn'), lmenu = document.querySelector('#layers'), lcount = document.querySelector('#layercount');
const setLayers = (open) => { lmenu.hidden = !open; lbtn.setAttribute('aria-expanded', String(open)); };
lbtn.addEventListener('click', (e) => {
  e.stopPropagation(); const open = lmenu.hidden; setLayers(open);
  if (open) { menu.hidden = true; sbtn.setAttribute('aria-expanded', 'false'); document.querySelector('#usermenu').hidden = true; }
});
// opening settings or the account menu closes this one (they stop the click, so listen early)
document.addEventListener('click', (e) => { if (e.isTrusted && !lmenu.hidden && !e.target.closest('#layers,#layersbtn')) setLayers(false); }, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lmenu.hidden) { setLayers(false); lbtn.focus(); } });
// Time zones: this row opens and closes the clock panel
const tzbtn = document.querySelector('#tzbtn'), tzpanel = document.querySelector('#timepanel');
tzbtn.addEventListener('click', () => document.querySelector(tzpanel.hidden ? '#timepanel-open' : '#timepanel-close').click());
// each row shows its state as a switch, and the Layers button shows how many are on
const rows = [...lmenu.querySelectorAll('.lr')];
function count() {
  const n = rows.filter((r) => r.classList.contains('on')).length;
  lcount.textContent = n; lcount.hidden = !n; lbtn.classList.toggle('has', n > 0);
  lbtn.dataset.tip = n ? `Layers and tools (${n} on)` : 'Layers and tools';
  rows.forEach((r) => r.setAttribute('aria-pressed', String(r.classList.contains('on'))));
}
const syncTz = () => { tzbtn.classList.toggle('on', !tzpanel.hidden); count(); };
const ob = new MutationObserver(count);
rows.forEach((r) => ob.observe(r, { attributes: true, attributeFilter: ['class'] }));
new MutationObserver(syncTz).observe(tzpanel, { attributes: true, attributeFilter: ['hidden'] });
syncTz();

// ---------- names on hover: the banner shows icons, and a small label appears under the one the mouse is on ----------
const tipEl = document.createElement('div'); tipEl.id = 'hdrtip'; tipEl.setAttribute('role', 'tooltip'); tipEl.hidden = true; document.body.append(tipEl);
const tipTargets = document.querySelectorAll('#views button, #layersbtn, #playtop, #signinbtn, #settingsbtn');
tipTargets.forEach((el) => {
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
