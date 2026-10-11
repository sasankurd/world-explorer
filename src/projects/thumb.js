// Project thumbnails: a small drawing of the world from the site's own border data, framed on the project's places
// (or its saved view), with amber pins and a cyan outline of the saved view. It needs no network and no map tiles.
let ready = false;
const f1 = (n) => (Math.round(n * 10) / 10).toString();

function ensureDefs() {
  if (ready) return true;
  const app = window.__app; if (!app?.borders) return false;
  let d = '';
  for (const f of app.borders.features) {
    const g = f.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const p of polys) {
      const r = p[0]; if (r.length < 8) continue;
      d += 'M' + f1(r[0][0] + 180) + ' ' + f1(90 - r[0][1]);
      for (let i = 3; i < r.length; i += 3) d += 'L' + f1(r[i][0] + 180) + ' ' + f1(90 - r[i][1]);
      d += 'Z';
    }
  }
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true'); svg.style.position = 'absolute';
  const path = document.createElementNS(NS, 'path'); path.setAttribute('id', 'we-world'); path.setAttribute('d', d);
  const defs = document.createElementNS(NS, 'defs'); defs.append(path); svg.append(defs); document.body.append(svg);
  return (ready = true);
}

// the part of the world to show, as [x, y, width, height] in degrees (x from 0 to 360, y from 0 to 180)
export function frameFor(project) {
  const pts = project.places.map((p) => [p.lng, p.lat]);
  let x0 = -180, x1 = 180, y0 = -78, y1 = 84;
  if (pts.length) {
    x0 = Math.min(...pts.map((p) => p[0])); x1 = Math.max(...pts.map((p) => p[0]));
    y0 = Math.min(...pts.map((p) => p[1])); y1 = Math.max(...pts.map((p) => p[1]));
  } else if (project.view) {
    const [cx, cy] = project.view.center, span = Math.min(360, (360 * 900) / (512 * Math.pow(2, project.view.zoom)));
    x0 = cx - span / 2; x1 = cx + span / 2; y0 = cy - span / 4; y1 = cy + span / 4;
  } else return [0, 6, 360, 162];
  const pad = Math.max(8, (x1 - x0) * 0.35, (y1 - y0) * 0.6);
  x0 -= pad; x1 += pad; y0 -= pad * 0.56; y1 += pad * 0.56;
  let w = x1 - x0, h = y1 - y0; const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  if (w / h > 16 / 9) h = w * 9 / 16; else w = h * 16 / 9;
  w = Math.min(360, Math.max(w, 40)); h = w * 9 / 16;
  let X = cx - w / 2, Y = cy - h / 2;
  X = Math.max(-180, Math.min(180 - w, X)); Y = Math.max(-90, Math.min(90 - h, Y));
  return [X + 180, 90 - (Y + h), w, h];
}

export function thumbSvg(project, { label = '' } = {}) {
  const [x, y, w, h] = frameFor(project);
  const defs = ensureDefs();
  const r = w * 0.012;
  const pins = project.places.slice(0, 60).map((p) => `<circle cx="${f1(p.lng + 180)}" cy="${f1(90 - p.lat)}" r="${r.toFixed(2)}" class="tp"/>`).join('');
  let box = '';
  if (project.view) {
    const [cx, cy] = project.view.center, span = Math.min(360, (360 * 900) / (512 * Math.pow(2, project.view.zoom)));
    box = `<rect x="${f1(cx + 180 - span / 2)}" y="${f1(90 - cy - span / 4)}" width="${f1(span)}" height="${f1(span / 2)}" class="tv" vector-effect="non-scaling-stroke"/>`;
  }
  return `<svg class="thumb" viewBox="${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${label.replace(/[^\w ,.'-]/g, '')}"><rect x="-10" y="-10" width="400" height="200" class="ts"/>${defs ? '<use href="#we-world" class="tl"/>' : ''}${box}${pins}</svg>`;
}
