# CLAUDE.md

Familjens matönskelista för jullovet: en webbapp (PWA, även för iPad) och en Node/Express-server. Alla enheter delar samma lista. Ingen inloggning, och varje enhet väljer själv vem som använder den ("Vem är du?"). Allt användargränssnitt, all text och alla kommentarer är på **svenska**.

## Kommandon

```bash
npm start        # server på :3000 (läser .env om den finns)
npm run dev      # node --watch
npm test         # node:test, test/*.test.js
npm run icons    # public/icons via sharp
```

Kräver Node.js 22.13 eller senare.

## Arkitektur

- **All data ligger i en enda fil, `data/jullov.json`** (`DATA_DIR` → `RAILWAY_VOLUME_MOUNT_PATH` → `./data`). Där finns `rev`, `settings` (title, start, end, helgDays, members), `wishes`, `plan`, `days` och `trash`. Uppladdade bilder ligger i `uploads/` och säkerhetskopior i `backup/`.
- `server/store.js`: hela tillståndet hålls i minnet. **Alla ändringar går via `commit(mutator)`**, som höjer `rev` och sparar atomiskt (tmp + rename). Validera före `commit`, eftersom en ändring inte ska kunna misslyckas halvvägs. Säkerhetskopia tas högst en gång i timmen och de 30 senaste sparas. En trasig datafil flyttas undan och ersätts av den senaste kopian. `publicState()` skickar inte med `trash`.
- `server/schema.js`: `wishFields`, `settingsFields` och `planFields` validerar och rensar all indata. **Nya fält måste läggas till här**, annars rensas de bort. `defaultState()` ger tomt tillstånd. Bilder accepteras bara som `/uploads/<uuid>.(jpg|png|webp)`.
- `server/api.js`: hela REST-API:t under `/api`. Skrivande anrop svarar med hela `publicState()`, som klienten lägger in direkt. `GET /api/rev` används för att se om något har ändrats. Borttagna rätter (med sin plan) hamnar i `trash` och kan återställas via `/wishes/:id/restore`.
- `server/webimport.js`: receptimport från URL via schema.org/Recipe i JSON-LD, plus bildhämtning. **All hämtning från internet går via `safeFetch`**, som blockerar privata IP-adresser, kontrollerar varje omdirigering och har storleksgränser.
- `public/js/lib/` (`dates`, `meals`): **delad logik** för server, klient och tester. Håll dem fria från DOM- och Node-beroenden. Datum är ISO-strängar och räknas i UTC.

## Klienten

- Vanilla ES-moduler utan byggsteg. `app.js` har routingtabellen (hash-routing: `''`, `plan`, `skriv-ut`, `installningar`) och renderar om hela sidan vid varje ändring.
- Händelser hanteras genom delegering. Element har `data-act`, `data-change`, `data-input` eller `form[data-submit]`, och varje vy i `views/` exporterar motsvarande objekt (`wishActions`, `planChanges`, `settingsSubmits`, …) som slås ihop i `app.js`. Lägg till nya handlingar där, inte med egna `addEventListener`.
- `state` i `api.js` är klientens enda datalager och fylls av serverns svar. `ui.js` håller tillstånd som bara gäller gränssnittet (vem, sökning, filter, modal, toast). "Vem är du?" sparas i `localStorage`.
- Klienten frågar `/api/rev` var tionde sekund. Medan någon skriver i ett fält skjuts omritningen upp tills fältet lämnas.
- HTML byggs med den taggade mallen `html` i `dom.js`, som escapar allt. Använd `html\`\`` för nästlade fragment och aldrig råa strängar med attribut.
- `sw.js`: network-first med cache som reserv (offline går bara att läsa). **Höj `VERSION`** och uppdatera `SHELL_FILES` när klientfiler läggs till.

## Driftsättning (Railway)

- `railway.json` + `.github/workflows/test.yml`. Railway deployar vid push till `main`. Hälsokontrollen går mot `/healthz`, och servern stänger ner snyggt på SIGTERM.
- Utan volym försvinner datan vid varje deploy, så en volym måste vara monterad. Inga miljövariabler krävs.

## Stil

- Färgtokens finns i `public/css/app.css` (`--green #1d4b38`, `--berry #a3262f`, `--gold #c9a55a`, `--cream`). Rubriker har Cormorant Garamond och brödtext Inter, båda självhostade via `@fontsource` (`/fonts/...`).
- Pekytor ska vara minst 44 px, och layouten ska fungera på iPad i både stående och liggande läge.
- Utskrift styrs av `print.css` (klasserna `no-print` och `print-only`).
