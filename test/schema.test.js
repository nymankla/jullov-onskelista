import test from 'node:test';
import assert from 'node:assert/strict';
import { wishFields, settingsFields, planFields, cleanImage, cleanUrl, lines, defaultState } from '../server/schema.js';

test('wishFields rensar och begränsar text', () => {
  const f = wishFields({
    title: '  Janssons   frestelse \n', note: 'a'.repeat(2000), url: 'javascript:alert(1)', servings: '4',
    ingredients: 'potatis\n\n  sill  \n', steps: ['Skiva', '', 'Grädda'],
  });
  assert.equal(f.title, 'Janssons frestelse');
  assert.equal(f.note.length, 1000);
  assert.equal(f.url, '', 'bara http och https tillåts');
  assert.equal(f.servings, 4);
  assert.deepEqual(f.ingredients, ['potatis', 'sill']);
  assert.deepEqual(f.steps, ['Skiva', 'Grädda']);
});

test('wishFields kräver namn men bara om titeln skickas med', () => {
  assert.throws(() => wishFields({ title: '   ' }), /namn/);
  assert.deepEqual(wishFields({ note: 'bara en anteckning' }), { note: 'bara en anteckning' });
});

test('portioner måste vara ett positivt tal', () => {
  assert.equal(wishFields({ servings: 0 }).servings, null);
  assert.equal(wishFields({ servings: '' }).servings, null);
  assert.equal(wishFields({ servings: 'många' }).servings, null);
  assert.equal(wishFields({ servings: 5000 }).servings, 100);
});

test('bara bilder som appen själv sparat godtas', () => {
  const ok = '/uploads/123e4567-e89b-12d3-a456-426614174000.jpg';
  assert.equal(cleanImage(ok), ok);
  assert.equal(cleanImage('https://example.com/x.jpg'), '');
  assert.equal(cleanImage('/uploads/../../etc/passwd'), '');
  assert.equal(cleanImage('/uploads/123e4567-e89b-12d3-a456-426614174000.svg'), '');
});

test('cleanUrl släpper bara igenom http(s)', () => {
  assert.equal(cleanUrl('https://www.ica.se/recept/x/'), 'https://www.ica.se/recept/x/');
  assert.equal(cleanUrl('ftp://x.se'), '');
  assert.equal(cleanUrl('inte en url'), '');
});

test('lines begränsar antal och längd', () => {
  assert.equal(lines(Array(200).fill('x'), 80, 10).length, 80);
  assert.equal(lines('abcdefghijkl', 5, 4)[0], 'abcd');
});

test('settingsFields kontrollerar datum och julhelgsdagar', () => {
  const cur = defaultState(new Date('2026-10-01T00:00:00Z')).settings;
  const ok = settingsFields({ start: '2026-12-20', end: '2027-01-04', helgDays: ['2026-12-24', '2026-12-25', '2030-01-01', '2026-12-24'] }, cur);
  assert.deepEqual(ok.helgDays, ['2026-12-24', '2026-12-25'], 'dubbletter och dagar utanför lovet försvinner');
  assert.throws(() => settingsFields({ start: '2027-01-10', end: '2027-01-04' }, cur), /före/);
  assert.throws(() => settingsFields({ start: '2026-02-30' }, cur), /datum/i);
  assert.throws(() => settingsFields({ start: '2026-01-01', end: '2026-12-31' }, cur), /60 dagar/);
});

test('settingsFields behåller rubriken om den töms', () => {
  const cur = defaultState(new Date('2026-10-01T00:00:00Z')).settings;
  assert.equal(settingsFields({ title: '   ' }, cur).title, cur.title);
});

test('planFields kräver giltigt datum och måltid', () => {
  assert.deepEqual(planFields({ date: '2026-12-24', meal: 'middag', text: ' Skinka ' }), { date: '2026-12-24', meal: 'middag', text: 'Skinka' });
  assert.throws(() => planFields({ date: 'imorgon', meal: 'middag' }), /datum/i);
  assert.throws(() => planFields({ date: '2026-12-24', meal: 'natt' }), /måltid/i);
});
