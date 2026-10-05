// Trade flow lines: click a country and see curved lines to its main export and import partners.
// Line thickness shows the value. Numbers come from UN Comtrade (latest year it has), loaded when you click.
import * as maplibregl from 'maplibre-gl';

while (!window.__app) await new Promise((r) => setTimeout(r, 25));
const app = window.__app;
const { map, countries } = app;
const $ = (s) => document.querySelector(s);
const btn = $('#tradebtn');
let on = true, shownId = null, anim = 0, boxFor = null;
const cacheT = new Map();
const COLORS = { dark: { x: '#52d6ff', m: '#ffa45c' }, light: { x: '#0a68b4', m: '#d4460a' } };
const colors = () => COLORS[app.isDark() ? 'dark' : 'light'];

// Comtrade numbers a few countries differently from the standard ISO codes
const UNCODE = { USA: 842, FRA: 251, ITA: 381, NOR: 579, IND: 699, CHE: 757, TWN: 490 };
const money = (v) => (v >= 1e12 ? `$${(v / 1e12).toFixed(2)} trillion` : v >= 1e9 ? `$${(v / 1e9).toFixed(1)} billion` : v >= 1e6 ? `$${(v / 1e6).toFixed(0)} million` : `$${Math.round(v).toLocaleString('en')}`);

async function flow(id, y, f) {
  const code = UNCODE[id] ?? countries[id].num;
  const url = `https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode=${code}&period=${y}&cmdCode=TOTAL&flowCode=${f}&partner2Code=0&customsCode=C00&motCode=0`;
  const r = await fetch(url); if (!r.ok) throw new Error('UN Comtrade answered ' + r.status);
  const rows = (await r.json()).data || [];
  let total = 0; const by = {};
  for (const d of rows) {
    const v = +d.primaryValue; if (!(v > 0)) continue;
    if (d.partnerCode === 0) { total = Math.max(total, v); continue; }
    const pid = d.partnerISO; if (!countries[pid] || pid === id) continue;
    by[pid] = (by[pid] || 0) + v;
  }
  const list = Object.entries(by).map(([pid, v]) => ({ pid, v })).sort((a, b) => b.v - a.v).slice(0, 7);
  return { total: total || list.reduce((a, b) => a + b.v, 0), list };
}
let baked = null;
async function bakedTrade(id) {
  baked ??= fetch('/data/trade.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const b = await baked; const t = b?.c?.[id]; if (!t) return null;
  const side = (s) => ({ total: s[0], list: s[1].map(([pid, v]) => ({ pid, v })).filter((d) => countries[d.pid]) });
  return { year: b.year, x: side(t.x), m: side(t.m), mirror: !!t.mirror, baked: true };
}
function getTrade(id) {
  if (cacheT.has(id)) return cacheT.get(id);
  const p = (async () => {
    const saved = await bakedTrade(id); if (saved && (saved.x.list.length || saved.m.list.length)) return saved;
    const now = new Date().getFullYear();
    let lastErr;
    for (const y of [now - 2, now - 3, now - 4]) {
      try {
        const [x, m] = await Promise.all([flow(id, y, 'X'), flow(id, y, 'M')]);
        if (x.list.length || m.list.length) return { year: y, x, m };
      } catch (e) { lastErr = e; if (!/answered|fetch|Failed|NetworkError|Load/i.test(e.message)) throw e; }
    }
    throw lastErr || new Error('UN Comtrade has no trade figures for this country');
  })();
  cacheT.set(id, p); p.catch(() => cacheT.delete(id));
  return p;
}

// ---------- drawing ----------
function ensureLayers() {
  if (map.getSource('trade')) return;
  const empty = { type: 'FeatureCollection', features: [] };
  map.addSource('trade', { type: 'geojson', data: empty });
  map.addSource('tradepts', { type: 'geojson', data: empty });
  const c = colors(), mk = ['match', ['get', 'k'], 'x', c.x, c.m];
  map.addLayer({ id: 'trade-glow', type: 'line', source: 'trade', layout: { 'line-cap': 'round' }, paint: { 'line-color': mk, 'line-width': ['+', ['get', 'w'], 6], 'line-blur': 5, 'line-opacity': 0.3 } });
  map.addLayer({ id: 'trade-lines', type: 'line', source: 'trade', layout: { 'line-cap': 'round' }, paint: { 'line-color': mk, 'line-width': ['get', 'w'], 'line-opacity': 0.9 } });
  map.addLayer({ id: 'trade-pts', type: 'circle', source: 'tradepts', paint: { 'circle-radius': ['+', 3, ['/', ['get', 'w'], 2]], 'circle-color': mk, 'circle-stroke-color': '#000', 'circle-stroke-width': 1, 'circle-opacity': 0.95 } });
  const pop = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: 'tradepop' });
  map.on('mouseenter', 'trade-pts', (e) => {
    map.getCanvas().style.cursor = 'help';
    const f = e.features[0]; pop.setLngLat(f.geometry.coordinates).setHTML(`<b>${f.properties.name}</b><br>${f.properties.k === 'x' ? 'Exports to' : 'Imports from'} · ${f.properties.val}`).addTo(map);
  });
  map.on('mouseleave', 'trade-pts', () => { map.getCanvas().style.cursor = ''; pop.remove(); });
}
function recolorLines() {
  if (!map.getLayer('trade-lines')) return;
  const c = colors(), mk = ['match', ['get', 'k'], 'x', c.x, c.m];
  for (const id of ['trade-glow', 'trade-lines']) map.setPaintProperty(id, 'line-color', mk);
  map.setPaintProperty('trade-pts', 'circle-color', mk);
  map.setPaintProperty('trade-pts', 'circle-stroke-color', app.isDark() ? '#000' : '#fff');
}
window.addEventListener('maptheme-change', recolorLines);
window.addEventListener('view-change', recolorLines);

// a curved line between two places; `bend` sets how high it arcs, `t` how much of it is drawn
function arc(from, to, bend, t) {
  const dl = ((to[0] - from[0] + 540) % 360) - 180; // always take the short way round the globe
  const a = from, b = [from[0] + dl, to[1]];
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len; if (ny < 0) { nx = -nx; ny = -ny; } // arc towards the north
  const k = len * bend, cx = (a[0] + b[0]) / 2 + nx * k, cy = Math.min(80, (a[1] + b[1]) / 2 + ny * k);
  const n = 48, pts = [];
  for (let i = 0; i <= Math.round(n * t); i++) {
    const u = i / n, v = 1 - u;
    pts.push([v * v * a[0] + 2 * v * u * cx + u * u * b[0], v * v * a[1] + 2 * v * u * cy + u * u * b[1]]);
  }
  return pts;
}
function draw(id, data) {
  ensureLayers(); recolorLines();
  const c = countries[id], from = [c.latlng[1], c.latlng[0]];
  const items = [];
  const maxV = Math.max(...data.x.list.map((d) => d.v), ...data.m.list.map((d) => d.v), 1);
  for (const [k, bend, src] of [['x', 0.17, data.x], ['m', 0.33, data.m]]) {
    for (const d of src.list) {
      const p = countries[d.pid]; if (!p?.latlng) continue;
      items.push({ k, bend, to: [p.latlng[1], p.latlng[0]], w: 1.4 + 8 * Math.sqrt(d.v / maxV), name: p.name, val: money(d.v) });
    }
  }
  cancelAnimationFrame(anim);
  const start = performance.now(), D = 750;
  const frame = (now) => {
    const t = Math.min(1, (now - start) / D), e = 1 - Math.pow(1 - t, 3);
    map.getSource('trade')?.setData({ type: 'FeatureCollection', features: items.map((it) => ({ type: 'Feature', properties: { k: it.k, w: it.w }, geometry: { type: 'LineString', coordinates: arc(from, it.to, it.bend, e) } })) });
    if (t < 1) anim = requestAnimationFrame(frame);
    else map.getSource('tradepts')?.setData({ type: 'FeatureCollection', features: items.map((it) => ({ type: 'Feature', properties: { k: it.k, w: it.w, name: it.name, val: it.val }, geometry: { type: 'Point', coordinates: arc(from, it.to, it.bend, 1).pop() } })) });
  };
  map.getSource('tradepts')?.setData({ type: 'FeatureCollection', features: [] });
  anim = requestAnimationFrame(frame);
}
function clearLines() {
  cancelAnimationFrame(anim); shownId = null;
  const empty = { type: 'FeatureCollection', features: [] };
  map.getSource('trade')?.setData(empty); map.getSource('tradepts')?.setData(empty);
}

// ---------- the Trade tab ----------
function renderBox(id, d) {
  const box = $('#tradebox'); if (!box) return;
  const rows = (src) => src.list.map((p) => `<tr><td>${countries[p.pid].flag} ${countries[p.pid].name}</td><td>${money(p.v)}</td><td class="muted">${src.total ? Math.round((p.v / src.total) * 100) + '%' : ''}</td></tr>`).join('') || '<tr><td class="muted" colspan="3">No figures</td></tr>';
  box.innerHTML = `<p class="muted">Main trading partners in ${d.year}. On the map, thicker lines mean more trade.</p>
    <h3><i class="tdot x"></i>Exports to</h3><table>${rows(d.x)}</table>
    <h3><i class="tdot m"></i>Imports from</h3><table>${rows(d.m)}</table>
    <div class="note">${d.baked ? `Source: World Bank WITS, goods only, ${d.year}.${d.mirror ? ' This country does not report its own trade, so these figures come from its partners\' records and cover only partners that report.' : ''}` : 'Source: UN Comtrade, goods only, latest year it has for this country.'} Each side lists the top partners, and the percentage is their share of the country's total in that direction.</div>`;
}
function renderErr(id, e) {
  const box = $('#tradebox'); if (!box) return;
  box.innerHTML = `<div class="note">Trade partners could not be loaded right now (${e.message}). This comes from the UN Comtrade service, which sometimes limits free requests.</div><div class="chips"><button type="button" id="trade-retry">Try again</button></div>`;
  $('#trade-retry').onclick = () => { box.innerHTML = '<p class="muted">Loading trade partners…</p>'; load(id, true); };
}
async function load(id, tabOpen) {
  const wantLines = on, wantBox = tabOpen || !!$('#tradebox');
  if (!wantLines && !wantBox) return;
  try {
    const d = await getTrade(id);
    if (panelId() !== id) return; // the window was closed or another country was opened meanwhile
    if (wantLines && on) { draw(id, d); shownId = id; }
    if ($('#tradebox')) renderBox(id, d);
  } catch (e) { if (panelId() === id) renderErr(id, e); }
}
const panelId = () => (location.hash || '').slice(1);

window.addEventListener('country-open', (e) => {
  const { id, tab } = e.detail;
  if (id !== shownId && !on) clearLines();
  if (tab === 'trade') { boxFor = id; load(id, true); }
  else if (id !== shownId) { clearLines(); load(id, false); }
});
window.addEventListener('country-close', clearLines);
btn.addEventListener('click', () => {
  on = !on; btn.classList.toggle('on', on);
  if (!on) clearLines();
  else if (panelId() && countries[panelId()]) load(panelId(), false);
});
