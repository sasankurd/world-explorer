// "Recent activity": the last few places the person opened on this device. Used on the front page.
import { cleanText, PLACE_KINDS } from './model.js';
import { browserStorage } from './store.js';

export function createRecent({ storage = browserStorage(), key = 'we-recent-v1', max = 6, now = () => Date.now() } = {}) {
  const read = () => {
    try {
      const a = JSON.parse(storage?.getItem(key) || '[]');
      return (Array.isArray(a) ? a : []).map((r) => {
        const name = cleanText(r?.name, 120);
        const ok = name && PLACE_KINDS.includes(r.kind) && Number.isFinite(r.lng) && Number.isFinite(r.lat);
        return ok ? { kind: r.kind, name, ref: /^[A-Z]{3}$/.test(r.ref) ? r.ref : '', lng: r.lng, lat: r.lat, at: Number.isFinite(r.at) ? r.at : 0 } : null;
      }).filter(Boolean).slice(0, max);
    } catch { return []; }
  };
  return {
    list: read,
    push(item) {
      const name = cleanText(item?.name, 120); if (!name) return;
      const entry = { kind: PLACE_KINDS.includes(item.kind) ? item.kind : 'point', name, ref: item.ref || '', lng: item.lng, lat: item.lat, at: now() };
      const rest = read().filter((r) => !(r.kind === entry.kind && r.name === entry.name && r.ref === entry.ref));
      try { storage?.setItem(key, JSON.stringify([entry, ...rest].slice(0, max))); } catch {}
    },
    clear() { try { storage?.removeItem(key); } catch {} },
  };
}
