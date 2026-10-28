// Haalt de agenda en de producties uit Notion en schrijft ze naar site/data/.
// Draait automatisch via GitHub Actions (zie .github/workflows/notion.yml).
// Nodig: NOTION_TOKEN, AGENDA_DB en PRODUCTIES_DB als omgevingsvariabelen.

import fs from "node:fs/promises";
import path from "node:path";
import { verwerkFoto } from "./foto.mjs";

const TOKEN = process.env.NOTION_TOKEN;
const AGENDA_DB = process.env.AGENDA_DB;
const PRODUCTIES_DB = process.env.PRODUCTIES_DB;
// Beeldbank: standaard de database “Beeldbank (website)”; overschrijfbaar met BEELDBANK_DB.
const BEELDBANK_DB = process.env.BEELDBANK_DB || "4194280648e841659ebdef6307358815";
// Teksten: standaard de database “Teksten (website)”; overschrijfbaar met TEKSTEN_DB.
const TEKSTEN_DB = process.env.TEKSTEN_DB || "57e78e458ed5461f8166cafdb391d7af";
if (!TOKEN || !AGENDA_DB || !PRODUCTIES_DB) {
  console.error("NOTION_TOKEN, AGENDA_DB en PRODUCTIES_DB moeten ingesteld zijn.");
  process.exit(1);
}

const OUT = path.resolve("site/data");
const FOTO = path.join(OUT, "foto");
let sharp = null;
try { sharp = (await import("sharp")).default; }
catch { console.log("sharp niet gevonden: foto’s worden niet verkleind."); }

async function notion(url, body) {
  const res = await fetch("https://api.notion.com/v1/" + url, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + TOKEN,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`);
  return res.json();
}

async function queryAll(db, sorts) {
  const rows = [];
  let cursor;
  do {
    const r = await notion(`databases/${db}/query`, {
      filter: { property: "Online", checkbox: { equals: true } },
      sorts, start_cursor: cursor, page_size: 100,
    });
    rows.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return rows;
}

// Een Notion-eigenschap omzetten naar gewone tekst
const text = p => !p ? "" :
  p.type === "title" ? p.title.map(t => t.plain_text).join("") :
  p.type === "rich_text" ? p.rich_text.map(t => t.plain_text).join("") :
  p.type === "url" ? (p.url || "") :
  p.type === "select" ? (p.select?.name || "") :
  p.type === "number" ? String(p.number ?? "") : "";

// De uitgebreide tekst staat in de pagina zelf (onder de eigenschappen in Notion).
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const richHtml = rt => (rt || []).map(x => {
  let h = esc(x.plain_text);
  const a = x.annotations || {};
  if (a.bold) h = `<strong>${h}</strong>`;
  if (a.italic) h = `<em>${h}</em>`;
  if (x.href) h = `<a href="${esc(x.href)}">${h}</a>`;
  return h;
}).join("");
const BLOK = { paragraph: "p", bulleted_list_item: "li", numbered_list_item: "li", quote: "quote", heading_1: "h", heading_2: "h", heading_3: "h" };
async function blokken(id) {
  const out = [];
  let cursor;
  do {
    const r = await notion(`blocks/${id}/children?page_size=100${cursor ? "&start_cursor=" + cursor : ""}`);
    for (const b of r.results) {
      const type = BLOK[b.type];
      if (!type) continue;
      const html = richHtml(b[b.type].rich_text);
      if (html.trim()) out.push({ type, html });
    }
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return out;
}

// Rijkere versie voor de productiepagina’s: koppen, lijsten (genummerd of niet) en citaten.
const RIJK = { paragraph: "p", heading_1: "h2", heading_2: "h2", heading_3: "h3", bulleted_list_item: "ul", numbered_list_item: "ol", quote: "quote" };
async function blokkenRijk(id) {
  const out = [];
  let cursor;
  do {
    const r = await notion(`blocks/${id}/children?page_size=100${cursor ? "&start_cursor=" + cursor : ""}`);
    for (const b of r.results) {
      const type = RIJK[b.type];
      if (!type) continue;
      const html = richHtml(b[b.type].rich_text).replace(/\n/g, "<br>");
      if (html.trim()) out.push({ type, html });
    }
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return out;
}

// Eén link per regel, eventueel met titel: "https://… | Titel"
const regelsMetTitel = p => text(p).split(/\n+/).map(l => l.trim()).filter(Boolean).map(l => {
  const [url, ...rest] = l.split("|");
  return { url: url.trim(), titel: rest.join("|").trim() };
}).filter(x => /^https?:\/\//.test(x.url));
// Eén item per regel (zonder titel)
const regels = p => text(p).split(/\n+/).map(l => l.trim()).filter(Boolean);
// Een eigenschap zoeken, ook als de naam met een andere apostrof geschreven is
const prop = (p, ...namen) => { for (const n of namen) if (p[n]) return p[n]; return undefined; };

// Meerdere links in één tekstveld: één per regel (of gescheiden door spaties)
const lines = p => text(p).split(/\s+/).filter(x => /^https?:\/\//.test(x));

// Een gedeelde Google Drive-link omzetten naar een rechtstreekse download.
// Werkt voor links zoals drive.google.com/file/d/<id>/view en drive.google.com/open?id=<id>.
export function directLink(url) {
  const m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([\w-]{20,})/);
  return m ? `https://drive.google.com/uc?export=download&id=${m[1]}` : url;
}

// Foto’s uit Notion verlopen na een uur, dus we downloaden ze naar de site.
// Volgorde: eerst het veld Foto (upload of ingesloten link), anders het veld Fotolink.
// Enkel echt doorzichtige beelden blijven PNG, de rest wordt JPEG (zie foto.mjs).
const used = new Set();
async function haalFoto(url, sleutel) {
  url = directLink(url);
  let res;
  try { res = await fetch(url, { redirect: "follow" }); } catch { res = null; }
  const type = res?.headers.get("content-type") || "";
  if (!res?.ok || !type.startsWith("image/")) {
    console.warn(`Foto niet bruikbaar voor ${sleutel}: ${res ? res.status + " " + type : "geen antwoord"}.` +
      (url.includes("drive.google.com") ? " Staat het bestand gedeeld met ‘iedereen met de link’?" : ""));
    return "";
  }
  let buf = Buffer.from(await res.arrayBuffer());
  let ext = "jpg";
  try { if (sharp) ({ buf, ext } = await verwerkFoto(buf, sharp)); else if (type.includes("png")) ext = "png"; }
  catch (err) { console.warn(`Foto ${sleutel} niet verwerkt (${err.message}), origineel bewaard.`); if (type.includes("png")) ext = "png"; }
  const name = sleutel + "." + ext;
  used.add(name);
  await fs.writeFile(path.join(FOTO, name), buf);
  return "data/foto/" + name;
}
async function foto(page, filesProp, linkProp) {
  const f = filesProp?.files?.[0];
  const url = f ? (f.type === "external" ? f.external.url : f.file.url) : (linkProp?.url || "");
  return url ? haalFoto(url, page.id.replace(/-/g, "")) : "";
}
// Alle foto’s na de eerste in het veld Foto (voor een reeks onder de tekst)
async function fotoReeks(page, filesProp) {
  const out = [];
  const files = (filesProp?.files || []).slice(1, 9);
  for (const [i, f] of files.entries()) {
    const url = f.type === "external" ? f.external.url : f.file.url;
    const pad = url ? await haalFoto(url, `${page.id.replace(/-/g, "")}-${i + 1}`) : "";
    if (pad) out.push(pad);
  }
  return out;
}

async function write(name, data) {
  const json = JSON.stringify(data, null, 2);
  await fs.writeFile(path.join(OUT, name + ".json"), json + "\n");
  // .js-versie zodat de pagina’s ook zonder server (dubbelklik) werken
  await fs.writeFile(path.join(OUT, name + ".js"), `window.${name.toUpperCase()} = ${json};\n`);
}

await fs.mkdir(FOTO, { recursive: true });

// Agenda
const agenda = [];
for (const r of await queryAll(AGENDA_DB, [{ property: "Datum", direction: "ascending" }])) {
  const p = r.properties, d = p.Datum?.date;
  if (!d?.start) continue;
  agenda.push({
    start: d.start.slice(0, 10),
    end: d.end ? d.end.slice(0, 10) : undefined,
    time: text(p.Uur),
    village: text(p.Dorp),
    place: text(p.Locatie),
    artist: text(p.Artiest),
    kind: [text(p.Soort), text(p.Reeks)].filter(Boolean).join(", "),
    sites: (p.Website?.multi_select || []).map(o => o.name),
    reeks: text(p.Reeks),
    price: text(p.Prijs),
    tickets: text(p.Ticketlink),
    cta: text(p.Knoptekst) || undefined,
    volzet: p.Volzet?.checkbox === true,
    info: text(p["Meer info"]),
    sub: text(p.Ondertitel),
    origin: text(p.Herkomst),
    text: text(p.Beschrijving),
    adres: text(p.Adres),
    duur: text(p.Duur),
    lang: await blokken(r.id),
    videos: lines(p["Video’s"]),
    spotify: lines(p.Spotify),
    webadres: text(p.Webadres),
    foto: await foto(r, p.Foto, p.Fotolink),
    _extra: await fotoReeks(r, p.Foto),   // alle foto’s na de eerste in het veld Foto
    _id: r.id,
  });
}

// Producties (podiumproducties, installaties, playlists en concepten op maat)
const producties = [];
for (const r of await queryAll(PRODUCTIES_DB, [{ property: "Volgorde", direction: "ascending" }])) {
  const p = r.properties;
  const titel = text(p.Titel);
  const slug = text(p.Webadres) || titel.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  producties.push({
    slug,
    soort: text(p.Soort) || "Podiumproductie",
    titel,
    label: text(p.Label),
    makers: text(p.Makers),
    tekst: text(p.Tekst),
    extra: text(p.Extra),
    waar: text(p.Waar),
    vorm: text(p.Vorm),
    speelduur: text(p.Speelduur),
    periode: text(p.Periode),
    data: regels(p.Data),
    bezetting: text(p.Bezetting),
    techniek: text(p.Techniek),
    geschikt: text(p["Geschikt voor"]),
    prijs: text(p.Prijs),
    contact: text(p.Contact),
    knop: text(p.Knoptekst),
    knoplink: text(p.Knoplink),
    uitsnede: text(p.Uitsnede),
    videos: regelsMetTitel(prop(p, "Video's", "Video’s")),
    spotify: lines(p.Spotify),
    soundcloud: lines(p.SoundCloud),
    lang: await blokkenRijk(r.id),
    foto: await foto(r, p.Foto, p.Fotolink),
    fotos: await fotoReeks(r, p.Foto),
  });
}
await write("producties", producties);

// Vaste teksten van de site (kolommen Sleutel en Tekst). Wat leeg is, valt terug op de standaardtekst in de code.
const teksten = {};
for (const r of await queryAll(TEKSTEN_DB, [{ property: "Sleutel", direction: "ascending" }])) {
  const sleutel = text(r.properties.Sleutel).trim();
  const tekst = text(r.properties.Tekst);
  if (sleutel && tekst.trim()) teksten[sleutel] = tekst;
}
await write("teksten", teksten);

// Beeldbank
const beeldbank = [];
for (const r of await queryAll(BEELDBANK_DB, [{ property: "Volgorde", direction: "ascending" }])) {
  const p = r.properties;
  if (p.Online?.checkbox !== true) continue;
  const src = (await foto(r, p.Foto, p.Fotolink)) || text(p["Lokaal bestand"]);
  if (!src) continue;
  beeldbank.push({
    titel: text(p.Titel),
    src,
    alt: text(p["Alt-tekst"]) || text(p.Titel),
    fotograaf: text(p.Fotograaf),
    jaar: p.Jaar?.number ?? null,
    onderwerp: p.Onderwerp?.select?.name || "",
    uitsnede: (p.Uitsnede?.select?.name || "").toLowerCase(),
    gebruik: (p.Gebruik?.multi_select || []).map(o => o.name),
    volgorde: p.Volgorde?.number ?? null,
    concerten: (p.Concert?.relation || []).map(x => x.id),
  });
}

// Foto’s uit de beeldbank bij het bijhorende concert zetten (relatie “Concert”).
// Heeft het concert zelf geen Foto/Fotolink, dan wordt de eerste beeldbankfoto de hoofdfoto.
for (const e of agenda) {
  const b = beeldbank.filter(x => x.concerten.includes(e._id));
  // Extra foto’s in het veld Foto van het concert (na de eerste) komen vóór die uit de beeldbank
  const extra = (e._extra || []).map((src, i) => ({ src, alt: `${e.artist}, foto ${i + 1}`, fotograaf: "" }));
  if (b.length || extra.length) {
    e.beelden = [...extra, ...b.map(x => ({ src: x.src, alt: x.alt, fotograaf: x.fotograaf }))];
    if (!e.foto && b.length) { e.foto = b[0].src; e.fotoAlt = b[0].alt; e.fotograaf = b[0].fotograaf; }
  }
  delete e._id;
  delete e._extra;
}
await write("agenda", agenda);
await write("beeldbank", beeldbank.map(({ concerten, ...x }) => x));

// Foto’s die niet meer gebruikt worden opruimen
for (const f of await fs.readdir(FOTO)) if (!used.has(f)) await fs.unlink(path.join(FOTO, f));

console.log(`Klaar: ${agenda.length} agenda-items, ${producties.length} producties, ${beeldbank.length} beelden, ${Object.keys(teksten).length} teksten.`);
