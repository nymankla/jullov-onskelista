import { html } from '../dom.js';
import { state, api, wishById } from '../api.js';
import { ui, setWho, openModal, closeModal, showToast } from '../ui.js';
import { MEALS, mealLabel } from '../lib/meals.js';
import { formatDate } from '../lib/dates.js';
import { allDays, dayLabel, heartButton, hostOf, mealChips, planFor } from './common.js';

/** Modaler med formulär ritas inte om av bakgrundsuppdateringar, så att det man skrivit finns kvar. */
export const FORM_MODALS = new Set(['who', 'wish-form', 'plan-add', 'plan-wish', 'plan-entry']);

const shell = (title, body) => html`<div class="overlay" data-act="modal-backdrop">
  <div class="sheet" role="dialog" aria-modal="true" aria-label="${title}" tabindex="-1">
    <header class="sheet-head"><h2>${title}</h2><button class="icon-btn" data-act="modal-close" aria-label="Stäng">×</button></header>
    <div class="sheet-body">${body}</div>
  </div>
</div>`;

// ---------- Vem är du? ----------
function whoModal() {
  const { members } = state.settings;
  return shell('Vem är du?', html`
    <p>Välj ditt namn så att dina önskemål och röster hamnar rätt. Valet sparas bara på den här enheten.</p>
    ${members.length ? html`<div class="chips big">${members.map((n) => html`<button class="chip ${n === ui.who ? 'on' : ''}" data-act="who-pick" data-name="${n}"><span>${n}</span></button>`)}</div>` : ''}
    <form class="row" data-submit="who-new">
      <input name="name" maxlength="30" placeholder="${members.length ? 'Eller lägg till ett nytt namn' : 'Skriv ditt namn'}" autocomplete="off" required aria-label="Namn">
      <button class="btn primary">${members.length ? 'Lägg till' : 'Fortsätt'}</button>
    </form>`);
}

// ---------- En önskad rätt ----------
function wishModal(m) {
  const w = wishById(m.id);
  if (!w) return null;
  const planned = planFor(w.id);
  return shell(w.title, html`
    ${w.image ? html`<img class="hero" src="${w.image}" alt="">` : ''}
    <p class="by">${w.wishedBy ? `Önskad av ${w.wishedBy}` : 'Önskad rätt'}${w.servings ? ` · ${w.servings} portioner` : ''}</p>
    ${w.note ? html`<p class="note">${w.note}</p>` : ''}
    ${w.url ? html`<p><a href="${w.url}" target="_blank" rel="noopener noreferrer">Öppna receptet på ${hostOf(w.url)} ↗</a></p>` : ''}
    <div class="vote-row">${heartButton(w)}<span class="muted">${w.votes.length ? `Gillas av ${w.votes.join(', ')}` : 'Ingen har gillat än'}</span></div>
    ${w.ingredients.length ? html`<details class="fold"><summary>Ingredienser (${w.ingredients.length})</summary><ul>${w.ingredients.map((i) => html`<li>${i}</li>`)}</ul></details>` : ''}
    ${w.steps.length ? html`<details class="fold"><summary>Gör så här (${w.steps.length} steg)</summary><ol>${w.steps.map((s) => html`<li>${s}</li>`)}</ol></details>` : ''}
    <h3>Planerat</h3>
    ${planned.length
      ? html`<ul class="planned">${planned.map((p) => html`<li><span>${dayLabel(p.date)} · ${mealLabel(p.meal)}</span>
          <button class="btn ghost small" data-act="plan-remove" data-id="${p.id}">Ta bort</button></li>`)}</ul>`
      : html`<p class="muted">Inte planerad än.</p>`}
    <div class="actions">
      <button class="btn primary" data-act="plan-wish" data-id="${w.id}">Planera</button>
      <button class="btn" data-act="wish-edit" data-id="${w.id}">Redigera</button>
      <button class="btn danger" data-act="wish-delete" data-id="${w.id}">Ta bort</button>
    </div>`);
}

function wishForm(m) {
  const w = m.id ? wishById(m.id) : null;
  const v = w ?? { title: '', note: '', url: '', wishedBy: ui.who, servings: '', ingredients: [], steps: [], image: '' };
  const people = v.wishedBy && !state.settings.members.includes(v.wishedBy) ? [...state.settings.members, v.wishedBy] : state.settings.members;
  return shell(w ? 'Redigera önskemål' : 'Önska en rätt', html`
    <form class="form" data-submit="save-wish" data-id="${w?.id ?? ''}">
      <div class="importbox">
        <label class="field"><span>Länk till recept (valfritt)</span>
          <div class="row"><input name="url" type="url" inputmode="url" placeholder="https://www.ica.se/recept/…" value="${v.url}" autocomplete="off">
          <button type="button" class="btn" data-act="import">Hämta recept</button></div>
        </label>
        <p class="hint" id="import-status" role="status">Klistra in en länk så fylls rätten i åt dig.</p>
      </div>
      <img class="hero small" id="form-img" src="${v.image}" alt="" ${v.image ? '' : 'hidden'}>
      <input type="hidden" name="image" value="${v.image}">
      <label class="field"><span>Vad vill ni äta?</span><input name="title" value="${v.title}" maxlength="120" required placeholder="Till exempel Janssons frestelse" autocomplete="off"></label>
      <div class="two">
        <label class="field"><span>Önskad av</span>
          <select name="wishedBy">${people.map((p) => html`<option value="${p}" ${p === v.wishedBy ? 'selected' : ''}>${p}</option>`)}</select>
        </label>
        <label class="field"><span>Portioner</span><input name="servings" type="number" inputmode="numeric" min="1" max="100" value="${v.servings ?? ''}"></label>
      </div>
      <label class="field"><span>Anteckning</span><textarea name="note" rows="2" maxlength="1000" placeholder="Till exempel: med mammas sås">${v.note}</textarea></label>
      <label class="field"><span>Ingredienser (en per rad)</span><textarea name="ingredients" rows="4">${v.ingredients.join('\n')}</textarea></label>
      <label class="field"><span>Gör så här (ett steg per rad)</span><textarea name="steps" rows="4">${v.steps.join('\n')}</textarea></label>
      <div class="actions"><button class="btn primary">${w ? 'Spara ändringar' : 'Lägg till önskemål'}</button><button type="button" class="btn" data-act="modal-close">Avbryt</button></div>
    </form>`);
}

// ---------- Planera ----------
const wishOptions = () => {
  const sorted = [...state.wishes].sort((a, b) => b.votes.length - a.votes.length);
  return sorted.map((w) => html`<option value="${w.id}">${w.title}${w.votes.length ? ` (${w.votes.length} ♥)` : ''}${planFor(w.id).length ? ' · planerad' : ''}</option>`);
};

const dateSelect = (selected) => html`<select name="date" aria-label="Dag">
  ${allDays().map((d) => html`<option value="${d}" ${d === selected ? 'selected' : ''}>${dayLabel(d)}${state.settings.helgDays.includes(d) ? ' (julhelg)' : ''}</option>`)}
</select>`;

function planAddModal(m) {
  return shell(`Lägg till måltid, ${dayLabel(m.date)}`, html`
    <form class="form" data-submit="plan-add-save" data-date="${m.date}">
      <fieldset class="field"><legend>Måltid</legend>${mealChips('middag', MEALS)}</fieldset>
      <label class="field"><span>Från önskelistan</span>
        <select name="wishId"><option value="">Välj en önskad rätt</option>${wishOptions()}</select>
      </label>
      <label class="field"><span>Eller skriv något eget</span><input name="text" maxlength="120" placeholder="Till exempel Rester och smörgåsar" autocomplete="off"></label>
      <div class="actions"><button class="btn primary">Lägg till</button><button type="button" class="btn" data-act="modal-close">Avbryt</button></div>
    </form>`);
}

function planWishModal(m) {
  const w = wishById(m.id);
  if (!w) return null;
  return shell(`Planera ${w.title}`, html`
    <form class="form" data-submit="plan-wish-save" data-id="${w.id}">
      <label class="field"><span>Dag</span>${dateSelect(allDays().find((d) => !state.plan.some((p) => p.date === d)) ?? allDays()[0])}</label>
      <fieldset class="field"><legend>Måltid</legend>${mealChips('middag', MEALS)}</fieldset>
      <div class="actions"><button class="btn primary">Lägg i planen</button><button type="button" class="btn" data-act="modal-close">Avbryt</button></div>
    </form>`);
}

function planEntryModal(m) {
  const p = state.plan.find((e) => e.id === m.id);
  if (!p) return null;
  const w = p.wishId ? wishById(p.wishId) : null;
  return shell(w ? w.title : p.text, html`
    <form class="form" data-submit="plan-entry-save" data-id="${p.id}">
      <label class="field"><span>Dag</span>${dateSelect(p.date)}</label>
      <fieldset class="field"><legend>Måltid</legend>${mealChips(p.meal, MEALS)}</fieldset>
      <div class="actions">
        <button class="btn primary">Spara</button>
        ${w ? html`<button type="button" class="btn" data-act="wish-open" data-id="${w.id}">Visa rätten</button>` : ''}
        <button type="button" class="btn danger" data-act="plan-remove" data-id="${p.id}">Ta bort från planen</button>
      </div>
    </form>`);
}

/** Returnerar fragmentet för den aktuella modalen, eller null om den inte finns längre. */
export function modalHtml(m) {
  switch (m.type) {
    case 'who': return whoModal(m);
    case 'wish': return wishModal(m);
    case 'wish-form': return wishForm(m);
    case 'plan-add': return planAddModal(m);
    case 'plan-wish': return planWishModal(m);
    case 'plan-entry': return planEntryModal(m);
    default: return null;
  }
}

// ---------- Åtgärder ----------
export const modalActions = {
  'modal-close': () => closeModal(),
  'modal-backdrop': (el, ev) => { if (ev.target === el) closeModal(); },
  'who-pick'(el) {
    setWho(el.dataset.name);
    const next = ui.modal?.next;
    if (next) openModal(next); else closeModal();
    document.dispatchEvent(new Event('ui:rerender'));
  },
  'wish-edit': (el) => openModal({ type: 'wish-form', id: el.dataset.id }),
  'plan-wish': (el) => openModal({ type: 'plan-wish', id: el.dataset.id }),
  async 'plan-remove'(el) {
    await api.removePlan(el.dataset.id);
    // Öppna rättens vy igen om man kom därifrån, annars stäng
    if (ui.modal?.type === 'plan-entry') closeModal();
  },
  async 'wish-delete'(el) {
    const w = wishById(el.dataset.id);
    const data = await api.deleteWish(el.dataset.id);
    closeModal();
    showToast(`${w?.title ?? 'Rätten'} togs bort`, async () => { await api.restoreWish(data.undoId); });
  },
  async import(btn) {
    const form = btn.closest('form');
    const status = form.querySelector('#import-status');
    const url = form.elements.url.value.trim();
    if (!url) { status.textContent = 'Klistra in en länk först.'; return; }
    btn.disabled = true;
    status.textContent = 'Hämtar receptet…';
    try {
      const d = await api.importRecipe(url);
      const set = (name, value) => { if (value !== '' && value != null) form.elements[name].value = value; };
      set('title', d.title);
      set('note', form.elements.note.value ? '' : d.note);
      set('servings', d.servings);
      set('ingredients', d.ingredients.join('\n'));
      set('steps', d.steps.join('\n'));
      set('url', d.url);
      if (d.image) {
        form.elements.image.value = d.image;
        const img = form.querySelector('#form-img');
        img.src = d.image;
        img.hidden = false;
      }
      status.textContent = `Hämtade "${d.title}" från ${d.host}. Läs igenom och spara.`;
    } catch (e) {
      status.textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  },
};

const num = (v) => (v === '' || v == null ? null : Number(v));

export const modalSubmits = {
  async 'who-new'(form) {
    const data = await api.addMember(new FormData(form).get('name'));
    setWho(data.name);
    const next = ui.modal?.next;
    if (next) openModal(next); else closeModal();
  },
  async 'save-wish'(form) {
    const f = Object.fromEntries(new FormData(form));
    const body = { ...f, servings: num(f.servings) };
    if (form.dataset.id) {
      await api.updateWish(form.dataset.id, body);
      openModal({ type: 'wish', id: form.dataset.id });
      showToast('Ändringarna är sparade');
    } else {
      const data = await api.addWish(body);
      closeModal();
      showToast(`${body.title} lades till i önskelistan`, null);
      return data;
    }
  },
  async 'plan-add-save'(form) {
    const f = new FormData(form);
    const wishId = f.get('wishId') || null;
    const text = String(f.get('text') ?? '').trim();
    await api.addPlan({ date: form.dataset.date, meal: f.get('meal'), wishId, text: wishId ? '' : text });
    closeModal();
    showToast(`Tillagt ${formatDate(form.dataset.date)}`);
  },
  async 'plan-wish-save'(form) {
    const f = new FormData(form);
    await api.addPlan({ date: f.get('date'), meal: f.get('meal'), wishId: form.dataset.id });
    openModal({ type: 'wish', id: form.dataset.id });
    showToast(`Planerad ${formatDate(f.get('date'))}`);
  },
  async 'plan-entry-save'(form) {
    const f = new FormData(form);
    await api.movePlan(form.dataset.id, { date: f.get('date'), meal: f.get('meal') });
    closeModal();
  },
};
