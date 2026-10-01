import { html } from '../dom.js';
import { state, api } from '../api.js';
import { ui, setWho, showToast } from '../ui.js';
import { eachDay, formatDate, weekday } from '../lib/dates.js';
import { capital } from './common.js';

export function settingsPage() {
  const s = state.settings;
  const days = eachDay(s.start, s.end);
  return html`<section class="page narrow">
    <header class="page-head"><div><h1>Inställningar</h1><p class="sub">Gäller för hela familjen.</p></div></header>

    <form class="card form" data-submit="save-settings">
      <h2>Lovet</h2>
      <label class="field"><span>Rubrik</span><input name="title" value="${s.title}" maxlength="80" required></label>
      <div class="two">
        <label class="field"><span>Första lovdagen</span><input type="date" name="start" value="${s.start}" required></label>
        <label class="field"><span>Sista lovdagen</span><input type="date" name="end" value="${s.end}" required></label>
      </div>
      <fieldset class="field">
        <legend>Vilka dagar är själva julhelgen?</legend>
        <div class="chips">
          ${days.map((d) => html`<label class="chip"><input type="checkbox" name="helg" value="${d}" ${s.helgDays.includes(d) ? 'checked' : ''}><span>${capital(weekday(d)).slice(0, 3)} ${formatDate(d, { short: true })}</span></label>`)}
        </div>
        <p class="hint">Julhelgen visas för sig under Dagsplan. Övriga dagar är lovdagar.</p>
      </fieldset>
      <button class="btn primary">Spara</button>
    </form>

    <section class="card form">
      <h2>Familjen</h2>
      <p class="hint">Namnen används för önskemål, röster och ansvarig kock. Varje enhet väljer själv vem som använder den.</p>
      <ul class="people">
        ${s.members.map((m) => html`<li><span>${m}${m === ui.who ? html` <small class="muted">(du på den här enheten)</small>` : ''}</span>
          <button class="btn ghost small" data-act="member-remove" data-name="${m}" aria-label="Ta bort ${m}">Ta bort</button></li>`)}
      </ul>
      <form class="row" data-submit="member-add">
        <input name="name" maxlength="30" placeholder="Nytt namn" autocomplete="off" required aria-label="Nytt namn">
        <button class="btn">Lägg till</button>
      </form>
    </section>

    <section class="card form">
      <h2>Säkerhetskopia</h2>
      <p class="hint">Servern sparar automatiskt en kopia varje timme. Du kan också ladda ner allt som en fil.</p>
      <a class="btn" href="/api/export" download>Ladda ner alla önskemål</a>
    </section>
  </section>`;
}

export const settingsActions = {
  async 'member-remove'(el) {
    const name = el.dataset.name;
    await api.removeMember(name);
    if (ui.who === name) setWho('');
    showToast(`${name} togs bort. Tidigare röster och önskemål finns kvar.`);
  },
};

export const settingsSubmits = {
  async 'save-settings'(form) {
    const f = new FormData(form);
    await api.saveSettings({
      title: f.get('title'), start: f.get('start'), end: f.get('end'), helgDays: f.getAll('helg'),
    });
    showToast('Inställningarna är sparade');
  },
  async 'member-add'(form) {
    const name = new FormData(form).get('name');
    const data = await api.addMember(name);
    if (!ui.who) setWho(data.name);
    form.reset();
  },
};
