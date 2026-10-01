// Datumhjälp som delas av server, klient och tester. Allt räknas i UTC så att sommartid inte spelar roll.
const DAY = 86400000;
const WEEKDAYS = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];

/** 'YYYY-MM-DD' → millisekunder (UTC), eller null om datumet inte finns. */
export function parseISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? ''));
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(t);
  return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? t : null;
}

export const isISODate = (s) => parseISO(s) !== null;
export const toISO = (t) => new Date(t).toISOString().slice(0, 10);
export const addDays = (iso, n) => toISO(parseISO(iso) + n * DAY);

/** Alla datum från start till slut, inklusive båda. Tom lista om intervallet är ogiltigt. */
export function eachDay(start, end) {
  const a = parseISO(start);
  const b = parseISO(end);
  if (a === null || b === null || b < a) return [];
  const out = [];
  for (let t = a; t <= b; t += DAY) out.push(toISO(t));
  return out;
}

export const weekday = (iso) => WEEKDAYS[new Date(parseISO(iso)).getUTCDay()];
export const isWeekend = (iso) => [0, 6].includes(new Date(parseISO(iso)).getUTCDay());

/** "24 december", eller "24 dec" med short. */
export function formatDate(iso, { short = false } = {}) {
  const d = new Date(parseISO(iso));
  const month = MONTHS[d.getUTCMonth()];
  return `${d.getUTCDate()} ${short ? month.slice(0, 3) : month}`;
}

/** Standardlov: 19 dec till 3 jan för det jullov som kommer härnäst (eller pågår). */
export function defaultBreak(now = new Date()) {
  const year = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return {
    start: `${year}-12-19`,
    end: `${year + 1}-01-03`,
    helgDays: [`${year}-12-24`, `${year}-12-25`, `${year}-12-26`],
  };
}
