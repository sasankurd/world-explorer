// History: how the world's countries, peoples, names and borders looked in every era, from 123,000 BC to today.
// Data: "Historical Basemaps" by Andre Ourednik (GPL-3.0), 54 snapshots baked into /data/history/ by scripts/build-history.mjs.
// Borders are approximate for most of the past. Dashed lines mean "roughly here".
while (!window.__app) await new Promise((r) => setTimeout(r, 25));
const app = window.__app;
const { map } = app;
const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const enc = encodeURIComponent;

// ---------- the eras, and a line about each snapshot ----------
const ERAS = [
  { key: 'stone', name: 'Stone Age', to: -4000, text: 'Before writing: small bands of hunter-gatherers spread across the world, then the first farmers. There are no states yet, so the map shows peoples and cultures.' },
  { key: 'bronze', name: 'Bronze Age', to: -1000, text: 'The first cities, kings and writing. Egypt, Mesopotamia, the Indus valley and China grow the earliest states.' },
  { key: 'classical', name: 'Classical antiquity', to: 200, text: 'Great empires rise: Persia, Greece and Alexander, Rome, Han China, the Mauryas and the Kushans.' },
  { key: 'late', name: 'Late antiquity and early Middle Ages', to: 900, text: 'Rome fades in the west, peoples migrate, and new powers appear: Byzantium, the Islamic caliphates, the Franks, Tang China and the Vikings.' },
  { key: 'medieval', name: 'High and late Middle Ages', to: 1400, text: 'Feudal kingdoms, the Crusades, the Mongol conquests and great trading empires from Mali to Song and Ming China.' },
  { key: 'early', name: 'Early modern period', to: 1783, text: 'Europeans reach every ocean. The Ottoman, Mughal, Spanish, Portuguese, Russian and Qing empires dominate large parts of the world.' },
  { key: 'empires', name: 'Age of nations and empires', to: 1914, text: 'Revolutions, new nation states and industrial power. European empires carve up Africa and Asia.' },
  { key: 'wars', name: 'World wars and Cold War', to: 1994, text: 'Two world wars, the end of the old empires, decolonisation and a world split between two blocs.' },
  { key: 'today', name: 'Today', to: 99999, text: 'The modern world of nearly two hundred countries.' },
];
const NOTES = {
  '-123000': 'Early humans: Homo erectus, Homo heidelbergensis and Neanderthals live in Africa, Europe and Asia.',
  '-10000': 'The ice age has just ended. People everywhere live by hunting and gathering.',
  '-8000': 'Farming begins in the Fertile Crescent and soon in China and the Americas.',
  '-5000': 'Farming villages spread across Europe, Asia and Africa.',
  '-4000': 'Copper tools and the first towns appear. Cities begin to grow in Mesopotamia.',
  '-3000': 'Egypt is united and Sumerian city-states flourish. Writing is invented.',
  '-2000': 'Babylon, Minoan Crete, the Indus cities and the Xia and Shang dynasties of China.',
  '-1500': 'The age of Egypt\'s New Kingdom, the Hittites, Mitanni and Mycenaean Greece.',
  '-1000': 'The Iron Age begins. Kingdoms of Israel, the Phoenician cities and the Zhou dynasty.',
  '-700': 'The Assyrian Empire is at its height. Greek city-states found colonies around the Mediterranean.',
  '-500': 'The Persian Achaemenid Empire is the largest the world has yet seen.',
  '-400': 'Classical Greece, the early Roman Republic and the Warring States of China.',
  '-323': 'Alexander the Great\'s empire at the time of his death.',
  '-300': 'Alexander\'s successors split his empire. The Mauryan Empire rules most of India.',
  '-200': 'Rome and Carthage fight for the Mediterranean. The Han dynasty begins in China.',
  '-100': 'Rome expands across the Mediterranean. The Han reach Central Asia and Parthia rules Persia.',
  '-1': 'The Roman Republic has become an empire under Augustus.',
  '100': 'The Roman Empire at its height, with Han China, Parthia and the Kushan Empire.',
  '200': 'The late Han dynasty is breaking up. Rome is still strong; the Sasanians will soon replace Parthia.',
  '300': 'China is divided. Rome is split into administrative halves and the Sasanian Empire rules Persia.',
  '400': 'Germanic peoples settle inside the Western Roman Empire, which ends in 476. The Gupta Empire rules northern India.',
  '500': 'Germanic kingdoms in the west; the Byzantine Empire in the east.',
  '600': 'Islam begins in Arabia. The Tang dynasty unites China.',
  '700': 'The Umayyad Caliphate stretches from Spain to Central Asia.',
  '800': 'Charlemagne is crowned emperor. The Abbasid Caliphate and Tang China are great powers.',
  '900': 'The Viking age, a divided caliphate and the Song dynasty soon to come in China.',
  '1000': 'The Holy Roman Empire, the Chola dynasty in India and the Song in China.',
  '1100': 'The Crusader states in the Levant, the Song and Jin in China.',
  '1200': 'The Mongols are rising under Genghis Khan. The Delhi Sultanate is founded.',
  '1279': 'The Mongol Empire at its largest, with Yuan China.',
  '1300': 'The Mongol khanates, the Mali Empire and the early Ottomans.',
  '1400': 'Ming China, the Timurid Empire, and the Aztec and Inca peoples growing in the Americas.',
  '1492': 'The eve of European contact with the Americas. Many peoples and kingdoms are shown.',
  '1500': 'The first European colonies, the Ottoman Empire and Safavid Persia.',
  '1530': 'The Ottoman Empire under Suleiman, the Spanish conquests in America and the early Mughals.',
  '1600': 'Spanish, Portuguese, Dutch, English and French colonies, the Mughal Empire and Tokugawa Japan.',
  '1650': 'The Qing take China. Europe is just out of the Thirty Years\' War.',
  '1700': 'The Qing, Mughal, Ottoman and Russian empires are among the largest states.',
  '1715': 'Europe after the War of the Spanish Succession.',
  '1783': 'The United States wins independence.',
  '1800': 'The Napoleonic age and the Industrial Revolution begin.',
  '1815': 'The Congress of Vienna redraws Europe after Napoleon.',
  '1878': 'The Congress of Berlin reshapes the Balkans as the Ottoman Empire shrinks.',
  '1880': 'The "Scramble for Africa" is beginning.',
  '1900': 'European empires control much of Africa and Asia.',
  '1914': 'The eve of the First World War.',
  '1920': 'After the First World War: the Austro-Hungarian, German, Russian and Ottoman empires have fallen.',
  '1930': 'The interwar years and the Great Depression.',
  '1938': 'The eve of the Second World War.',
  '1945': 'The end of the Second World War and the founding of the United Nations.',
  '1960': 'Decolonisation: dozens of African and Asian countries gain independence.',
  '1994': 'After the Cold War: the Soviet Union and Yugoslavia have broken up.',
  '2000': 'The turn of the millennium.',
  '2010': 'The modern world (South Sudan, created in 2011, is the main newer country).',
};
const fmtYear = (y) => (y < 0 ? `${(-y).toLocaleString('en')} BC` : y < 1000 ? `AD ${y}` : String(y));
const eraOf = (y) => ERAS.find((e) => y <= e.to);

// ---------- the map layers ----------
let index = null, cur = null, active = false, ready = false, idx = 0, sel = null, playing = null, namesOn = true, loadSeq = 0, ptr = 0;
const cache = new Map();
const dark = () => app.isDark();
// keep the map's centre in the part of the screen that the Stats bar does not cover
const bar = $('#statbar');
const pad = () => map.setPadding({ top: active ? bar.offsetHeight : 0, bottom: 0, left: 0, right: 0 });
new ResizeObserver(() => { if (active) { pad(); drawLabels(); } }).observe(bar);
function colorExpr() {
  const d = dark();
  return ['case', ['<', ['get', 'h'], 0], d ? '#161d27' : '#e3e7ec',
    ['to-color', ['concat', 'hsl(', ['get', 'h'], ',', d ? '52' : '58', '%,', ['to-string', ['+', d ? 30 : 60, ['*', ['get', 'v'], d ? 16 : 14]]], '%)']]];
}
function paintAll() {
  if (!ready) return;
  const d = dark();
  map.setPaintProperty('hist-fill', 'fill-color', colorExpr());
  map.setPaintProperty('hist-fill', 'fill-opacity', ['case', ['boolean', ['feature-state', 'selected'], false], 0.98, 0.86]);
  for (const id of ['hist-line', 'hist-line-approx']) map.setPaintProperty(id, 'line-color', d ? '#e8f4ff' : '#2b3340');
  map.setPaintProperty('hist-sel', 'line-color', d ? '#52d6ff' : '#0a68b4');
}
function ensureLayers() {
  if (ready) return;
  map.addSource('hist', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  const before = map.getLayer('selected') ? 'selected' : undefined;
  map.addLayer({ id: 'hist-fill', type: 'fill', source: 'hist', layout: { visibility: 'none' }, paint: { 'fill-color': '#444' } }, before);
  map.addLayer({ id: 'hist-line', type: 'line', source: 'hist', filter: ['>=', ['get', 'b'], 2], layout: { visibility: 'none', 'line-join': 'round' }, paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.7, 6, 1.4], 'line-opacity': 0.75 } }, before);
  map.addLayer({ id: 'hist-line-approx', type: 'line', source: 'hist', filter: ['==', ['get', 'b'], 1], layout: { visibility: 'none', 'line-join': 'round' }, paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.7, 6, 1.3], 'line-opacity': 0.5, 'line-dasharray': [2.5, 2] } }, before);
  map.addLayer({ id: 'hist-sel', type: 'line', source: 'hist', layout: { visibility: 'none' }, paint: { 'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2.8, 0] } }, before);
  ready = true; paintAll();
}
const showLayers = (on) => {
  for (const id of ['hist-fill', 'hist-line', 'hist-line-approx', 'hist-sel']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  for (const id of ['fill', 'line']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'none' : 'visible');
};

// ---------- loading one snapshot ----------
async function load(i) {
  const e = index[i]; const mine = ++loadSeq;
  if (!cache.has(e.year)) cache.set(e.year, fetch('/data/history/' + e.file).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }));
  let data;
  try { data = await cache.get(e.year); } catch (err) { cache.delete(e.year); if (mine === loadSeq) say(`Could not load ${fmtYear(e.year)}: ${err.message}. Check your connection and try again.`, true); return; }
  if (mine !== loadSeq) return;
  cur = { year: e.year, data, named: data.features.filter((f) => f.properties.n).sort((a, b) => b.properties.ar - a.properties.ar) };
  sel = null; hidePanel();
  map.getSource('hist').setData(data);
  say(''); drawLabels(); renderList();
}
const say = (t, bad) => { const n = $('#h-msg'); n.textContent = t; n.hidden = !t; n.className = bad ? 'bad' : ''; };

// ---------- names on the map ----------
let labelBox = null, lraf = 0, labelEls = [];
function ensureLabelBox() { if (labelBox) return; labelBox = document.createElement('div'); labelBox.id = 'hl'; map.getCanvasContainer().append(labelBox); }
function drawLabels() { if (!lraf) lraf = requestAnimationFrame(layoutLabels); }
function layoutLabels() {
  lraf = 0; ensureLabelBox();
  for (const el of labelEls) el.remove(); labelEls = [];
  if (!active || !namesOn || !cur) return;
  const z = map.getZoom(), ppd = (512 * 2 ** z) / 360; // screen pixels per degree of longitude
  const cv = map.getCanvas(), W = cv.clientWidth, H = cv.clientHeight, taken = [];
  let made = 0;
  for (const f of cur.named) {
    const p = f.properties, pxw = Math.max(p.bw * ppd, p.bh * ppd * 0.9);
    if (pxw < 26 || made > 160) continue;
    const fs = pxw > 420 ? 17 : pxw > 220 ? 14.5 : pxw > 110 ? 12.5 : 11;
    const name = p.n, half = Math.ceil(name.length / 2);
    let lines = [name];
    const chars = name.length * fs * 0.56;
    if (chars > pxw * 1.15) { // try two lines
      const sp = [...name.matchAll(/ /g)].map((m) => m.index).sort((a, b) => Math.abs(a - half) - Math.abs(b - half))[0];
      if (sp == null) continue;
      lines = [name.slice(0, sp), name.slice(sp + 1)];
      if (Math.max(lines[0].length, lines[1].length) * fs * 0.56 > pxw * 1.25) continue;
    }
    const w = Math.max(...lines.map((l) => l.length)) * fs * 0.56 + 6, h = lines.length * fs * 1.2 + 2;
    for (const k of [-1, 0, 1]) {
      const pt = map.project([p.lx + 360 * k, p.ly]);
      if (pt.x < -w || pt.x > W + w || pt.y < -h || pt.y > H + h) continue;
      const box = [pt.x - w / 2, pt.y - h / 2, pt.x + w / 2, pt.y + h / 2];
      if (taken.some((t) => box[0] < t[2] && box[2] > t[0] && box[1] < t[3] && box[3] > t[1])) continue;
      taken.push(box); made++;
      const el = document.createElement('div'); el.className = 'hl' + (f.id === sel ? ' sel' : ''); el.style.cssText = `left:${pt.x}px;top:${pt.y}px;font-size:${fs}px`;
      el.innerHTML = lines.map(esc).join('<br>'); labelBox.append(el); labelEls.push(el);
    }
  }
}
map.on('move', () => { if (active) drawLabels(); });
map.on('resize', () => { if (active) drawLabels(); });

// ---------- clicking a shape ----------
function areaText(ar) { const km = ar * 111.32 * 110.57; return km >= 1e6 ? `about ${(km / 1e6).toFixed(1)} million km²` : km >= 1000 ? `about ${Math.round(km / 1000) * 1000 >= 100000 ? Math.round(km / 10000) * 10 : Math.round(km / 1000)} thousand km²` : 'under 1,000 km²'; }
const PREC = { 1: 'Approximate: the borders are a rough guide.', 2: 'Fairly accurate for the time.', 3: 'Precise: set by treaties and international law.' };
function showPanel(f) {
  const p = f.properties, panel = $('#panel');
  const era = eraOf(cur.year);
  const row = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
  const q = enc(`${p.n} ${cur.year < 0 ? '' : ''}`.trim());
  panel.innerHTML = `<div class="ph"><span class="flag">🏛️</span><h2>${esc(p.n)}</h2><button id="close" aria-label="Close">✕</button></div>
  <div class="body"><table>${row('When', `${fmtYear(cur.year)} · ${esc(era.name)}`)}${p.s ? row('Ruled by', esc(p.s)) : ''}${p.p ? row('Part of', esc(p.p)) : ''}
  ${row('Size', areaText(p.ar))}${row('Borders', PREC[p.b] || PREC[1])}</table>
  <p class="muted" style="margin:8px 0 0;font-size:13px">${esc(NOTES[cur.year] || '')}</p>
  <h3>Learn more</h3><div class="chips"><a target="_blank" rel="noopener" href="${p.u ? 'https://en.wikipedia.org/wiki/' + p.u : 'https://en.wikipedia.org/wiki/Special:Search?search=' + q}">Wikipedia</a><a target="_blank" rel="noopener" href="https://www.google.com/search?q=${enc(p.n + ' history')}">Search the web</a></div></div>`;
  panel.hidden = false; panel.scrollTop = 0;
  $('#close').onclick = () => { hidePanel(); select(null); };
}
function hidePanel() { const panel = $('#panel'); if (active && panel.querySelector('.ph .flag')?.textContent === '🏛️') panel.hidden = true; }
function select(id) {
  if (sel != null) map.setFeatureState({ source: 'hist', id: sel }, { selected: false });
  sel = id; if (id != null) map.setFeatureState({ source: 'hist', id }, { selected: true });
  drawLabels();
}
map.on('click', (e) => {
  if (!active) return;
  const f = map.queryRenderedFeatures(e.point, { layers: ['hist-fill'] })[0];
  if (!f || f.properties.h < 0 || !f.properties.n) { select(null); hidePanel(); return; }
  select(f.id); showPanel(cur.data.features.find((x) => x.id === f.id) || f);
});
const tip = $('#tip');
map.on('mousemove', 'hist-fill', (e) => {
  if (!active) return;
  const f = e.features[0], n = f?.properties.n;
  map.getCanvas().style.cursor = n ? 'pointer' : '';
  if (!n) { tip.hidden = true; return; }
  tip.hidden = false; tip.textContent = n + (f.properties.s ? ` · ruled by ${f.properties.s}` : ''); tip.style.left = e.point.x + 14 + 'px'; tip.style.top = e.point.y + 14 + 'px';
});
map.on('mouseleave', 'hist-fill', () => { if (active) { tip.hidden = true; map.getCanvas().style.cursor = ''; } });

// ---------- the list of names for this snapshot ----------
function renderList() {
  const box = $('#h-rows'); if (!cur || $('#h-table').hidden) return;
  const q = $('#h-find').value.trim().toLowerCase();
  const rows = cur.named.filter((f) => !q || f.properties.n.toLowerCase().includes(q) || (f.properties.s || '').toLowerCase().includes(q));
  box.innerHTML = rows.slice(0, 300).map((f) => `<button type="button" class="sbr" data-id="${f.id}"><span class="nm">${esc(f.properties.n)}${f.properties.s ? ` <span class="muted">· ${esc(f.properties.s)}</span>` : ''}</span><span class="v">${esc(areaText(f.properties.ar).replace('about ', '').replace(' million km²', ' M km²').replace(' thousand km²', ' k km²'))}</span></button>`).join('')
    + (rows.length > 300 ? `<p class="muted" style="padding:8px 12px;margin:0">${rows.length - 300} more. Type in the box to narrow the list.</p>` : '') || '<p class="muted" style="padding:10px 12px;margin:0">Nothing matches.</p>';
}
function bboxOf(f) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const poly of f.geometry.coordinates) for (const [x, y] of poly[0]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return [[x0, y0], [x1, y1]]; }
$('#h-rows').addEventListener('click', (e) => {
  const b = e.target.closest('.sbr'); if (!b) return;
  const f = cur.data.features.find((x) => x.id === +b.dataset.id); if (!f) return;
  const [[x0, y0], [x1, y1]] = bboxOf(f);
  if (x1 - x0 > 300) map.flyTo({ center: [f.properties.lx, f.properties.ly], zoom: 3, duration: 900 }); else map.fitBounds([[x0, y0], [x1, y1]], { padding: 90, maxZoom: 6, duration: 900 });
  select(f.id); showPanel(f);
});
$('#h-find').addEventListener('input', renderList);
$('#h-list').addEventListener('click', () => { const t = $('#h-table'); t.hidden = !t.hidden; $('#h-list').classList.toggle('on', !t.hidden); renderList(); });
$('#h-names').addEventListener('click', () => { namesOn = !namesOn; $('#h-names').classList.toggle('on', namesOn); drawLabels(); });

// ---------- the timeline ----------
function drawEras() {
  const box = $('#h-eras'); box.innerHTML = '';
  ERAS.forEach((e, k) => {
    const first = index.findIndex((s) => s.year <= e.to && (k === 0 || s.year > ERAS[k - 1].to));
    const n = index.filter((s) => s.year <= e.to && (k === 0 || s.year > ERAS[k - 1].to)).length;
    if (!n) return;
    const b = document.createElement('button'); b.type = 'button'; b.dataset.first = first; b.dataset.era = e.key; b.style.flex = String(n); b.title = `${e.name}: ${fmtYear(index[first].year)}`; b.textContent = e.name; box.append(b);
  });
}
function setIndex(i, fromUser) {
  idx = Math.max(0, Math.min(index.length - 1, i));
  if (fromUser) stop();
  const y = index[idx].year, era = eraOf(y);
  $('#h-range').value = idx; $('#h-year').textContent = fmtYear(y);
  $('#h-era').textContent = era.name; $('#h-note').textContent = NOTES[y] || era.text;
  $('#h-eras').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.era === era.key));
  $('#h-prev').disabled = idx === 0; $('#h-next').disabled = idx === index.length - 1;
  $('#h-count').textContent = `${idx + 1} of ${index.length} snapshots`;
  load(idx);
}
$('#h-range').addEventListener('input', (e) => setIndex(+e.target.value, true));
$('#h-prev').addEventListener('click', () => setIndex(idx - 1, true));
$('#h-next').addEventListener('click', () => setIndex(idx + 1, true));
$('#h-eras').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setIndex(+b.dataset.first, true); });
function stop() { if (playing) { clearInterval(playing); playing = null; } $('#h-play').textContent = '▶'; $('#h-play').classList.remove('on'); }
$('#h-play').addEventListener('click', () => {
  if (playing) return stop();
  if (idx >= index.length - 1) setIndex(0);
  $('#h-play').textContent = '❚❚'; $('#h-play').classList.add('on');
  playing = setInterval(() => { if (idx >= index.length - 1) return stop(); setIndex(idx + 1); }, 1900);
});

// ---------- turning the History view on and off ----------
async function enter() {
  if (active) return;
  active = true; document.body.classList.add('history'); $('#hist').hidden = false;
  try {
    if (!index) { index = await (await fetch('/data/history/index.json')).json(); drawEras(); $('#h-range').max = index.length - 1; }
  } catch { active = false; document.body.classList.remove('history'); say('Could not load the history timeline. Check your connection and try again.', true); return; }
  ensureLayers(); showLayers(true); paintAll(); app.closePanel?.(); pad();
  const start = cur ? idx : index.findIndex((s) => s.year === 100);
  setIndex(start < 0 ? 0 : start);
  map.easeTo({ center: [30, 24], zoom: Math.min(map.getZoom(), 1.9), duration: 700 });
}
function leave() {
  if (!active) return;
  stop(); active = false; document.body.classList.remove('history'); $('#hist').hidden = true; pad();
  if (ready) showLayers(false);
  for (const el of labelEls) el.remove(); labelEls = []; tip.hidden = true; hidePanelAlways();
  app.recolor?.();
}
function hidePanelAlways() { const panel = $('#panel'); if (panel.querySelector('.ph .flag')?.textContent === '🏛️') panel.hidden = true; }
window.addEventListener('maptheme-change', () => { if (ready) paintAll(); });
window.__history = { enter, leave, get active() { return active; }, get year() { return cur?.year; }, get count() { return index?.length; }, setIndex, get current() { return cur; } };
