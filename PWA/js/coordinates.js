// Conversione A1 <-> indici (0-based). Colonne: A..Z, AA..AZ, ... CV
export const ROWS = 100, COLS = 100;
export const colName = i => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
export const colIndex = n => [...n].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
export const key = (r, c) => colName(c) + (r + 1);
export function parseRef(s) {
  const m = /^([A-Z]{1,3})(\d+)$/.exec(s.toUpperCase());
  return m ? { r: +m[2] - 1, c: colIndex(m[1]) } : null;
}
