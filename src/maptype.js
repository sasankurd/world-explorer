// One "Map type" button in the banner (like the layers switcher in Google Maps): a small window with Map, Terrain, Satellite and 3D Earth.
// The four old buttons stay in the page (hidden on computers) so every other part of the site keeps working through them.
while (!window.__app) await new Promise((r) => setTimeout(r, 25));
const $ = (s, r = document) => r.querySelector(s);
const views = $('#views');
const TYPES = [
  { k: 'political', name: 'Map', img: 'map', tip: 'Political map with country colours' },
  { k: 'terrain', name: 'Terrain', img: 'terrain', tip: 'Land height and shape' },
  { k: 'satellite', name: 'Satellite', img: 'satellite', tip: 'Satellite photo' },
  { k: 'globe', name: '3D Earth', img: 'globe', tip: 'A globe you can spin and tilt' },
];
const src = (t) => $(`#views button[data-view="${t.k}"]`);
const btn = document.createElement('button');
btn.id = 'maptypebtn'; btn.type = 'button'; btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'maptypemenu');
btn.innerHTML = '<span class="mt-th" aria-hidden="true"></span><span class="mt-nm">Map</span><span class="mt-ch" aria-hidden="true">▾</span>';
$('.pill', views).after(btn);
const menu = document.createElement('div');
menu.id = 'maptypemenu'; menu.hidden = true; menu.setAttribute('role', 'group'); menu.setAttribute('aria-label', 'Map type');
menu.innerHTML = `<h2>Map type</h2><div class="mt-grid">${TYPES.map((t) => `<button type="button" class="mt-tile" data-k="${t.k}" title="${t.tip}"><span class="mt-img" style="background-image:url(/img/maptype/${t.img}.jpg)"></span><b>${t.name}</b></button>`).join('')}</div>`;
$('header').append(menu);

function current() { return TYPES.find((t) => src(t)?.classList.contains('on')) || null; }
function sync() {
  const c = current();
  btn.classList.toggle('on', !!c);
  if (c) { $('.mt-nm', btn).textContent = c.name; $('.mt-th', btn).style.backgroundImage = `url(/img/maptype/${c.img}.jpg)`; }
  menu.querySelectorAll('.mt-tile').forEach((b) => { const on = c?.k === b.dataset.k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  window.dispatchEvent(new Event('globe-change')); // moves the sliding glow behind the right button
}
sync();
// follow the hidden buttons, whoever presses them (search, front page, 3D Earth switching itself off…)
const mo = new MutationObserver(() => requestAnimationFrame(sync));
TYPES.forEach((t) => src(t) && mo.observe(src(t), { attributes: true, attributeFilter: ['class'] }));

function place() { const r = btn.getBoundingClientRect(), h = $('header').getBoundingClientRect(); menu.style.left = Math.max(8, Math.min(innerWidth - menu.offsetWidth - 8, r.left - h.left)) + 'px'; }
function setOpen(on) { menu.hidden = !on; btn.setAttribute('aria-expanded', String(on)); if (on) { for (const id of ['#settings', '#usermenu', '#layers']) { const e = $(id); if (e) e.hidden = true; } place(); } }
btn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(menu.hidden); });
menu.addEventListener('click', (e) => { const b = e.target.closest('.mt-tile'); if (!b) return; src(TYPES.find((t) => t.k === b.dataset.k))?.click(); setOpen(false); });
document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('#maptypemenu,#maptypebtn')) setOpen(false); }, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setOpen(false); btn.focus(); } });
window.addEventListener('resize', () => { if (!menu.hidden) place(); });
