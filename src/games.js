// Play: trivia games about the world, in their own window.
// Solo, or with friends: on the same device (pass and play) or in an online room.
// Online rooms use Supabase "Realtime" (a free message-passing service, the same project that handles sign-in).
// The game host keeps the score; everyone gets the same questions because they are made from one shared random seed.
while (!window.__app) await new Promise((r) => setTimeout(r, 25));
const app = window.__app;
const $ = (s, r = document) => r.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => Number(n).toLocaleString('en', { maximumFractionDigits: 0 });
const short = (n) => (n >= 1e9 ? (n / 1e9).toFixed(2) + ' billion' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' million' : fmt(n));

// ---------- random numbers that repeat for everyone with the same seed ----------
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
const shuffle = (r, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- questions ----------
let pool = [];
const getPool = () => (pool.length ? pool : (pool = Object.values(app.countries).filter((c) => c.independent && c.capital && c.population && c.area && c.flag).sort((a, b) => (a.id < b.id ? -1 : 1))));
const LIMIT = { flags: 15, capitals: 15, hl: 10, mystery: 28 };
const CLUE_MS = 4000;

function options(r, c, key) {
  const same = getPool().filter((x) => x.id !== c.id && x.region === c.region && x[key] !== c[key]);
  const rest = getPool().filter((x) => x.id !== c.id && x[key] !== c[key] && !same.includes(x));
  const others = [...shuffle(r, same).slice(0, 3), ...shuffle(r, rest)].filter((x, i, a) => a.findIndex((y) => y[key] === x[key]) === i).slice(0, 3);
  const all = shuffle(r, [c, ...others]);
  return { all, ans: all.indexOf(c) };
}
function make(kind, r, used) {
  const P = getPool(); let c; let tries = 0;
  do { c = pick(r, P); tries++; } while (used.has(c.id) && tries < 40);
  used.add(c.id);
  if (kind === 'flags') {
    const o = options(r, c, 'name');
    return { kind, limit: LIMIT.flags, head: `<div class="gq-flag">${esc(c.flag)}</div>`, text: 'Whose flag is this?', opts: o.all.map((x) => esc(x.name)), ans: o.ans, fact: `${c.flag} <b>${esc(c.name)}</b> · capital ${esc(c.capital)} · ${esc(c.region)}` };
  }
  if (kind === 'capitals') {
    const o = options(r, c, 'capital');
    return { kind, limit: LIMIT.capitals, head: `<div class="gq-flag small">${esc(c.flag)}</div>`, text: `What is the capital of <b>${esc(c.name)}</b>?`, opts: o.all.map((x) => esc(x.capital)), ans: o.ans, fact: `The capital of ${esc(c.name)} is <b>${esc(c.capital)}</b>.` };
  }
  if (kind === 'hl') {
    let b; tries = 0; const m = r() < 0.5 ? 'population' : 'area';
    do { b = pick(r, P); tries++; } while ((b.id === c.id || Math.max(b[m], c[m]) / Math.min(b[m], c[m]) < 1.2) && tries < 60);
    const pair = r() < 0.5 ? [c, b] : [b, c], big = pair[0][m] > pair[1][m] ? 0 : 1;
    const v = (x) => (m === 'population' ? short(x.population) + ' people' : fmt(x.area) + ' km²');
    return { kind, limit: LIMIT.hl, head: '<div class="gq-vs">⚖️</div>', text: m === 'population' ? 'Which country has <b>more people</b>?' : 'Which country is <b>bigger</b> (land area)?', opts: pair.map((x) => `${esc(x.flag)} ${esc(x.name)}`), ans: big, fact: `${esc(pair[0].flag)} ${esc(pair[0].name)}: <b>${v(pair[0])}</b> · ${esc(pair[1].flag)} ${esc(pair[1].name)}: <b>${v(pair[1])}</b>` };
  }
  // mystery country: clues appear one by one; the sooner you guess, the more points
  const o = options(r, c, 'name'), clues = [];
  clues.push(`I am in ${esc(c.subregion || c.region)}.`);
  if (c.languages?.length) clues.push(`People speak ${esc(c.languages.slice(0, 3).join(', '))}.`);
  if (c.currencies?.length) clues.push(`Money: ${esc(c.currencies[0])}.`);
  clues.push(`${c.landlocked ? 'I have no coastline.' : 'I have a coastline.'} I touch ${c.borders?.length || 0} other ${c.borders?.length === 1 ? 'country' : 'countries'} by land.`);
  clues.push(`About ${short(c.population)} people live here, and my capital starts with “${esc(c.capital[0])}”.`);
  clues.push(`My flag: <span class="gq-flag small">${esc(c.flag)}</span>`);
  return { kind, limit: LIMIT.mystery, head: '<div class="gq-vs">🕵️</div>', text: 'Mystery country — who am I?', clues, opts: o.all.map((x) => esc(x.name)), ans: o.ans, fact: `${c.flag} <b>${esc(c.name)}</b> · capital ${esc(c.capital)}` };
}
const KINDS = { flags: ['flags'], capitals: ['capitals'], hl: ['hl'], mystery: ['mystery'], streak: ['hl'], lightning: ['flags', 'capitals'], mixed: ['flags', 'capitals', 'hl', 'mystery'] };
function questionSource(mode, seed) {
  const r = rng(seed), used = new Set(), list = [];
  return (i) => { while (list.length <= i) { if (used.size > getPool().length - 10) used.clear(); list.push(make(pick(r, KINDS[mode]), r, used)); } return list[i]; };
}
// points: 100 for a right answer plus up to 50 for speed; mystery country pays more for fewer clues
function points(q, choice, ms) {
  if (choice !== q.ans) return 0;
  if (q.kind === 'mystery') return 200 - 30 * (Math.min(q.clues.length, 1 + Math.floor(ms / CLUE_MS)) - 1);
  return 100 + Math.round(50 * Math.max(0, 1 - ms / (q.limit * 1000)));
}

const MODES = {
  flags: ['🚩', 'Flag quiz', 'Name the country from its flag.'],
  capitals: ['🏛️', 'Capital quiz', 'Pick the right capital city.'],
  hl: ['⚖️', 'Bigger or smaller', 'Which country has more people, or more land?'],
  mystery: ['🕵️', 'Mystery country', 'Clues appear one by one. Guess early for more points.'],
  mixed: ['🎲', 'Mix it up', 'A bit of everything.'],
  streak: ['🔥', 'Streak', 'Bigger or smaller, until you slip. How long can you last?'],
  lightning: ['⚡', 'Lightning', '60 seconds. Flags and capitals. As many as you can.'],
};
const SOLO = ['flags', 'capitals', 'hl', 'mystery', 'mixed', 'streak', 'lightning'], MULTI = ['flags', 'capitals', 'hl', 'mystery', 'mixed'];
const bestKey = 'we-games-best';
const bests = () => { try { return JSON.parse(localStorage.getItem(bestKey) || '{}'); } catch { return {}; } };
const saveBest = (m, s) => { const b = bests(); if (s > (b[m] || 0)) { b[m] = s; try { localStorage.setItem(bestKey, JSON.stringify(b)); } catch {} return true; } return false; };

// ---------- the window ----------
const win = document.createElement('div');
win.id = 'gamewin'; win.hidden = true; win.setAttribute('role', 'dialog'); win.setAttribute('aria-modal', 'true'); win.setAttribute('aria-label', 'Trivia games');
win.innerHTML = '<div class="gw-box"><header><b>🎮 Play</b><span id="gw-sub" class="muted"></span><button type="button" id="gw-x" aria-label="Close">✕</button></header><div id="gw-body"></div></div>';
document.body.append(win);
const body = $('#gw-body', win);
let G = null; // the game in progress
const clearTimers = () => { if (!G) return; if (G.nk) document.removeEventListener('keydown', G.nk); clearTimeout(G.tt); clearInterval(G.ti); clearTimeout(G.tn); clearTimeout(G.tg); };
function openWin() { win.hidden = false; home(); }
function closeWin() { clearTimers(); G = null; leaveRoom(); win.hidden = true; }
$('#gw-x', win).onclick = closeWin;
win.addEventListener('pointerdown', (e) => { if (e.target === win) closeWin(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !win.hidden) closeWin(); });
const sub = (t) => { $('#gw-sub', win).textContent = t || ''; };
const back = (to) => `<button type="button" class="gw-back" data-go="${to}">← Back</button>`;
body.addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) screens[b.dataset.go]?.(); });

const modeCards = (list, extra = '') => `<div class="gw-modes">${list.map((m) => `<button type="button" class="gw-card" data-mode="${m}"><span class="e">${MODES[m][0]}</span><b>${MODES[m][1]}</b><small>${MODES[m][2]}</small>${extra === 'best' && bests()[m] ? `<span class="best">Best: ${fmt(bests()[m])}</span>` : ''}</button>`).join('')}</div>`;

const screens = { home, solo, friends, local, online };
function home() {
  clearTimers(); G = null; leaveRoom(); sub('');
  body.innerHTML = `<h2>How do you want to play?</h2><p class="muted">Trivia questions about the countries of the world.</p>
    <div class="gw-two"><button type="button" class="gw-card big" data-go="solo"><span class="e">🧍</span><b>Solo</b><small>Just you. Beat your own best score.</small></button>
    <button type="button" class="gw-card big" data-go="friends"><span class="e">👥</span><b>With friends</b><small>Take turns on one device, or race in an online room.</small></button></div>`;
}
function solo() {
  sub('Solo'); body.innerHTML = `${back('home')}<h2>Pick a game</h2>${modeCards(SOLO, 'best')}`;
  body.onclick = null;
  $$cards((m) => startLocal(m, [{ id: 'me', name: 'You' }], 'solo'));
}
function $$cards(fn) { body.querySelectorAll('.gw-card[data-mode]').forEach((b) => (b.onclick = () => fn(b.dataset.mode))); }
function friends() {
  sub('With friends');
  const ok = onlineOK();
  body.innerHTML = `${back('home')}<h2>Where are your friends?</h2>
    <div class="gw-two"><button type="button" class="gw-card big" data-go="local"><span class="e">📱</span><b>Same device</b><small>Pass the phone or keyboard around and take turns.</small></button>
    <button type="button" class="gw-card big${ok ? '' : ' off'}" data-go="${ok ? 'online' : 'friends'}"><span class="e">🌐</span><b>Online room</b><small>${ok ? 'Everyone plays on their own device with a room code.' : 'Needs the free online service switched on first (see the README). Same device works now.'}</small></button></div>`;
}
let names = ['Player 1', 'Player 2'];
function local() {
  sub('Same device');
  const draw = () => {
    body.innerHTML = `${back('friends')}<h2>Who is playing?</h2>
      <div class="gw-names">${names.map((n, i) => `<div><input data-n="${i}" value="${esc(n)}" maxlength="14" aria-label="Player ${i + 1} name">${names.length > 2 ? `<button type="button" data-rm="${i}" aria-label="Remove player ${i + 1}">✕</button>` : ''}</div>`).join('')}</div>
      ${names.length < 6 ? '<button type="button" class="gw-add" id="gw-addp">+ Add a player</button>' : ''}
      <h3>Pick a game · 5 questions each</h3>${modeCards(MULTI)}`;
    body.querySelectorAll('[data-n]').forEach((i) => (i.oninput = () => (names[+i.dataset.n] = i.value)));
    body.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { names.splice(+b.dataset.rm, 1); draw(); }));
    const add = $('#gw-addp', body); if (add) add.onclick = () => { names.push('Player ' + (names.length + 1)); draw(); };
    $$cards((m) => startLocal(m, names.map((n, i) => ({ id: 'l' + i, name: n.trim() || 'Player ' + (i + 1) })), 'local'));
  };
  draw();
}

// ---------- playing (solo and same device) ----------
function startLocal(mode, players, type) {
  clearTimers();
  const seed = (Math.random() * 2 ** 31) | 0;
  G = { type, mode, seed, src: questionSource(mode, seed), players: players.map((p) => ({ ...p, score: 0 })), i: 0, total: mode === 'streak' || mode === 'lightning' ? null : type === 'local' ? 5 * players.length : 10, over: false, correct: 0 };
  if (mode === 'lightning') { G.end = Date.now() + 60000; G.tg = setTimeout(() => { if (G && !G.over) finish(); }, 60000); }
  nextLocal();
}
const who = () => G.players[G.i % G.players.length];
function nextLocal() {
  if (!G || G.over) return;
  if (G.total && G.i >= G.total) return finish();
  askQ(G.src(G.i), { onAnswer: (c, ms) => answeredLocal(c, ms) });
}
function answeredLocal(c, ms) {
  const q = G.q, p = who(), ok = c === q.ans, pts = points(q, c, ms);
  if (G.mode === 'streak' || G.mode === 'lightning') p.score += ok ? 1 : 0; else p.score += pts;
  if (ok) G.correct++;
  reveal(q, c, { gain: { [p.id]: pts } });
  scoreboard();
  const stop = G.mode === 'streak' && !ok;
  if (G.mode === 'lightning') { G.tn = setTimeout(() => { G.i++; nextLocal(); }, 650); return; }
  const last = G.total && G.i + 1 >= G.total;
  showNext(stop ? 'See result' : last ? 'See result' : 'Next', () => { if (stop) return finish(); G.i++; nextLocal(); });
}

// ---------- the question screen (the same for every kind of game) ----------
function scoreboard() {
  const el = $('#gw-score', body); if (!el || !G) return;
  const cur = G.type === 'online' ? null : who().id;
  el.innerHTML = G.players.map((p) => `<span class="gw-pl${p.id === cur ? ' on' : ''}${G.me && p.id === G.me ? ' me' : ''}"><i>${esc(p.name)}</i><b>${fmt(p.score)}</b></span>`).join('');
  const t = $('#gw-prog', body);
  if (t) t.textContent = G.mode === 'lightning' ? '⚡ ' + Math.max(0, Math.ceil((G.end - Date.now()) / 1000)) + ' s' : G.mode === 'streak' ? `🔥 Streak ${G.correct}` : `Question ${Math.min(G.i + 1, G.total)} of ${G.total}`;
}
function askQ(q, { onAnswer, label }) {
  clearTimeout(G.tt); clearInterval(G.ti); clearTimeout(G.tn);
  G.q = q; G.picked = null; G.t0 = Date.now(); G.onAnswer = onAnswer;
  sub(MODES[G.mode][1]);
  const turn = G.type === 'local' ? `<div class="gw-turn">🎯 <b>${esc(who().name)}</b>, your turn</div>` : label ? `<div class="gw-turn">${label}</div>` : '';
  body.innerHTML = `<div class="gw-top"><div id="gw-score" class="gw-score"></div><span id="gw-prog" class="muted"></span></div>${turn}
    <div class="gq">${q.head}<p class="gq-text">${q.text}</p>
    ${q.clues ? `<ol class="gq-clues">${q.clues.map((c, i) => `<li class="${i ? 'hid' : ''}">${c}</li>`).join('')}</ol>` : ''}
    ${G.mode === 'lightning' ? '' : '<div class="gq-bar"><i></i></div>'}
    <div class="gq-opts">${q.opts.map((o, i) => `<button type="button" class="gq-opt" data-i="${i}"><kbd>${i + 1}</kbd>${o}</button>`).join('')}</div>
    <div id="gw-after"></div></div>`;
  scoreboard();
  body.querySelectorAll('.gq-opt').forEach((b) => (b.onclick = () => choose(+b.dataset.i)));
  const bar = $('.gq-bar i', body);
  if (bar) { bar.style.transition = 'none'; bar.style.width = '100%'; void bar.offsetWidth; bar.style.transition = `width ${q.limit}s linear`; bar.style.width = '0%'; G.tt = setTimeout(() => choose(-1), q.limit * 1000); }
  if (q.clues) { let n = 1; G.ti = setInterval(() => { const li = body.querySelectorAll('.gq-clues li.hid'); if (li[0]) { li[0].classList.remove('hid'); n++; } else clearInterval(G.ti); }, CLUE_MS); }
  if (G.mode === 'lightning') G.ti = setInterval(scoreboard, 500);
}
function choose(c) {
  if (!G || G.picked !== null || !G.onAnswer) return;
  G.picked = c; clearTimeout(G.tt); if (G.q.clues) clearInterval(G.ti);
  body.querySelectorAll('.gq-opt').forEach((b) => (b.disabled = true));
  const bar = $('.gq-bar i', body); if (bar) { bar.style.width = getComputedStyle(bar).width; bar.style.transition = 'none'; }
  G.onAnswer(c, Date.now() - G.t0);
}
function reveal(q, c, { gain, waiting } = {}) {
  body.querySelectorAll('.gq-opt').forEach((b, i) => { b.disabled = true; b.classList.toggle('right', i === q.ans); b.classList.toggle('wrong', i === c && c !== q.ans); });
  body.querySelectorAll('.gq-clues li').forEach((li) => li.classList.remove('hid'));
  const mine = gain && G.me ? gain[G.me] : gain && G.type !== 'online' ? Object.values(gain)[0] : null;
  const head = c === -1 ? '⏱️ Time is up.' : c === q.ans ? '✅ Correct!' : '❌ Not quite.';
  $('#gw-after', body).innerHTML = `<div class="gq-fact"><p>${head}${mine ? ` <b class="plus">+${mine}</b>` : ''}</p><p>${q.fact}</p>${waiting ? `<p class="muted">${waiting}</p>` : ''}</div><div id="gw-nx"></div>`;
}
function showNext(label, fn) {
  const nx = $('#gw-nx', body); if (!nx) return;
  nx.innerHTML = `<button type="button" class="gw-go" id="gw-next">${label} →</button>`;
  if (G.nk) document.removeEventListener('keydown', G.nk);
  const go = () => { document.removeEventListener('keydown', key); fn(); };
  const key = (e) => { if (e.key === 'Enter' && !win.hidden && !e.target.closest?.('button')) go(); };
  G.nk = key; $('#gw-next', nx).onclick = go; document.addEventListener('keydown', key); $('#gw-next', nx).focus();
}
document.addEventListener('keydown', (e) => { if (win.hidden || !G || !G.q || G.picked !== null || !/^[1-4]$/.test(e.key)) return; if (+e.key <= G.q.opts.length) choose(+e.key - 1); });

function finish() {
  if (!G) return; clearTimers(); G.over = true;
  const ranked = G.players.slice().sort((a, b) => b.score - a.score);
  let newBest = false;
  if (G.type === 'solo') newBest = saveBest(G.mode, ranked[0].score);
  const solo = G.players.length === 1, unit = G.mode === 'streak' || G.mode === 'lightning' ? ' correct' : ' points';
  const medal = ['🥇', '🥈', '🥉'];
  const tie = ranked.length > 1 && ranked[0].score === ranked[1].score;
  body.innerHTML = `<div class="gw-end"><h2>${solo ? (newBest ? '🏆 New best!' : 'Game over') : tie ? "🤝 It's a tie!" : `🏆 ${esc(ranked[0].name)} wins!`}</h2>
    ${solo ? `<p class="big">${fmt(ranked[0].score)}<small>${unit}</small></p>${G.total ? `<p class="muted">${G.correct} of ${G.total} right</p>` : ''}${!newBest && bests()[G.mode] ? `<p class="muted">Your best: ${fmt(bests()[G.mode])}</p>` : ''}`
      : `<ol class="gw-rank">${ranked.map((p, i) => `<li${p.id === G.me ? ' class="me"' : ''}><span>${medal[i] || i + 1 + '.'}</span><i>${esc(p.name)}</i><b>${fmt(p.score)}</b></li>`).join('')}</ol>`}
    <div class="gw-endbtns">${G.type === 'online' && !G.host ? '<span class="muted">Waiting for the host to play again…</span>' : '<button type="button" class="gw-go" id="gw-again">Play again</button>'}<button type="button" class="gw-alt" id="gw-menu">Menu</button></div></div>`;
  const a = $('#gw-again', body);
  if (a) a.onclick = () => { if (G.type === 'online') hostStart(G.mode); else startLocal(G.mode, G.players.map((p) => ({ id: p.id, name: p.name })), G.type); };
  $('#gw-menu', body).onclick = () => { if (G.type === 'online') { leaveRoom(); friends(); } else home(); };
  if (G.type === 'online' && G.host) send({ t: 'end', scores: scoreMap() });
}

// ---------- online rooms ----------
let cfg = null;
fetch('/auth-config.json').then((r) => r.json()).then((j) => { cfg = { url: String(j.supabaseUrl || '').replace(/\/+$/, ''), key: String(j.anonKey || '') }; }).catch(() => {});
const onlineOK = () => !!(cfg && cfg.url && cfg.key && 'WebSocket' in window);
let ws = null, topic = '', ref = 0, hb = 0, me = null, roster = [], lobbyMode = 'flags', roomCode = '';
const scoreMap = () => Object.fromEntries(G.players.map((p) => [p.id, p.score]));
function send(msg) { if (ws?.readyState === 1) ws.send(JSON.stringify({ topic, event: 'broadcast', payload: { type: 'broadcast', event: 'msg', payload: msg }, ref: String(++ref), join_ref: '1' })); }
function leaveRoom() { clearInterval(hb); if (ws) { try { if (me) send({ t: 'bye', id: me.id }); ws.onclose = null; ws.close(); } catch {} } ws = null; me = null; roster = []; }
function connect(code) {
  return new Promise((res, rej) => {
    const base = cfg.url.replace(/^http/i, 'ws');
    let sock; try { sock = new WebSocket(`${base}/realtime/v1/websocket?apikey=${encodeURIComponent(cfg.key)}&vsn=1.0.0`); } catch (e) { return rej(e); }
    ws = sock; topic = 'realtime:wx-' + code;
    const fail = setTimeout(() => rej(new Error('The online service did not answer.')), 9000);
    sock.onopen = () => sock.send(JSON.stringify({ topic, event: 'phx_join', payload: { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, private: false } }, ref: '1', join_ref: '1' }));
    sock.onmessage = (m) => {
      let d; try { d = JSON.parse(m.data); } catch { return; }
      if (d.event === 'phx_reply' && d.ref === '1') { clearTimeout(fail); if (d.payload?.status === 'ok') { hb = setInterval(() => sock.readyState === 1 && sock.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) })), 25000); res(); } else rej(new Error('Could not open the room.')); }
      if (d.event === 'broadcast' && d.payload?.event === 'msg') onMsg(d.payload.payload);
    };
    sock.onerror = () => { clearTimeout(fail); rej(new Error('Could not reach the online service.')); };
    sock.onclose = () => { if (me && !win.hidden) { sub(''); body.innerHTML = `<h2>Connection lost</h2><p class="muted">The online room closed.</p><button type="button" class="gw-go" data-go="friends">Back</button>`; clearTimers(); } };
  });
}
const newCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
function online() {
  sub('Online room'); const saved = (() => { try { return localStorage.getItem('we-games-name') || ''; } catch { return ''; } })();
  body.innerHTML = `${back('friends')}<h2>Online room</h2>
    <label class="gw-lab">Your name<input id="gw-name" maxlength="14" value="${esc(saved)}" placeholder="e.g. Sasan"></label>
    <div class="gw-two"><div class="gw-box2"><b>Start a room</b><p class="muted">You get a 4-letter code to share with friends.</p><button type="button" class="gw-go" id="gw-create">Create room</button></div>
    <div class="gw-box2"><b>Join a room</b><input id="gw-code" maxlength="4" placeholder="CODE" autocapitalize="characters"><button type="button" class="gw-go" id="gw-join">Join</button></div></div><p id="gw-err" class="gw-err"></p>`;
  const nm = () => { const v = $('#gw-name', body).value.trim() || 'Player'; try { localStorage.setItem('we-games-name', v); } catch {} return v; };
  const err = (t) => { $('#gw-err', body).textContent = t; };
  const go = async (code, host) => {
    err(''); const name = nm(); me = { id: 'o' + Math.random().toString(36).slice(2, 8), name };
    try { await connect(code); } catch (e) { me = null; return err(e.message); }
    roomCode = code; roster = [{ id: me.id, name }];
    G = { type: 'online', host, me: me.id, players: roster.map((p) => ({ ...p, score: 0 })), mode: 'flags', total: 10, i: 0, players0: null };
    if (host) lobby(); else { lobby(); let n = 0; const ask = () => { if (!G || G.host || G.started || n++ > 5) return; send({ t: 'hello', id: me.id, name }); G.tg = setTimeout(ask, 1200); }; ask(); }
  };
  $('#gw-create', body).onclick = () => go(newCode(), true);
  $('#gw-join', body).onclick = () => { const c = $('#gw-code', body).value.trim().toUpperCase(); if (c.length !== 4) return err('Type the 4-letter code.'); go(c, false); };
}
function lobby() {
  if (!G || G.type !== 'online' || G.started) return;
  const host = G.host;
  body.innerHTML = `<h2>Room <span class="gw-codebig">${esc(roomCode)}</span></h2>
    <p class="muted">Friends join with this code: Settings → Play → With friends → Online room → Join.</p>
    <ul class="gw-lobby">${G.players.map((p) => `<li>${p.id === me.id ? '⭐' : '👤'} ${esc(p.name)}${p.host ? ' <small>(host)</small>' : ''}</li>`).join('')}</ul>
    ${host ? `<h3>Pick a game</h3>${modeCards(MULTI)}<p class="muted">Pick a game to start it. At least 2 players are needed.</p>` : '<p class="muted">Waiting for the host to pick a game…</p>'}`;
  if (host) $$cards((m) => { if (G.players.length < 2) { sub('Waiting for a friend to join first'); return; } hostStart(m); });
}
// everything that arrives from other players
function onMsg(m) {
  if (!G || G.type !== 'online' || !m) return;
  if (G.host) {
    if (m.t === 'hello') { if (!G.players.some((p) => p.id === m.id) && !G.started && G.players.length < 8) G.players.push({ id: m.id, name: String(m.name).slice(0, 14), score: 0 }); sendRoster(); if (!G.started) lobby(); }
    if (m.t === 'bye') { G.players = G.players.filter((p) => p.id !== m.id); if (G.started) { if (G.pend) { delete G.pend.answers[m.id]; hostMaybeFinish(); } } else { sendRoster(); lobby(); } }
    if (m.t === 'ans' && G.pend && m.i === G.pend.i) { G.pend.answers[m.id] = { c: m.c, ms: m.ms }; hostMaybeFinish(); }
    return;
  }
  if (m.t === 'roster') { if (m.started && !G.started && !m.players.some((p) => p.id === me.id)) { body.innerHTML = '<h2>Game already started</h2><p class="muted">Ask the host to start a new round.</p>'; return; } G.players = m.players.map((p) => ({ ...p })); if (!G.started) lobby(); }
  if (m.t === 'start') { clearTimeout(G.tg); G.started = true; G.over = false; G.mode = m.mode; G.total = m.total; G.src = questionSource(m.mode, m.seed); G.players.forEach((p) => (p.score = 0)); G.correct = 0; }
  if (m.t === 'q' && G.started && G.src) { G.i = m.i; askQ(G.src(m.i), { label: `Everyone answers together`, onAnswer: (c, ms) => { send({ t: 'ans', id: me.id, i: m.i, c, ms }); reveal(G.q, c, { waiting: 'Waiting for the others…' }); } }); }
  if (m.t === 'res' && G.started) { G.players.forEach((p) => { if (m.scores[p.id] != null) p.score = m.scores[p.id]; }); const mine = m.ans[me.id]; reveal(G.q, G.picked === null ? -1 : G.picked, { gain: Object.fromEntries(Object.entries(m.ans).map(([k, v]) => [k, v.p])) }); scoreboard(); void mine; }
  if (m.t === 'end') { G.players.forEach((p) => { if (m.scores[p.id] != null) p.score = m.scores[p.id]; }); finish(); }
  if (m.t === 'again') { G.started = false; }
}
const sendRoster = () => send({ t: 'roster', players: G.players.map((p) => ({ id: p.id, name: p.name, score: p.score, host: p.id === me.id })), started: !!G.started });
function hostStart(mode) {
  if (!G.host) return; const seed = (Math.random() * 2 ** 31) | 0;
  G.started = true; G.over = false; G.mode = mode; G.total = 10; G.src = questionSource(mode, seed); G.i = 0; G.correct = 0; G.players.forEach((p) => (p.score = 0));
  send({ t: 'start', mode, seed, total: 10 });
  setTimeout(hostAsk, 700);
}
function hostAsk() {
  if (!G || !G.host || G.over) return;
  const i = G.i, q = G.src(i);
  G.pend = { i, answers: {} };
  send({ t: 'q', i });
  askQ(q, { label: 'Everyone answers together', onAnswer: (c, ms) => { G.pend.answers[me.id] = { c, ms }; reveal(q, c, { waiting: 'Waiting for the others…' }); hostMaybeFinish(); } });
  clearTimeout(G.tg); G.tg = setTimeout(() => hostFinish(), q.limit * 1000 + 3500);
}
function hostMaybeFinish() { if (G?.pend && G.players.every((p) => G.pend.answers[p.id])) setTimeout(hostFinish, 400); }
function hostFinish() {
  if (!G?.pend) return; clearTimeout(G.tg);
  const { i, answers } = G.pend, q = G.src(i); G.pend = null;
  const out = {};
  for (const p of G.players) { const a = answers[p.id] || { c: -1, ms: 0 }, pts = points(q, a.c, a.ms); p.score += pts; out[p.id] = { c: a.c, p: pts }; }
  send({ t: 'res', i, ans: out, scores: scoreMap() });
  reveal(q, G.picked === null ? -1 : G.picked, { gain: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.p])) }); scoreboard();
  G.i = i + 1;
  G.tn = setTimeout(() => { if (G.i >= G.total) finish(); else hostAsk(); }, 4200);
}

// ---------- the Play button on the banner ----------
$('#playtop')?.addEventListener('click', openWin);
window.__games = { open: openWin, close: closeWin, get G() { return G; }, make, rng, questionSource, points };
