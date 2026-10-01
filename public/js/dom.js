// HTML byggs med den taggade mallen html``, som escapar allt utom färdiga fragment.
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

class Safe {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

const part = (v) => {
  if (v instanceof Safe) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  if (v === null || v === undefined || v === false) return '';
  return esc(v);
};

export const html = (strings, ...vals) => new Safe(strings.reduce((out, s, i) => out + part(vals[i - 1]) + s));
export const raw = (s) => new Safe(String(s));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
