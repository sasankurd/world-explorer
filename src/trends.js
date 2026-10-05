// Mini charts in the country window: how population, the economy and tourism changed over the years.
import { loadSeries, defOf, valueAt, fmtVal } from './series.js';

while (!window.__app) await new Promise((r) => setTimeout(r, 25));
const { countries } = window.__app;
const SHOW = [['population', 'Population'], ['gdp', 'Economy'], ['tourism', 'Tourism']];

function spark(vals, y0) {
  const pts = vals.map((v, i) => (v == null ? null : [i, v])).filter(Boolean);
  if (pts.length < 2) return null;
  const lo = Math.min(...pts.map((p) => p[1])), hi = Math.max(...pts.map((p) => p[1])), n = vals.length - 1 || 1;
  const X = (i) => (i / n) * 120, Y = (v) => 36 - ((v - lo) / (hi - lo || 1)) * 32;
  const line = pts.map((p, k) => `${k ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
  const area = `${line}L${X(pts[pts.length - 1][0]).toFixed(1)},40L${X(pts[0][0]).toFixed(1)},40Z`;
  const last = pts[pts.length - 1];
  return { line, area, dot: [(X(last[0]) / 120) * 100, (Y(last[1]) / 40) * 100], first: pts[0], last, y0 };
}
function cardHtml(key, label, state) {
  const def = defOf(key);
  if (state.error) return `<button type="button" class="tcard" data-key="${key}"><span class="tt">${label}</span><span class="tv muted">Not available right now</span></button>`;
  if (!state.s) return `<div class="tcard"><span class="tt">${label}</span><span class="tv muted">Loading…</span></div>`;
  const sp = spark(state.arr, state.s.y0);
  if (!sp) return `<div class="tcard"><span class="tt">${label}</span><span class="tv muted">No data for this country</span></div>`;
  const y1 = state.s.y0 + sp.last[0], yf = state.s.y0 + sp.first[0], r = sp.last[1] / sp.first[1];
  const change = !isFinite(r) || sp.first[1] <= 0 ? '' : r >= 2 ? `×${r.toFixed(r >= 10 ? 0 : 1)} since ${yf}` : `${r >= 1 ? '+' : '−'}${Math.abs(Math.round((r - 1) * 100))}% since ${yf}`;
  return `<button type="button" class="tcard" data-key="${key}" title="Show ${label.toLowerCase()} on the world map">
    <span class="tt">${label}</span><span class="tv">${fmtVal(def, sp.last[1])} <small>${y1}</small></span>
    <span class="tg"><svg viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="tg-${key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--acc)" stop-opacity=".35"/><stop offset="1" stop-color="var(--acc)" stop-opacity="0"/></linearGradient></defs>
    <path d="${sp.area}" fill="url(#tg-${key})"/><path d="${sp.line}" fill="none" stroke="var(--acc)" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg><i style="left:${sp.dot[0]}%;top:${sp.dot[1]}%"></i></span>
    <span class="tc">${change}</span></button>`;
}
window.addEventListener('country-open', (e) => {
  const { id, tab } = e.detail; if (tab !== 'overview') return;
  const box = document.querySelector('#trends'); if (!box) return;
  const states = Object.fromEntries(SHOW.map(([k]) => [k, {}]));
  const paint = () => {
    if (!box.isConnected) return;
    box.innerHTML = `<h3>Trends since 1960</h3><div class="trends">${SHOW.map(([k, l]) => cardHtml(k, l, states[k])).join('')}</div>`;
  };
  box.onclick = (ev) => { const b = ev.target.closest('[data-key]'); if (b) window.__stats?.show(b.dataset.key); };
  paint();
  for (const [k] of SHOW) {
    const done = (s) => { states[k] = { s, arr: s.v[id] ? s.v[id] : [] }; paint(); };
    loadSeries(k, countries, done).then(done).catch(() => { states[k] = { error: true }; paint(); });
  }
});
