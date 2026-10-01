import { html } from '../dom.js';
import { state, api } from '../api.js';
import { ui, openModal } from '../ui.js';
import { formatDate, weekday } from '../lib/dates.js';
import { mealLabel } from '../lib/meals.js';
import { allDays, byDateMeal, capital, entryTitle } from './common.js';

const TABS = [['alla', 'Hela lovet'], ['helg', 'Julhelgen'], ['lov', 'Lovdagarna']];
const isHelg = (d) => state.settings.helgDays.includes(d);

function entry(p) {
  return html`<li><button class="entry" data-act="plan-entry" data-id="${p.id}">
    <span class="meal">${mealLabel(p.meal)}</span><span class="entry-title">${entryTitle(p)}</span>
  </button></li>`;
}

function dayCard(d) {
  const day = state.days[d] ?? { cook: '', note: '' };
  const entries = state.plan.filter((p) => p.date === d).sort(byDateMeal);
  const { members } = state.settings;
  const cooks = day.cook && !members.includes(day.cook) ? [...members, day.cook] : members;
  return html`<article class="card day ${isHelg(d) ? 'helg' : ''}" data-date="${d}">
    <header class="day-head">
      <h3>${capital(weekday(d))} <span class="date">${formatDate(d)}</span></h3>
      ${isHelg(d) ? html`<span class="ribbon">🎄 Julhelg</span>` : ''}
    </header>
    <div class="day-meta">
      <label class="field inline"><span>Kock</span>
        <select data-change="cook" data-date="${d}" aria-label="Ansvarig kock ${formatDate(d)}">
          <option value="">Ingen vald</option>
          ${cooks.map((m) => html`<option value="${m}" ${m === day.cook ? 'selected' : ''}>${m}</option>`)}
        </select>
      </label>
      <input class="day-note" type="text" maxlength="300" placeholder="Anteckning, till exempel gäster kommer" value="${day.note}" data-change="day-note" data-date="${d}" aria-label="Anteckning ${formatDate(d)}">
    </div>
    ${entries.length ? html`<ul class="entries">${entries.map(entry)}</ul>` : html`<p class="muted none">Inget planerat än</p>`}
    <button class="btn ghost add" data-act="plan-add" data-date="${d}">+ Lägg till måltid</button>
  </article>`;
}

export function planPage() {
  const days = allDays().filter((d) => ui.planTab === 'alla' || (ui.planTab === 'helg') === isHelg(d));
  const unplanned = state.wishes.filter((w) => !state.plan.some((p) => p.wishId === w.id)).length;
  return html`<section class="page">
    <header class="page-head">
      <div>
        <h1>Dagsplan</h1>
        <p class="sub">${unplanned ? `${unplanned} önskade rätter väntar på en dag` : 'Alla önskade rätter har en plats i planen'}</p>
      </div>
    </header>
    <div class="seg wide" role="group" aria-label="Visa dagar">
      ${TABS.map(([id, label]) => html`<button class="seg-btn ${ui.planTab === id ? 'on' : ''}" data-act="plan-tab" data-value="${id}" aria-pressed="${ui.planTab === id ? 'true' : 'false'}">${label}</button>`)}
    </div>
    ${days.length
      ? html`<div class="cards days">${days.map(dayCard)}</div>`
      : html`<div class="empty"><p>Inga dagar att visa. Välj datum för lovet under Inställningar.</p></div>`}
  </section>`;
}

export const planActions = {
  'plan-tab': (el) => { ui.planTab = el.dataset.value; document.dispatchEvent(new Event('ui:rerender')); },
  'plan-add': (el) => openModal({ type: 'plan-add', date: el.dataset.date }),
  'plan-entry': (el) => openModal({ type: 'plan-entry', id: el.dataset.id }),
};

function saveDay(el) {
  const card = el.closest('.day');
  return api.setDay(el.dataset.date, {
    cook: card.querySelector('select').value,
    note: card.querySelector('.day-note').value,
  });
}

export const planChanges = { cook: saveDay, 'day-note': saveDay };
