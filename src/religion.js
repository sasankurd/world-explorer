// Religion by country: shares of the population, as a statistic for the map and as charts.
// Data: Pew Research Center, 2010 estimate and projections for 2020 to 2050 (public/data/religion.json, CC BY 4.0, via datasets/world-religion-projections).
// The projections are Pew's forecasts, not measurements. Pew rounds each group to the nearest 10,000, so very small countries are left out.

export const GROUPS = [
  { key: 'christians', label: 'Christians', color: '#4c8dff' },
  { key: 'muslims', label: 'Muslims', color: '#2fbf8a' },
  { key: 'unaffiliated', label: 'Unaffiliated', color: '#9aa7b8' },
  { key: 'hindus', label: 'Hindus', color: '#f5a04a' },
  { key: 'buddhists', label: 'Buddhists', color: '#e6c84a' },
  { key: 'folk', label: 'Folk religions', color: '#c27ad8' },
  { key: 'other', label: 'Other religions', color: '#d96b8a' },
  { key: 'jews', label: 'Jews', color: '#7fd1e0' },
];
export const SOURCE = 'Pew Research Center (2010 estimate; 2020 to 2050 are projections)';
export const YEARS = [2010, 2020, 2030, 2040, 2050];
export const isProjection = (y) => y > 2010;

// ---- pure helpers (tested in tests/religion.test.mjs) ----
// One country's shares for a year as fractions that add up to 1, or null when the data cannot be trusted.
export function sharesOf(data, id, year) {
  const raw = data?.c?.[id]?.[String(year)]; if (!Array.isArray(raw)) return null;
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum < 850 || sum > 1150) return null;           // far from 100%: rounding of small numbers dominates
  return raw.map((x) => x / sum);
}
// The whole world (or the listed countries): population-weighted, so big countries count more.
export function worldShares(data, year, ids = Object.keys(data?.c || {})) {
  const tot = new Array(GROUPS.length).fill(0); let pop = 0;
  for (const id of ids) {
    const s = sharesOf(data, id, year), n = data.c[id]?.t?.[String(year)]; if (!s || !n) continue;
    s.forEach((x, i) => { tot[i] += x * n; }); pop += n;
  }
  return pop ? tot.map((x) => x / pop) : null;
}
export const biggest = (shares) => (shares ? shares.reduce((b, x, i) => (x > shares[b] ? i : b), 0) : -1);
export const pct = (x) => (x >= 0.995 ? '100%' : x >= 0.1 ? (x * 100).toFixed(0) + '%' : x >= 0.005 ? (x * 100).toFixed(1) + '%' : x > 0 ? '<0.5%' : '0%');

// A statistic series in the shape the Stats code uses: values only in the five data years, so the slider moves in steps of 10.
export function seriesFor(data, groupIndex) {
  const v = {};
  for (const id of Object.keys(data.c)) {
    const a = new Array(YEARS[YEARS.length - 1] - YEARS[0] + 1).fill(null); let any = false;
    for (const y of YEARS) { const s = sharesOf(data, id, y); if (s) { a[y - YEARS[0]] = s[groupIndex] * 100; any = true; } }
    if (any) v[id] = a;
  }
  return { y0: YEARS[0], v, first: YEARS[0], last: YEARS[YEARS.length - 1], step: 10, live: false, projected: true };
}

// ---- loading ----
let loading = null;
export function loadReligion() {
  loading ||= fetch('/data/religion.json').then((r) => { if (!r.ok) throw new Error('religion data not found'); return r.json(); }).catch((e) => { loading = null; throw e; });
  return loading;
}

// ---- drawing (plain DOM, no libraries) ----
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); for (const c of kids) e.append(c.nodeType ? c : document.createTextNode(c)); return e; };
const svg = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

// One stacked bar plus a legend with every percentage, so nothing depends on colour alone.
export function shareBar(shares, { highlight = -1 } = {}) {
  const wrap = el('div', { class: 'rel-bar' });
  const bar = el('div', { class: 'rb-track', role: 'img', 'aria-label': GROUPS.map((g, i) => `${g.label} ${pct(shares[i])}`).join(', ') });
  shares.forEach((x, i) => { if (x > 0.0005) { const s = el('span', { style: `flex:${x};background:${GROUPS[i].color}` }); if (highlight >= 0 && highlight !== i) s.style.opacity = '.45'; bar.append(s); } });
  const ul = el('ul', { class: 'rb-legend' });
  shares.map((x, i) => [x, i]).sort((a, b) => b[0] - a[0]).forEach(([x, i]) => {
    if (x < 0.0005) return;
    ul.append(el('li', highlight === i ? { class: 'on' } : {}, el('i', { style: `background:${GROUPS[i].color}` }), el('span', {}, GROUPS[i].label), el('b', {}, pct(x))));
  });
  wrap.append(bar, ul); return wrap;
}

// Five stacked columns (2010 to 2050) for one place: how the mix is expected to change.
export function trendColumns(data, id /* null = world */, { year } = {}) {
  const W = 300, H = 120, top = 8, bot = 22, bw = 34, gap = (W - bw * YEARS.length) / (YEARS.length + 1);
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'rel-cols', role: 'img' });
  const desc = [];
  YEARS.forEach((y, k) => {
    const s = id ? sharesOf(data, id, y) : worldShares(data, y); if (!s) return;
    const x = gap + k * (bw + gap); let yy = H - bot;
    s.forEach((v, i) => { const h = v * (H - bot - top); if (h < 0.3) return; yy -= h; root.append(svg('rect', { x, y: yy.toFixed(1), width: bw, height: h.toFixed(1), fill: GROUPS[i].color, opacity: year && year !== y ? '.55' : '1' })); });
    const t = svg('text', { x: x + bw / 2, y: H - 7, 'text-anchor': 'middle', 'font-size': '11', fill: year === y ? '#52d6ff' : '#9fb0c4', 'font-weight': year === y ? '700' : '400' }); t.textContent = isProjection(y) ? y + '*' : y; root.append(t);
    const lead = biggest(s); desc.push(`${y}: ${GROUPS[lead].label} ${pct(s[lead])}`);
  });
  root.setAttribute('aria-label', 'Largest group by year. ' + desc.join('; '));
  return root;
}
