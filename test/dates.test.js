import test from 'node:test';
import assert from 'node:assert/strict';
import { parseISO, isISODate, eachDay, addDays, weekday, isWeekend, formatDate, defaultBreak } from '../public/js/lib/dates.js';

test('parseISO avvisar datum som inte finns', () => {
  assert.equal(isISODate('2026-12-24'), true);
  assert.equal(isISODate('2026-02-30'), false);
  assert.equal(isISODate('2026-13-01'), false);
  assert.equal(isISODate('24 december'), false);
  assert.equal(parseISO(undefined), null);
});

test('eachDay ger alla dagar inklusive start och slut, även över årsskiftet', () => {
  const days = eachDay('2026-12-30', '2027-01-02');
  assert.deepEqual(days, ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  assert.deepEqual(eachDay('2026-12-24', '2026-12-24'), ['2026-12-24']);
});

test('eachDay ger tom lista för ogiltigt intervall', () => {
  assert.deepEqual(eachDay('2027-01-02', '2026-12-30'), []);
  assert.deepEqual(eachDay('x', '2026-12-30'), []);
});

test('eachDay påverkas inte av sommartid', () => {
  assert.equal(eachDay('2026-03-27', '2026-03-30').length, 4);
  assert.equal(eachDay('2026-10-24', '2026-10-27').length, 4);
});

test('veckodagar och formatering på svenska', () => {
  assert.equal(weekday('2026-12-24'), 'torsdag');
  assert.equal(weekday('2026-12-19'), 'lördag');
  assert.equal(isWeekend('2026-12-19'), true);
  assert.equal(isWeekend('2026-12-24'), false);
  assert.equal(formatDate('2026-12-24'), '24 december');
  assert.equal(formatDate('2027-01-03', { short: true }), '3 jan');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('defaultBreak väljer lovet som kommer härnäst', () => {
  assert.deepEqual(defaultBreak(new Date('2026-10-01T12:00:00Z')), {
    start: '2026-12-19', end: '2027-01-03', helgDays: ['2026-12-24', '2026-12-25', '2026-12-26'],
  });
  // Mitt i januari räknas fortfarande det lov som just varit
  assert.equal(defaultBreak(new Date('2027-01-02T12:00:00Z')).start, '2026-12-19');
});
