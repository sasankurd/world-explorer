// Tiny server step for the Conflict layer: asks GDELT on the site's behalf (browsers are often refused by it) and keeps the answer for 5 minutes.
// Everything else is served from the static files.
export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (u.pathname !== '/api/conflict') return env.ASSETS.fetch(req);
    const q = u.searchParams.get('q') || '';
    if (q.length > 400) return new Response('bad request', { status: 400 });
    const target = `https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(`${q} sourcelang:eng`)}&format=geojson&timespan=1d&maxpoints=250`;
    let r; try { r = await fetch(target, { cf: { cacheTtl: 300, cacheEverything: true } }); } catch { return new Response('upstream unavailable', { status: 502 }); }
    return new Response(r.body, { status: r.status, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' } });
  },
};
