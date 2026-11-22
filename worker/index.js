// Tiny server step for the Conflict layer: hands GDELT's public event files to the page (it may refuse browsers directly) and keeps each for 15 minutes.
// Everything else is served from the static files.
export default {
  async fetch(req, env) {
    const u = new URL(req.url), m = u.pathname.match(/^\/api\/gdelt\/(lastupdate\.txt|\d{14}\.export\.CSV\.zip)$/);
    if (!m) return env.ASSETS.fetch(req);
    let r; try { r = await fetch(`https://data.gdeltproject.org/gdeltv2/${m[1]}`, { cf: { cacheTtl: m[1] === 'lastupdate.txt' ? 120 : 900, cacheEverything: true } }); } catch { return new Response('upstream unavailable', { status: 502 }); }
    return new Response(r.body, { status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/octet-stream', 'cache-control': 'public, max-age=300' } });
  },
};
