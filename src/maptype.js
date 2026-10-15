// Map type: Map, Terrain, Satellite, OpenStreetMap or 3D Earth.
// It is shown in two places that stay in step: a picker on the map (bottom left) and a grid in the Layers tab.
// The hidden #views buttons still do the real work, because other parts of the site (search, stats, 3D Earth) press them.
while (!window.__app) await new Promise((r) => setTimeout(r, 25));
const $ = (s, r = document) => r.querySelector(s);
const app = window.__app;
const TYPES = [
  { k: 'political', name: 'Map', img: 'map', tip: 'Political map with country colours' },
  { k: 'terrain', name: 'Terrain', img: 'terrain', tip: 'Land height and shape' },
  { k: 'satellite', name: 'Satellite', img: 'satellite', tip: 'Satellite photo' },
  { k: 'osm', name: 'OpenStreetMap', img: 'osm', tip: 'Streets and places from OpenStreetMap' },
  { k: 'virals', name: 'Virals', img: 'virals', tip: 'See-through map with only thin borders and country names' },
  { k: 'globe', name: '3D Earth', img: 'globe', tip: 'A globe you can spin and tilt' },
];
const src = (t) => $(`#views button[data-view="${t.k === 'osm' || t.k === 'virals' ? 'political' : t.k}"]`);
const tileHtml = (t) => `<button type="button" class="mt-tile" data-k="${t.k}" title="${t.tip}" aria-pressed="false"><span class="mt-img" style="background-image:url(/img/maptype/${t.img}.jpg)"></span><b>${t.name}</b></button>`;

function current() {
  if (app.viralsOn && !window.__globe?.active) return TYPES.find((t) => t.k === 'virals');
  const on = TYPES.find((t) => t.k !== 'osm' && t.k !== 'virals' && src(t)?.classList.contains('on'));
  if (on && on.k === 'political' && app.baseMap === 'osm') return TYPES.find((t) => t.k === 'osm');
  return on || null;
}
function set(k) {
  const t = TYPES.find((x) => x.k === k); if (!t) return false;
  if (k !== 'virals' && app.viralsOn) app.setVirals(false);
  if (k === 'virals') { if (app.baseMap !== 'normal') app.setBaseMap('normal'); src(TYPES[0])?.click(); app.setVirals(true); }
  else if (k === 'osm') { src(TYPES[0])?.click(); app.setBaseMap('osm'); }
  else { if (k === 'political' && app.baseMap !== 'normal') app.setBaseMap('normal'); src(t)?.click(); }
  sync();
  return true;
}

// ---- the picker on the map ----
const bar = $('#mapbar'), btn = $('#mapbar-type');
const menu = document.createElement('div');
menu.id = 'maptypemenu'; menu.hidden = true; menu.setAttribute('role', 'group'); menu.setAttribute('aria-label', 'Map type');
menu.innerHTML = `<div class="mt-list">${TYPES.map(tileHtml).join('')}</div>`;
bar.append(menu);
// ---- the grid in the Layers tab ----
$('#maptypes').innerHTML = TYPES.map(tileHtml).join('');

function sync() {
  const c = current();
  const t = c || TYPES[0];
  $('.mt-th', btn).style.backgroundImage = `url(/img/maptype/${t.img}.jpg)`;
  $('#mapbar-type-n').textContent = c ? c.name : 'Map';
  document.querySelectorAll('.mt-tile').forEach((b) => { const on = c?.k === b.dataset.k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  const globe = c?.k === 'globe';
  const dim = $('#ctl-dim'); dim.setAttribute('aria-pressed', String(globe)); $('#ctl-dim-t').textContent = globe ? '2D' : '3D';
  dim.title = globe ? 'Back to the flat map' : 'Switch to the 3D globe';
  dim.setAttribute('aria-label', dim.title);
  window.dispatchEvent(new CustomEvent('maptype-change', { detail: c ? c.k : app.view }));
}
const mo = new MutationObserver(() => requestAnimationFrame(sync));
TYPES.forEach((t) => src(t) && mo.observe(src(t), { attributes: true, attributeFilter: ['class'] }));
window.addEventListener('basemap-change', () => requestAnimationFrame(sync));
window.addEventListener('globe-change', () => requestAnimationFrame(sync));
window.addEventListener('virals-layer', () => requestAnimationFrame(sync));

function setOpen(on) { menu.hidden = !on; btn.setAttribute('aria-expanded', String(on)); }
btn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(menu.hidden); });
document.addEventListener('click', (e) => {
  const tile = e.target.closest('.mt-tile');
  if (tile) { set(tile.dataset.k); setOpen(false); return; }
  if (!menu.hidden && !e.target.closest('#maptypemenu,#mapbar-type')) setOpen(false);
}, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setOpen(false); btn.focus(); } });

// ---- 2D / 3D switch and zoom buttons ----
$('#ctl-dim').addEventListener('click', () => { if (window.__globe?.active) window.__globe.toggle(false); else $('#globebtn').click(); });
function zoomBy(dir) {
  const g = window.__globe;
  if (g?.active && g.viewer) { const cam = g.viewer.camera, h = cam.positionCartographic.height; if (dir > 0) cam.zoomIn(h * 0.4); else cam.zoomOut(h * 0.6); return; }
  if (dir > 0) app.map.zoomIn(); else app.map.zoomOut();
}
// reset: the flat map goes back to the opening world view; in 3D it is the globe's own Reset view
$('#ctl-reset').addEventListener('click', () => {
  if (window.__globe?.active) { document.querySelector('#gl-home')?.click(); return; }
  app.map.flyTo({ center: [20, 25], zoom: 1.6, bearing: 0, pitch: 0, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900 });
});
$('#ctl-zin').addEventListener('click', () => zoomBy(1));
$('#ctl-zout').addEventListener('click', () => zoomBy(-1));
const limits = () => { const z = app.map.getZoom(); $('#ctl-zin').disabled = z >= app.map.getMaxZoom() - 0.01; $('#ctl-zout').disabled = z <= app.map.getMinZoom() + 0.01; };
app.map.on('zoom', limits); limits();

sync();
window.__maptype = { TYPES, get current() { return current()?.k || null; }, set };
