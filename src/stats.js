// The Stats bar: pick a statistic, drag the year slider, watch the map change. Also the "where people live" heat view.
import { allDefs, defOf, loadSeries, valueAt, fmtVal, domainOf, norm, ramp, rampCss, NODATA, customStats, saveCustomStats, matcher, parsePasted, fetchWorldBank } from './series.js';

while (!window.__app) await new Promise((r) => setTimeout(r, 25));
const app = window.__app;
const { map, countries } = app;
const $ = (s) => document.querySelector(s);
const bar = $('#statbar'), range = $('#sb-range'), yearOut = $('#sb-year'), playBtn = $('#sb-play');

let numsOn = true, tableOn = false;
let key = 'population', mode = 'stat'; // mode: 'stat' (colour by a statistic), 'heat' (where people live) or 'history' (the world in past eras)
let series = null, def = defOf(key), dom = [0, 1], year = 2023, userYear = null, seq = 0, playing = null, heatReady = false;
const theme = () => (app.isDark() ? 'dark' : 'light');
const isOpen = () => !bar.hidden;

// ---------- what the map asks us ----------
app.statsHook = {
  get heat() { return mode === 'heat' && isOpen(); },
  get numbers() { return mode === 'stat' && isOpen() && numsOn && !!series; },
  text(c) { const v = series ? valueAt(series, c.id, year) : null; return v == null ? '' : fmtVal(def, v); },
  color(c) {
    if (mode === 'heat') return '#0d1218'; // the heat view is always drawn on dark
    const v = series ? valueAt(series, c.id, year) : null;
    if (v == null) return NODATA[theme()];
    return ramp(theme(), norm(def, dom, v));
  },
  tip(c) {
    if (mode === 'heat') return '';
    const v = series ? valueAt(series, c.id, year) : null;
    return ` · ${v == null ? 'no data' : fmtVal(def, v)}${series?.static ? '' : ` (${year})`}`;
  },
};
let raf = 0;
const recolorSoon = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; app.recolor(); renderTable(); }); };

// ---------- numbers: the ranked table and the figures on the map ----------
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function renderTable() {
  const box = $('#sb-table');
  if (!tableOn || box.hidden || mode !== 'stat' || !series) return;
  const q = $('#sb-find').value.trim().toLowerCase();
  const rows = Object.values(countries).map((c) => [c, valueAt(series, c.id, year)]).filter((r) => r[1] != null).sort((a, b) => b[1] - a[1]);
  const html = rows.map(([c, v], i) => [i + 1, c, v]).filter(([, c]) => !q || c.name.toLowerCase().includes(q))
    .map(([n, c, v]) => `<button type="button" class="sbr" data-id="${c.id}"><span class="r">${n}</span><span class="nm">${c.flag} ${esc(c.name)}</span><span class="v">${esc(fmtVal(def, v))}</span></button>`).join('');
  $('#sb-rows').innerHTML = html || '<p class="muted" style="padding:10px 12px;margin:0">No country matches.</p>';
}
$('#sb-nums').addEventListener('click', () => { numsOn = !numsOn; $('#sb-nums').classList.toggle('on', numsOn); app.recolor(); });
$('#sb-tbtn').addEventListener('click', () => { tableOn = !tableOn; $('#sb-tbtn').classList.toggle('on', tableOn); $('#sb-table').hidden = !tableOn; renderTable(); });
$('#sb-find').addEventListener('input', renderTable);
$('#sb-rows').addEventListener('click', (e) => { const b = e.target.closest('.sbr'); if (b) app.openCountry(b.dataset.id, 'overview', true); });

// ---------- the chips ----------
function renderChips() {
  if (mode === 'history') { // in History only this row is needed, which keeps the bar small
    $('#sb-groups').innerHTML = '<div class="sbg"><span class="sbl">History</span><div class="sbc"><button type="button" class="on" data-history="1">World through time</button><button type="button" data-back="1" title="Go back to the statistics">← Statistics</button></div></div>';
    return;
  }
  const groups = [];
  for (const d of allDefs()) {
    let g = groups.find((x) => x.name === d.group);
    if (!g) groups.push((g = { name: d.group, items: [] }));
    g.items.push(d);
  }
  const chip = (d) => `<button type="button" class="${mode === 'stat' && d.key === key ? 'on' : ''}" data-key="${d.key}">${d.label}</button>${d.custom ? `<button type="button" class="del" data-del="${d.key}" title="Remove ${d.label}" aria-label="Remove ${d.label}">✕</button>` : ''}`;
  const html = (g) => `<div class="sbg"><span class="sbl">${g.name}</span><div class="sbc">${g.items.map(chip).join('')}${g.name === 'Yours' ? '<button type="button" class="addbtn" data-add="1">+ Add statistic</button>' : ''}</div></div>`;
  if (!groups.some((g) => g.name === 'Yours')) groups.push({ name: 'Yours', items: [] });
  const yours = groups.find((g) => g.name === 'Yours');
  const heat = `<div class="sbg"><span class="sbl">Where people live</span><div class="sbc"><button type="button" class="${mode === 'heat' ? 'on' : ''}" data-heat="1">People heat</button></div></div>`;
  const hist = `<div class="sbg"><span class="sbl">History</span><div class="sbc"><button type="button" class="${mode === 'history' ? 'on' : ''}" data-history="1" title="How the world's countries, names and borders looked in every era">World through time</button></div></div>`;
  $('#sb-groups').innerHTML = groups.filter((g) => g !== yours).map(html).join('') + heat + hist + html(yours);
}
$('#sb-groups').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.key) select(b.dataset.key);
  else if (b.dataset.heat) setHeat();
  else if (b.dataset.history) setHistory();
  else if (b.dataset.back) select(key);
  else if (b.dataset.add) { const f = $('#sb-add'); f.hidden = !f.hidden; if (!f.hidden) $('#sa-name').focus(); }
  else if (b.dataset.del) {
    saveCustomStats(customStats().filter((c) => c.key !== b.dataset.del));
    if (key === b.dataset.del) select('population'); else renderChips();
  }
});

// ---------- choosing a statistic ----------
const note = (t) => { $('#sb-note').textContent = t; };
async function select(k) {
  leaveHistory(); stopPlay(); mode = 'stat'; key = k; def = defOf(k) || defOf('population');
  setHeatLayer(false); renderChips();
  $('#sb-time').classList.remove('heatmode');
  note('Loading…');
  const mine = ++seq;
  try {
    const s = await loadSeries(k, countries, (m) => { if (key === k && mode === 'stat') adopt(m); });
    if (mine === seq) adopt(s);
  } catch (e) {
    if (mine !== seq) return;
    series = null; recolorSoon();
    note(`Could not load "${def.label}": ${e.message}. Check your connection, then click it again.`);
  }
  app.applyView(); // sea and borders for the right theme
}
function adopt(s) {
  series = s; def = defOf(key) || def; dom = domainOf(def, s);
  const still = s.static;
  for (const el of [playBtn, yearOut, $('.sb-rangewrap')]) el.hidden = !!still;
  range.min = s.first; range.max = s.last;
  year = userYear == null ? s.last : Math.min(Math.max(userYear, s.first), s.last);
  syncYear(false);
  $('#sb-min').textContent = s.first; $('#sb-max').textContent = s.last;
  drawLegend();
  const src = def.custom ? (def.wb ? 'World Bank data' : 'your numbers') : s.live ? 'live World Bank data' : s.static ? 'country facts' : 'saved data; checking the World Bank for newer years';
  note(`${def.label}: ${def.unit}. ${still ? '' : `${s.first}–${s.last}. `}Source: ${src}.`);
  recolorSoon();
}
function drawLegend() {
  $('#sb-grad').style.background = mode === 'heat' ? 'linear-gradient(90deg,rgba(40,20,120,.6),#7a28c8,#e0489f,#ffb347,#fff6c8)' : rampCss(theme());
  $('#sb-lo').textContent = mode === 'heat' ? 'fewer people' : fmtVal(def, dom[0]);
  $('#sb-hi').textContent = mode === 'heat' ? 'more people' : fmtVal(def, dom[1]);
}

// ---------- the year slider ----------
function syncYear(recolor = true) {
  range.value = year; yearOut.textContent = year;
  if (recolor) recolorSoon();
}
range.addEventListener('input', () => { year = +range.value; userYear = year; stopPlay(); syncYear(); });
function stopPlay() { if (playing) { clearInterval(playing); playing = null; } playBtn.textContent = '▶'; playBtn.classList.remove('on'); }
playBtn.addEventListener('click', () => {
  if (playing) { stopPlay(); return; }
  if (!series) return;
  if (year >= series.last) year = series.first;
  userYear = year; syncYear();
  playBtn.textContent = '❚❚'; playBtn.classList.add('on');
  playing = setInterval(() => {
    if (year >= series.last) { stopPlay(); return; }
    year++; userYear = year; syncYear();
  }, 380);
});

// ---------- people heat: where people actually live ----------
async function ensureHeat() {
  if (heatReady) return;
  heatReady = true;
  try {
    const rows = await (await fetch('/data/cities.json')).json();
    const features = rows.filter((r) => r[3] > 0).map((r) => ({ type: 'Feature', properties: { pop: r[3] }, geometry: { type: 'Point', coordinates: [r[1], r[2]] } }));
    map.addSource('people', { type: 'geojson', data: { type: 'FeatureCollection', features } });
    map.addLayer({
      id: 'heat', type: 'heatmap', source: 'people', layout: { visibility: 'none' },
      paint: {
        'heatmap-weight': ['interpolate', ['linear'], ['get', 'pop'], 0, 0.04, 1e5, 0.2, 1e6, 0.55, 1e7, 1],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.9, 5, 1.8, 9, 3],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 5, 2, 12, 4, 34, 6, 80, 8, 170, 10, 320],
        'heatmap-opacity': 0.92,
        'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.08, 'rgba(48,24,140,0.55)', 0.25, 'rgba(122,40,200,0.78)', 0.45, '#e0489f', 0.7, '#ffb347', 1, '#fff6c8'],
      },
    }, 'selected');
  } catch { heatReady = false; }
}
async function setHeatLayer(on) {
  if (on) await ensureHeat();
  if (map.getLayer('heat')) map.setLayoutProperty('heat', 'visibility', on ? 'visible' : 'none');
}
async function setHeat() {
  leaveHistory(); stopPlay(); mode = 'heat'; seq++; renderChips();
  $('#sb-time').classList.add('heatmode');
  for (const el of [playBtn, yearOut, $('.sb-rangewrap')]) el.hidden = true;
  drawLegend();
  note('Brighter means more people live close together, so empty desert and crowded cities stand out. Built from about 4,800 cities and towns of roughly 50,000 people or more; small villages are not counted.');
  app.applyView();
  await setHeatLayer(true);
}

// ---------- history: the world in every era ----------
function leaveHistory() {
  window.__history?.leave();
  $('#sb-time').hidden = false; $('#sb-table').hidden = !tableOn;
}
async function setHistory() {
  stopPlay(); mode = 'history'; seq++; renderChips();
  setHeatLayer(false);
  $('#sb-time').hidden = true; $('#sb-table').hidden = true;
  note('Colours show who ruled each area. Dashed lines are rough borders. Click a shape to learn more. Data: Historical Basemaps (GPL-3.0); ancient borders are approximate.');
  app.applyView();
  await window.__history?.enter();
}

// ---------- opening and closing the bar ----------
let started = false;
function open() {
  bar.hidden = false;
  if (!started) { started = true; renderChips(); select(key); } else if (mode === 'heat') { setHeatLayer(true); } else if (mode === 'history') { window.__history?.enter(); }
  else recolorSoon();
  fitOffset();
}
function close() {
  stopPlay(); window.__history?.leave(); bar.hidden = true; $('#sb-add').hidden = true;
  if (map.getLayer('heat')) map.setLayoutProperty('heat', 'visibility', 'none');
  fitOffset();
}
window.addEventListener('view-change', (e) => (e.detail === 'stats' ? open() : close()));
window.addEventListener('maptheme-change', () => { if (isOpen()) { drawLegend(); recolorSoon(); } });
function fitOffset() { document.documentElement.style.setProperty('--sb', bar.hidden ? '0px' : bar.offsetHeight + 'px'); }
new ResizeObserver(fitOffset).observe(bar);
window.__stats = { show(k) { if (app.view !== 'stats') app.setView('stats'); select(k); }, select };

// ---------- add your own statistic ----------
const form = $('#sb-add'), msg = $('#sa-msg');
const say = (t, bad) => { msg.textContent = t; msg.style.color = bad ? '#ff8a8a' : ''; };
form.addEventListener('change', (e) => {
  if (e.target.name !== 'sa-mode') return;
  const wb = form.elements['sa-mode'].value === 'wb';
  $('#sa-paste-l').hidden = wb; $('#sa-wb-l').hidden = !wb; say('');
});
$('#sb-add-close').addEventListener('click', () => { form.hidden = true; });
const guessKind = (vals) => { const p = vals.filter((x) => x > 0).sort((a, b) => a - b); return p.length > 8 && p[Math.floor(p.length * 0.95)] / p[Math.floor(p.length * 0.05)] > 200 ? 'log' : 'lin'; };
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#sa-name').value.trim(), unit = $('#sa-unit').value.trim();
  const useWb = form.elements['sa-mode'].value === 'wb';
  const id = 'c_' + Date.now().toString(36);
  const ids = new Set(Object.keys(countries));
  try {
    let d;
    if (!useWb) {
      const { rows, bad } = parsePasted($('#sa-paste').value, matcher(countries));
      if (!rows.length) return say('No countries recognised. Use names like France or three-letter codes like FRA.', true);
      d = { key: id, label: name, unit: unit || name, rows, kind: guessKind(rows.map((r) => r[2])), fmt: 'num' };
      say(`Added ${new Set(rows.map((r) => r[0])).size} countries${bad ? `, skipped ${bad} lines I could not read` : ''}.`);
    } else {
      const code = $('#sa-wb').value.trim();
      if (!/^[A-Za-z0-9._]+$/.test(code)) return say('Type a World Bank code such as SP.DYN.IMRT.IN.', true);
      say('Checking the World Bank…');
      const w = await fetchWorldBank(code, ids);
      d = { key: id, label: name, unit: unit || w.name || code, wb: code, kind: guessKind(Object.values(w.v).map((a) => a[a.length - 1]).filter((x) => x != null)), fmt: 'num' };
      say('Added.');
    }
    saveCustomStats([...customStats(), d]);
    form.reset(); $('#sa-paste-l').hidden = false; $('#sa-wb-l').hidden = true;
    setTimeout(() => { form.hidden = true; say(''); }, 900);
    select(id);
  } catch (err) { say(err.message || 'Could not add that statistic.', true); }
});

// ---------- minimize the stats bar (also folds away by itself when you search) ----------
const minBtn = document.createElement('button');
minBtn.type = 'button'; minBtn.id = 'sb-min-btn';
bar.prepend(minBtn);
function setMin(on) {
  bar.classList.toggle('min', on);
  minBtn.textContent = on ? '📊 Stats ▾' : '▴ Hide';
  minBtn.setAttribute('aria-expanded', String(!on));
  minBtn.title = on ? 'Show the stats menu' : 'Hide the stats menu to see more of the map';
  fitOffset();
}
minBtn.onclick = () => setMin(!bar.classList.contains('min'));
setMin(false);
document.querySelector('#search')?.addEventListener('focus', () => { if (!bar.hidden) setMin(true); });
