# Jullovets matönskelista

Familjens önskelista över maten vi vill laga under jullovet, både julhelgen och lovdagarna. Webbapp som fungerar i webbläsare och på iPad (kan läggas till på hemskärmen). Alla enheter delar samma lista.

## Funktioner

- **Önskelista:** lägg till rätter med namn, vem som önskar, anteckning, länk, ingredienser och steg. Sök, filtrera (alla, ej planerade, planerade) och sortera (mest gillade, nyast, A till Ö).
- **Rösta:** varje person gillar sina favoriter med ♥. Den som önskar en rätt röstar automatiskt på den.
- **Hämta recept från internet:** klistra in en länk (koket.se, ica.se, arla.se med flera). Namn, bild, portioner, ingredienser och steg fylls i åt dig.
- **Dagsplan:** lägg rätter på dag och måltid (frukost, lunch, middag, fika, kvällsmat). Visa hela lovet, bara julhelgen eller bara lovdagarna.
- **Ansvarig kock** och en kort anteckning per dag.
- **Skriv ut** dagsplanen på papper eller som PDF, med en lista över önskemål som ännu inte fått en dag.
- **Ångra** när en rätt tas bort. Servern sparar dessutom en säkerhetskopia varje timme.
- Fungerar offline för läsning. Listan uppdateras av sig själv när någon annan ändrar.

Ingen inloggning: alla som har länken kan lägga till och ändra. Varje enhet väljer vem som använder den ("Vem är du?").

## Kom igång lokalt

Kräver Node.js 22.13 eller senare.

```bash
npm install
npm start               # http://localhost:3000
```

| Kommando | Vad det gör |
|---|---|
| `npm run dev` | Server som startar om vid ändringar |
| `npm test` | Tester för datum, validering, API och receptimport |
| `npm run icons` | Genererar appikonerna i `public/icons` |

Data sparas i `data/jullov.json` (finns inte i git).

## Driftsättning på Railway

Samma upplägg som receptpärmen. Varje push till `main` deployas automatiskt. Konfigurationen finns i [`railway.json`](railway.json): bygge med Railpack, start med `node server/index.js` och hälsokontroll mot `/healthz`.

**Första gången** (i Railways webbgränssnitt, med samma konto som receptpärmen):

1. **New Project, Deploy from GitHub repo** och välj det här repot.
2. **Lägg till en volym** innan listan används på riktigt: högerklicka på tjänsten, välj **Attach volume** och ange monteringssökväg, till exempel `/data`. Railway sätter då `RAILWAY_VOLUME_MOUNT_PATH` och appen sparar allt där. Utan volym försvinner önskemålen vid varje ny deploy.
3. Under **Settings, Networking** väljer du **Generate Domain** för att få en adress.
4. Öppna adressen på iPaden, tryck på dela-knappen i Safari och välj **Lägg till på hemskärmen**.

Inga variabler behöver sättas. Valfria:

| Variabel | Betydelse |
|---|---|
| `DATA_DIR` | Överstyr var data sparas (annars volymen, annars `./data`) |
| `PORT` | Sätts av Railway |

Eftersom ingen inloggning finns bör adressen bara delas inom familjen.

## Hur det hänger ihop

- `server/store.js` läser och skriver `jullov.json` atomiskt (tmp + rename) och tar säkerhetskopior i `backup/` (högst en per timme, de 30 senaste sparas). Om filen är trasig flyttas den undan och senaste kopian används.
- `server/schema.js` validerar allt som skrivs. Nya fält måste läggas till här, annars rensas de bort.
- `server/api.js` är hela REST-API:t under `/api`. Varje ändring höjer `rev`, och klienten kollar `/api/rev` var tionde sekund.
- `server/webimport.js` hämtar recept och bilder. All hämtning går via `safeFetch`, som blockerar interna adresser och kontrollerar varje omdirigering.
- `public/` är vanilla ES-moduler utan byggsteg. Höj `VERSION` i `public/sw.js` och uppdatera `SHELL_FILES` när klientfiler läggs till.
