import { html, $ } from './dom.js';
import { state, load, refreshIfChanged, onChange } from './api.js';
import { ui, closeModal, hideToast, showToast, openModal } from './ui.js';
import { wishesPage, wishActions, wishInputs, wishChanges } from './views/wishes.js';
import { planPage, planActions, planChanges } from './views/plan.js';
import { handlaPage, handlaActions, handlaChanges } from './views/handla.js';
import { printPage, printActions } from './views/print.js';
import { settingsPage, settingsActions, settingsSubmits } from './views/settings.js';
import { FORM_MODALS, modalHtml, modalActions, modalSubmits } from './views/modals.js';

const ROUTES = {
  '': { page: wishesPage, title: 'Önskelista' },
  plan: { page: planPage, title: 'Dagsplan' },
  handla: { page: handlaPage, title: 'Handla' },
  'skriv-ut': { page: printPage, title: 'Skriv ut' },
  installningar: { page: settingsPage, title: 'Inställningar' },
};
const TABS = [['', 'Önskelista', '♥'], ['plan', 'Dagsplan', '▦'], ['handla', 'Handla', '▤'], ['skriv-ut', 'Skriv ut', '⎙'], ['installningar', 'Inställningar', '⚙']];

const actions = {
  ...wishActions, ...planActions, ...handlaActions, ...printActions, ...settingsActions, ...modalActions,
  async 'toast-undo'() {
    const undo = ui.toast?.undo;
    hideToast();
    if (undo) await undo();
  },
  'who-open': () => openModal({ type: 'who' }),
  reload: () => location.reload(),
};
const changes = { ...wishChanges, ...planChanges, ...handlaChanges };
const inputs = { ...wishInputs };
const submits = { ...settingsSubmits, ...modalSubmits };

const app = $('#app');
const route = () => location.hash.replace(/^#\/?/, '').split('?')[0];

function shell(content, current) {
  return html`<a class="skip" href="#main">Hoppa till innehållet</a>
    <header class="topbar no-print">
      <a class="brand" href="#/"><span class="star" aria-hidden="true">✦</span><span class="brand-text">${state.settings.title}</span></a>
      <nav class="tabs" aria-label="Huvudmeny">
        ${TABS.map(([id, label, icon]) => html`<a class="tab ${current === id ? 'on' : ''}" href="#/${id}" ${current === id ? 'aria-current="page"' : ''}><span class="tab-icon" aria-hidden="true">${icon}</span><span>${label}</span></a>`)}
      </nav>
      <button class="who" data-act="who-open" aria-label="Byt person">${ui.who || 'Vem är du?'}</button>
    </header>
    ${state.offline ? html`<div class="offline no-print" role="status">Du är offline. Du kan läsa listan, men inte ändra den.</div>` : ''}
    <main id="main" class="main" tabindex="-1">${content}</main>`;
}

function renderToast() {
  const t = ui.toast;
  $('#toast-root').innerHTML = t
    ? html`<div class="toast" role="status"><span>${t.text}</span>${t.undo ? html`<button data-act="toast-undo">Ångra</button>` : ''}</div>`.toString()
    : '';
}

function renderModal(force) {
  const root = $('#modal-root');
  const m = ui.modal;
  if (!m) {
    root.innerHTML = '';
    document.body.classList.remove('modal-open');
    return;
  }
  // Ritas inte om om det är ett formulär som redan är öppet
  if (!force && FORM_MODALS.has(m.type) && root.firstElementChild) return;
  const content = modalHtml(m);
  if (!content) { closeModal(); return; }
  root.innerHTML = content.toString();
  document.body.classList.add('modal-open');
  if (force) root.querySelector('.sheet')?.focus({ preventScroll: true });
}

function render() {
  const current = ROUTES[route()] ? route() : '';
  const y = window.scrollY;
  app.innerHTML = shell(ROUTES[current].page(), current).toString();
  window.scrollTo(0, y);
  document.title = `${ROUTES[current].title} · ${state.settings.title}`;
  renderToast();
  renderModal(false);
}

// ---------- Händelser ----------
async function run(fn, ...args) {
  try { await fn(...args); } catch (e) { showToast(e.message, null, 6000); }
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  const fn = el && actions[el.dataset.act];
  if (fn) run(fn, el, ev);
});

document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-change]');
  const fn = el && changes[el.dataset.change];
  if (fn) run(fn, el);
});

document.addEventListener('input', (ev) => {
  const el = ev.target.closest('[data-input]');
  const fn = el && inputs[el.dataset.input];
  if (fn) fn(el);
});

document.addEventListener('submit', (ev) => {
  const form = ev.target.closest('form[data-submit]');
  if (!form) return;
  ev.preventDefault();
  const fn = submits[form.dataset.submit];
  if (!fn) return;
  const buttons = [...form.querySelectorAll('button:not([type="button"])')];
  buttons.forEach((b) => { b.disabled = true; });
  run(fn, form).finally(() => buttons.forEach((b) => { b.disabled = false; }));
});

document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && ui.modal) closeModal(); });

document.addEventListener('ui:modal', () => renderModal(true));
document.addEventListener('ui:toast', renderToast);
document.addEventListener('ui:rerender', render);
window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); });

// ---------- Uppdatering från andra enheter ----------
let polling = false;
let pending = false;
const editing = () => app.contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);

onChange(() => {
  if (polling && editing()) { pending = true; return; }
  render();
});

document.addEventListener('focusout', () => {
  setTimeout(() => { if (pending && !editing()) { pending = false; render(); } }, 100);
});

async function poll() {
  if (document.hidden) return;
  polling = true;
  try { await refreshIfChanged(); } finally { polling = false; }
}
setInterval(poll, 10_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
window.addEventListener('online', poll);

// ---------- Start ----------
async function start() {
  app.innerHTML = '<p class="loading">Hämtar önskelistan…</p>';
  try {
    await load();
  } catch (e) {
    app.innerHTML = html`<div class="loading"><p>${e.message}</p><button class="btn primary" data-act="reload">Försök igen</button></div>`.toString();
    return;
  }
  render();
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
start();
