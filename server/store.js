// All data ligger i en JSON-fil. Skrivningar sker atomiskt (tmp + rename) och en säkerhetskopia tas högst en gång i timmen.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultState } from './schema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// På Railway pekar RAILWAY_VOLUME_MOUNT_PATH på den persistenta volymen
export const DATA_DIR = path.resolve(ROOT, process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const BACKUP_DIR = path.join(DATA_DIR, 'backup');
const FILE = path.join(DATA_DIR, 'jullov.json');
const MAX_BACKUPS = 30;
const BACKUP_EVERY_MS = 60 * 60 * 1000;
const MAX_TRASH = 30;

for (const d of [DATA_DIR, UPLOADS_DIR, BACKUP_DIR]) fs.mkdirSync(d, { recursive: true });

function readState(file) {
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  const base = defaultState();
  return {
    ...base,
    ...s,
    settings: { ...base.settings, ...s.settings },
    wishes: s.wishes ?? [],
    plan: s.plan ?? [],
    days: s.days ?? {},
    trash: s.trash ?? [],
  };
}

function latestBackup() {
  return fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json')).sort().at(-1);
}

function load() {
  if (!fs.existsSync(FILE)) return defaultState();
  try {
    return readState(FILE);
  } catch (e) {
    // Trasig fil: spara undan den och försök med senaste säkerhetskopian
    const broken = `${FILE}.trasig-${Date.now()}`;
    fs.renameSync(FILE, broken);
    console.error(`Datafilen kunde inte läsas (${e.message}). Flyttad till ${broken}`);
    const b = latestBackup();
    if (b) {
      console.error(`Återställer från säkerhetskopian ${b}`);
      return readState(path.join(BACKUP_DIR, b));
    }
    return defaultState();
  }
}

let state = load();
let lastBackupAt = 0;

function backup() {
  if (Date.now() - lastBackupAt < BACKUP_EVERY_MS) return;
  lastBackupAt = Date.now();
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13); // 20261201T1530
  fs.copyFileSync(FILE, path.join(BACKUP_DIR, `jullov-${stamp}.json`));
  const all = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json')).sort();
  for (const old of all.slice(0, Math.max(0, all.length - MAX_BACKUPS))) fs.rmSync(path.join(BACKUP_DIR, old), { force: true });
}

function persist() {
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, FILE);
  try { backup(); } catch (e) { console.error('Säkerhetskopian misslyckades:', e.message); }
}

if (!fs.existsSync(FILE)) persist();

export const getState = () => state;

/** Det klienten får se. Papperskorgen skickas inte med. */
export const publicState = () => ({
  rev: state.rev,
  settings: state.settings,
  wishes: state.wishes,
  plan: state.plan,
  days: state.days,
});

/** Kör en ändring, höjer versionen och sparar. Validera före anropet: ändringen ska inte kunna misslyckas halvvägs. */
export function commit(mutator) {
  const result = mutator(state);
  state.rev += 1;
  state.trash = state.trash.slice(-MAX_TRASH);
  persist();
  return result;
}

/** Bara för tester. */
export function resetState(next = defaultState()) {
  state = next;
  persist();
}
