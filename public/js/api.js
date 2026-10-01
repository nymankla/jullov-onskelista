// Klientens enda datalager och all kommunikation med servern.
export const state = {
  rev: 0,
  settings: { title: 'Jullovets matönskelista', start: '', end: '', helgDays: [], members: [] },
  wishes: [],
  plan: [],
  days: {},
  ready: false,
  offline: false,
};

const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = () => listeners.forEach((fn) => fn());

function apply(data) {
  const { undoId, id, name, ...snapshot } = data;
  Object.assign(state, snapshot, { ready: true, offline: false });
  notify();
}

async function request(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    state.offline = true;
    notify();
    throw new Error('Ingen kontakt med servern. Försök igen när du är online.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Något gick fel');
  // Svar från cachen (offline) får aldrig skrivas som om de vore sparade
  if (res.headers.get('x-from-cache') && method !== 'GET') throw new Error('Du är offline');
  state.offline = res.headers.get('x-from-cache') === '1';
  return data;
}

async function mutate(method, url, body) {
  const data = await request(method, url, body);
  apply(data);
  return data;
}

export async function load() {
  const data = await request('GET', '/api/state');
  apply(data);
}

/** Hämtar bara om servern har en nyare version. Returnerar true om något ändrades. */
export async function refreshIfChanged() {
  try {
    const { rev } = await request('GET', '/api/rev');
    if (rev === state.rev) return false;
    await load();
    return true;
  } catch {
    return false;
  }
}

export const api = {
  addWish: (w) => mutate('POST', '/api/wishes', w),
  updateWish: (id, w) => mutate('PATCH', `/api/wishes/${id}`, w),
  deleteWish: (id) => mutate('DELETE', `/api/wishes/${id}`),
  restoreWish: (id) => mutate('POST', `/api/wishes/${id}/restore`, {}),
  vote: (id, name) => mutate('POST', `/api/wishes/${id}/vote`, { name }),
  addPlan: (p) => mutate('POST', '/api/plan', p),
  movePlan: (id, p) => mutate('PATCH', `/api/plan/${id}`, p),
  removePlan: (id) => mutate('DELETE', `/api/plan/${id}`),
  setDay: (date, d) => mutate('PUT', `/api/days/${date}`, d),
  saveSettings: (s) => mutate('PUT', '/api/settings', s),
  addMember: (name) => mutate('POST', '/api/members', { name }),
  removeMember: (name) => mutate('DELETE', `/api/members/${encodeURIComponent(name)}`),
  importRecipe: (url) => request('POST', '/api/import', { url }),
};

export const wishById = (id) => state.wishes.find((w) => w.id === id);
