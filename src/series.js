// Statistics by year (1960 to today): the list of statistics, loading them, and formatting numbers.
//
// Where the numbers come from
//  - Population and GDP are saved with the site (public/data/series), so they work straight away.
//  - Everything else, and newer years, is loaded live from the World Bank when you open it
//    (api.worldbank.org, free and open). If the World Bank does not answer, saved data is used where we have it.

export const INDICATORS = [
  { key: 'population', label: 'Population', group: 'People', wb: 'SP.POP.TOTL', baked: true, kind: 'log', fmt: 'num', unit: 'people' },
  { key: 'growth', label: 'Growth', group: 'People', derive: 'population', kind: 'lin', dom: [-1, 4], fmt: 'pct', unit: 'population growth per year' },
  { key: 'density', label: 'Density', group: 'People', wb: 'EN.POP.DNST', kind: 'log', fmt: 'dens', unit: 'people per km²' },
  { key: 'internet', label: 'Internet users', group: 'Connected', wb: 'IT.NET.USER.ZS', kind: 'lin', dom: [0, 100], fmt: 'pct', unit: '% of people using the internet' },
  { key: 'lifeexp', label: 'Age span', group: 'Health', wb: 'SP.DYN.LE00.IN', kind: 'lin', dom: [35, 85], fmt: 'yrs', unit: 'life expectancy at birth' },
  { key: 'gdp', label: 'Economy', group: 'Money', wb: 'NY.GDP.MKTP.CD', baked: true, kind: 'log', fmt: 'usd', unit: 'GDP in US dollars' },
  { key: 'gdppc', label: 'Income per person', group: 'Money', wb: 'NY.GDP.PCAP.CD', kind: 'log', fmt: 'usd', unit: 'GDP per person, US dollars' },
  { key: 'tourism', label: 'Tourists', group: 'Money', wb: 'ST.INT.ARVL', kind: 'log', fmt: 'num', unit: 'international tourist arrivals per year' },
  { key: 'milspend', label: 'Spending', group: 'Military power', wb: 'MS.MIL.XPND.CD', kind: 'log', fmt: 'usd', unit: 'military spending, US dollars' },
  { key: 'milgdp', label: '% of economy', group: 'Military power', wb: 'MS.MIL.XPND.GD.ZS', kind: 'lin', dom: [0, 6], fmt: 'pct', unit: 'military spending as % of GDP' },
  { key: 'armed', label: 'Armed forces', group: 'Military power', wb: 'MS.MIL.TOTL.P1', kind: 'log', fmt: 'num', unit: 'people in the armed forces' },
  { key: 'area', label: 'Area', group: 'Land', staticArea: true, kind: 'log', fmt: 'area', unit: 'km²' },
];

// the World Bank spells Kosovo differently from our map
const ALIAS = { XKX: 'UNK' };
const cache = new Map(); // key -> Promise<series>

export function customStats() {
  try { return JSON.parse(localStorage.getItem('customStats') || '[]'); } catch { return []; }
}
export function saveCustomStats(list) {
  try { localStorage.setItem('customStats', JSON.stringify(list)); } catch {}
}
export const allDefs = () => [...INDICATORS, ...customStats().map((c) => ({ ...c, group: 'Yours', custom: true }))];
export const defOf = (key) => allDefs().find((d) => d.key === key);

// a series is { y0, v: { ISO3: [value per year from y0] }, first, last, live, static? }
function finish(s, ids) {
  const counts = {};
  for (const id of Object.keys(s.v)) s.v[id].forEach((x, i) => { if (x != null) counts[s.y0 + i] = (counts[s.y0 + i] || 0) + 1; });
  const years = Object.keys(counts).map(Number).sort((a, b) => a - b);
  const top = Math.max(0, ...Object.values(counts));
  const ok = years.filter((y) => counts[y] >= Math.min(25, top) && counts[y] >= top * 0.5);
  s.first = ok.length ? ok[0] : years[0] ?? s.y0;
  s.last = ok.length ? ok[ok.length - 1] : years[years.length - 1] ?? s.y0;
  return s;
}
export function valueAt(s, id, year) {
  if (!s) return null;
  const a = s.v[id]; if (!a) return null;
  if (s.static) return a[0] ?? null;
  const x = a[year - s.y0];
  return x == null || !isFinite(x) ? null : x;
}

async function fetchBaked(key) {
  const r = await fetch(`/data/series/${key}.json`); if (!r.ok) throw new Error('no saved data');
  const j = await r.json();
  return { y0: j.y0, v: j.v, live: false };
}
export async function fetchWorldBank(code, ids) {
  const y1 = new Date().getFullYear();
  const url = (p) => `https://api.worldbank.org/v2/country/all/indicator/${encodeURIComponent(code)}?format=json&per_page=20000&date=1960:${y1}&page=${p}`;
  const get = async (p) => {
    const r = await fetch(url(p)); if (!r.ok) throw new Error('World Bank answered ' + r.status);
    const j = await r.json();
    if (!Array.isArray(j) || !Array.isArray(j[1])) throw new Error(j?.[0]?.message?.[0]?.value || 'The World Bank has no data for ' + code);
    return j;
  };
  const first = await get(1);
  let rows = first[1]; const pages = first[0]?.pages || 1;
  for (let p = 2; p <= pages; p++) rows = rows.concat((await get(p))[1] || []);
  const byId = {}; let maxY = 1960; let name = null;
  for (const r of rows) {
    name ||= r.indicator?.value;
    let id = r.countryiso3code; if (!id) continue; id = ALIAS[id] || id;
    if (!ids.has(id) || r.value == null) continue;
    const y = +r.date; if (!(y >= 1960)) continue;
    (byId[id] ??= {})[y] = +r.value; if (y > maxY) maxY = y;
  }
  const v = {};
  for (const [id, m] of Object.entries(byId)) { const a = []; for (let y = 1960; y <= maxY; y++) a.push(m[y] ?? null); v[id] = a; }
  if (!Object.keys(v).length) throw new Error('The World Bank has no country data for ' + code);
  return { y0: 1960, v, live: true, name };
}
function merge(base, live) { // live values win; saved ones fill any gaps
  const maxY = Math.max(base.y0 + (Object.values(base.v)[0]?.length || 0) - 1, live.y0 + (Object.values(live.v)[0]?.length || 0) - 1);
  const v = {};
  for (const id of new Set([...Object.keys(base.v), ...Object.keys(live.v)])) {
    const a = [];
    for (let y = 1960; y <= maxY; y++) a.push(live.v[id]?.[y - live.y0] ?? base.v[id]?.[y - base.y0] ?? null);
    v[id] = a;
  }
  return { y0: 1960, v, live: true, name: live.name };
}
function fromRows(rows, ids) { // rows: [ISO3, year|null, value]
  const dated = rows.some((r) => r[1] != null);
  if (!dated) { const v = {}; for (const [id, , x] of rows) v[id] = [x]; return { y0: 0, v, static: true, live: false }; }
  const byId = {}; let maxY = 1960;
  for (const [id, y, x] of rows) { if (y == null || y < 1960) continue; (byId[id] ??= {})[y] = x; if (y > maxY) maxY = y; }
  const v = {};
  for (const [id, m] of Object.entries(byId)) { const a = []; for (let y = 1960; y <= maxY; y++) a.push(m[y] ?? null); v[id] = a; }
  return { y0: 1960, v, live: false };
}

// Load a statistic. `onUpgrade(series)` is called later if newer live data replaces the saved data.
export function loadSeries(key, countries, onUpgrade) {
  if (cache.has(key)) return cache.get(key);
  const ids = new Set(Object.keys(countries));
  const def = defOf(key); if (!def) return Promise.reject(new Error('Unknown statistic'));
  const p = (async () => {
    if (def.staticArea) {
      const v = {}; for (const c of Object.values(countries)) if (c.area) v[c.id] = [c.area];
      return finish({ y0: 0, v, static: true, live: false }, ids);
    }
    if (def.custom && def.rows) return finish(fromRows(def.rows, ids), ids);
    if (def.derive) {
      const base = await loadSeries(def.derive, countries, onUpgrade && (() => { cache.delete(key); loadSeries(key, countries, onUpgrade).then(onUpgrade); }));
      const v = {};
      for (const [id, a] of Object.entries(base.v)) v[id] = a.map((x, i) => (i && x != null && a[i - 1] ? (x / a[i - 1] - 1) * 100 : null));
      return finish({ y0: base.y0, v, live: base.live }, ids);
    }
    let saved = null;
    if (def.baked) { try { saved = finish(await fetchBaked(key), ids); } catch {} }
    const live = fetchWorldBank(def.wb, ids);
    if (saved) {
      live.then((l) => { const m = finish(merge(saved, l), ids); cache.set(key, Promise.resolve(m)); onUpgrade?.(m); }).catch(() => {});
      return saved;
    }
    return finish(await live, ids);
  })();
  cache.set(key, p);
  p.catch(() => cache.delete(key)); // so it can be tried again
  return p;
}
export function forgetSeries(key) { cache.delete(key); }

// ---- numbers ----
export function fmtVal(def, v) {
  if (v == null || !isFinite(v)) return '—';
  const big = (x) => {
    const a = Math.abs(x);
    if (a >= 1e12) return (x / 1e12).toFixed(2) + ' trillion';
    if (a >= 1e9) return (x / 1e9).toFixed(a >= 1e10 ? 1 : 2) + ' billion';
    if (a >= 1e6) return (x / 1e6).toFixed(a >= 1e7 ? 1 : 2) + ' million';
    if (a >= 1e4) return Math.round(x / 1e3) + ' thousand';
    return Math.round(x).toLocaleString('en');
  };
  switch (def?.fmt) {
    case 'usd': return '$' + (Math.abs(v) >= 1e4 ? big(v) : Math.round(v).toLocaleString('en'));
    case 'pct': return v.toFixed(1) + '%';
    case 'yrs': return v.toFixed(1) + ' years';
    case 'dens': return (v >= 100 ? Math.round(v).toLocaleString('en') : v.toFixed(1)) + ' per km²';
    case 'area': return Math.round(v).toLocaleString('en') + ' km²';
    default: return Math.abs(v) < 1e4 && Math.abs(v) % 1 ? v.toFixed(2).replace(/\.?0+$/, '') : big(v);
  }
}
export const shortVal = (def, v) => { // tight version for chart labels
  if (v == null || !isFinite(v)) return '—';
  const a = Math.abs(v); const s = a >= 1e12 ? (v / 1e12).toFixed(1) + 'T' : a >= 1e9 ? (v / 1e9).toFixed(1) + 'B' : a >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : a >= 1e4 ? Math.round(v / 1e3) + 'K' : a >= 100 ? Math.round(v).toLocaleString('en') : v.toFixed(1);
  return def?.fmt === 'usd' ? '$' + s : def?.fmt === 'pct' ? s + '%' : s;
};

// ---- colours: where a value sits between the low and high end (0 to 1) ----
export function domainOf(def, s) {
  if (def.dom) return def.dom;
  const xs = [];
  for (const a of Object.values(s.v)) for (const x of a) if (x != null && isFinite(x) && (def.kind !== 'log' || x > 0)) xs.push(x);
  xs.sort((a, b) => a - b);
  if (!xs.length) return [0, 1];
  const q = (p) => xs[Math.min(xs.length - 1, Math.max(0, Math.floor(p * (xs.length - 1))))];
  let lo = q(0.01), hi = q(0.997); if (hi <= lo) hi = lo + 1;
  return [lo, hi];
}
export function norm(def, dom, v) {
  const f = def.kind === 'log' ? Math.log : (x) => x;
  const lo = f(dom[0]), hi = f(dom[1]);
  if (def.kind === 'log' && v <= 0) return 0;
  return Math.max(0, Math.min(1, (f(v) - lo) / (hi - lo)));
}
const RAMPS = {
  dark: ['#1a1f5c', '#2f5fc4', '#22b8d6', '#7be08a', '#ffe45c'],
  light: ['#eef5fd', '#bcd8f4', '#6aa7e0', '#2f6bbd', '#0a2e73'],
};
export const NODATA = { dark: '#1b222b', light: '#cdd4db' };
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function ramp(theme, t) {
  const st = RAMPS[theme], x = Math.max(0, Math.min(1, t)) * (st.length - 1), i = Math.min(st.length - 2, Math.floor(x)), f = x - i;
  const a = hex(st[i]), b = hex(st[i + 1]);
  return `rgb(${a.map((c, k) => Math.round(c + (b[k] - c) * f)).join(',')})`;
}
export const rampCss = (theme) => `linear-gradient(90deg,${RAMPS[theme].join(',')})`;

// ---- matching pasted names to our countries ----
export function matcher(countries) {
  const m = new Map();
  for (const c of Object.values(countries)) {
    m.set(c.id.toLowerCase(), c.id); if (c.iso2) m.set(c.iso2.toLowerCase(), c.id);
    m.set(c.name.toLowerCase(), c.id); if (c.official) m.set(c.official.toLowerCase(), c.id);
  }
  const extra = { usa: 'USA', uk: 'GBR', 'united kingdom': 'GBR', 'united states of america': 'USA', 'south korea': 'KOR', 'north korea': 'PRK', russia: 'RUS', 'czech republic': 'CZE', turkey: 'TUR', 'ivory coast': 'CIV', burma: 'MMR', 'cabo verde': 'CPV', swaziland: 'SWZ' };
  for (const [k, v] of Object.entries(extra)) if (countries[v]) m.set(k, v);
  return (name) => m.get(String(name).trim().toLowerCase().replace(/^"|"$/g, ''));
}
export function parsePasted(text, find) {
  const rows = []; let bad = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    const parts = line.split(/[,;\t]/).map((s) => s.trim());
    const num = (s) => parseFloat(String(s).replace(/[\s]/g, ''));
    if (parts.length === 2) {
      const id = find(parts[0]), x = num(parts[1]);
      if (id && isFinite(x)) rows.push([id, null, x]); else if (!(rows.length === 0 && !isFinite(x))) bad++;
    } else if (parts.length >= 3) {
      const id = find(parts[0]), y = parseInt(parts[1], 10), x = num(parts[2]);
      if (id && y >= 1800 && isFinite(x)) rows.push([id, y, x]); else if (!(rows.length === 0 && !isFinite(x))) bad++;
    } else bad++;
  }
  return { rows, bad };
}
