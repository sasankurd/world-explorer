// The Overview tab of a country window gets a small religion chart (2010 estimate, Pew Research Center).
import { loadReligion, sharesOf, shareBar, trendColumns, biggest, GROUPS, pct, isProjection } from './religion.js';
while (!window.__app) await new Promise((r) => setTimeout(r, 25));
const app = window.__app;
window.addEventListener('country-open', async (e) => {
  if (e.detail?.tab !== 'overview') return;
  const id = e.detail.id, panel = document.querySelector('#panel'), body = panel?.querySelector('.body'); if (!body) return;
  let data; try { data = await loadReligion(); } catch { return; }       // no data file: simply no chart
  const name = app.countries[id]?.name;
  if (!panel.contains(body) || panel.querySelector('h2')?.textContent !== name || body.querySelector('.rel-panel')) return;
  // while a religion statistic is on the map, follow its year; otherwise show the 2010 estimate
  const st = window.__stats, follow = !!st?.religion, y = follow ? st.year : 2010;
  const s = sharesOf(data, id, y); if (!s) return;
  const sec = document.createElement('section'); sec.className = 'rel-panel'; sec.setAttribute('aria-label', `Religion in ${name}`);
  const h = document.createElement('h3'); h.textContent = `Religion, ${y}${isProjection(y) ? '*' : ''}`; sec.append(h);
  sec.append(shareBar(s, { highlight: follow ? GROUPS.findIndex((g) => 'rel_' + g.key === st.key) : -1 }));
  const cap = document.createElement('div'); cap.className = 'rel-cap'; cap.textContent = 'How the mix changes, 2010 to 2050'; sec.append(cap, trendColumns(data, id, { year: y }));
  const lead = biggest(s), note = document.createElement('p'); note.className = 'rel-foot muted';
  note.textContent = `${GROUPS[lead].label} are the largest group (${pct(s[lead])}). 2010 is an estimate by the Pew Research Center; * marks projections, not measurements. Open Layers, then Statistics, to colour the map by religion.`;
  sec.append(note); body.append(sec);
});
