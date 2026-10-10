// One "Map type" button in the banner (like the layers switcher in Google Maps): a small window with Map, Terrain, Satellite and 3D Earth.
// The four old buttons stay in the page (hidden on computers) so every other part of the site keeps working through them.
while (!window.__app) await new Promise((r) => setTimeout(r, 25));
const $ = (s, r = document) => r.querySelector(s);
const views = $('#views');
const TYPES = [
  { k: 'political', name: 'Map', img: 'map', tip: 'Political map with country colours' },
  { k: 'terrain', name: 'Terrain', img: 'terrain', tip: 'Land height and shape' },
  { k: 'satellite', name: 'Satellite', img: 'satellite', tip: 'Satellite photo' },
  { k: 'osm', name: 'OpenStreetMap', img: 'osm', tip: 'Streets and places from OpenStreetMap' },
  { k: 'globe', name: '3D Earth', img: 'globe', tip: 'A globe you can spin and tilt' },
];
const src = (t) => $(`#views button[data-view="${t.k === 'osm' ? 'political' : t.k}"]`);
const app = window.__app;
const btn = document.createElement('button');
btn.id = 'maptypebtn'; btn.type = 'button'; btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'maptypemenu');
btn.innerHTML = '<span class="mt-th" aria-hidden="true"></span>';
btn.setAttribute('aria-label', 'Map type'); btn.title = 'Map type';
$('#layerwrap').after(btn); // next to the Layers button
const menu = document.createElement('div');
menu.id = 'maptypemenu'; menu.hidden = true; menu.setAttribute('role', 'group'); menu.setAttribute('aria-label', 'Map type');
menu.innerHTML = `<div class="mt-list">${TYPES.map((t) => `<button type="button" class="mt-tile" data-k="${t.k}" title="${t.tip}"><span class="mt-img" style="background-image:url(/img/maptype/${t.img}.jpg)"></span><b>${t.name}</b></button>`).join('')}</div>`;
$('header').append(menu);

function current() {
  const on = TYPES.filter((t) => t.k !== 'osm' && src(t)?.classList.contains('on'))[0];
  if (on && on.k === 'political' && app.baseMap === 'osm') return TYPES.find((t) => t.k === 'osm');
  return on || null;
}
function sync() {
  const c = current();
  btn.classList.toggle('on', !!c); views.classList.toggle('nopill', !!c); // the glow is only for Stats now
  if (c) { btn.title = `Map type: ${c.name}`; btn.setAttribute('aria-label', btn.title); $('.mt-th', btn).style.backgroundImage = `url(/img/maptype/${c.img}.jpg)`; }
  menu.querySelectorAll('.mt-tile').forEach((b) => { const on = c?.k === b.dataset.k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  window.dispatchEvent(new Event('globe-change')); // moves the sliding glow behind the right button
}
sync();
// follow the hidden buttons, whoever presses them (search, front page, 3D Earth switching itself off…)
const mo = new MutationObserver(() => requestAnimationFrame(sync));
TYPES.forEach((t) => src(t) && mo.observe(src(t), { attributes: true, attributeFilter: ['class'] }));
window.addEventListener('basemap-change', () => requestAnimationFrame(sync));

function place() { const r = btn.getBoundingClientRect(), h = $('header').getBoundingClientRect(); menu.style.left = Math.max(8, Math.min(innerWidth - menu.offsetWidth - 8, r.left - h.left)) + 'px'; }
function setOpen(on) { menu.hidden = !on; btn.setAttribute('aria-expanded', String(on)); if (on) { for (const id of ['#settings', '#usermenu', '#layers']) { const e = $(id); if (e) e.hidden = true; } place(); } }
btn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(menu.hidden); });
menu.addEventListener('click', (e) => {
  const b = e.target.closest('.mt-tile'); if (!b) return; const k = b.dataset.k;
  if (k === 'osm') { src(TYPES[0])?.click(); app.setBaseMap('osm'); }          // the Map view, drawn on OpenStreetMap
  else { if (k === 'political' && app.baseMap !== 'normal') app.setBaseMap('normal'); src(TYPES.find((t) => t.k === k))?.click(); }
  setOpen(false); sync();
});
document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('#maptypemenu,#maptypebtn')) setOpen(false); }, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setOpen(false); btn.focus(); } });
window.addEventListener('resize', () => { if (!menu.hidden) place(); });
