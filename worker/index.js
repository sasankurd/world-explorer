// Tiny server step for the site. Everything not listed here is served from the static files.
//  /api/gdelt/...  hands GDELT's public event files to the Conflict layer (GDELT may refuse browsers directly)
//  /api/search?q=  Live search: an AI model turns the topic into OpenStreetMap tags, then OpenStreetMap's Overpass service lists matching places
const KEYS = new Set(['amenity', 'leisure', 'sport', 'shop', 'tourism', 'historic', 'building', 'craft', 'office']);
const OK = /^[a-z0-9_]{1,40}$/;
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' } });

// plain-word backup when the AI is unavailable: topic word -> OpenStreetMap tag groups
const WORDS = [
  [/cinema|movie|film/, 'Cinemas', [[['amenity', 'cinema']]]], [/restaurant|food|eat/, 'Restaurants', [[['amenity', 'restaurant']]]], [/cafe|coffee/, 'Cafés', [[['amenity', 'cafe']]]],
  [/chess/, 'Chess clubs and venues', [[['sport', 'chess']], [['leisure', 'chess']]]], [/football|soccer/, 'Football stadiums', [[['leisure', 'stadium'], ['sport', 'soccer']]]],
  [/ufc|mma|boxing|martial/, 'Martial arts and boxing gyms', [[['sport', 'boxing']], [['sport', 'martial_arts']], [['sport', 'mixed_martial_arts']]]], [/basketball/, 'Basketball venues', [[['leisure', 'stadium'], ['sport', 'basketball']], [['leisure', 'sports_centre'], ['sport', 'basketball']]]],
  [/tennis/, 'Tennis venues', [[['leisure', 'sports_centre'], ['sport', 'tennis']]]], [/golf/, 'Golf courses', [[['leisure', 'golf_course']]]], [/museum/, 'Museums', [[['tourism', 'museum']]]], [/hotel/, 'Hotels', [[['tourism', 'hotel']]]],
  [/gym|fitness|crossfit/, 'Gyms', [[['leisure', 'fitness_centre']]]], [/hospital/, 'Hospitals', [[['amenity', 'hospital']]]], [/library/, 'Libraries', [[['amenity', 'library']]]], [/stadium/, 'Stadiums', [[['leisure', 'stadium']]]],
];

async function intent(q, env) {
  if (env.AI) {
    try {
      const r = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', { max_tokens: 300, messages: [
        { role: 'system', content: 'You turn a topic into OpenStreetMap tag groups that find real places for it on a map. Reply with JSON only, no words: {"label":"short plural name","clauses":[[["key","value"],["key","value"]]]}. Each clause is a group of tags that must all match; separate clauses are alternatives. Use at most 4 clauses and keys only from: amenity, leisure, sport, shop, tourism, historic, building, craft, office. Values are lowercase OpenStreetMap values. For a sport or game use its venues, for example football: [[["leisure","stadium"],["sport","soccer"]]]; chess: [[["sport","chess"]],[["leisure","chess"]]]; UFC or MMA: [[["sport","boxing"]],[["sport","martial_arts"]],[["sport","mixed_martial_arts"]]]; cinema: [[["amenity","cinema"]]]; restaurant: [[["amenity","restaurant"]]].' },
        { role: 'user', content: q },
      ] });
      const t = typeof r.response === 'string' ? r.response : JSON.stringify(r.response);
      const o = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)), clauses = clean(o.clauses);
      if (clauses.length) return { label: String(o.label || q).slice(0, 60), clauses, ai: true };
    } catch { /* fall through to the word list */ }
  }
  const w = WORDS.find(([re]) => re.test(q.toLowerCase()));
  return w ? { label: w[1], clauses: w[2], ai: false } : null;
}
const clean = (cl) => (Array.isArray(cl) ? cl : []).slice(0, 4).map((g) => (Array.isArray(g) ? g : []).slice(0, 3).filter((p) => Array.isArray(p) && KEYS.has(p[0]) && OK.test(String(p[1]))).map((p) => [p[0], String(p[1])])).filter((g) => g.length);

async function overpass(clauses) {
  const body = (area) => `[out:json][timeout:25];(${clauses.map((g) => `nwr${g.map(([k, v]) => `["${k}"="${v}"]`).join('')}${area};`).join('')});out center 1500;`;
  let err;
  for (const u of OVERPASS) {
    try { const r = await fetch(u, { method: 'POST', body: `data=${encodeURIComponent(body(''))}`, headers: { 'content-type': 'application/x-www-form-urlencoded' } }); if (r.ok) return (await r.json()).elements || []; err = new Error(`HTTP ${r.status}`); } catch (e) { err = e; }
  }
  throw err;
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (u.pathname === '/api/search') {
      const q = (u.searchParams.get('q') || '').trim().slice(0, 80); if (!q) return json({ error: 'empty' }, 400);
      const it = await intent(q, env); if (!it) return json({ error: 'I could not tell what places to look for. Try a place type or a sport, like "cinemas" or "chess".' }, 422);
      try {
        const els = await overpass(it.clauses);
        const places = els.map((e) => ({ lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon, name: e.tags?.name || '', type: e.tags?.amenity || e.tags?.leisure || e.tags?.tourism || e.tags?.sport || e.tags?.shop || '' })).filter((p) => p.lat != null && p.lon != null);
        return json({ label: it.label, ai: it.ai, places });
      } catch { return json({ error: 'The map data service is busy. Try again in a minute.' }, 502); }
    }
    const m = u.pathname.match(/^\/api\/gdelt\/(lastupdate\.txt|\d{14}\.export\.CSV\.zip)$/);
    if (!m) return env.ASSETS.fetch(req);
    let r; try { r = await fetch(`https://data.gdeltproject.org/gdeltv2/${m[1]}`, { cf: { cacheTtl: m[1] === 'lastupdate.txt' ? 120 : 900, cacheEverything: true } }); } catch { return new Response('upstream unavailable', { status: 502 }); }
    return new Response(r.body, { status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/octet-stream', 'cache-control': 'public, max-age=300' } });
  },
};
