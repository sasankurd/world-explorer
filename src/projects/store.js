// Project storage. Projects live in this browser's localStorage and nowhere else.
// Every method returns a plain result ({ ok, ... }) instead of throwing, so the screens can show a clear message.
// The storage is passed in, so a server-backed version can replace it later without touching the screens, and tests can use a fake.
import { SCHEMA_VERSION, LIMITS, createProject, sanitizeProject, sanitizeLayers, validateProjectInput } from './model.js';

export const STORAGE_KEY = 'we-projects-v1';

export function browserStorage() {
  try { const s = globalThis.localStorage; const k = '__we_probe'; s.setItem(k, '1'); s.removeItem(k); return s; } catch { return null; }
}

export function createStore({ storage = browserStorage(), key = STORAGE_KEY, now = () => Date.now() } = {}) {
  // status: 'loading' | 'ready' | 'error'. persistent: false when nothing can be written (private mode, blocked storage, full disk).
  const state = { status: 'loading', projects: [], error: null, persistent: !!storage, lastSaveError: null };
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => { try { fn(state); } catch {} });

  function parse(text) {
    let data;
    try { data = JSON.parse(text); } catch { return { ok: false, error: 'The saved projects could not be read (the data is damaged).' }; }
    if (!data || typeof data !== 'object' || !Array.isArray(data.projects)) return { ok: false, error: 'The saved projects could not be read (unexpected format).' };
    if (typeof data.v === 'number' && data.v > SCHEMA_VERSION) return { ok: false, error: 'These projects were saved by a newer version of World Explorer. Update the site before editing them.', newer: true };
    const projects = [], seen = new Set();
    for (const raw of data.projects) { const p = sanitizeProject(raw); if (p && !seen.has(p.id) && projects.length < LIMITS.projects) { seen.add(p.id); projects.push(p); } }
    return { ok: true, projects, dropped: data.projects.length - projects.length };
  }

  function load() {
    if (!storage) { state.status = 'ready'; state.persistent = false; state.error = null; return; }
    let text;
    try { text = storage.getItem(key); } catch { state.status = 'ready'; state.persistent = false; return; }
    if (text == null) { state.status = 'ready'; state.projects = []; state.error = null; return; }
    const r = parse(text);
    if (!r.ok) { state.status = 'error'; state.error = { message: r.error, newer: !!r.newer }; return; }
    state.status = 'ready'; state.projects = r.projects; state.error = null;
  }

  function write() {
    if (!storage) { state.persistent = false; return { ok: false, error: 'This browser is not letting the site save anything (private mode or blocked storage). Your change is kept only until you close this tab.' }; }
    try {
      storage.setItem(key, JSON.stringify({ v: SCHEMA_VERSION, projects: state.projects }));
      state.persistent = true; state.lastSaveError = null; return { ok: true };
    } catch {
      state.persistent = false;
      state.lastSaveError = 'The browser could not save your projects (storage is full or blocked). Your change is kept only until you close this tab. Use Export to keep a copy.';
      return { ok: false, error: state.lastSaveError };
    }
  }

  // Re-read storage first so a change made in another tab is not overwritten, apply the change, then write.
  function mutate(fn) {
    if (state.status === 'error') return { ok: false, error: state.error?.newer ? state.error.message : 'Projects are unavailable until the saved data is repaired.' };
    if (storage && state.persistent) { load(); if (state.status === 'error') return { ok: false, error: state.error.message }; }
    const out = fn(state.projects);
    if (!out.ok) return out;
    state.projects = out.projects;
    const w = write();
    emit();
    return { ...out, saved: w.ok, warning: w.ok ? '' : w.error };
  }

  const api = {
    get state() { return state; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    init() { load(); emit(); return state; },
    reload() { load(); emit(); return state; },
    list() { return [...state.projects].sort((a, b) => b.updatedAt - a.updatedAt); },
    get(id) { return state.projects.find((p) => p.id === id) || null; },

    create(input) {
      return mutate((ps) => {
        if (ps.length >= LIMITS.projects) return { ok: false, error: `You can keep up to ${LIMITS.projects} projects.` };
        const r = createProject(input, now()); if (!r.ok) return r;
        return { ok: true, projects: [r.value, ...ps], project: r.value };
      });
    },
    // fn(project) must return { ok, project } (the helpers in model.js do)
    update(id, fn) {
      return mutate((ps) => {
        const cur = ps.find((p) => p.id === id); if (!cur) return { ok: false, error: 'That project no longer exists.' };
        const r = fn(cur); if (!r.ok) return r;
        return { ...r, projects: ps.map((p) => (p.id === id ? r.project : p)) };
      });
    },
    edit(id, input) {
      const v = validateProjectInput(input); if (!v.ok) return v;
      return api.update(id, (p) => ({ ok: true, project: { ...p, ...v.value, updatedAt: now() } }));
    },
    remove(id) {
      return mutate((ps) => (ps.some((p) => p.id === id) ? { ok: true, projects: ps.filter((p) => p.id !== id) } : { ok: false, error: 'That project no longer exists.' }));
    },
    // put a removed project back (used by "Undo")
    restore(project) {
      return mutate((ps) => { const p = sanitizeProject(project); if (!p) return { ok: false, error: 'Could not restore the project.' }; return ps.some((x) => x.id === p.id) ? { ok: true, projects: ps } : { ok: true, projects: [p, ...ps], project: p }; });
    },

    // ----- backup -----
    exportJson() { return JSON.stringify({ app: 'world-explorer', v: SCHEMA_VERSION, exportedAt: new Date(now()).toISOString(), projects: state.projects }, null, 2); },
    // Adds the projects from a backup. Existing projects are kept; imported ones get new ids so nothing is overwritten.
    importJson(text) {
      if (typeof text !== 'string' || text.length > 5e6) return { ok: false, error: 'That file is too large to be a World Explorer backup.' };
      const r = parse(text); if (!r.ok) return { ok: false, error: r.error.replace('saved projects', 'backup file') };
      if (!r.projects.length) return { ok: false, error: 'No projects were found in that file.' };
      return mutate((ps) => {
        const room = LIMITS.projects - ps.length; if (room <= 0) return { ok: false, error: `You already have ${LIMITS.projects} projects. Delete one first.` };
        const take = r.projects.slice(0, room).map((p) => sanitizeProject({ ...p, id: undefined, createdAt: p.createdAt, updatedAt: p.updatedAt }));
        return { ok: true, projects: [...take, ...ps], imported: take.length, skipped: r.projects.length - take.length + r.dropped };
      });
    },
    // for damaged data: keep a copy of it under another key, then start empty
    resetDamaged() {
      if (!storage) return { ok: false, error: 'Storage is not available.' };
      try { const raw = storage.getItem(key); if (raw != null) storage.setItem(key + '-damaged-' + now(), raw); storage.removeItem(key); } catch { return { ok: false, error: 'Could not reset the saved data.' }; }
      load(); emit(); return { ok: true };
    },
    sanitizeLayers,
  };
  return api;
}
