// Motore di calcolo: tokenizer -> parser ricorsivo (AST) -> valutazione lazy con cache.
import { ROWS, COLS, parseRef, key } from './coordinates.js';

export class Err { constructor(m) { this.m = m; } }
const E = m => new Err(m);
export const fmt = v => v instanceof Err ? v.m : typeof v === 'number' ? String(+v.toPrecision(12)) : String(v);

// ---- TOKENIZER: numeri, stringhe "..", parole (funzioni/riferimenti), operatori
function tokenize(s) {
  const t = [], re = /\s*(?:(\d+\.?\d*|\.\d+)|"([^"]*)"|([A-Za-z][A-Za-z0-9.]*)|([-+*\/():;,]))/y;
  while (re.lastIndex < s.length) {
    const pos = re.lastIndex, m = re.exec(s);
    if (!m) { if (s.slice(pos).trim() === '') break; throw E('#VALORE!'); }
    if (m[1] !== undefined) t.push({ k: 'n', v: +m[1] });
    else if (m[2] !== undefined) t.push({ k: 's', v: m[2] });
    else if (m[3] !== undefined) t.push({ k: 'w', v: m[3] });
    else t.push({ k: 'o', v: m[4] });
  }
  return t;
}

const FUNCS = new Set(['SOMMA', 'MEDIA', 'CONTA', 'CONTA.VALORI', 'SOMMA.SE', 'CONTA.SE', 'MEDIA.SE', 'MAX', 'MIN']);

// ---- PARSER (precedenza: parentesi > unario - > * / > + -). Registra le dipendenze in deps.
function parse(src, deps) {
  const tk = tokenize(src); let p = 0;
  const peek = () => tk[p], isOp = (...o) => peek() && peek().k === 'o' && o.includes(peek().v);
  const expect = v => { if (!isOp(v)) throw E('#VALORE!'); p++; };
  const ref = name => {
    const x = parseRef(name); if (!x) throw E('#NOME?');
    if (x.r >= ROWS || x.c >= COLS) throw E('#RIF!');
    return x;
  };
  function expr() { let a = term(); while (isOp('+', '-')) { const op = tk[p++].v; a = { t: 'b', op, a, b: term() }; } return a; }
  function term() { let a = unary(); while (isOp('*', '/')) { const op = tk[p++].v; a = { t: 'b', op, a, b: unary() }; } return a; }
  function unary() { if (isOp('-')) { p++; return { t: 'neg', a: unary() }; } return primary(); }
  function primary() {
    const x = tk[p++]; if (!x) throw E('#VALORE!');
    if (x.k === 'n' || x.k === 's') return { t: x.k, v: x.v };
    if (x.k === 'o' && x.v === '(') { const e = expr(); expect(')'); return e; }
    if (x.k !== 'w') throw E('#VALORE!');
    if (isOp('(')) { // funzione
      p++; const name = x.v.toUpperCase(); if (!FUNCS.has(name)) throw E('#NOME?');
      const args = [];
      if (isOp(')')) p++; else for (;;) { args.push(expr()); if (isOp(';', ',')) { p++; continue; } expect(')'); break; }
      return { t: 'fn', name, args };
    }
    const a = ref(x.v);
    if (isOp(':')) { // intervallo
      p++; const w = tk[p++]; if (!w || w.k !== 'w') throw E('#VALORE!');
      const b = ref(w.v);
      const n = { t: 'rng', r1: Math.min(a.r, b.r), r2: Math.max(a.r, b.r), c1: Math.min(a.c, b.c), c2: Math.max(a.c, b.c) };
      deps.ranges.push([n.r1, n.c1, n.r2, n.c2]); return n;
    }
    deps.cells.push(key(a.r, a.c)); return { t: 'ref', r: a.r, c: a.c };
  }
  const e = expr(); if (p < tk.length) throw E('#VALORE!');
  return e;
}

// Criteri per *.SE: ">5", "<=3", "<>x", "=ciao", 5
function crit(c) {
  if (typeof c === 'number') return v => v === c;
  const m = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(String(c).trim()), op = m[1] || '=', t = m[2];
  const tn = t !== '' && isFinite(t) ? Number(t) : null;
  const cmp = (x, y) => op === '=' ? x === y : op === '<>' ? x !== y : op === '<' ? x < y : op === '>' ? x > y : op === '<=' ? x <= y : x >= y;
  if (tn !== null) return v => typeof v === 'number' ? cmp(v, tn) : op === '<>';
  return v => (op === '=' || op === '<>') ? cmp(String(v).toLowerCase(), t.toLowerCase()) : false;
}

export class Sheet {
  constructor() {
    this.raw = new Map();   // chiave -> testo grezzo
    this.ast = new Map();   // chiave -> AST (solo formule)
    this.dep = new Map();   // chiave formula -> {cells, ranges}
    this.rev = new Map();   // cella -> Set di formule che la citano (dipendenti diretti)
    this.cache = new Map(); // valori calcolati
    this.busy = new Set();  // celle in corso di valutazione (rilevamento cicli)
  }
  getRaw(k) { return this.raw.get(k) ?? ''; }

  // Imposta una cella e invalida SOLO i dipendenti (transitivi). Il ricalcolo è lazy.
  set(k, v) {
    v = String(v);
    const old = this.dep.get(k);
    if (old) { for (const c of old.cells) this.rev.get(c)?.delete(k); this.dep.delete(k); this.ast.delete(k); }
    if (v === '') this.raw.delete(k); else this.raw.set(k, v);
    if (v[0] === '=') {
      const deps = { cells: [], ranges: [] }; let a;
      try { a = parse(v.slice(1), deps); } catch (e) { if (!(e instanceof Err)) throw e; a = { t: 'err', e }; }
      this.ast.set(k, a); this.dep.set(k, deps);
      for (const c of deps.cells) (this.rev.get(c) || this.rev.set(c, new Set()).get(c)).add(k);
    }
    return this.invalidate(k);
  }
  invalidate(k) {
    const out = [], seen = new Set([k]), st = [k];
    const add = f => { if (!seen.has(f)) { seen.add(f); st.push(f); } };
    while (st.length) {
      const x = st.pop(); this.cache.delete(x); out.push(x);
      const { r, c } = parseRef(x);
      this.rev.get(x)?.forEach(add);
      for (const [f, d] of this.dep) for (const g of d.ranges)
        if (r >= g[0] && r <= g[2] && c >= g[1] && c <= g[3]) { add(f); break; }
    }
    return out;
  }
  // Valore di una cella: number | string | Err
  val(k) {
    if (this.cache.has(k)) return this.cache.get(k);
    const raw = this.raw.get(k); let v;
    if (raw === undefined) v = '';
    else if (raw[0] !== '=') v = raw.trim() !== '' && isFinite(raw) ? Number(raw) : raw;
    else {
      if (this.busy.has(k)) return E('#CIRC!'); // ciclo: non in cache
      this.busy.add(k);
      try { v = this.ev(this.ast.get(k)); } catch (e) { if (!(e instanceof Err)) throw e; v = e; }
      this.busy.delete(k);
    }
    this.cache.set(k, v); return v;
  }
  num(v) { if (v === '') return 0; if (typeof v === 'number') return v; throw E('#VALORE!'); }
  ev(n) {
    switch (n.t) {
      case 'err': throw n.e;
      case 'n': case 's': return n.v;
      case 'ref': { const v = this.val(key(n.r, n.c)); if (v instanceof Err) throw v; return v; }
      case 'rng': throw E('#VALORE!');
      case 'neg': return -this.num(this.ev(n.a));
      case 'b': {
        const a = this.num(this.ev(n.a)), b = this.num(this.ev(n.b));
        if (n.op === '/') { if (b === 0) throw E('#DIV/0!'); return a / b; }
        return n.op === '+' ? a + b : n.op === '-' ? a - b : a * b;
      }
      case 'fn': return this.fn(n);
    }
  }
  rangeVals(n) {
    const o = [];
    for (let r = n.r1; r <= n.r2; r++) for (let c = n.c1; c <= n.c2; c++) {
      const v = this.val(key(r, c)); if (v instanceof Err) throw v; o.push(v);
    }
    return o;
  }
  fn(n) {
    const a = n.args;
    const flat = () => a.flatMap(x => x.t === 'rng' ? this.rangeVals(x) : [this.ev(x)]);
    const nums = () => a.flatMap(x => x.t === 'rng'
      ? this.rangeVals(x).filter(v => typeof v === 'number')
      : (v => v === '' ? [] : [this.num(v)])(this.ev(x)));
    switch (n.name) {
      case 'SOMMA': return nums().reduce((s, x) => s + x, 0);
      case 'MEDIA': { const v = nums(); if (!v.length) throw E('#DIV/0!'); return v.reduce((s, x) => s + x, 0) / v.length; }
      case 'MAX': { const v = nums(); return v.length ? Math.max(...v) : 0; }
      case 'MIN': { const v = nums(); return v.length ? Math.min(...v) : 0; }
      case 'CONTA': return flat().filter(v => typeof v === 'number').length;
      case 'CONTA.VALORI': return flat().filter(v => v !== '').length;
      default: { // SOMMA.SE / CONTA.SE / MEDIA.SE (intervallo; criterio; [intervallo_somma])
        if (a.length < 2 || a[0].t !== 'rng' || (a[2] && a[2].t !== 'rng')) throw E('#VALORE!');
        const rv = this.rangeVals(a[0]), m = crit(this.ev(a[1])), sv = a[2] ? this.rangeVals(a[2]) : rv;
        let cnt = 0, sum = 0;
        rv.forEach((v, i) => { if (m(v)) { cnt++; if (typeof sv[i] === 'number') sum += sv[i]; } });
        if (n.name === 'CONTA.SE') return cnt;
        if (n.name === 'SOMMA.SE') return sum;
        if (!cnt) throw E('#DIV/0!'); return sum / cnt;
      }
    }
  }
}
