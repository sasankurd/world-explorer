// Builds public/data/series/{population,gdp}.json from the open "datasets" copies of World Bank data on GitHub.
// Format: { y0: 1960, v: { USA: [value or null for each year from y0 on] } }
import fs from 'node:fs';
const countries = JSON.parse(fs.readFileSync('public/data/countries.json', 'utf8'));
const ids = new Set(Object.keys(countries));
const sources = {
  population: 'https://raw.githubusercontent.com/datasets/population/main/data/population.csv',
  gdp: 'https://raw.githubusercontent.com/datasets/gdp/main/data/gdp.csv',
};
for (const [key, url] of Object.entries(sources)) {
  const text = await (await fetch(url)).text();
  const v = {}; let maxY = 0;
  for (const line of text.split(/\r?\n/).slice(1)) {
    const m = line.match(/^(?:"[^"]*"|[^,]*),([A-Z]{3}),(\d{4}),([-\d.eE+]+)$/);
    if (!m || !ids.has(m[1])) continue;
    const y = +m[2], val = +m[3]; if (!isFinite(val)) continue;
    (v[m[1]] ??= {})[y] = val; maxY = Math.max(maxY, y);
  }
  const out = {};
  for (const [id, byYear] of Object.entries(v)) {
    const a = []; for (let y = 1960; y <= maxY; y++) a.push(byYear[y] != null ? Math.round(byYear[y]) : null);
    out[id] = a;
  }
  fs.writeFileSync(`public/data/series/${key}.json`, JSON.stringify({ y0: 1960, v: out }));
  console.log(key, Object.keys(out).length, 'countries, to', maxY);
}
