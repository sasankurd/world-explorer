// Front page and the Units rows in Settings.
import { ago } from './projects/model.js';
import { isLocked } from './workspace/gate.js';
// The front page sits on top of the map and goes away when you choose where to go. The map keeps loading underneath.
while (!window.__app) await new Promise((r) => setTimeout(r, 25));
const app = window.__app;
const $ = (s, r = document) => r.querySelector(s);
const click = (sel) => $(sel)?.click();

// ---------- Units (kilometres or miles, °C or °F) ----------
const load = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const units = { dist: load('we-unit', 'km'), temp: load('we-temp', 'C') };
window.__units = units;
const setUnit = (k, v) => { units[k] = v; try { localStorage.setItem(k === 'dist' ? 'we-unit' : 'we-temp', v); } catch {} window.dispatchEvent(new CustomEvent('units-change', { detail: { ...units } })); drawUnits(); };
// the two rows live inside the Settings menu
const rowsHtml = '<div class="srow"><div><b>Distance</b><small>Kilometres or miles</small></div><div class="seg" data-k="dist"><button type="button" data-v="km">km</button><button type="button" data-v="mi">miles</button></div></div><div class="srow"><div><b>Temperature</b><small>Celsius or Fahrenheit</small></div><div class="seg" data-k="temp"><button type="button" data-v="C">°C</button><button type="button" data-v="F">°F</button></div></div>';
const umenu = $('#settings'); umenu.insertAdjacentHTML('beforeend', rowsHtml);
function drawUnits() { umenu.querySelectorAll('.seg').forEach((s) => s.querySelectorAll('button').forEach((b) => { const on = b.dataset.v === units[s.dataset.k]; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); })); }
drawUnits();
umenu.addEventListener('click', (e) => { const b = e.target.closest('.seg button'); if (b) setUnit(b.closest('.seg').dataset.k, b.dataset.v); });

// ---------- the front page ----------
// A launch point, not a menu: one headline, two actions, and three small entry points. The tools themselves live in the map's Layers tab.
const ic = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const land = document.createElement('section');
land.id = 'landing'; land.hidden = true; land.setAttribute('aria-label', 'Welcome to World Explorer');
land.innerHTML = `<div class="ld-hero"><canvas id="ld-globe" aria-hidden="true"></canvas><div class="ld-copy">
    <h2>Explore the world.<br><em>Keep what matters.</em></h2>
    <p class="ld-open">Search countries and cities on an interactive map, save places and map views, and organise them into projects.</p>
    <p class="ld-lock">World Explorer works inside projects. Create your first project, then explore the map, save places and views, and keep notes in it. Projects are saved in this browser.</p>
    <div class="ld-btns"><button type="button" class="ld-go" data-a="map">${ic('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>')}Explore the map</button><button type="button" class="ld-alt" data-a="create">${ic('<path d="M12 5v14M5 12h14"/>')}Create a project</button></div></div></div>
  <div id="ld-gatemsg" class="ld-lock" role="status"></div>
  <section class="ld-how ld-lock" aria-label="How it works"><ol><li><b>Create a project</b><span>Give it a name. It keeps your places, notes and map view together.</span></li><li><b>The map opens inside it</b><span>Search, zoom and click countries as usual.</span></li><li><b>Save as you explore</b><span>Pin countries, cities and map views to your project.</span></li></ol></section>
  <div class="ld-entry">
    <section class="ld-box" aria-labelledby="ld-h-p"><h3 id="ld-h-p">Projects</h3><div id="ld-projects"></div></section>
    <section class="ld-box" aria-labelledby="ld-h-d"><h3 id="ld-h-d">Discover</h3><ul class="ld-list">
      <li><button type="button" data-a="random"><b>Open a random country</b><small>Facts, rankings and news for a place you may not know</small></button></li>
      <li><button type="button" data-a="earth"><b>See the 3D globe</b><small>Spin, tilt and zoom the whole planet</small></button></li>
      <li><button type="button" data-a="layers"><b>Browse layers and tools</b><small>Statistics, historical maps, live flights, distances and more</small></button></li>
      <li><button type="button" data-a="play"><b>Play a trivia game</b><small>Flags and capitals, solo or with friends</small></button></li></ul></section>
    <section class="ld-box" aria-labelledby="ld-h-r"><h3 id="ld-h-r">Recent activity</h3><div id="ld-recent"></div></section>
  </div>
  <p class="ld-foot">Map data © OpenStreetMap contributors · Borders: Natural Earth / world-atlas · Imagery: NASA Blue Marble and Black Marble, Esri · Live data: Open-Meteo, OpenSky</p>`;
$('main').prepend(land);

// a slowly turning Earth, drawn with the country borders and the lights of the cities
const cv = $('#ld-globe', land), g = cv.getContext('2d');
let rings = [], lights = [], rot = 0.9, raf = 0, last = 0;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
fetch('/data/borders.geojson').then((r) => r.json()).then((j) => {
  for (const f of j.features) { const gm = f.geometry, polys = gm.type === 'MultiPolygon' ? gm.coordinates : [gm.coordinates]; for (const p of polys) for (const ring of p) { const out = []; for (let i = 0; i < ring.length; i += 3) out.push(ring[i][0] * Math.PI / 180, ring[i][1] * Math.PI / 180); if (out.length > 6) rings.push(out); } }
  if (!land.hidden) frame(0);
}).catch(() => {});
const pollCities = setInterval(() => { if (app.cities?.length) { lights = app.cities.filter((c) => c.pop > 400000).map((c) => [c.lng * Math.PI / 180, c.lat * Math.PI / 180, Math.min(1, c.pop / 8e6)]); clearInterval(pollCities); } }, 400);
function size() { const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); }
function frame(t) {
  if (land.hidden) { raf = 0; return; }
  raf = requestAnimationFrame(frame);
  if (t - last < 40 && last) return; const dt = t - last; last = t;
  if (!reduce && dt < 500) rot += dt * 0.000045;
  if (!cv.width) size();
  const W = cv.width, H = cv.height, R = Math.min(H * 0.62, W * 0.36), cx = W * 0.72, cy = H * 0.62, tilt = 0.45;
  g.clearRect(0, 0, W, H);
  const halo = g.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.35); halo.addColorStop(0, 'rgba(76,208,242,.16)'); halo.addColorStop(1, 'rgba(76,208,242,0)');
  g.fillStyle = halo; g.fillRect(0, 0, W, H);
  const body = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R); body.addColorStop(0, '#12304f'); body.addColorStop(0.6, '#0a1c33'); body.addColorStop(1, '#050c18');
  g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fillStyle = body; g.fill();
  const st = Math.sin(tilt), ct = Math.cos(tilt);
  const proj = (lon, lat) => { const l = lon + rot, x = Math.cos(lat) * Math.sin(l), y0 = Math.sin(lat), z0 = Math.cos(lat) * Math.cos(l); const y = y0 * ct - z0 * st, z = y0 * st + z0 * ct; return [cx + x * R, cy - y * R, z]; };
  g.lineWidth = Math.max(1, W / 1100); g.strokeStyle = 'rgba(120,205,240,.5)'; g.beginPath();
  for (const ring of rings) { let pen = false; for (let i = 0; i < ring.length; i += 2) { const [x, y, z] = proj(ring[i], ring[i + 1]); if (z > 0) { pen ? g.lineTo(x, y) : g.moveTo(x, y); pen = true; } else pen = false; } }
  g.stroke();
  for (const [lon, lat, s] of lights) { const [x, y, z] = proj(lon, lat); if (z <= 0.02) continue; const a = (0.35 + 0.65 * s) * Math.min(1, z * 2.2); g.fillStyle = `rgba(245,179,74,${a})`; g.beginPath(); g.arc(x, y, (1.1 + 2 * s) * (W / 1300), 0, 7); g.fill(); }
  const shade = g.createLinearGradient(cx - R, cy, cx + R, cy); shade.addColorStop(0, 'rgba(0,0,0,.55)'); shade.addColorStop(0.55, 'rgba(0,0,0,0)'); g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip(); g.fillStyle = shade; g.fillRect(cx - R, cy - R, R * 2, R * 2); g.restore();
  g.lineWidth = 2 * (W / 1300); g.strokeStyle = 'rgba(120,205,240,.4)'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
}
new ResizeObserver(() => { cv.width = 0; }).observe(cv);

// the map needs a project: locked until at least one exists (or a shared read-only project is open)
const locked = () => {
  const p = window.__projects;
  if (!p) return !!window.__noProjects;
  return isLocked({ status: p.store.state.status, count: p.store.state.status === 'ready' ? p.store.list().length : 0, sharedOpen: p.sharedOpen, bypass: !!window.__gateBypass });
};
function paintGate() { const on = locked(); land.classList.toggle('gated', on); document.body.classList.toggle('gated', on); return on; }
function showLanding() {
  paintGate();
  land.hidden = false; land.scrollTop = 0; document.body.classList.add('landing'); drawEntry();
  if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
}
function hideLanding() { if (locked()) return false; land.hidden = true; document.body.classList.remove('gated'); document.body.classList.remove('landing'); try { sessionStorage.setItem('we-landed', '1'); } catch {} }

// the three entry points are filled from what is saved on this device
const P = () => window.__projects;
const el = (tag, cls, ...kids) => { const e = document.createElement(tag); if (cls) e.className = cls; for (const k of kids) e.append(k.nodeType ? k : document.createTextNode(k)); return e; };
function item(title, sub, onclick) { const b = el('button', 'ld-item', el('b', '', title), el('small', '', sub)); b.type = 'button'; b.addEventListener('click', onclick); const li = el('li', '', b); return li; }
function drawEntry() {
  const p = P(), box = $('#ld-projects'), rec = $('#ld-recent'); if (!p) return;
  const gm = $('#ld-gatemsg'); gm.replaceChildren();
  if (p.store.state.status === 'error') {
    gm.append(el('p', 'ld-err', 'Your saved projects could not be read, so the map stays closed until that is fixed.'), act('See what went wrong', () => { window.__gateBypass = true; hideLanding(); window.__workspace.setTab('projects'); }));
  }
  const list = p.store.state.status === 'ready' ? p.store.list() : [];
  box.replaceChildren();
  if (p.store.state.status === 'error') box.append(el('p', 'muted', 'Your saved projects could not be read. Open Projects to see why.'), act('Open Projects', () => { hideLanding(); window.__workspace.setTab('projects'); }));
  else if (!list.length) box.append(el('p', 'muted', 'Keep places, notes and map views together. Projects are saved in this browser.'), act('Create a project', () => GO.create()));
  else {
    const ul = el('ul', 'ld-list');
    for (const pr of list.slice(0, 3)) ul.append(item(pr.name, `${pr.places.length} ${pr.places.length === 1 ? 'place' : 'places'} · updated ${ago(pr.updatedAt)}`, () => { hideLanding(); p.openDetail(pr.id); }));
    box.append(ul, act('All projects', () => { hideLanding(); window.__workspace.setTab('projects'); }));
  }
  rec.replaceChildren();
  const items = p.recent.list().slice(0, 4);
  if (!items.length) rec.append(el('p', 'muted', 'Countries and places you open will appear here, so you can pick up where you left off.'));
  else { const ul = el('ul', 'ld-list'); for (const r of items) ul.append(item(r.name, ({ country: 'Country', city: 'City', place: 'Place', point: 'Map point' })[r.kind] + ' · ' + ago(r.at), () => { hideLanding(); r.kind === 'country' && app.countries[r.ref] ? app.openCountry(r.ref) : app.goTo(r.name, r.lng, r.lat, r.kind === 'city' ? 10 : 12, null, { kind: r.kind, ref: r.ref }); })); rec.append(ul); }
}
function act(label, fn) { const b = el('button', 'ld-more', label); b.type = 'button'; b.addEventListener('click', fn); return b; }

const GO = {
  map() { if (locked()) return GO.create(); hideLanding(); window.__workspace.setTab('projects'); },
  create() { hideLanding(); P().create(); },
  random() { hideLanding(); app.openCountry(app.list[Math.floor(Math.random() * app.list.length)].id); },
  earth() { hideLanding(); click('#globebtn'); },
  layers() { hideLanding(); window.__workspace.setTab('layers'); },
  play() { hideLanding(); click('#playtop'); },
};
land.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (b) GO[b.dataset.a]?.(); });
$('header h1').style.cursor = 'pointer'; $('header h1').addEventListener('click', showLanding);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !land.hidden && !locked() && !document.querySelector('dialog[open]')) GO.map(); });

while (!window.__projects || !window.__workspace) await new Promise((r) => setTimeout(r, 25));
function gateCheck() {
  if (window.__projects?.store.state.status === 'ready') window.__gateBypass = false;
  const lk = locked();
  if (lk && land.hidden) { showLanding(); return; }                       // the last project was deleted, or a shared one was closed
  if (lk) { paintGate(); drawEntry(); return; }
  if (!land.hidden && land.classList.contains('gated')) { hideLanding(); window.__workspace.setTab('projects'); }   // the first project was just created: open the map
  else if (!land.hidden) drawEntry();
}
window.__projects.store.subscribe(gateCheck);
window.addEventListener('gate-check', gateCheck);
let seen = false; try { seen = sessionStorage.getItem('we-landed') === '1'; } catch {}
if (locked() || (!seen && !location.search.includes('map') && !location.hash)) showLanding();
window.__landing = { show: showLanding, hide: hideLanding };
