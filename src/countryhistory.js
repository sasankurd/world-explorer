// The History tab of a country window: who held the country's capital in each era, with a small map of the world at that time.
// Built from the same historical snapshots as the History layer (public/data/history). Where a country has no record, it says so.
while (!window.__app) await new Promise((r) => setTimeout(r, 25));
const app = window.__app;
const LON0 = -170, SPAN = 360, LAT1 = 82, LATSPAN = 140;           // must match scripts/build-history-thumbs.py
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtYear = (y) => (y < 0 ? `${(-y).toLocaleString('en')} BC` : y < 1000 ? `AD ${y}` : String(y));
let data = null, index = null, failed = false;
async function load() {
  if (data || failed) return;
  try { [data, index] = await Promise.all(['country-timeline.json', 'index.json'].map((f) => fetch('/data/history/' + f).then((r) => { if (!r.ok) throw new Error(); return r.json(); }))); }
  catch { failed = true; }
}
// consecutive snapshots with the same name become one line, e.g. "1530 to 1914 · Ottoman Empire"
function group(rows) {
  const out = [];
  for (const [year, name, ruler, part] of rows) {
    const last = out[out.length - 1];
    if (last && last.name === name && last.ruler === ruler) last.to = year; else out.push({ from: year, to: year, name, ruler, part });
  }
  return out;
}
const range = (g) => (g.from === g.to ? fmtYear(g.from) : `${fmtYear(g.from)} to ${fmtYear(g.to)}`);
function where(id) {
  const k = app.cities?.find((c) => c.cc === id && c.cap) || null;
  if (k) return [k.lng, k.lat];
  const ll = app.countries[id]?.latlng; return ll ? [ll[1], ll[0]] : null;
}
function render(id, host) {
  const rows = data[id] || [], gs = group(rows), pos = where(id), c = app.countries[id];
  const box = document.createElement('section'); box.className = 'ch'; box.setAttribute('aria-label', `History of ${c.name} through the eras`);
  const h = document.createElement('h3'); h.textContent = 'Through the eras'; box.append(h);
  if (!gs.length) {
    const p = document.createElement('p'); p.className = 'muted'; p.textContent = `Our historical maps have no record for ${c.name}. Very small countries and islands are often too small to show on them. The Wikipedia links above are the best place to start.`; box.append(p); host.replaceWith(box); return;
  }
  const intro = document.createElement('p'); intro.className = 'muted ch-intro';
  intro.textContent = `Which country, empire or people held ${c.capital || 'the middle of ' + c.name} in each snapshot of our historical maps. The dot marks the place. Choose an entry to see that era on the map.`; box.append(intro);
  const ol = document.createElement('ol'); ol.className = 'ch-list';
  for (const g of gs) {
    const snap = index.find((s) => s.year === g.from);
    const li = document.createElement('li'); const b = document.createElement('button'); b.type = 'button'; b.className = 'ch-row';
    b.setAttribute('aria-label', `${g.name}, ${range(g)}. Show this era on the map.`);
    const fig = document.createElement('span'); fig.className = 'ch-pic';
    const im = document.createElement('img'); im.alt = ''; im.width = 96; im.height = 48; im.loading = 'lazy'; if (snap) im.src = '/img/history/' + snap.file.replace('.json', '.jpg'); fig.append(im);
    if (pos) { const d = document.createElement('i'); d.style.left = (((pos[0] - LON0 + 360) % 360) / SPAN * 100).toFixed(1) + '%'; d.style.top = Math.max(0, Math.min(100, (LAT1 - pos[1]) / LATSPAN * 100)).toFixed(1) + '%'; fig.append(d); }
    const tx = document.createElement('span'); tx.className = 'ch-tx';
    tx.innerHTML = `<b>${esc(g.name)}</b><small>${esc(range(g))}</small>${g.ruler ? `<small>Ruled by ${esc(g.ruler)}</small>` : g.part ? `<small>Part of ${esc(g.part)}</small>` : ''}`;
    b.append(fig, tx);
    b.addEventListener('click', async () => {
      const H = window.__history; if (!H) return;
      // open History the same way the Layers row does, so the timeline bar appears too
      if (!H.active) document.querySelector('#historyrow')?.click();
      for (let n = 0; n < 60 && !(H.active && H.count); n++) await new Promise((r) => setTimeout(r, 100));
      const i = index.findIndex((s) => s.year === g.from); if (i >= 0 && H.active) H.setIndex(i, true);
    });
    li.append(b); ol.append(li);
  }
  box.append(ol);
  const src = document.createElement('p'); src.className = 'ch-src muted'; src.textContent = 'Borders are approximate for early eras (source: Historical Basemaps, GPL-3.0). Pictures are small maps drawn from the same data over NASA Blue Marble.'; box.append(src);
  host.replaceWith(box);
}
window.addEventListener('country-open', async (e) => {
  if (e.detail?.tab !== 'history') return;
  const panel = document.querySelector('#panel'), host = panel?.querySelector('.note'); if (!host) return;
  const id = e.detail.id; host.textContent = 'Loading the timeline…'; host.setAttribute('role', 'status');
  await load();
  if (!panel.contains(host) || panel.querySelector('h2')?.textContent !== app.countries[id]?.name) return;   // the window changed meanwhile
  if (failed) { host.textContent = 'The timeline could not be loaded. Check your connection and open this tab again.'; return; }
  render(id, host);
});
