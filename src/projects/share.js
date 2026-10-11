// Read-only sharing without a server.
// A share link carries a compact, compressed COPY of the project in the part of the address after "#".
// That part is never sent to any server. It cannot be updated or taken back once handed out, and it is not a live page.
// Everything read from a link is treated as untrusted: it is size-limited, decompressed with a cap, and run through the same sanitiser as saved data.
import { sanitizeProject, sanitizePlace, sanitizeLayers, sanitizeView, LIMITS } from './model.js';

export const MAX_PAYLOAD = 7000;       // characters of the link payload we will create or accept
const MAX_JSON = 120000;               // bytes after decompressing

const b64u = {
  enc(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec(str) {
    if (!/^[A-Za-z0-9_-]*$/.test(str)) throw new Error('bad characters');
    const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
    const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out;
  },
};

async function pipe(bytes, stream, limit) {
  const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader();
  const parts = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    total += value.length; if (limit && total > limit) { reader.cancel(); throw new Error('too large'); }
    parts.push(value);
  }
  const out = new Uint8Array(total); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// the smallest useful copy: names, positions, notes, view and layers (no ids, no dates)
export function toPayload(project) {
  const idx = new Map(project.places.map((p, i) => [p.id, i]));
  return {
    v: 1, n: project.name, d: project.description,
    p: project.places.map((p) => [p.name, p.lng, p.lat, p.kind, p.ref, p.note]),
    t: project.notes.map((n) => [n.text, idx.has(n.placeId) ? idx.get(n.placeId) : -1]),
    w: project.view ? [project.view.center[0], project.view.center[1], project.view.zoom] : null,
    l: project.layers,
  };
}
export function fromPayload(o) {
  if (!o || typeof o !== 'object' || o.v !== 1) throw new Error('unsupported');
  const rows = (Array.isArray(o.p) ? o.p : []).slice(0, LIMITS.places);
  // sanitise each place on its own, so a note can point at the id its place was given
  const sane = rows.map((r) => (Array.isArray(r) ? sanitizePlace({ name: r[0], lng: r[1], lat: r[2], kind: r[3], ref: r[4], note: r[5] }) : null));
  const kept = sane.filter(Boolean);
  const notes = (Array.isArray(o.t) ? o.t : []).slice(0, LIMITS.notes).map((r) => (Array.isArray(r) ? { text: r[0], placeId: sane[r[1]]?.id || '' } : null)).filter(Boolean);
  const project = sanitizeProject({
    name: o.n, description: o.d, visibility: 'private',
    places: kept, notes,
    view: Array.isArray(o.w) ? sanitizeView({ center: [o.w[0], o.w[1]], zoom: o.w[2] }) : null,
    layers: sanitizeLayers(o.l),
  });
  if (!project) throw new Error('empty');
  return project;
}

// -> "z.<data>" (compressed) or "j.<data>" when this browser cannot compress
export async function encodeShare(project) {
  const json = new TextEncoder().encode(JSON.stringify(toPayload(project)));
  let out;
  if (typeof CompressionStream === 'function') out = 'z.' + b64u.enc(await pipe(json, new CompressionStream('deflate-raw')));
  else out = 'j.' + b64u.enc(json);
  if (out.length > MAX_PAYLOAD) return { ok: false, error: `This project is too big to fit in a link (${out.length} of ${MAX_PAYLOAD} characters). Remove some places or notes, or share an exported backup file instead.` };
  return { ok: true, payload: out };
}

export async function decodeShare(payload) {
  try {
    if (typeof payload !== 'string' || payload.length < 3 || payload.length > MAX_PAYLOAD) throw new Error('size');
    const kind = payload.slice(0, 2), body = b64u.dec(payload.slice(2));
    let bytes;
    if (kind === 'z.') { if (typeof DecompressionStream !== 'function') return { ok: false, error: 'This browser cannot open compressed share links. Try a current version of Chrome, Edge, Firefox or Safari.' }; bytes = await pipe(body, new DecompressionStream('deflate-raw'), MAX_JSON); }
    else if (kind === 'j.') bytes = body;
    else throw new Error('kind');
    if (bytes.length > MAX_JSON) throw new Error('too large');
    return { ok: true, project: fromPayload(JSON.parse(new TextDecoder().decode(bytes))) };
  } catch {
    return { ok: false, error: 'This share link is damaged or incomplete, so it cannot be opened.' };
  }
}

export const shareUrl = (payload, base = location.origin + location.pathname) => `${base}#share=${payload}`;
