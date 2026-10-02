// Gränssnittets tillstånd som inte sparas på servern.
const KEY = 'jullov.who';
const read = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };

export const ui = {
  who: read(),
  q: '',
  filter: 'alla', // alla | oplanerade | planerade
  sort: 'populara', // populara | nyast | namn
  planTab: 'alla', // alla | helg | lov
  handlaDays: [], // valda datum för inköpslistan
  handlaChecked: new Set(), // ikryssade varor, nyckel "planId:index"
  modal: null, // { type, ...data }
  toast: null, // { text, undo? }
};

export function setWho(name) {
  ui.who = name;
  try { localStorage.setItem(KEY, name); } catch { /* privat läge */ }
}

export function openModal(modal) {
  ui.modal = modal;
  document.dispatchEvent(new Event('ui:modal'));
}

export function closeModal() {
  ui.modal = null;
  document.dispatchEvent(new Event('ui:modal'));
}

let toastTimer;
export function showToast(text, undo = null, ms = 7000) {
  ui.toast = { text, undo };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, ms);
  document.dispatchEvent(new Event('ui:toast'));
}

export function hideToast() {
  clearTimeout(toastTimer);
  ui.toast = null;
  document.dispatchEvent(new Event('ui:toast'));
}
