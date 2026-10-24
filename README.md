# merodefestival.be

De website leest de **agenda** en de **producties** uit Notion. Elk uur haalt GitHub
de nieuwste versie op en zet ze online via Cloudflare Pages.

    Notion  →  GitHub (elk uur)  →  Cloudflare Pages  →  merodefestival.be

## Dagelijks gebruik

Alles gebeurt in Notion, op de pagina **Website Merodefestival – beheer**:

- **Agenda (website)**: één rij per concert. Vink *Online* aan om het te tonen.
  Voorbije data verdwijnen vanzelf van de site. Uitverkocht? Vink *Volzet* aan:
  de ticketknop wordt dan het label **Volzet**.
- **Website** bepaalt op welke site een concert verschijnt (Merodefestival, Holsbeek Sessies,
  Limburg Sessies, Klanken van de Steden, WESP). Leeg = Merodefestival. Op merodefestival.be
  staan enkel de Merode-concerten in de agenda; de eerstvolgende drie van de andere reeksen
  verschijnen apart in het blok *Ook van WESP*. Voor een andere site bouw je de pagina's met
  `SITE_NAAM="Holsbeek Sessies" node scripts/build-pages.mjs`.
- **Producties (website)**: de voorstellingen voor programmatoren. *Volgorde* bepaalt de plaats.
- **Foto**: sleep één liggende foto in het veld *Foto*, of plak een Google Drive-link in
  *Fotolink*. Zet het Drive-bestand dan op **Delen → Iedereen met de link**. De foto wordt
  automatisch opgehaald en verkleind; lukt dat niet, dan staat de reden in het logboek van
  GitHub Actions.
- **Twee teksten per concert.** *Beschrijving* is de korte tekst: die verschijnt op de homepage
  onder *Meer info*. De **uitgebreide tekst** schrijf je in de Notion-pagina zelf (klik een rij
  open en typ onder de eigenschappen): die komt op de concertpagina. Vet, cursief, opsommingen
  en citaten (blok *Quote*) worden overgenomen. Is de pagina leeg, dan toont de concertpagina
  de korte tekst.
- **Elk concert krijgt een eigen pagina** (`site/concert/…`), in de plaats van de blog op de
  oude site. Daarop staan ondertitel, herkomst, beschrijving, foto, een blok *Kijk en luister* met
  YouTube-video’s (veld *Video’s*) en Spotify-spelers (veld *Spotify*), telkens één link per regel,
  de praktische info met routelink, een knop *Zet in je agenda* en drie andere concerten.
  Een lege regel in de beschrijving maakt een nieuwe alinea.
- **Webadres** (optioneel) bepaalt het adres van die pagina, bv. `the-weaving` →
  merodefestival.be/concert/the-weaving.html. Leeg = automatisch uit naam en datum.
  Verander een webadres liever niet meer nadat je de link gedeeld hebt.

Binnen het uur staat alles online. Meteen publiceren: GitHub → **Actions** →
**Notion → website** → **Run workflow**.

## Eenmalige installatie (± 30 minuten)

### 1. Notion-koppeling
1. Ga naar https://www.notion.so/profile/integrations → **Nieuwe koppeling**.
   Naam: *Website Merodefestival*. Rechten: alleen **Inhoud lezen**.
2. Kopieer de geheime sleutel (begint met `ntn_`).
3. Open in Notion de pagina **Website Merodefestival – beheer** → `•••` →
   **Verbindingen** → voeg *Website Merodefestival* toe.
   Deel enkel deze pagina met de koppeling, niet de interne AGENDA.

### 2. GitHub
1. Maak een account op https://github.com en een nieuwe repository, bv. `merodefestival-site`.
2. Upload de inhoud van deze map (ook de verborgen map `.github`).
3. **Settings → Secrets and variables → Actions → New repository secret**, drie keer:
   - `NOTION_TOKEN` = de sleutel uit stap 1
   - `AGENDA_DB` = `b62d94be5f6c4177a988fe14895952fc`
   - `PRODUCTIES_DB` = `ed8cf4efcbc6475fa48c453554aaf010`
4. **Actions → Notion → website → Run workflow** voor een eerste test.

### 3. Cloudflare Pages
1. Maak een gratis account op https://dash.cloudflare.com.
2. **Workers & Pages → Create → Pages → Connect to Git** → kies de repository.
3. Build command: leeg laten. Build output directory: `site`.
4. Na de eerste publicatie: **Custom domains** → `merodefestival.be` en `www.merodefestival.be`.

Let op bij het verhuizen van het domein: neem de bestaande **MX-records** (e-mail)
mee naar de nieuwe DNS, anders komt er geen mail meer binnen.

## Vorige edities

De pagina `vorige-edities.html` en de tijdlijn op de homepage komen uit `site/data/edities.json`:
per jaar de plek, het programma, de fotografen en de YouTube-video’s (alleen de code na `v=`).
Na het festival voeg je bovenaan een nieuw jaar toe; de pagina wordt bij de volgende run vanzelf opnieuw gemaakt.

De kerkconcerten per seizoen staan in `site/data/kerkconcerten.json`. Per concert kan een YouTube-code (`video`) en per seizoen een brochurevoorkant (`brochure`, bv. `img/brochures/2025-2026.jpg`) worden toegevoegd. Affiches zet je als
`site/img/affiches/<jaar>.jpg`; ze verschijnen dan vanzelf bij het juiste festivaljaar.

## Seizoen wisselen

De homepage draagt de stijl van het lopende seizoen (nu de kerkconcerten 2026–2027,
artwork Reinhart Croon). Alles daarvoor staat in `site/seizoen/`:

- `seizoen.css`: de kleuren (achtergrond, accent, papier)
- `seizoen.js`: titel, jaartallen, introtekst en ticketprijzen
- `artwork.jpg` en `logo-oranje.png`: het beeld en het logo in de seizoenskleur

Nieuw seizoen? Vervang die vier bestanden; de rest van de site blijft ongemoeid.
Producties en Over WESP houden altijd de vaste huisstijl.

## Pierrot-koppeling: Volzet automatisch

Een kleine Cloudflare Worker (`pierrot-webhook/worker.js`) ontvangt de webhooks van
Pierrot, zoekt het concert in Notion via het veld **Pierrot-ID**, vinkt **Volzet** aan of
uit en laat de site meteen opnieuw bouwen.

    Pierrot  →  Worker  →  Notion (Volzet)  →  GitHub  →  website

### Installatie (± 20 minuten)

1. **Notion**: maak een tweede koppeling *Website – tickets* met de rechten
   **Inhoud lezen** én **Inhoud bijwerken**, en voeg ze toe aan de pagina
   *Website Merodefestival – beheer* (`•••` → Verbindingen).
2. **GitHub-token** (zodat de site niet op het uur wacht): GitHub → Settings →
   Developer settings → **Fine-grained tokens** → alleen deze repository →
   recht **Actions: Read and write**.
3. **Cloudflare**: Workers & Pages → **Create → Worker** → naam `pierrot-webhook` →
   **Edit code** → plak de inhoud van `worker.js` → **Deploy**.
   Daarna **Settings → Variables and Secrets**:
   - `WEBHOOK_KEY`: een zelfgekozen lang geheim woord
   - `NOTION_TOKEN`: de sleutel van *Website – tickets*
   - `AGENDA_DB`: `b62d94be5f6c4177a988fe14895952fc`
   - `GITHUB_TOKEN`: het token uit stap 2
   - `GITHUB_REPO`: bv. `wespvzw/merodefestival-site`
4. **Tijdelijk logboek**: Storage → **KV** → maak `pierrot-log` aan, en koppel het bij de
   Worker via **Settings → Bindings → KV** onder de naam `LOG`.
5. **Pierrot**: voeg een webhook toe met als adres
   `https://pierrot-webhook.<jouw-account>.workers.dev/pierrot?key=<WEBHOOK_KEY>`
   en kies de gebeurtenissen rond bestellingen, annulaties en (als die bestaat) uitverkocht.
6. **Notion**: vul per concert het veld **Pierrot-ID** in (het nummer of de korte naam
   van het evenement in Pierrot).

### Eerste test

Pierrot publiceert niet welke gegevens in een webhook zitten. Na de eerste bestelling
open je `https://pierrot-webhook.<jouw-account>.workers.dev/laatste?key=<WEBHOOK_KEY>`.
Daar zie je wat Pierrot stuurt en wat de Worker ervan begreep (`result`).
Staat daar `volzet: null`, dan moet alleen de functie `interpret()` in `worker.js`
worden aangepast aan het echte formaat.

Het logboek kan persoonsgegevens van kopers bevatten. Het wist zichzelf na 30 dagen;
verwijder de KV-koppeling zodra alles werkt.

Handmatig blijft altijd mogelijk: het vinkje *Volzet* in Notion werkt los van Pierrot.

## Wat waar staat

| Map / bestand | Inhoud |
|---|---|
| `site/` | De website zelf: de homepage (`index.html`) en de concertpagina’s |
| `later/` | Producties en Over WESP, voorlopig niet online |
| `site/img/` | Vaste sfeerbeelden |
| `site/data/` | Door Notion gevuld: `agenda.json/js`, `producties.json/js`, `foto/` |
| `scripts/sync-notion.mjs` | Haalt de gegevens uit Notion |
| `scripts/build-pages.mjs` | Maakt de concertpagina’s, agendabestanden en de sitemap |
| `site/concert/` | De gegenereerde concertpagina’s (niet met de hand aanpassen) |
| `.github/workflows/notion.yml` | Laat het script elk uur draaien |
| `pierrot-webhook/` | Worker die Volzet automatisch zet vanuit Pierrot |

Vaste teksten (Over WESP, formats, footer) staan rechtstreeks in de HTML.

## Beeldbank

Alle foto’s voor de site staan in de Notion-database **Beeldbank (website)** (onder “Website Merodefestival – beheer”).
Per foto: upload in *Foto* of een gedeelde Drive-link in *Fotolink*, een *Alt-tekst*, eventueel *Fotograaf* en *Jaar*,
en bij *Gebruik* waar ze verschijnt. Alles met *Homepage-carrousel* en *Online* aangevinkt verspringt op de homepage
naast het seizoensbeeld, in de volgorde van *Volgorde*. Foto’s die al in de site zitten verwijzen via *Lokaal bestand*.

### Foto’s bij een concert

In de Beeldbank koppel je een foto aan een concert via het veld **Concert** (zoek de artiest in de agenda).
Vink *Online* aan. Heeft het concert zelf nog geen foto, dan wordt de eerste gekoppelde foto de grote foto
bovenaan de concertpagina; extra foto’s verschijnen onder de tekst onder “Foto’s”, met de naam van de fotograaf.
In de agenda zie je de gekoppelde foto’s terug in het veld **Foto’s (beeldbank)**.

### Links in “Ook van WESP”

De kaarten linken naar een externe site: eerst het veld *Meer info* van het concert in Notion,
anders de website van de reeks uit `site/data/reeksen.js`, anders de ticketlink, anders wespvzw.be.

### Wisselend seizoensbeeld

Bovenaan de homepage wisselt het seizoensbeeld van Reinhart zacht af met foto’s uit de kerken.
Dat zijn de rijen in de Beeldbank met *Onderwerp* = Kerkconcert, *Gebruik* = Homepage-carrousel en *Online* aangevinkt,
in de volgorde van *Volgorde*. Een foto erbij of eruit regel je dus gewoon in Notion.

## Producties

De database **Producties (website)** in Notion bepaalt de pagina `producties.html` en per rij met *Online* aangevinkt een pagina `productie-<webadres>.html`.

- **Soort** bepaalt de rubriek: Podiumproductie, Installatie, Playlist of Concept op maat. Een rubriek zonder items verschijnt niet.
- **Volgorde** bepaalt de volgorde binnen een rubriek (laag getal = eerst).
- De korte tekst op de kaart komt uit *Tekst*, de uitgebreide tekst uit de Notion-pagina zelf (koppen, lijsten, vet en cursief werken).
- **Video’s**: één regel per video, als `link | titel`. YouTube en Vimeo spelen in de pagina. Een Vimeo-link met verborgen deel (`vimeo.com/1231680612/2276477c4b`) werkt ook. Een Vimeo-link zonder nummer wordt een gewone link.
- **Spotify** en **SoundCloud**: één link per regel, wordt een ingesloten speler.
- **Foto**: de eerste foto is de hoofdfoto, alle volgende komen als reeks onder de tekst. Een foto met doorzichtige achtergrond (PNG/WebP) blijft doorzichtig en staat op een lichte achtergrond.
- **Uitsnede** (midden, boven, onder, links, rechts, volledig tonen) bepaalt welk deel van de foto op de kaart zichtbaar blijft.
- **Knoptekst** en **Knoplink**: zonder link opent de knop een mail naar *Contact* (standaard info@merodefestival.be).
