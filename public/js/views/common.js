import { html } from '../dom.js';
import { state, wishById } from '../api.js';
import { ui } from '../ui.js';
import { mealOrder } from '../lib/meals.js';
import { formatDate, weekday } from '../lib/dates.js';

export const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const dayLabel = (iso) => `${capital(weekday(iso))} ${formatDate(iso)}`;
export const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

export const byDateMeal = (a, b) => a.date.localeCompare(b.date) || mealOrder(a.meal) - mealOrder(b.meal);
export const planFor = (wishId) => state.plan.filter((p) => p.wishId === wishId).sort(byDateMeal);
export const entryTitle = (p) => (p.wishId ? wishById(p.wishId)?.title ?? 'Borttagen rätt' : p.text);

/** Alla datum som ska visas: lovet plus eventuella dagar utanför det som har planering. */
export function allDays() {
  const { start, end } = state.settings;
  const set = new Set([...state.plan.map((p) => p.date), ...Object.keys(state.days)]);
  for (let d = start; d && d <= end; d = nextDay(d)) set.add(d);
  return [...set].sort();
}

function nextDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export function heartButton(w) {
  const mine = Boolean(ui.who) && w.votes.includes(ui.who);
  return html`<button class="heart ${mine ? 'on' : ''}" data-act="vote" data-id="${w.id}" aria-pressed="${mine ? 'true' : 'false'}" aria-label="${mine ? 'Ta bort din röst' : 'Gilla'} ${w.title}">
    <span class="heart-icon" aria-hidden="true">${mine ? '♥' : '♡'}</span><span class="count">${w.votes.length}</span>
  </button>`;
}

export const mealChips = (selected = 'middag', meals) => html`<div class="chips" role="radiogroup" aria-label="Måltid">
  ${meals.map((m) => html`<label class="chip"><input type="radio" name="meal" value="${m.id}" ${m.id === selected ? 'checked' : ''}><span>${m.label}</span></label>`)}
</div>`;
