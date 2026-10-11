// Real pictures for the History timeline: each snapshot is matched to a Wikipedia article about that time (a monument, a ruler, an event)
// and we show that article's lead picture. Wikipedia only returns pictures it has a free licence for. Nothing is stored on our side.
// Needs internet; when a picture is not available the timeline simply shows a plain tile.
export const ERA_TITLES = {
  '-123000': 'Neanderthal', '-10000': 'Lascaux', '-8000': 'Göbekli Tepe', '-5000': 'Çatalhöyük', '-4000': 'Sumer', '-3000': 'Narmer Palette',
  '-2000': 'Great Pyramid of Giza', '-1500': 'Tutankhamun', '-1000': 'Neo-Assyrian Empire', '-700': 'Ashurbanipal', '-500': 'Persepolis', '-400': 'Parthenon',
  '-323': 'Alexander the Great', '-300': 'Ptolemy I Soter', '-200': 'Terracotta Army', '-100': 'Pompey', '-1': 'Augustus', '100': 'Colosseum',
  '200': 'Septimius Severus', '300': 'Constantine the Great', '400': 'Sack of Rome (410)', '500': 'Hagia Sophia', '600': 'Taq Kasra', '700': 'Dome of the Rock',
  '800': 'Charlemagne', '900': 'Oseberg ship', '1000': 'Brihadisvara Temple, Thanjavur', '1100': 'First Crusade', '1200': 'Genghis Khan', '1279': 'Kublai Khan',
  '1300': 'Mansa Musa', '1400': 'Timur', '1492': 'Christopher Columbus', '1500': 'Mona Lisa', '1530': 'Suleiman the Magnificent', '1600': 'William Shakespeare',
  '1650': 'Taj Mahal', '1700': 'Peter the Great', '1715': 'Louis XIV', '1783': 'George Washington', '1800': 'Napoleon', '1815': 'Battle of Waterloo',
  '1878': 'Congress of Berlin', '1880': 'Scramble for Africa', '1900': 'Boxer Rebellion', '1914': 'World War I', '1920': 'League of Nations', '1930': 'Great Depression',
  '1938': 'Munich Agreement', '1945': 'World War II', '1960': 'Decolonization of Africa', '1994': 'Dissolution of the Soviet Union', '2000': 'Year 2000 problem', '2010': 'Burj Khalifa',
};
export const eraTitle = (year) => ERA_TITLES[String(year)] || '';

const cache = new Map();            // requested title -> { src, page } | null
const pending = new Map();          // requested title -> promise
const API = 'https://en.wikipedia.org/w/api.php';

async function batch(titles) {
  const u = new URL(API);
  const q = { action: 'query', format: 'json', formatversion: '2', origin: '*', prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '280', redirects: '1', titles: titles.join('|') };
  for (const k in q) u.searchParams.set(k, q[k]);
  const r = await fetch(u); if (!r.ok) throw new Error('bad status');
  const j = (await r.json()).query || {};
  const norm = new Map((j.normalized || []).map((x) => [x.from, x.to])), redir = new Map((j.redirects || []).map((x) => [x.from, x.to]));
  const pages = new Map((j.pages || []).map((p) => [p.title, p]));
  for (const t of titles) {
    const n = norm.get(t) || t, page = pages.get(redir.get(n) || n);
    const src = page?.thumbnail?.source;
    cache.set(t, src && /^https:\/\//.test(src) ? { src, page: 'https://en.wikipedia.org/wiki/' + encodeURIComponent((page.title || t).replace(/ /g, '_')), title: page.title || t } : null);
  }
}
// Ask for several titles at once (Wikipedia takes up to 50 per request). Never throws: failed titles just have no picture.
export function loadPhotos(titles) {
  const want = [...new Set(titles.filter(Boolean))].filter((t) => !cache.has(t) && !pending.has(t));
  for (let i = 0; i < want.length; i += 40) {
    const part = want.slice(i, i + 40);
    const p = batch(part).catch(() => {}).finally(() => part.forEach((t) => pending.delete(t)));
    part.forEach((t) => pending.set(t, p));
  }
  return Promise.all(titles.filter(Boolean).map((t) => pending.get(t))).then(() => {});
}
export const getPhoto = (title) => cache.get(title) || null;
