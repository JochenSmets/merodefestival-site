// Vaste teksten van de site, beheerd in Notion (database “Teksten (website)”).
//
// - T(sleutel, standaard) geeft de tekst uit Notion, of de standaardtekst als er niets is ingevuld.
// - Elke tekst die de site opvraagt wordt onthouden. Aan het einde van de bouw komt die lijst in
//   .build/teksten-catalogus.json; vul-teksten.mjs zet de ontbrekende teksten dan als nieuwe rijen in Notion.
// - pasHomepage() past de teksten toe op het sjabloon van de homepage (scripts/sjablonen/index.html).

import fs from "node:fs/promises";
import path from "node:path";

const register = new Map();
let TEKSTEN = {};
let wijzigingen = {};

const PAGINA = { menu: "Footer", footer: "Footer", wesp: "Over WESP", statistiek: "Algemeen", speler: "Algemeen", vrienden: "Algemeen", partners: "Algemeen", privacy: "Algemeen", homepage: "Homepage", seizoen: "Homepage", concert: "Concertpagina",
  algemeen: "Algemeen", edities: "Vorige edities", beleef: "Beleef de Merode", producties: "Producties", soort: "Producties", veld: "Producties" };
const UITLEG = { menu: "Menu bovenaan elke pagina", wesp: "Pagina Over WESP", statistiek: "Statistieken (token invullen om aan te zetten)", speler: "Spelers van Spotify en SoundCloud", vrienden: "Pagina Vrienden van Merodefestival", partners: "Pagina Partners", privacy: "Pagina Privacyverklaring", footer: "Onderaan elke pagina", homepage: "Homepage", seizoen: "Hoofdsectie bovenaan de homepage",
  concert: "Pagina van een concert", algemeen: "Op meerdere pagina’s", edities: "Pagina Vorige edities", beleef: "Pagina’s onder Beleef de Merode",
  producties: "Pagina’s onder Producties", soort: "Rubrieken op de pagina Producties", veld: "Gegevensblok bij een productie" };

const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const jsEsc = t => JSON.stringify(String(t)).slice(1, -1);
const eigen = k => (TEKSTEN[k] || "").trim();

export async function laadTeksten(ROOT) {
  try { TEKSTEN = JSON.parse(await fs.readFile(path.join(ROOT, "data/teksten.json"), "utf8")); }
  catch { TEKSTEN = {}; }
}

function reg(sleutel, standaard, uitleg) {
  if (register.has(sleutel)) return;
  const voor = sleutel.split(".")[0];
  register.set(sleutel, { sleutel, standaard: String(standaard ?? ""), pagina: PAGINA[voor] || "Overig", uitleg: uitleg || UITLEG[voor] || "" });
}

export function T(sleutel, standaard, uitleg) {
  reg(sleutel, standaard, uitleg);
  return eigen(sleutel) || standaard;
}

// ---------- seizoen (hoofdsectie van de homepage en de pagina’s met seizoensgegevens) ----------
export function seizoenOverrides(S) {
  const standaard = {
    titel: S.titel, jaren: S.jaren, kop: S.kop,
    intro: (S.intro || []).join("\n\n"),
    prijzen: (S.tickets || []).map(([k, v]) => `${k} | ${v}`).join("\n"),
    ticketlink: S.ticketlink, credit: S.credit, beeldbeschrijving: S.artworkAlt,
  };
  const uitleg = {
    titel: "Titel in de hoofdsectie van de homepage (bijvoorbeeld ‘kerk – concerten’)", jaren: "Seizoen onder de titel (bijvoorbeeld 2026–2027)",
    kop: "Kop boven de inleiding bij de agenda", intro: "Inleiding bij de agenda. Een lege regel maakt een nieuwe alinea.",
    prijzen: "Prijzen naast de agenda, één per regel als ‘Omschrijving | Prijs’", ticketlink: "Adres van de knoppen Tickets",
    credit: "Vermelding van de kunstenaar onder het seizoensbeeld", beeldbeschrijving: "Beschrijving van het seizoensbeeld voor wie het niet ziet",
  };
  const nieuw = { ...S };
  wijzigingen = {};
  for (const [k, d] of Object.entries(standaard)) {
    reg(`seizoen.${k}`, d || "", uitleg[k]);
    const n = eigen(`seizoen.${k}`);
    if (!n || n === (d || "")) continue;
    if (k === "intro") nieuw.intro = wijzigingen.intro = n.split(/\n{2,}/).map(x => x.trim()).filter(Boolean);
    else if (k === "prijzen") nieuw.tickets = wijzigingen.tickets = n.split(/\n+/).map(l => l.split("|").map(x => x.trim())).filter(r => r[0]);
    else if (k === "beeldbeschrijving") nieuw.artworkAlt = wijzigingen.artworkAlt = n;
    else nieuw[k] = wijzigingen[k] = n;
  }
  return nieuw;
}

// ---------- homepage ----------
// [sleutel, standaardtekst, uitleg, sjablonen]; {} is de plek van de tekst. Een sjabloon dat met " begint is een stukje programmacode.
const P = "<p>{}</p>";
const HOMEPAGE = [
  ["menu.agenda", "Agenda", "", ['<li><a href="#agenda">{}</a></li>']],
  ["menu.festival", "Festival 2027", "", ['<li><a href="#festival">{}</a></li>']],
  ["menu.beleef", "Beleef de Merode", "", ['<li><a href="#beleef">{}</a></li>']],
  ["menu.producties", "Producties", "", ['<li><a href="producties.html">{}</a></li>']],
  ["menu.wesp", "Over WESP", "", ['<li><a href="wesp.html">{}</a></li>']],
  ["menu.edities", "Vorige edities", "", ['<li><a href="vorige-edities.html">{}</a></li>']],
  ["menu.nieuwsbrief", "Nieuwsbrief", "", ['<li><a href="#nieuwsbrief">{}</a></li>']],
  ["menu.menu", "Menu", "Knop voor het menu op een telefoon", ['<button class="menu-toggle" aria-expanded="false" aria-controls="hoofdmenu">{}</button>']],
  ["menu.tickets", "Tickets", "Oranje knop rechtsboven", ['<a class="btn" id="tickets-top" href="https://wesp-vzw.pierrot.io/">{}</a>']],
  ["homepage.titel", "Merodefestival – folk en wereldmuziek in de kerken van de Merode", "Titel in het tabblad van de browser en in Google", ["<title>{}</title>"]],
  ["homepage.beschrijving", "Kerkconcerten met folk en wereldmuziek in de dorpskerken van Landschapspark de Merode, en elk Hemelvaartweekend het Merodefestival.", "Korte beschrijving die Google toont", ['<meta name="description" content="{}">']],
  ["homepage.tickets-knop", "Tickets bestellen", "Knop naast de inleiding bij de agenda", ['<a class="btn" id="intro-tickets" href="https://wesp-vzw.pierrot.io/">{}</a>']],
  ["homepage.agenda-kop", "Agenda", "Kop boven de lijst met concerten", ['<h2 class="label" style="font-size:1rem;margin-bottom:1.25rem;color:var(--s-papier-zacht)">{}</h2>']],
  ["homepage.toon-alles", "Toon de hele agenda", "Knop onder de agenda", ['<button class="btn toon-alles" id="toon-alles" aria-expanded="false">{}</button>', '"{}"']],
  ["homepage.toon-minder", "Toon minder", "Knop onder de agenda als alles getoond wordt", ['"{}"']],
  ["homepage.ook-kop", "Ook van WESP", "Titel van het blok met concerten uit andere reeksen", ['<h2 id="ook-wesp-titel">{}</h2>']],
  ["homepage.ook-intro", "Concerten in onze andere reeksen, buiten de Merode.", "Tekst naast de titel van dat blok", [P]],
  ["homepage.ook-meer", "Meer info ↗", "Link onderaan elke kaart in dat blok", ["{}<span class=\"sr\">"]],
  ["homepage.ook-extern", "(opent een andere website)", "Verborgen tekst voor schermlezers bij die link", ['<span class="sr"> {}</span>']],
  ["homepage.festival-datum", "Hemelvaartweekend 2027", "Datumregel boven het festival als de datum nog niet in de agenda staat", ['<p class="label fest-datum" id="fest-datum">{}</p>']],
  ["homepage.festival-voor", "Hemelvaartweekend", "Begin van de datumregel boven het festival (daarna volgen de datums)", ['"{} · "']],
  ["homepage.festival-titel", "Merodefestival 2027", "Titel van het blok over het festival", ['<h2 id="festival-titel">{}</h2>']],
  ["homepage.festival-intro", "Overdag wandel je met muzikanten door de mooiste natuurgebieden van de Merode. ’s Avonds speelt internationale folk op de Citadel van Diest. Het programma volgt in het voorjaar.", "Inleiding bij het festival", ['<p class="fest-intro">{}</p>']],
  ["homepage.festival-knop", "Meer over het festival", "Knop bij het festival", ['<a class="btn" id="fest-link" href="concert/merodefestival-2027.html">{}</a>']],
  ["homepage.festival-nieuwsbrief", "Hou me op de hoogte", "Tweede knop bij het festival", ['<a class="btn ghost" href="#nieuwsbrief">{}</a>']],
  ["homepage.festival-foto1", "Overdag: muzikale wandelingen door de natuur", "Onderschrift bij de eerste foto van het festival", ["<figcaption>{}</figcaption>"]],
  ["homepage.festival-foto2", "’s Avonds: folk op de Citadel", "Onderschrift bij de tweede foto van het festival", ["<figcaption>{}</figcaption>"]],
  ["homepage.edities-kop", "Sinds 2015", "Titel van het blok over de vorige edities", ['<h2 id="edities-titel">{}</h2>']],
  ["homepage.edities-intro", "Meer dan tien jaar folk in de Merode: elk jaar het beste van de Europese folkscene, en sinds 2017 ook een concertreeks door het jaar heen.", "Tekst bij dat blok", [P]],
  ["homepage.edities-knop", "Alle vorige edities", "Knop bij dat blok", ['<a class="btn" href="vorige-edities.html">{}</a>']],
  ["homepage.edities-fotos", "Foto’s en video’s", "Onder een jaartal zonder plaats in de tijdlijn", ['"{}"']],
  ["homepage.edities-geen", "Geen festival", "Onder een jaartal waarin geen festival was", ['"{}"']],
  ["homepage.beleef-kop", "Beleef de Merode, ook thuis", "Titel van het blok Beleef de Merode", ['<h2 id="beleef-titel">{}</h2>']],
  ["homepage.beleef-intro", "Muziek, verhalen en wandelingen om mee te nemen.", "Tekst onder die titel", ['<p class="beleef-intro">{}</p>']],
  ["homepage.beleef1-label", "Boek", "Kaart 1 in Beleef de Merode: label", ['<span class="label">{}</span><span class="naam">Ode aan de Merode</span>']],
  ["homepage.beleef1-naam", "Ode aan de Merode", "Kaart 1: titel", ['<span class="naam">{}</span><span class="uitleg">Negen verhalen']],
  ["homepage.beleef1-uitleg", "Negen verhalen, wandelingen, video’s en een afspeellijst.", "Kaart 1: uitleg", ['<span class="uitleg">{}</span>']],
  ["homepage.beleef2-label", "Podcast", "Kaart 2: label", ['<span class="label">{}</span><span class="naam">Wandelpodcast</span>']],
  ["homepage.beleef2-naam", "Wandelpodcast", "Kaart 2: titel", ['<span class="naam">{}</span>']],
  ["homepage.beleef2-uitleg", "Folkmuzikanten vertellen onderweg over hun muziek, en spelen in de natuur.", "Kaart 2: uitleg", ['<span class="uitleg">{}</span>']],
  ["homepage.beleef3-label", "Cd en vinyl", "Kaart 3: label", ['<span class="label">{}</span>']],
  ["homepage.beleef3-naam", "The Sound of the Abbey", "Kaart 3: titel", ['<span class="naam">{}</span>']],
  ["homepage.beleef3-uitleg", "Opnames uit de Abdij van Park, met dertien artiesten.", "Kaart 3: uitleg", ['<span class="uitleg">{}</span>']],
  ["homepage.beleef4-label", "Video’s", "Kaart 4: label", ['<span class="label">{}</span>']],
  ["homepage.beleef4-naam", "Volkscafés en volksliekes", "Kaart 4: titel", ['<span class="naam">{}</span>']],
  ["homepage.beleef4-uitleg", "Het muzikale erfgoed van de streek, in beeld.", "Kaart 4: uitleg", ['<span class="uitleg">{}</span>']],
  ["homepage.wesp-tekst", "Merodefestival is meer dan concerten. Als folkincubator creëren, begeleiden en verbinden we folk- en wereldmuziek in Vlaanderen, met het landschap als vertrekpunt.", "Strook over WESP onderaan de homepage", [P]],
  ["homepage.wesp-knop", "Ontdek wat WESP doet", "Knop in die strook", ['<a class="btn ghost" href="wesp.html">{}</a>']],
  ["homepage.nieuws-kop", "Mis geen concert", "Titel van de nieuwsbriefstrook", ['<h2 id="nieuws-titel">{}</h2>']],
  ["homepage.nieuws-tekst", "Nieuwe concerten en het festivalprogramma in je mailbox.", "Tekst in de nieuwsbriefstrook", [P]],
  ["homepage.nieuws-knop", "Schrijf je in", "Knop in de nieuwsbriefstrook", ['<a class="btn" href="http://eepurl.com/g8U9mX">{}</a>']],
  ["homepage.volzet", "Volzet", "Label bij een uitverkocht concert in de agenda", [">{}</span>"]],
  ["homepage.koop", "Koop tickets", "Knop bij het eerstvolgende concert", ['"{}"']],
  ["homepage.tickets-kort", "Tickets", "Knop bij een concert in de lijst", [' : "{}")']],
  ["homepage.eerstvolgende", "Eerstvolgende ·", "Begin van de regel boven het eerstvolgende concert", ['"{} "']],
  ["homepage.nu", "Nu te zien", "Datumregel als een concert bezig is", ['"{}"']],
  ["homepage.vanavond", "Vanavond", "Datumregel voor een concert van vandaag", ['"{}"']],
  ["homepage.morgen", "Morgen", "Datumregel voor een concert van morgen", ['"{}"']],
  ["homepage.deze", "Deze", "Datumregel voor een concert binnen een week (‘Deze zaterdag 7 maart’)", ['"{} "']],
  ["homepage.meer-concert", "Meer over dit concert", "Link naar de pagina van een concert", [">{}</a>", '"{}"']],
  ["homepage.meer-info", "Meer info", "Uitklapbare info bij een concert in de lijst", ["<summary>{}</summary>"]],
  ["homepage.kijk-luister", "Kijk en luister", "Link bij een concert met video of muziek", ['"{}"']],
  ["algemeen.foto", "Foto:", "Voor de naam van de fotograaf", ['"{} "']],
  ["footer.contact", "Contact", "Kop van de eerste kolom onderaan", ["<h3>{}</h3>"]],
  ["footer.organisatie", "Merodefestival is een project van WESP vzw, BE 0863 441 738, Jozef Wautersstraat 4, 3010 Kessel-Lo", "Gegevens van de organisatie onderaan", [P]],
  ["footer.volg", "Volg ons", "Kop van de tweede kolom onderaan", ["<h3>{}</h3>"]],
  ["footer.steun-kop", "Met steun van", "Kop van de derde kolom onderaan", ["<h3>{}</h3>"]],
  ["footer.steun", "De Vlaamse overheid, kunsten en erfgoed, de provincie Vlaams-Brabant, de Nationale Loterij en projectvereniging de Merode. Met de medewerking van de parochies en kerkfabrieken.", "Wie de site steunt, onderaan", [P]],
];

function pas(html, sleutel, sjablonen, standaard) {
  const nieuw = eigen(sleutel);
  if (!nieuw || nieuw === standaard) return html;
  for (const tpl of sjablonen) {
    const js = tpl.startsWith('"') || tpl.startsWith(" ");
    const inTekst = (t) => js ? jsEsc(t) : esc(t).replace(/\n/g, "<br>");
    let f = tpl.replace("{}", standaard);
    if (!html.includes(f)) f = tpl.replace("{}", esc(standaard));
    if (!html.includes(f)) { console.warn(`Tekst ‘${sleutel}’ niet gevonden in de homepage.`); continue; }
    const r = tpl.replace("{}", () => inTekst(nieuw));
    html = html.split(f).join(r);
  }
  return html;
}

export function pasHomepage(html) {
  for (const [sleutel, standaard, uitleg, sjablonen] of HOMEPAGE) {
    reg(sleutel, standaard, uitleg);
    html = pas(html, sleutel, sjablonen, standaard);
  }
  // Seizoensgegevens (titel, intro, prijzen...) worden in de pagina over de standaardwaarden heen gezet
  if (Object.keys(wijzigingen).length) {
    const inject = `<script>Object.assign(window.SEIZOEN, ${JSON.stringify(wijzigingen).replace(/</g, "\\u003c")});</script>`;
    html = html.replace('<script src="seizoen/seizoen.js"></script>', m => m + "\n" + inject);
  }
  return html;
}

export async function schrijfCatalogus(bestand) {
  await fs.mkdir(path.dirname(bestand), { recursive: true });
  await fs.writeFile(bestand, JSON.stringify([...register.values()], null, 2) + "\n");
  return register.size;
}
