import { html } from '../dom.js';
import { state } from '../api.js';
import { formatDate } from '../lib/dates.js';
import { mealLabel } from '../lib/meals.js';
import { allDays, byDateMeal, capital, entryTitle, hostOf } from './common.js';
import { weekday } from '../lib/dates.js';

const isHelg = (d) => state.settings.helgDays.includes(d);

function printDay(d) {
  const day = state.days[d] ?? { cook: '', note: '' };
  const entries = state.plan.filter((p) => p.date === d).sort(byDateMeal);
  return html`<section class="p-day ${isHelg(d) ? 'helg' : ''}">
    <h3>${capital(weekday(d))} ${formatDate(d)}${isHelg(d) ? html` <small>Julhelg</small>` : ''}</h3>
    ${day.cook ? html`<p class="p-cook">Kock: ${day.cook}</p>` : ''}
    ${day.note ? html`<p class="p-note">${day.note}</p>` : ''}
    ${entries.length
      ? html`<ul>${entries.map((p) => html`<li><span class="meal">${mealLabel(p.meal)}</span> ${entryTitle(p)}</li>`)}</ul>`
      : html`<p class="muted">Inget planerat</p>`}
  </section>`;
}

export function printPage() {
  const { title, start, end } = state.settings;
  const waiting = state.wishes
    .filter((w) => !state.plan.some((p) => p.wishId === w.id))
    .sort((a, b) => b.votes.length - a.votes.length);
  return html`<section class="page print-page">
    <header class="page-head no-print">
      <div><h1>Skriv ut</h1><p class="sub">Så här ser planen ut på papper eller som PDF.</p></div>
      <button class="btn primary" data-act="print">Skriv ut eller spara som PDF</button>
    </header>
    <div class="sheet-paper">
      <h2 class="p-title">${title}</h2>
      <p class="p-sub">${formatDate(start)} till ${formatDate(end)}</p>
      <div class="p-days">${allDays().map(printDay)}</div>
      ${waiting.length
        ? html`<section class="p-wishes">
            <h3>Önskemål som inte har fått en dag</h3>
            <ul>${waiting.map((w) => html`<li>${w.title}${w.wishedBy ? ` (${w.wishedBy})` : ''}${w.votes.length ? ` · ${w.votes.length} ♥` : ''}${w.url ? html` <small>${hostOf(w.url)}</small>` : ''}</li>`)}</ul>
          </section>`
        : ''}
    </div>
  </section>`;
}

export const printActions = { print: () => window.print() };
