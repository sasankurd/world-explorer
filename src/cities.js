// Cities: a list of cities inside a country's Geography tab, a detail view for each city, floating cards you can drag
// around the map, and a window that puts cities side by side. People can add cities of their own.
// Facts that work offline: name, country, size, position. Live facts come from free services that need no key:
// Open-Meteo (weather, local time, elevation, sunrise and sunset; also finds cities by name) and Wikipedia (a short description).
import * as maplibregl from 'maplibre-gl';

while (!window.__app) await new Promise((r) => setTimeout(r, 25));
const app = window.__app;
const { map, countries } = app;
const $ = (s, r = document) => r.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const enc = encodeURIComponent;
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`.]/g, '').replace(/[-–,_/]+/g, ' ').trim();
const fmt = (n, d = 0) => Number(n).toLocaleString('en', { maximumFractionDigits: d });
const keyOf = (c) => `${norm(c.name)}|${(+c.lng).toFixed(2)}|${(+c.lat).toFixed(2)}`;
const store = (k, v) => { try { v === undefined ? JSON.parse(localStorage.getItem(k) || '[]') : localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
const km = (a, b) => { const R = 6371, r = Math.PI / 180, dl = (b.lat - a.lat) * r, dg = (b.lng - a.lng) * r, h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dg / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

let custom = read('we-cities');           // cities people added
let compare = read('we-compare');         // cities in the compare window
const allCities = () => [...(app.cities || []), ...custom];
const inCountry = (id) => allCities().filter((c) => c.cc === id).sort((a, b) => (b.cap - a.cap) || (b.pop - a.pop));
const capitalOf = (id) => (app.cities || []).find((c) => c.cc === id && c.cap);

// ---------- live facts ----------
const WMO = { 0: ['☀️', 'Clear sky'], 1: ['🌤️', 'Mostly clear'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Overcast'], 45: ['🌫️', 'Fog'], 48: ['🌫️', 'Freezing fog'], 51: ['🌦️', 'Light drizzle'], 53: ['🌦️', 'Drizzle'], 55: ['🌧️', 'Heavy drizzle'], 56: ['🌧️', 'Freezing drizzle'], 57: ['🌧️', 'Freezing drizzle'], 61: ['🌦️', 'Light rain'], 63: ['🌧️', 'Rain'], 65: ['🌧️', 'Heavy rain'], 66: ['🌧️', 'Freezing rain'], 67: ['🌧️', 'Freezing rain'], 71: ['🌨️', 'Light snow'], 73: ['🌨️', 'Snow'], 75: ['❄️', 'Heavy snow'], 77: ['🌨️', 'Snow grains'], 80: ['🌦️', 'Rain showers'], 81: ['🌧️', 'Rain showers'], 82: ['⛈️', 'Violent showers'], 85: ['🌨️', 'Snow showers'], 86: ['❄️', 'Snow showers'], 95: ['⛈️', 'Thunderstorm'], 96: ['⛈️', 'Thunderstorm, hail'], 99: ['⛈️', 'Thunderstorm, hail'] };
const lives = new Map(), wikis = new Map();
function live(c) {
  const k = keyOf(c), old = lives.get(k);
  if (old && Date.now() - old.t < 600000) return old.p;
  const p = (async () => {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&daily=sunrise,sunset&timezone=auto&forecast_days=1`;
    const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    return { tz: j.timezone, off: j.utc_offset_seconds, elev: j.elevation, cur: j.current || {}, sunrise: j.daily?.sunrise?.[0], sunset: j.daily?.sunset?.[0] };
  })();
  lives.set(k, { t: Date.now(), p }); p.catch(() => lives.delete(k));
  return p;
}
function wiki(c) {
  const k = keyOf(c); if (wikis.has(k)) return wikis.get(k);
  const country = countries[c.cc]?.name || '';
  const get = async (title) => { const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${enc(title.replace(/ /g, '_'))}?redirect=true`); if (!r.ok) return null; const j = await r.json(); return j.type === 'standard' && j.extract ? j : null; };
  const p = (async () => (country ? (await get(`${c.name}, ${country}`)) : null) || (await get(c.name)))().catch(() => null);
  wikis.set(k, p); return p;
}
const hhmm = (tz) => { try { return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(new Date()); } catch { return '—'; } };
const offText = (s) => { const h = s / 3600, a = Math.abs(h); return `UTC${h < 0 ? '−' : '+'}${Math.floor(a)}${a % 1 ? ':' + String(Math.round((a % 1) * 60)).padStart(2, '0') : ''}`; };
const vsYou = (s) => { const d = (s - -new Date().getTimezoneOffset() * 60) / 3600; return d === 0 ? 'same time as you' : `${fmt(Math.abs(d), 1)} h ${d > 0 ? 'ahead of' : 'behind'} you`; };

// ---------- what we say about a city ----------
const FIELDS = [
  ['country', 'Country', (c) => { const k = countries[c.cc]; return k ? `${k.flag} ${esc(k.name)}` : '—'; }],
  ['kind', 'Status', (c) => (c.cap ? '★ Capital' : c.custom ? 'Added by you' : 'City')],
  ['pop', 'Population', (c) => (c.pop > 1 ? fmt(c.pop) : '—')],
  ['share', 'Share of country', (c) => { const k = countries[c.cc]; return k?.population && c.pop > 1 ? `${fmt((c.pop / k.population) * 100, c.pop / k.population < 0.01 ? 2 : 1)}%` : '—'; }],
  ['rank', 'Rank in country', (c) => { const l = inCountry(c.cc).filter((x) => x.pop > 1).sort((a, b) => b.pop - a.pop), i = l.findIndex((x) => keyOf(x) === keyOf(c)); return i < 0 ? '—' : `${i + 1} of ${l.length} listed`; }],
  ['time', 'Local time', () => '<span data-f="time">…</span>'],
  ['vs', 'Compared with you', () => '<span data-f="vs">…</span>'],
  ['weather', 'Weather now', () => '<span data-f="weather">…</span>'],
  ['temp', 'Temperature', () => '<span data-f="temp">…</span>'],
  ['hum', 'Humidity', () => '<span data-f="hum">…</span>'],
  ['wind', 'Wind', () => '<span data-f="wind">…</span>'],
  ['elev', 'Height above sea', () => '<span data-f="elev">…</span>'],
  ['sunrise', 'Sunrise', () => '<span data-f="sunrise">…</span>'],
  ['sunset', 'Sunset', () => '<span data-f="sunset">…</span>'],
  ['where', 'Position', (c) => `${Math.abs(c.lat).toFixed(2)}° ${c.lat >= 0 ? 'N' : 'S'}, ${Math.abs(c.lng).toFixed(2)}° ${c.lng >= 0 ? 'E' : 'W'}`],
  ['cap', 'From the capital', (c) => { const cap = capitalOf(c.cc); return !cap || c.cap ? '—' : `${fmt(km(cap, c))} km from ${esc(cap.name)}`; }],
];
const fieldOf = (k) => FIELDS.find((f) => f[0] === k);
const dash = '—';
function fillLive(root, l) {
  const set = (f, v, extra) => root.querySelectorAll(`[data-f="${f}"]`).forEach((e) => { e.textContent = v; if (extra) Object.assign(e.dataset, extra); });
  if (!l) { for (const f of ['time', 'vs', 'weather', 'temp', 'hum', 'wind', 'elev', 'sunrise', 'sunset']) set(f, dash); return; }
  const w = WMO[l.cur.weather_code] || ['', '—'];
  set('time', `${hhmm(l.tz)} · ${offText(l.off)}`, { ctz: l.tz, coff: offText(l.off) });
  set('vs', vsYou(l.off));
  set('weather', l.cur.weather_code == null ? dash : `${w[0]} ${w[1]}`);
  set('temp', l.cur.temperature_2m == null ? dash : `${Math.round(l.cur.temperature_2m)} °C${l.cur.apparent_temperature != null ? ` (feels ${Math.round(l.cur.apparent_temperature)})` : ''}`, { n: l.cur.temperature_2m });
  set('hum', l.cur.relative_humidity_2m == null ? dash : `${Math.round(l.cur.relative_humidity_2m)}%`);
  set('wind', l.cur.wind_speed_10m == null ? dash : `${Math.round(l.cur.wind_speed_10m)} km/h`);
  set('elev', l.elev == null ? dash : `${fmt(l.elev)} m`, { n: l.elev });
  set('sunrise', l.sunrise ? l.sunrise.slice(11, 16) : dash); set('sunset', l.sunset ? l.sunset.slice(11, 16) : dash);
}
function paintLive(root, c) { live(c).then((l) => fillLive(root, l), () => fillLive(root, null)); }
setInterval(() => document.querySelectorAll('[data-ctz]').forEach((e) => { e.textContent = `${hhmm(e.dataset.ctz)} · ${e.dataset.coff}`; }), 1000);
const rows = (c, keys) => keys.map((k) => { const f = fieldOf(k); return `<tr><td>${f[1]}</td><td>${f[2](c)}</td></tr>`; }).join('');

// ---------- the pins that show where cities are ----------
const pins = new Map();
function syncPins() {
  const want = new Map();
  for (const x of cards.values()) want.set(keyOf(x.city), x.city);
  for (const c of compare) want.set(keyOf(c), c);
  for (const [k, p] of pins) if (!want.has(k)) { p.remove(); pins.delete(k); }
  for (const [k, c] of want) if (!pins.has(k)) {
    const el = document.createElement('div'); el.className = 'cpin'; el.innerHTML = `<span class="pn">${esc(c.name)}</span><span class="pt"></span>`;
    pins.set(k, new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([c.lng, c.lat]).addTo(map));
  }
}
const showOnMap = (c) => map.flyTo({ center: [c.lng, c.lat], zoom: Math.max(map.getZoom(), c.cap || c.pop > 1e6 ? 8.5 : 9.5), duration: 1100 });

// ---------- dragging ----------
function draggable(el, handle) {
  let sx, sy, ox, oy, on = false;
  handle.style.touchAction = 'none';
  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button,input,select,a')) return;
    on = true; sx = e.clientX; sy = e.clientY; ox = el.offsetLeft; oy = el.offsetTop; handle.setPointerCapture(e.pointerId); front(el);
  });
  handle.addEventListener('pointermove', (e) => {
    if (!on) return; const host = el.parentElement;
    el.style.left = Math.max(0, Math.min(host.clientWidth - 60, ox + e.clientX - sx)) + 'px';
    el.style.top = Math.max(0, Math.min(host.clientHeight - 36, oy + e.clientY - sy)) + 'px';
    el.style.right = 'auto';
  });
  const up = () => { on = false; };
  handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
  el.addEventListener('pointerdown', () => front(el));
}
let z = 20; const front = (el) => { el.style.zIndex = ++z; };
const host = $('#cityfloat');

// ---------- floating city cards ----------
const cards = new Map();
function popOut(c) {
  const k = keyOf(c);
  if (cards.has(k)) { front(cards.get(k).el); return; }
  const el = document.createElement('section'); el.className = 'ccard'; el.setAttribute('aria-label', `${c.name} card`);
  const k2 = countries[c.cc];
  el.innerHTML = `<header><span class="g" aria-hidden="true">⠿</span><b>${k2 ? k2.flag + ' ' : ''}${esc(c.name)}${c.cap ? ' ★' : ''}</b><button type="button" data-a="cmp" title="Add to the compare window" aria-label="Compare">⚖</button><button type="button" data-a="map" title="Show on the map" aria-label="Show on the map">📍</button><button type="button" data-a="x" title="Close" aria-label="Close">✕</button></header>
    <table>${rows(c, ['time', 'weather', 'temp', 'pop', 'elev', 'sunrise', 'sunset'])}</table>`;
  const n = cards.size, hostBox = host.getBoundingClientRect();
  const panelOpen = !$('#panel').hidden;
  el.style.left = Math.min(hostBox.width - 270, (panelOpen ? 430 : 24) + n * 26) + 'px'; el.style.top = Math.min(hostBox.height - 200, 80 + n * 26) + 'px';
  host.append(el); front(el); draggable(el, $('header', el));
  el.addEventListener('click', (e) => {
    const a = e.target.closest('button')?.dataset.a; if (!a) return;
    if (a === 'x') { el.remove(); cards.delete(k); syncPins(); }
    if (a === 'cmp') addCompare(c);
    if (a === 'map') showOnMap(c);
  });
  cards.set(k, { el, city: c }); syncPins(); paintLive(el, c);
}

// ---------- finding cities (ours first, then anywhere on Earth) ----------
async function searchCities(q, cc) {
  const n = norm(q); if (n.length < 2) return [];
  const local = allCities().filter((c) => (!cc || c.cc === cc) && norm(c.name).includes(n))
    .sort((a, b) => (norm(b.name).startsWith(n) - norm(a.name).startsWith(n)) || (b.pop - a.pop)).slice(0, 6);
  return local;
}
async function searchOnline(q, cc) {
  const iso2 = cc ? countries[cc]?.iso2 : '';
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${enc(q)}&count=8&language=en&format=json${iso2 ? '&countryCode=' + iso2 : ''}`);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  return (j.results || []).map((x) => ({ name: x.name, lng: x.longitude, lat: x.latitude, pop: x.population || 0, cap: false, cc: Object.values(countries).find((c) => c.iso2 === x.country_code)?.id, custom: true, admin: x.admin1 || '' }))
    .filter((x) => x.cc);
}
// a city from the online search joins the list only if we do not already have it nearby
function adopt(c) {
  const near = allCities().find((x) => x.cc === c.cc && norm(x.name) === norm(c.name) && km(x, c) < 60) || allCities().find((x) => km(x, c) < 8 && norm(x.name) === norm(c.name));
  if (near) return near;
  custom = [...custom, { name: c.name, lng: +c.lng.toFixed(3), lat: +c.lat.toFixed(3), pop: c.pop, cap: false, cc: c.cc, custom: true, admin: c.admin }]; store('we-cities', custom);
  return custom[custom.length - 1];
}
// a small search box that shows local matches at once and online matches after a short pause
function cityPicker(input, out, { cc, onPick }) {
  let t = 0, seq = 0;
  const draw = (items, note) => {
    out.innerHTML = items.map((c, i) => { const k = countries[c.cc]; return `<li data-i="${i}">${k ? k.flag : '📍'} <b>${esc(c.name)}</b><span class="muted"> · ${esc(k?.name || '')}${c.admin ? ', ' + esc(c.admin) : ''}${c.pop > 1 ? ' · ' + (c.pop >= 1e6 ? (c.pop / 1e6).toFixed(1) + ' M' : Math.round(c.pop / 1000) + ' k') : ''}${c.net ? ' · online' : ''}</span></li>`; }).join('') + (note ? `<li class="note">${esc(note)}</li>` : '');
    out._items = items;
  };
  input.addEventListener('input', async () => {
    clearTimeout(t); const q = input.value.trim(), mine = ++seq;
    if (q.length < 2) { out.innerHTML = ''; return; }
    const local = await searchCities(q, cc); draw(local, q.length >= 3 ? 'Searching the whole world…' : '');
    if (q.length < 3) return;
    t = setTimeout(async () => {
      try {
        const on = (await searchOnline(q, cc)).filter((o) => !local.some((l) => norm(l.name) === norm(o.name) && km(l, o) < 60)).map((o) => ({ ...o, net: true }));
        if (mine === seq) draw([...local, ...on], local.length + on.length ? '' : 'No city found. Check the spelling.');
      } catch { if (mine === seq) draw(local, local.length ? '' : 'Could not search online right now.'); }
    }, 380);
  });
  out.addEventListener('click', (e) => { const li = e.target.closest('li[data-i]'); if (!li) return; const c = out._items[li.dataset.i]; out.innerHTML = ''; input.value = ''; onPick(c.net ? adopt(c) : c); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && out._items?.length) { e.preventDefault(); const c = out._items[0]; out.innerHTML = ''; input.value = ''; onPick(c.net ? adopt(c) : c); } });
}

// ---------- the compare window ----------
let cmpEl = null;
function ensureCompare() {
  if (cmpEl) return cmpEl;
  cmpEl = document.createElement('section'); cmpEl.id = 'citycmp'; cmpEl.setAttribute('aria-label', 'Compare cities'); cmpEl.hidden = true;
  cmpEl.innerHTML = `<header><span class="g" aria-hidden="true">⠿</span><b>⚖ Compare cities</b><button type="button" data-a="fit" title="Zoom the map to show them all" aria-label="Show all on the map">📍</button><button type="button" data-a="clear" title="Remove all" aria-label="Remove all">🗑</button><button type="button" data-a="x" title="Close" aria-label="Close">✕</button></header>
    <div class="cc-add"><input type="search" placeholder="Add a city, anywhere in the world…" autocomplete="off" aria-label="Add a city to compare"><ul class="cc-res"></ul></div>
    <div class="cc-scroll"><div class="cc-empty muted">Add two or more cities to see them side by side.</div></div>`;
  host.append(cmpEl); draggable(cmpEl, $('header', cmpEl));
  cmpEl.style.right = '12px'; cmpEl.style.top = '70px';
  cityPicker($('input', cmpEl), $('.cc-res', cmpEl), { onPick: (c) => addCompare(c) });
  cmpEl.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'x') cmpEl.hidden = true;
    if (b.dataset.a === 'clear') { compare = []; store('we-compare', compare); renderCompare(); syncPins(); }
    if (b.dataset.a === 'fit') fitAll();
    if (b.dataset.rm) { compare = compare.filter((c) => keyOf(c) !== b.dataset.rm); store('we-compare', compare); renderCompare(); syncPins(); }
    if (b.dataset.pop) popOut(compare.find((c) => keyOf(c) === b.dataset.pop));
    if (b.dataset.go) showOnMap(compare.find((c) => keyOf(c) === b.dataset.go));
  });
  return cmpEl;
}
function fitAll() {
  if (!compare.length) return;
  const b = new maplibregl.LngLatBounds(); compare.forEach((c) => b.extend([c.lng, c.lat]));
  map.fitBounds(b, { padding: { top: 90, bottom: 90, left: 90, right: 90 }, maxZoom: 7, duration: 1000 });
}
const CMP_ROWS = ['country', 'kind', 'pop', 'share', 'time', 'vs', 'weather', 'temp', 'hum', 'wind', 'elev', 'sunrise', 'sunset', 'where'];
function renderCompare() {
  const el = ensureCompare(), box = $('.cc-scroll', el);
  if (!compare.length) { box.innerHTML = '<div class="cc-empty muted">Add two or more cities to see them side by side.</div>'; return; }
  const head = compare.map((c) => `<th scope="col"><div class="cc-h"><b>${esc(c.name)}</b><span class="cc-b"><button type="button" data-pop="${esc(keyOf(c))}" title="Pop out as a floating card" aria-label="Pop out ${esc(c.name)}">⇱</button><button type="button" data-go="${esc(keyOf(c))}" title="Show on the map" aria-label="Show ${esc(c.name)} on the map">📍</button><button type="button" data-rm="${esc(keyOf(c))}" title="Remove" aria-label="Remove ${esc(c.name)}">✕</button></span></div></th>`).join('');
  const body = CMP_ROWS.map((k) => `<tr data-k="${k}"><th scope="row">${fieldOf(k)[1]}</th>${compare.map((c) => `<td data-c="${esc(keyOf(c))}">${fieldOf(k)[2](c)}</td>`).join('')}</tr>`).join('')
    + (compare.length > 1 ? `<tr data-k="dist"><th scope="row">Distance from ${esc(compare[0].name)}</th>${compare.map((c, i) => `<td>${i ? fmt(km(compare[0], c)) + ' km' : '—'}</td>`).join('')}</tr>` : '');
  box.innerHTML = `<table class="cc-t"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table>`;
  // the biggest population is marked straight away
  markBest(box, 'pop', (td) => +td.textContent.replace(/[^0-9]/g, '') || 0);
  Promise.all(compare.map((c) => live(c).then((l) => { box.querySelectorAll(`td[data-c="${CSS.escape(keyOf(c))}"]`).forEach((td) => fillLive(td, l)); }, () => box.querySelectorAll(`td[data-c="${CSS.escape(keyOf(c))}"]`).forEach((td) => fillLive(td, null))))).then(() => {
    markBest(box, 'temp', (td) => { const s = td.querySelector('[data-n]'); return s ? +s.dataset.n : -1e9; });
    markBest(box, 'elev', (td) => { const s = td.querySelector('[data-n]'); return s ? +s.dataset.n : -1e9; });
  });
}
function markBest(box, key, val) {
  const tds = [...box.querySelectorAll(`tr[data-k="${key}"] td`)]; if (tds.length < 2) return;
  const vs = tds.map(val), max = Math.max(...vs); tds.forEach((td, i) => td.classList.toggle('best', vs[i] === max && max > -1e8));
}
function addCompare(c) {
  if (!compare.some((x) => keyOf(x) === keyOf(c))) { if (compare.length >= 6) compare.shift(); compare.push(c); store('we-compare', compare); }
  ensureCompare().hidden = false; front(cmpEl); renderCompare(); syncPins();
}

// ---------- inside a country's Geography tab ----------
const sortedFor = (id) => inCountry(id);
function cityRow(c) {
  const bits = [c.cap ? '<span class="cap">★ capital</span>' : '', c.custom ? '<span class="cap mine">yours</span>' : ''].join('');
  return `<button type="button" class="cty-row" data-k="${esc(keyOf(c))}"><span class="nm">${esc(c.name)} ${bits}</span><span class="v">${c.pop > 1 ? (c.pop >= 1e6 ? (c.pop / 1e6).toFixed(1) + ' M' : Math.round(c.pop / 1000) + ' k') : ''}</span></button>`;
}
function inject(id) {
  const panel = $('#panel'), c = countries[id]; if (!c || panel.hidden) return;
  const anchor = [...panel.querySelectorAll('h3')].find((h) => /Look at the land/.test(h.textContent)); if (!anchor || $('#cty')) return;
  const sec = document.createElement('section'); sec.id = 'cty';
  const total = () => sortedFor(id).length;
  sec.innerHTML = `<h3><button type="button" id="cty-tg" class="cty-tg" aria-expanded="false" aria-controls="cty-box">🏙️ Cities in ${esc(c.name)} <span class="count">${total()}</span><span class="chev" aria-hidden="true">▸</span></button></h3>
    <div id="cty-box" hidden>
      <input id="cty-find" type="search" placeholder="Find a city, or add one…" autocomplete="off" aria-label="Find or add a city in ${esc(c.name)}">
      <ul class="cc-res" id="cty-res"></ul>
      <div id="cty-list"></div>
      <div class="cty-foot"><button type="button" id="cty-cmp">⚖ Open compare window</button></div>
    </div>
    <div id="cty-detail" hidden></div>`;
  anchor.before(sec);
  const list = $('#cty-list', sec), find = $('#cty-find', sec);
  const drawList = () => {
    const q = norm(find.value), rows = sortedFor(id).filter((x) => !q || norm(x.name).includes(q));
    list.innerHTML = rows.map(cityRow).join('') || '<p class="muted" style="margin:6px 2px">No city in our list matches. Keep typing to search the world, then pick a result to add it.</p>';
    $('.count', sec).textContent = total();
  };
  $('#cty-tg', sec).addEventListener('click', () => {
    const box = $('#cty-box', sec), open = box.hidden;
    box.hidden = !open; $('#cty-detail', sec).hidden = true; $('#cty-tg', sec).setAttribute('aria-expanded', String(open)); sec.classList.toggle('open', open);
    if (open) drawList();
  });
  find.addEventListener('input', drawList);
  cityPicker(find, $('#cty-res', sec), { cc: id, onPick: (city) => { drawList(); openDetail(city, sec); } });
  list.addEventListener('click', (e) => { const b = e.target.closest('.cty-row'); if (!b) return; const city = sortedFor(id).find((x) => keyOf(x) === b.dataset.k); if (city) openDetail(city, sec); });
  $('#cty-cmp', sec).addEventListener('click', () => { ensureCompare().hidden = false; front(cmpEl); renderCompare(); });
}
async function openDetail(c, sec) {
  const d = $('#cty-detail', sec), k = countries[c.cc];
  $('#cty-box', sec).hidden = true; d.hidden = false; $('#cty-tg', sec).setAttribute('aria-expanded', 'true');
  const q = enc(`${c.name} ${k?.name || ''}`.trim());
  d.innerHTML = `<button type="button" class="cty-back">← All cities in ${esc(k?.name || 'this country')}</button>
    <div class="cty-title"><h4>${esc(c.name)}${c.cap ? ' <span class="cap">★ capital</span>' : ''}</h4>${c.custom ? '<button type="button" class="cty-del" title="Remove this city that you added">Remove</button>' : ''}</div>
    <div class="cty-act"><button type="button" data-a="pop" title="Open as a floating card you can drag across the map">⇱ Pop out</button><button type="button" data-a="cmp" title="Compare with other cities side by side">⚖ Compare</button><button type="button" data-a="map" title="Zoom the map to this city">📍 Show on map</button></div>
    <table>${rows(c, ['kind', 'pop', 'share', 'rank', 'time', 'vs', 'weather', 'temp', 'hum', 'wind', 'elev', 'sunrise', 'sunset', 'where', 'cap'])}</table>
    <p class="cty-wiki muted" data-w>Reading about ${esc(c.name)}…</p>
    <div class="chips"><a target="_blank" rel="noopener" href="https://www.google.com/maps/search/${q}">Google Maps</a><a target="_blank" rel="noopener" href="https://news.google.com/search?q=${q}">News</a><a target="_blank" rel="noopener" href="https://en.wikipedia.org/wiki/Special:Search?search=${q}">Wikipedia</a></div>`;
  paintLive(d, c); showOnMap(c);
  $('.cty-back', d).onclick = () => { d.hidden = true; $('#cty-box', sec).hidden = false; };
  d.querySelector('.cty-act').onclick = (e) => { const a = e.target.closest('button')?.dataset.a; if (a === 'pop') popOut(c); if (a === 'cmp') addCompare(c); if (a === 'map') showOnMap(c); };
  const del = $('.cty-del', d);
  if (del) del.onclick = () => { custom = custom.filter((x) => keyOf(x) !== keyOf(c)); store('we-cities', custom); compare = compare.filter((x) => keyOf(x) !== keyOf(c)); store('we-compare', compare); renderCompare(); syncPins(); d.hidden = true; $('#cty-box', sec).hidden = false; $('#cty-find', sec).dispatchEvent(new Event('input')); };
  const w = await wiki(c), slot = $('[data-w]', d); if (!slot) return;
  if (!w) { slot.textContent = ''; return; }
  const text = w.extract.length > 460 ? w.extract.slice(0, 460).replace(/\s+\S*$/, '') + '…' : w.extract;
  slot.className = 'cty-wiki'; slot.innerHTML = `${w.thumbnail?.source ? `<img src="${esc(w.thumbnail.source)}" alt="" loading="lazy">` : ''}${esc(text)} <a target="_blank" rel="noopener" href="${esc(w.content_urls?.desktop?.page || '#')}">Read more on Wikipedia</a>`;
}
window.addEventListener('country-open', (e) => { if (e.detail?.tab === 'geography') inject(e.detail.id); });

if (compare.length) { ensureCompare(); renderCompare(); syncPins(); } // earlier choices come back, with the window closed
window.__cities = { popOut, addCompare, openCompare() { ensureCompare().hidden = false; renderCompare(); }, get compare() { return compare; }, get custom() { return custom; }, cards, adopt, searchOnline };
