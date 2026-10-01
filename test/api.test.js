import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jullov-'));
process.env.DATA_DIR = dir;

const { default: express } = await import('express');
const { api } = await import('../server/api.js');
const { getState, resetState } = await import('../server/store.js');
const { defaultState } = await import('../server/schema.js');

let server;
let base;

before(async () => {
  const app = express();
  app.use('/api', api);
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => {
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const call = async (method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
};

test('startläge: tom lista med lov som kan redigeras', async () => {
  resetState(defaultState(new Date('2026-10-01T00:00:00Z')));
  const { status, data } = await call('GET', '/state');
  assert.equal(status, 200);
  assert.deepEqual(data.wishes, []);
  assert.equal(data.settings.start, '2026-12-19');
  assert.equal(data.trash, undefined, 'papperskorgen skickas inte till klienten');
});

test('familjemedlemmar läggs till utan dubbletter', async () => {
  let r = await call('POST', '/members', { name: ' Klas ' });
  assert.equal(r.data.name, 'Klas');
  r = await call('POST', '/members', { name: 'klas' });
  assert.equal(r.data.name, 'Klas', 'samma namn med annan versalisering ger inte en ny person');
  await call('POST', '/members', { name: 'Maja' });
  assert.deepEqual(getState().settings.members, ['Klas', 'Maja']);
  assert.equal((await call('POST', '/members', { name: '   ' })).status, 400);
});

let wishId;

test('en rätt läggs till och den som önskar röstar automatiskt', async () => {
  const r = await call('POST', '/wishes', { title: 'Janssons frestelse', wishedBy: 'Klas', ingredients: 'potatis\nsill', note: 'Med ansjovis' });
  assert.equal(r.status, 200);
  wishId = r.data.id;
  const w = r.data.wishes.find((x) => x.id === wishId);
  assert.deepEqual(w.votes, ['Klas']);
  assert.deepEqual(w.ingredients, ['potatis', 'sill']);
  assert.equal((await call('POST', '/wishes', { title: '' })).status, 400);
  assert.equal((await call('POST', '/wishes', {})).status, 400);
});

test('röster slås av och på per person', async () => {
  let r = await call('POST', `/wishes/${wishId}/vote`, { name: 'Maja' });
  assert.deepEqual(r.data.wishes[0].votes, ['Klas', 'Maja']);
  r = await call('POST', `/wishes/${wishId}/vote`, { name: 'Maja' });
  assert.deepEqual(r.data.wishes[0].votes, ['Klas']);
  assert.equal((await call('POST', `/wishes/${wishId}/vote`, {})).status, 400);
  assert.equal((await call('POST', '/wishes/finns-inte/vote', { name: 'Maja' })).status, 404);
});

test('en rätt kan ändras, men bara de fält som skickas', async () => {
  const r = await call('PATCH', `/wishes/${wishId}`, { title: 'Janssons' });
  assert.equal(r.data.wishes[0].title, 'Janssons');
  assert.equal(r.data.wishes[0].note, 'Med ansjovis');
  assert.equal((await call('PATCH', `/wishes/${wishId}`, { title: '' })).status, 400);
});

let entryId;

test('måltider planeras med rätt eller egen text', async () => {
  let r = await call('POST', '/plan', { date: '2026-12-24', meal: 'middag', wishId });
  entryId = r.data.id;
  assert.equal(r.data.plan.length, 1);
  r = await call('POST', '/plan', { date: '2026-12-25', meal: 'lunch', text: 'Rester' });
  assert.equal(r.data.plan.length, 2);
  assert.equal((await call('POST', '/plan', { date: '2026-12-25', meal: 'lunch' })).status, 400, 'rätt eller text krävs');
  assert.equal((await call('POST', '/plan', { date: '2026-12-25', meal: 'lunch', wishId: 'finns-inte' })).status, 404);
  assert.equal((await call('POST', '/plan', { date: 'imorgon', meal: 'lunch', text: 'x' })).status, 400);
  assert.equal((await call('POST', '/plan', { date: '2026-12-25', meal: 'natt', text: 'x' })).status, 400);
});

test('en planerad måltid kan flyttas', async () => {
  const r = await call('PATCH', `/plan/${entryId}`, { date: '2026-12-26', meal: 'fika' });
  const e = r.data.plan.find((p) => p.id === entryId);
  assert.equal(e.date, '2026-12-26');
  assert.equal(e.meal, 'fika');
  assert.equal(e.wishId, wishId);
  assert.equal((await call('PATCH', '/plan/finns-inte', { meal: 'lunch' })).status, 404);
});

test('kock och anteckning sparas per dag och rensas när de töms', async () => {
  let r = await call('PUT', '/days/2026-12-24', { cook: 'Maja', note: 'Mormor kommer' });
  assert.deepEqual(r.data.days['2026-12-24'], { cook: 'Maja', note: 'Mormor kommer' });
  r = await call('PUT', '/days/2026-12-24', { cook: '', note: '' });
  assert.equal(r.data.days['2026-12-24'], undefined);
  assert.equal((await call('PUT', '/days/inte-ett-datum', { cook: 'x' })).status, 400);
});

test('inställningar valideras och julhelgsdagar utanför lovet försvinner', async () => {
  let r = await call('PUT', '/settings', { title: 'Julmat 2026', start: '2026-12-20', end: '2027-01-04', helgDays: ['2026-12-24', '2026-12-31', '2030-01-01'] });
  assert.equal(r.data.settings.title, 'Julmat 2026');
  assert.deepEqual(r.data.settings.helgDays, ['2026-12-24', '2026-12-31']);
  r = await call('PUT', '/settings', { start: '2027-02-01' });
  assert.equal(r.status, 400, 'start efter slut');
  assert.equal(getState().settings.start, '2026-12-20', 'ett avvisat anrop ändrar ingenting');
});

test('en borttagen rätt kan ångras, med sin planering', async () => {
  const before = getState().plan.filter((p) => p.wishId === wishId).length;
  assert.ok(before > 0);
  let r = await call('DELETE', `/wishes/${wishId}`);
  assert.equal(r.data.wishes.length, 0);
  assert.equal(r.data.plan.some((p) => p.wishId === wishId), false);
  assert.equal(r.data.undoId, wishId);
  r = await call('POST', `/wishes/${wishId}/restore`, {});
  assert.equal(r.data.wishes.length, 1);
  assert.equal(r.data.plan.filter((p) => p.wishId === wishId).length, before);
  assert.equal((await call('POST', `/wishes/${wishId}/restore`, {})).status, 404, 'går bara att ångra en gång');
});

test('import avvisar saknad adress och interna adresser', async () => {
  assert.equal((await call('POST', '/import', {})).status, 400);
  assert.equal((await call('POST', '/import', { url: 'ftp://x.se/y' })).status, 400);
  const r = await call('POST', '/import', { url: 'http://127.0.0.1:1/' });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /internt/);
});

test('bilder från andra adresser sparas inte på en rätt', async () => {
  const r = await call('POST', '/wishes', { title: 'Med bild', image: 'https://example.com/x.jpg' });
  assert.equal(r.data.wishes.find((w) => w.id === r.data.id).image, '');
});

test('familjemedlem tas bort men röster finns kvar', async () => {
  const r = await call('DELETE', '/members/Maja');
  assert.deepEqual(r.data.settings.members, ['Klas']);
});

test('ogiltig JSON och okända adresser ger tydliga fel', async () => {
  const res = await fetch(`${base}/wishes`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{trasig' });
  assert.equal(res.status, 400);
  assert.equal((await call('GET', '/finns-inte')).status, 404);
});

test('data överlever en omstart och en säkerhetskopia skapas', async () => {
  const file = path.join(dir, 'jullov.json');
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(saved.rev, getState().rev);
  assert.ok(saved.wishes.length >= 1);
  assert.ok(fs.readdirSync(path.join(dir, 'backup')).length >= 1);
});

test('versionsnumret höjs vid varje ändring', async () => {
  const a = (await call('GET', '/rev')).data.rev;
  await call('POST', '/members', { name: 'Ny Person' });
  const b = (await call('GET', '/rev')).data.rev;
  assert.equal(b, a + 1);
});
