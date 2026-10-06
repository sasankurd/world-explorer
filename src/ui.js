// Header animations: sliding glow pill on the view tabs, click ripple, and a scan sweep across the map.
const views = document.querySelector('#views');
const pill = views.querySelector('.pill');
const scan = document.querySelector('#scan');

function syncPill(snap) {
  const on = views.querySelector('button.on');
  if (!on) return;
  if (snap) pill.classList.add('snap');
  pill.style.width = on.offsetWidth + 'px';
  pill.style.transform = `translateX(${on.offsetLeft}px)`;
  if (snap) { pill.offsetWidth; pill.classList.remove('snap'); }
}
function sweep() {
  scan.classList.remove('go'); scan.offsetWidth; scan.classList.add('go');
}
syncPill(true);
document.fonts?.ready.then(() => syncPill(true));
window.addEventListener('resize', () => syncPill(true));
views.addEventListener('click', (e) => { if (e.target.closest('button')) { requestAnimationFrame(() => syncPill(false)); sweep(); } });
document.querySelector('#maptheme').addEventListener('change', sweep);

document.querySelector('header').addEventListener('pointerdown', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const r = b.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2.4;
  const s = document.createElement('span');
  s.className = 'rip'; s.style.cssText = `left:${e.clientX - r.left}px;top:${e.clientY - r.top}px;width:${size}px;height:${size}px`;
  b.appendChild(s); setTimeout(() => s.remove(), 700);
});

// ---------- settings menu ----------
const sbtn = document.querySelector('#settingsbtn'), menu = document.querySelector('#settings');
const setMenu = (open) => { menu.hidden = !open; sbtn.setAttribute('aria-expanded', String(open)); };
sbtn.addEventListener('click', (e) => { e.stopPropagation(); setMenu(menu.hidden); document.querySelector('#usermenu').hidden = true; });
document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('#settings')) setMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); sbtn.focus(); } });
// the names switch is controlled by main.js; keep its screen-reader state in step with how it looks
const names = document.querySelector('#names');
const syncNames = () => names.setAttribute('aria-checked', String(names.classList.contains('on')));
new MutationObserver(syncNames).observe(names, { attributes: true, attributeFilter: ['class'] });
// animations on or off (remembered)
const anim = document.querySelector('#anim');
function setAnim(on, save) {
  document.body.classList.toggle('noanim', !on); anim.classList.toggle('on', on); anim.setAttribute('aria-checked', String(on));
  if (save) try { localStorage.setItem('animations', on ? 'on' : 'off'); } catch {}
}
let animOn = true; try { animOn = localStorage.getItem('animations') !== 'off'; } catch {}
setAnim(animOn, false);
anim.addEventListener('click', () => setAnim(!anim.classList.contains('on'), true));
