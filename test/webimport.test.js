import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateIp, extractRecipeJsonLd, toWishDraft, instructionsToSteps, importFromUrl } from '../server/webimport.js';

test('privata och interna adresser blockeras', () => {
  for (const ip of ['127.0.0.1', '10.0.0.5', '192.168.1.1', '172.16.0.1', '172.31.255.255', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '172.32.0.1', '93.184.216.34', '2606:4700::1111']) assert.equal(isPrivateIp(ip), false, ip);
});

test('import vägrar adresser som pekar på den egna maskinen', async () => {
  await assert.rejects(importFromUrl('http://127.0.0.1:3000/'), /internt/);
  await assert.rejects(importFromUrl('http://localhost/'), /internt/);
  await assert.rejects(importFromUrl('file:///etc/passwd'), /http/);
});

const page = (ld) => `<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body></body></html>`;

test('recept hittas i JSON-LD, även inne i @graph', () => {
  const recipe = { '@type': 'Recipe', name: 'Pepparkakor' };
  assert.equal(extractRecipeJsonLd(page(recipe)).name, 'Pepparkakor');
  assert.equal(extractRecipeJsonLd(page({ '@graph': [{ '@type': 'WebSite' }, recipe] })).name, 'Pepparkakor');
  assert.equal(extractRecipeJsonLd(page({ '@type': 'Article' })), null);
  assert.equal(extractRecipeJsonLd('<script type="application/ld+json">{trasig</script>'), null);
});

test('schema.org-recept blir en önskad rätt', () => {
  const draft = toWishDraft({
    '@type': 'Recipe', name: 'Julskinka &amp; senap', description: '<p>Klassikern</p>', recipeYield: ['8', '8 portioner'],
    recipeIngredient: ['1 skinka', '  ', '2 dl senap'], image: { url: '/bild.jpg' },
    recipeInstructions: [{ '@type': 'HowToStep', text: 'Koka skinkan.' }, { '@type': 'HowToSection', itemListElement: [{ text: 'Pensla.' }] }],
  }, 'https://www.example.se/recept/skinka');
  assert.equal(draft.title, 'Julskinka & senap');
  assert.equal(draft.note, 'Klassikern');
  assert.equal(draft.servings, 8);
  assert.deepEqual(draft.ingredients, ['1 skinka', '2 dl senap']);
  assert.deepEqual(draft.steps, ['Koka skinkan.', 'Pensla.']);
  assert.equal(draft.imageUrl, 'https://www.example.se/bild.jpg');
  assert.equal(draft.host, 'example.se');
});

test('instruktioner som en enda sträng delas upp i steg', () => {
  assert.deepEqual(instructionsToSteps('1. Skala potatisen. 2. Koka den.'), ['Skala potatisen.', 'Koka den.']);
  assert.deepEqual(instructionsToSteps(undefined), []);
});
