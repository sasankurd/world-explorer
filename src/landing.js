// Front page, top-bar links and the Units menu.
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
const ic = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const CARDS = [
  ['earth', 'Live Earth', 'Spin, tilt and zoom a 3D globe with day and night.', ic('<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>')],
  ['data', 'Country Data', 'Population, economy, health, education and more, by year.', ic('<path d="M5 20V10M12 20V4M19 20v-7"/>')],
  ['flights', 'Flight Tracker', 'Planes in the air right now, and where each is going.', ic('<path d="M10.5 13.5L3 11l1.5-1.5 8-.5L17 4.5a1.8 1.8 0 0 1 2.5 2.5L15 11.5l-.5 8L13 21l-2.5-7.5z"/>')],
  ['history', 'Historical Maps', 'See how borders and countries changed, from 123,000 BC.', ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')],
  ['play', 'Play', 'Trivia games about the world, solo or with friends.', ic('<rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="15.5" cy="11.5" r=".6" fill="currentColor"/><circle cx="18" cy="13.5" r=".6" fill="currentColor"/>')],
  ['measure', 'Distance & measure', 'Distance and travel time by foot, bike, car or train.', ic('<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>')],
];
const land = document.createElement('section');
land.id = 'landing'; land.hidden = true; land.setAttribute('aria-label', 'Welcome to World Explorer');
land.innerHTML = `<div class="ld-hero"><canvas id="ld-globe" aria-hidden="true"></canvas><div class="ld-copy"><h2>The world, <em>in context.</em></h2><p>Explore our planet through maps, data, history and live global activity.</p>
  <div class="ld-btns"><button type="button" class="ld-go" data-a="map">${ic('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>')} Explore the globe <span aria-hidden="true">→</span></button><button type="button" class="ld-alt" data-a="countries">${ic('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>')} Discover countries</button></div></div></div>
  <div class="ld-cards">${CARDS.map(([k, t, d, i]) => `<button type="button" class="ld-card c-${k}" data-a="${k}"><span class="ld-ic">${i}</span><span class="ld-tx"><b>${t}</b><small>${d}</small></span><span class="ld-ar" aria-hidden="true">→</span></button>`).join('')}</div>
  <p class="ld-foot">Map data © OpenStreetMap contributors · Borders: Natural Earth / world-atlas · Photos: NASA Blue Marble and Black Marble · Live data: Open-Meteo, OpenSky</p>`;
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
  const halo = g.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.35); halo.addColorStop(0, 'rgba(70,170,255,.35)'); halo.addColorStop(1, 'rgba(70,170,255,0)');
  g.fillStyle = halo; g.fillRect(0, 0, W, H);
  const body = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R); body.addColorStop(0, '#0f3a66'); body.addColorStop(0.6, '#07203d'); body.addColorStop(1, '#020a16');
  g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fillStyle = body; g.fill();
  const st = Math.sin(tilt), ct = Math.cos(tilt);
  const proj = (lon, lat) => { const l = lon + rot, x = Math.cos(lat) * Math.sin(l), y0 = Math.sin(lat), z0 = Math.cos(lat) * Math.cos(l); const y = y0 * ct - z0 * st, z = y0 * st + z0 * ct; return [cx + x * R, cy - y * R, z]; };
  g.lineWidth = Math.max(1, W / 1100); g.strokeStyle = 'rgba(110,200,255,.55)'; g.beginPath();
  for (const ring of rings) { let pen = false; for (let i = 0; i < ring.length; i += 2) { const [x, y, z] = proj(ring[i], ring[i + 1]); if (z > 0) { pen ? g.lineTo(x, y) : g.moveTo(x, y); pen = true; } else pen = false; } }
  g.stroke();
  for (const [lon, lat, s] of lights) { const [x, y, z] = proj(lon, lat); if (z <= 0.02) continue; const a = (0.35 + 0.65 * s) * Math.min(1, z * 2.2); g.fillStyle = `rgba(255,200,110,${a})`; g.beginPath(); g.arc(x, y, (1.1 + 2 * s) * (W / 1300), 0, 7); g.fill(); }
  const shade = g.createLinearGradient(cx - R, cy, cx + R, cy); shade.addColorStop(0, 'rgba(0,0,0,.55)'); shade.addColorStop(0.55, 'rgba(0,0,0,0)'); g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip(); g.fillStyle = shade; g.fillRect(cx - R, cy - R, R * 2, R * 2); g.restore();
  g.lineWidth = 2 * (W / 1300); g.strokeStyle = 'rgba(120,200,255,.55)'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
}
new ResizeObserver(() => { cv.width = 0; }).observe(cv);

function showLanding() {
  land.hidden = false; land.scrollTop = 0; document.body.classList.add('landing'); setNav('explore');
  if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
}
function hideLanding() { land.hidden = true; setNav(''); document.body.classList.remove('landing'); try { sessionStorage.setItem('we-landed', '1'); } catch {} }
const whenReady = (fn, tries = 30) => { if (fn()) return; if (tries > 0) setTimeout(() => whenReady(fn, tries - 1), 100); };
const GO = {
  map() { hideLanding(); if (app.view === 'stats' || app.view === 'globe') click('[data-view="political"]'); },
  countries() { hideLanding(); $('#search')?.focus(); },
  earth() { hideLanding(); click('#globebtn'); },
  data() { hideLanding(); if (app.view !== 'stats') click('[data-view="stats"]'); },
  history() { hideLanding(); if (app.view !== 'stats') click('[data-view="stats"]'); whenReady(() => { const b = $('#sb-groups [data-history]'); if (!b) return false; if (!b.classList.contains('on')) b.click(); return true; }); },
  flights() { hideLanding(); if (!$('#flightbtn').classList.contains('on')) click('#flightbtn'); },
  play() { hideLanding(); click('#playtop'); },
  measure() { hideLanding(); if (!$('#measurebtn').classList.contains('on')) click('#measurebtn'); },
};
land.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (b) GO[b.dataset.a]?.(); });

// ---------- links in the top bar ----------
const nav = document.createElement('nav');
nav.id = 'topnav'; nav.setAttribute('aria-label', 'Main');
nav.innerHTML = [['explore', 'Explore'], ['countries', 'Countries'], ['earth', 'Live Earth'], ['history', 'History'], ['data', 'Data']].map(([k, t]) => `<button type="button" data-n="${k}">${t}</button>`).join('');
$('header h1').after(nav);
function setNav(k) { nav.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.n === k)); }
nav.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; const k = b.dataset.n; if (k === 'explore') showLanding(); else { GO[k](); setNav(k === 'countries' ? '' : k); } });
$('header h1').style.cursor = 'pointer'; $('header h1').addEventListener('click', showLanding);
window.addEventListener('view-change', (e) => { if (land.hidden) setNav(e.detail === 'stats' ? 'data' : e.detail === 'globe' ? 'earth' : ''); });
window.addEventListener('globe-change', () => { if (land.hidden) setNav(app.view === 'globe' || $('#globebtn')?.classList.contains('on') ? 'earth' : ''); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !land.hidden) GO.map(); });

let seen = false; try { seen = sessionStorage.getItem('we-landed') === '1'; } catch {}
if (!seen && !location.search.includes('map') && !location.hash) showLanding(); else setNav('');
window.__landing = { show: showLanding, hide: hideLanding };
