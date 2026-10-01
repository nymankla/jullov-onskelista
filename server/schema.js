// Validering och rensning av allt som skrivs via API:t.
import { isISODate, eachDay, defaultBreak } from '../public/js/lib/dates.js';
import { isMeal } from '../public/js/lib/meals.js';

export const httpError = (status, message) => Object.assign(new Error(message), { status });

/** Enradig text. */
export const str = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
/** Flerradig text. */
export const text = (v, max) => String(v ?? '').replace(/\r/g, '').trim().slice(0, max);
/** Lista av rader, från en array eller en text med en post per rad. */
export const lines = (v, maxItems, maxLen) =>
  (Array.isArray(v) ? v : String(v ?? '').split('\n')).map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems);

export function cleanUrl(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    return ['http:', 'https:'].includes(u.protocol) ? u.href.slice(0, 500) : '';
  } catch {
    return '';
  }
}

/** Bara bilder som appen själv har sparat accepteras. */
export const cleanImage = (v) => (/^\/uploads\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(String(v ?? '')) ? String(v) : '');

export const cleanName = (v) => str(v, 30);

/** Fält som får sättas på en önskad rätt. Bara nycklar som finns i input tas med. */
export function wishFields(input = {}) {
  const out = {};
  if ('title' in input) {
    out.title = str(input.title, 120);
    if (!out.title) throw httpError(400, 'Rätten behöver ett namn');
  }
  if ('note' in input) out.note = text(input.note, 1000);
  if ('url' in input) out.url = cleanUrl(input.url);
  if ('wishedBy' in input) out.wishedBy = cleanName(input.wishedBy);
  if ('servings' in input) {
    const n = Math.round(Number(input.servings));
    out.servings = Number.isFinite(n) && n > 0 ? Math.min(n, 100) : null;
  }
  if ('ingredients' in input) out.ingredients = lines(input.ingredients, 80, 200);
  if ('steps' in input) out.steps = lines(input.steps, 60, 1000);
  if ('image' in input) out.image = cleanImage(input.image);
  return out;
}

/** Inställningar för lovet. Alla delar valideras mot varandra. */
export function settingsFields(input = {}, current) {
  const out = {};
  if ('title' in input) out.title = str(input.title, 80) || current.title;
  const start = 'start' in input ? input.start : current.start;
  const end = 'end' in input ? input.end : current.end;
  if (!isISODate(start) || !isISODate(end)) throw httpError(400, 'Ogiltigt datum');
  const days = eachDay(start, end);
  if (!days.length) throw httpError(400, 'Slutdatum kan inte vara före startdatum');
  if (days.length > 60) throw httpError(400, 'Lovet kan vara högst 60 dagar');
  out.start = start;
  out.end = end;
  const helg = 'helgDays' in input ? input.helgDays : current.helgDays;
  out.helgDays = [...new Set((Array.isArray(helg) ? helg : []).filter((d) => days.includes(d)))].sort();
  return out;
}

export function planFields(input = {}) {
  if (!isISODate(input.date)) throw httpError(400, 'Ogiltigt datum');
  if (!isMeal(input.meal)) throw httpError(400, 'Okänd måltid');
  return { date: input.date, meal: input.meal, text: str(input.text, 120) };
}

export function defaultState(now = new Date()) {
  const b = defaultBreak(now);
  return {
    rev: 1,
    settings: { title: 'Jullovets matönskelista', start: b.start, end: b.end, helgDays: b.helgDays, members: [] },
    wishes: [],
    plan: [],
    days: {},
    trash: [],
  };
}
