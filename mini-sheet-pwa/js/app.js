// UI: griglia virtualizzata (solo le celle visibili esistono nel DOM), tastiera, barra formula.
import { ROWS, COLS, colName, key } from './coordinates.js';
import { Sheet, fmt } from './engine.js';

const W = 90, H = 26;                       // devono coincidere con style.css
const $ = id => document.getElementById(id);
const vp = $('vp'), cells = $('cells'), ed = $('editor'), fb = $('fbar'), addr = $('addr');
const sh = new Sheet();
let sel = { r: 0, c: 0 }, editing = false, raf = 0, saveT = 0;

try { for (const [k, v] of JSON.parse(localStorage.getItem('mini-sheet') || '[]')) sh.set(k, v); } catch { }
const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem('mini-sheet', JSON.stringify([...sh.raw])); } catch { } }, 300); };
const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

$('layer').style.cssText = `width:${COLS * W}px;height:${ROWS * H}px`;
$('chi').style.width = COLS * W + 'px'; $('rhi').style.height = ROWS * H + 'px';
$('chi').innerHTML = Array.from({ length: COLS }, (_, c) => `<div class="hd" style="left:${c * W}px;width:${W}px">${colName(c)}</div>`).join('');
$('rhi').innerHTML = Array.from({ length: ROWS }, (_, r) => `<div class="hd" style="top:${r * H}px">${r + 1}</div>`).join('');

// VIRTUALIZZAZIONE: calcola la finestra visibile (+2 celle di margine) e ridisegna solo quella.
function render() {
  const x = vp.scrollLeft, y = vp.scrollTop;
  const vw = vp.clientWidth || innerWidth, vh = vp.clientHeight || innerHeight;  // fallback se il layout non è ancora pronto
  const c0 = Math.max(0, Math.floor(x / W) - 2), c1 = Math.min(COLS - 1, Math.ceil((x + vw) / W) + 2);
  const r0 = Math.max(0, Math.floor(y / H) - 2), r1 = Math.min(ROWS - 1, Math.ceil((y + vh) / H) + 2);
  let h = '';
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const v = sh.val(key(r, c));   // valutazione lazy: si ricalcolano solo le celle visibili invalidate
    const cls = typeof v === 'number' ? 'num' : typeof v === 'object' ? 'err' : '';
    h += `<div class="cell ${cls}${r === sel.r && c === sel.c ? ' sel' : ''}" style="left:${c * W}px;top:${r * H}px" data-r="${r}" data-c="${c}">${esc(fmt(v))}</div>`;
  }
  cells.innerHTML = h;
}
const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };
vp.addEventListener('scroll', () => {
  $('chi').style.transform = `translateX(${-vp.scrollLeft}px)`;
  $('rhi').style.transform = `translateY(${-vp.scrollTop}px)`;
  schedule();
}, { passive: true });
new ResizeObserver(schedule).observe(vp);  // ridisegna quando cambia la dimensione (CSS caricato, rotazione, resize)
addEventListener('load', schedule);

function select(r, c) {
  if (editing) commit();
  $('chi').children[sel.c].classList.remove('cur'); $('rhi').children[sel.r].classList.remove('cur');
  sel = { r: Math.max(0, Math.min(ROWS - 1, r)), c: Math.max(0, Math.min(COLS - 1, c)) };
  $('chi').children[sel.c].classList.add('cur'); $('rhi').children[sel.r].classList.add('cur');
  addr.textContent = key(sel.r, sel.c); fb.value = sh.getRaw(key(sel.r, sel.c));
  const l = sel.c * W, t = sel.r * H;   // porta la cella nel viewport
  if (l < vp.scrollLeft) vp.scrollLeft = l; else if (l + W > vp.scrollLeft + vp.clientWidth) vp.scrollLeft = l + W - vp.clientWidth;
  if (t < vp.scrollTop) vp.scrollTop = t; else if (t + H > vp.scrollTop + vp.clientHeight) vp.scrollTop = t + H - vp.clientHeight;
  render();
}
function setCell(k, v) { sh.set(k, v); persist(); schedule(); }
function startEdit(initial) {
  editing = true; Object.assign(ed.style, { display: 'block', left: sel.c * W + 'px', top: sel.r * H + 'px' });
  ed.value = initial ?? sh.getRaw(key(sel.r, sel.c)); fb.value = ed.value; ed.focus();
}
function commit() { if (!editing) return; editing = false; ed.style.display = 'none'; setCell(key(sel.r, sel.c), ed.value); }

cells.addEventListener('click', e => { const d = e.target.closest('.cell'); if (d) { vp.focus(); select(+d.dataset.r, +d.dataset.c); } });
cells.addEventListener('dblclick', e => { if (e.target.closest('.cell')) startEdit(); });
vp.addEventListener('keydown', e => {
  if (editing) return;
  const pg = Math.max(1, Math.floor(vp.clientHeight / H) - 1), { r, c } = sel;
  const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], Enter: [1, 0], PageUp: [-pg, 0], PageDown: [pg, 0] }[e.key];
  if (e.key === 'Tab') { e.preventDefault(); select(r, c + (e.shiftKey ? -1 : 1)); }
  else if (mv) { e.preventDefault(); select(r + mv[0], c + mv[1]); }
  else if (e.key === 'F2') { e.preventDefault(); startEdit(); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { setCell(key(r, c), ''); fb.value = ''; }
  else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { e.preventDefault(); startEdit(e.key); }
});
ed.addEventListener('input', () => fb.value = ed.value);
ed.addEventListener('blur', () => commit());
ed.addEventListener('keydown', e => {
  e.stopPropagation();   // altrimenti l'evento risale a #vp e muove la selezione una seconda volta
  const { r, c } = sel;
  if (e.key === 'Enter') { e.preventDefault(); select(r + 1, c); vp.focus(); }
  else if (e.key === 'Tab') { e.preventDefault(); select(r, c + (e.shiftKey ? -1 : 1)); vp.focus(); }
  else if (e.key === 'Escape') { editing = false; ed.style.display = 'none'; fb.value = sh.getRaw(key(r, c)); vp.focus(); }
});
fb.addEventListener('keydown', e => {
  if (e.key === 'Enter') { setCell(key(sel.r, sel.c), fb.value); select(sel.r + 1, sel.c); vp.focus(); }
});

// PWA: registrazione SW (percorso relativo!) e pulsante di installazione
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
let deferred; const ib = $('install');
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; ib.classList.remove('d-none'); });
ib.onclick = () => { deferred?.prompt(); ib.classList.add('d-none'); };

select(0, 0); vp.focus();
