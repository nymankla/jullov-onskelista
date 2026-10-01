import { html } from '../dom.js';
import { state, api } from '../api.js';
import { ui, openModal } from '../ui.js';
import { formatDate } from '../lib/dates.js';
import { mealLabel } from '../lib/meals.js';
import { heartButton, planFor } from './common.js';

function visibleWishes() {
  const q = ui.q.trim().toLowerCase();
  const list = state.wishes.filter((w) => {
    const planned = planFor(w.id).length > 0;
    if (ui.filter === 'oplanerade' && planned) return false;
    if (ui.filter === 'planerade' && !planned) return false;
    return !q || [w.title, w.note, w.wishedBy, ...w.ingredients].join(' ').toLowerCase().includes(q);
  });
  const order = {
    populara: (a, b) => b.votes.length - a.votes.length || b.createdAt.localeCompare(a.createdAt),
    nyast: (a, b) => b.createdAt.localeCompare(a.createdAt),
    namn: (a, b) => a.title.localeCompare(b.title, 'sv'),
  };
  return list.sort(order[ui.sort] ?? order.populara);
}

function card(w) {
  const planned = planFor(w.id);
  return html`<article class="card wish">
    <button class="wish-main" data-act="wish-open" data-id="${w.id}">
      ${w.image
        ? html`<img class="thumb" src="${w.image}" alt="" loading="lazy">`
        : html`<span class="thumb ph" aria-hidden="true">✦</span>`}
      <span class="wish-text">
        <span class="wish-title">${w.title}</span>
        <span class="wish-meta">${w.wishedBy ? `Önskad av ${w.wishedBy}` : 'Önskad rätt'}${w.ingredients.length ? ' · med recept' : ''}</span>
        ${planned.length
          ? html`<span class="badges">${planned.map((p) => html`<span class="badge">${formatDate(p.date, { short: true })} · ${mealLabel(p.meal)}</span>`)}</span>`
          : ''}
      </span>
    </button>
    ${heartButton(w)}
  </article>`;
}

export function wishList() {
  const list = visibleWishes();
  if (!state.wishes.length) {
    return html`<div class="empty"><p class="big">Inga önskemål än</p><p>Tryck på <strong>Önska en rätt</strong> och lägg till det första. Du kan också klistra in en länk till ett recept.</p></div>`;
  }
  if (!list.length) return html`<div class="empty"><p>Inga rätter matchar sökningen eller filtret.</p></div>`;
  return html`<div class="cards">${list.map(card)}</div>`;
}

const FILTERS = [['alla', 'Alla'], ['oplanerade', 'Ej planerade'], ['planerade', 'Planerade']];
const SORTS = [['populara', 'Mest gillade'], ['nyast', 'Nyast först'], ['namn', 'A till Ö']];

export function wishesPage() {
  const { title, start, end } = state.settings;
  return html`<section class="page">
    <header class="page-head">
      <div>
        <h1>${title}</h1>
        <p class="sub">${start && end ? `Jullovet ${formatDate(start)} till ${formatDate(end)}` : ''} · ${state.wishes.length} önskade rätter</p>
      </div>
      <button class="btn primary" data-act="wish-new">+ Önska en rätt</button>
    </header>
    <div class="toolbar">
      <input class="search" type="search" placeholder="Sök rätt, ingrediens eller person" value="${ui.q}" data-input="search" aria-label="Sök bland önskemålen" enterkeyhint="search">
      <div class="seg" role="group" aria-label="Visa">
        ${FILTERS.map(([id, label]) => html`<button class="seg-btn ${ui.filter === id ? 'on' : ''}" data-act="filter" data-value="${id}" aria-pressed="${ui.filter === id ? 'true' : 'false'}">${label}</button>`)}
      </div>
      <label class="sort"><span class="sr">Sortera</span>
        <select data-change="sort" aria-label="Sortera">${SORTS.map(([id, label]) => html`<option value="${id}" ${ui.sort === id ? 'selected' : ''}>${label}</option>`)}</select>
      </label>
    </div>
    <div id="wish-list">${wishList()}</div>
  </section>`;
}

export const wishActions = {
  'wish-new': () => openModal(ui.who ? { type: 'wish-form' } : { type: 'who', next: { type: 'wish-form' } }),
  'wish-open': (el) => openModal({ type: 'wish', id: el.dataset.id }),
  filter: (el) => { ui.filter = el.dataset.value; document.dispatchEvent(new Event('ui:rerender')); },
  async vote(el) {
    if (!ui.who) { openModal({ type: 'who', next: ui.modal }); return; }
    await api.vote(el.dataset.id, ui.who);
  },
};

export const wishInputs = {
  search(el) {
    ui.q = el.value;
    // Bara listan ritas om, så att fokus och tangentbordet finns kvar
    const target = document.getElementById('wish-list');
    if (target) target.innerHTML = wishList().toString();
  },
};

export const wishChanges = {
  sort(el) { ui.sort = el.value; document.dispatchEvent(new Event('ui:rerender')); },
};
