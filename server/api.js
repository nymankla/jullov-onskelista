import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import { getState, publicState, commit, UPLOADS_DIR } from './store.js';
import { wishFields, settingsFields, planFields, cleanName, cleanUrl, str, text, httpError } from './schema.js';
import { importFromUrl, fetchImage } from './webimport.js';
import { isISODate } from '../public/js/lib/dates.js';

export const api = express.Router();
api.use(express.json({ limit: '100kb' }));

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const findWish = (s, id) => s.wishes.find((w) => w.id === id) ?? (() => { throw httpError(404, 'Rätten finns inte längre'); })();
const reply = (res, extra = {}) => res.json({ ...publicState(), ...extra });

// ---------- Läsa ----------
api.get('/state', (req, res) => res.json(publicState()));
api.get('/rev', (req, res) => res.json({ rev: getState().rev }));

api.get('/export', (req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="jullov-onskelista.json"');
  res.json(getState());
});

// ---------- Önskade rätter ----------
api.post('/wishes', (req, res) => {
  const fields = wishFields({ title: '', ...req.body });
  const wish = commit((s) => {
    const w = {
      id: uuid(), note: '', url: '', wishedBy: '', servings: null, ingredients: [], steps: [], image: '',
      ...fields, votes: [], createdAt: now(),
    };
    // Den som önskar rätten röstar på den automatiskt
    if (w.wishedBy) w.votes.push(w.wishedBy);
    s.wishes.push(w);
    return w;
  });
  reply(res, { id: wish.id });
});

api.patch('/wishes/:id', (req, res) => {
  const fields = wishFields(req.body);
  findWish(getState(), req.params.id);
  commit((s) => Object.assign(findWish(s, req.params.id), fields));
  reply(res);
});

api.delete('/wishes/:id', (req, res) => {
  findWish(getState(), req.params.id);
  commit((s) => {
    const wish = findWish(s, req.params.id);
    const removed = s.plan.filter((p) => p.wishId === wish.id);
    s.wishes = s.wishes.filter((w) => w.id !== wish.id);
    s.plan = s.plan.filter((p) => p.wishId !== wish.id);
    s.trash.push({ wish, plan: removed, deletedAt: now() });
  });
  reply(res, { undoId: req.params.id });
});

api.post('/wishes/:id/restore', (req, res) => {
  const entry = getState().trash.find((t) => t.wish.id === req.params.id);
  if (!entry) throw httpError(404, 'Det går inte att ångra längre');
  commit((s) => {
    s.trash = s.trash.filter((t) => t !== entry);
    s.wishes.push(entry.wish);
    s.plan.push(...entry.plan);
  });
  reply(res);
});

api.post('/wishes/:id/vote', (req, res) => {
  const name = cleanName(req.body?.name);
  if (!name) throw httpError(400, 'Välj vem du är först');
  findWish(getState(), req.params.id);
  commit((s) => {
    const w = findWish(s, req.params.id);
    w.votes = w.votes.includes(name) ? w.votes.filter((v) => v !== name) : [...w.votes, name];
  });
  reply(res);
});

// ---------- Planering ----------
api.post('/plan', (req, res) => {
  const fields = planFields(req.body);
  const wishId = req.body?.wishId ?? null;
  if (wishId) findWish(getState(), wishId);
  else if (!fields.text) throw httpError(400, 'Skriv vad som ska lagas eller välj en önskad rätt');
  const entry = commit((s) => {
    const e = { id: uuid(), ...fields, wishId, createdAt: now() };
    s.plan.push(e);
    return e;
  });
  reply(res, { id: entry.id });
});

api.patch('/plan/:id', (req, res) => {
  const current = getState().plan.find((p) => p.id === req.params.id);
  if (!current) throw httpError(404, 'Platsen i planen finns inte längre');
  const fields = planFields({ ...current, ...req.body });
  commit((s) => Object.assign(s.plan.find((p) => p.id === req.params.id), fields));
  reply(res);
});

api.delete('/plan/:id', (req, res) => {
  commit((s) => { s.plan = s.plan.filter((p) => p.id !== req.params.id); });
  reply(res);
});

// ---------- Dagar: ansvarig kock och anteckning ----------
api.put('/days/:date', (req, res) => {
  if (!isISODate(req.params.date)) throw httpError(400, 'Ogiltigt datum');
  const day = { cook: cleanName(req.body?.cook), note: text(req.body?.note, 300) };
  commit((s) => {
    if (!day.cook && !day.note) delete s.days[req.params.date];
    else s.days[req.params.date] = day;
  });
  reply(res);
});

// ---------- Inställningar och familjemedlemmar ----------
api.put('/settings', (req, res) => {
  const fields = settingsFields(req.body, getState().settings);
  commit((s) => Object.assign(s.settings, fields));
  reply(res);
});

api.post('/members', (req, res) => {
  const name = cleanName(req.body?.name);
  if (!name) throw httpError(400, 'Skriv ett namn');
  const { members } = getState().settings;
  if (!members.some((m) => m.toLowerCase() === name.toLowerCase()) && members.length >= 20) throw httpError(400, 'Det får högst vara 20 personer');
  commit((s) => {
    if (!s.settings.members.some((m) => m.toLowerCase() === name.toLowerCase())) s.settings.members.push(name);
  });
  reply(res, { name: getState().settings.members.find((m) => m.toLowerCase() === name.toLowerCase()) });
});

api.delete('/members/:name', (req, res) => {
  commit((s) => { s.settings.members = s.settings.members.filter((m) => m !== req.params.name); });
  reply(res);
});

// ---------- Hämta recept från internet ----------
const hits = [];
function rateLimit(limit, windowMs) {
  const t = Date.now();
  while (hits.length && t - hits[0] > windowMs) hits.shift();
  if (hits.length >= limit) throw httpError(429, 'Vänta en stund innan du hämtar fler recept');
  hits.push(t);
}

api.post('/import', async (req, res) => {
  const url = cleanUrl(req.body?.url);
  if (!url) throw httpError(400, 'Klistra in en webbadress som börjar med https://');
  rateLimit(20, 60_000);
  const { imageUrl, host, ...draft } = await importFromUrl(url);
  let image = '';
  if (imageUrl) {
    const img = await fetchImage(imageUrl);
    if (img) {
      image = `/uploads/${uuid()}.${img.ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, path.basename(image)), img.body);
    }
  }
  res.json({ ...draft, title: str(draft.title, 120), image, host });
});

// ---------- Fel ----------
api.use((req, res) => res.status(404).json({ error: 'Okänd adress' }));
// eslint-disable-next-line no-unused-vars
api.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Ogiltig data' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'För mycket data' });
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Något gick fel på servern' : err.message });
});
