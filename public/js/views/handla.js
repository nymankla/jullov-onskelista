import { html } from '../dom.js';
import { state, wishById } from '../api.js';
import { ui } from '../ui.js';
import { formatDate, weekday } from '../lib/dates.js';
import { mealLabel } from '../lib/meals.js';
import { allDays, byDateMeal, capital, entryTitle } from './common.js';

const isHelg = (d) => state.settings.helgDays.includes(d);

function mealItem(p) {
  const wish = p.wishId ? wishById(p.wishId) : null;
  const ingredients = wish?.ingredients ?? [];
  const title = entryTitle(p);
  const items = ingredients.length ? ingredients : [title];
  return html`<li class="handla-meal">
    <div class="handla-meal-head"><span class="meal">${mealLabel(p.meal)}</span>${ingredients.length ? html`<strong>${title}</strong>` : ''}</div>
    <ul class="checklist">${items.map((item, i) => {
      const key = `${p.id}:${i}`;
      return html`<li><label><input type="checkbox" data-change="handla-check" data-key="${key}" ${ui.handlaChecked.has(key) ? 'checked' : ''}><span>${item}</span></label></li>`;
    })}</ul>
  </li>`;
}

function daySection(d) {
  const entries = state.plan.filter((p) => p.date === d).sort(byDateMeal);
  return html`<article class="card day ${isHelg(d) ? 'helg' : ''}">
    <header class="day-head">
      <h3>${capital(weekday(d))} <span class="date">${formatDate(d)}</span></h3>
      ${isHelg(d) ? html`<span class="ribbon">🎄 Julhelg</span>` : ''}
    </header>
    <ul class="handla-list">${entries.map(mealItem)}</ul>
  </article>`;
}

export function handlaPage() {
  const days = allDays().filter((d) => state.plan.some((p) => p.date === d));
  const selected = ui.handlaDays.filter((d) => days.includes(d)).sort();
  const sub = selected.length
    ? `Inköpslista för ${selected.length} ${selected.length === 1 ? 'dag' : 'dagar'}`
    : 'Välj en eller flera dagar, så blir det en inköpslista.';
  return html`<section class="page">
    <header class="page-head">
      <div><h1>Handla</h1><p class="sub">${sub}</p></div>
      ${selected.length ? html`<button class="btn primary" data-act="print">Skriv ut listan</button>` : ''}
    </header>
    <fieldset class="field no-print">
      <legend>Vilka dagar vill du handla för?</legend>
      ${days.length
        ? html`<div class="chips">${days.map((d) => html`<label class="chip"><input type="checkbox" data-change="handla-day" data-date="${d}" ${selected.includes(d) ? 'checked' : ''}><span>${capital(weekday(d)).slice(0, 3)} ${formatDate(d, { short: true })}</span></label>`)}</div>
           ${selected.length ? html`<button class="btn ghost small" data-act="handla-clear" type="button">Rensa valda dagar</button>` : ''}`
        : html`<p class="hint">Inga dagar har någon planerad mat än. Lägg till måltider under Dagsplan först.</p>`}
    </fieldset>
    ${selected.length ? html`<div class="cards">${selected.map(daySection)}</div>` : ''}
  </section>`;
}

export const handlaActions = {
  'handla-clear'() { ui.handlaDays = []; document.dispatchEvent(new Event('ui:rerender')); },
};

export const handlaChanges = {
  'handla-day'(el) {
    const d = el.dataset.date;
    const set = new Set(ui.handlaDays);
    if (el.checked) set.add(d); else set.delete(d);
    ui.handlaDays = [...set];
    document.dispatchEvent(new Event('ui:rerender'));
  },
  'handla-check'(el) {
    const key = el.dataset.key;
    if (el.checked) ui.handlaChecked.add(key); else ui.handlaChecked.delete(key);
  },
};
