// Haalt de agenda en de producties uit Notion en schrijft ze naar site/data/.
// Draait automatisch via GitHub Actions (zie .github/workflows/notion.yml).
// Nodig: NOTION_TOKEN, AGENDA_DB en PRODUCTIES_DB als omgevingsvariabelen.

import fs from "node:fs/promises";
import path from "node:path";

const TOKEN = process.env.NOTION_TOKEN;
const AGENDA_DB = process.env.AGENDA_DB;
const PRODUCTIES_DB = process.env.PRODUCTIES_DB;
// Beeldbank: standaard de database “Beeldbank (website)”; overschrijfbaar met BEELDBANK_DB.
const BEELDBANK_DB = process.env.BEELDBANK_DB || "4194280648e841659ebdef6307358815";
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
  p.type === "email" ? (p.email || "") :
  p.type === "phone_number" ? (p.phone_number || "") :
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

// Meerdere links in één tekstveld: één per regel (of gescheiden door spaties)
const lines = p => text(p).split(/\s+/).filter(x => /^https?:\/\//.test(x));
// Video’s bij producties: één per regel, als “link | titel”
const videoRegels = p => text(p).split(/\n/).map(r => {
  const [url, ...titel] = r.split("|");
  return { url: url.trim(), titel: titel.join("|").trim() };
}).filter(v => /^https?:\/\//.test(v.url));
// Gewone tekst met één item per regel (bv. speeldata)
const regels = p => text(p).split(/\n/).map(r => r.trim()).filter(Boolean);

// Een gedeelde Google Drive-link omzetten naar een rechtstreekse download.
// Werkt voor links zoals drive.google.com/file/d/<id>/view en drive.google.com/open?id=<id>.
export function directLink(url) {
  const m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([\w-]{20,})/);
  return m ? `https://drive.google.com/uc?export=download&id=${m[1]}` : url;
}

// Foto’s uit Notion verlopen na een uur, dus we downloaden ze naar de site.
// Volgorde: eerst het veld Foto (upload of ingesloten link), anders het veld Fotolink.
const used = new Set();
async function foto(page, filesProp, linkProp) {
  const f = filesProp?.files?.[0];
  let url = f ? (f.type === "external" ? f.external.url : f.file.url) : (linkProp?.url || "");
  if (!url) return "";
  url = directLink(url);
  const name = page.id.replace(/-/g, "") + ".jpg";
  let res;
  try { res = await fetch(url, { redirect: "follow" }); } catch { res = null; }
  const type = res?.headers.get("content-type") || "";
  if (!res?.ok || !type.startsWith("image/")) {
    console.warn(`Foto niet bruikbaar voor ${page.id}: ${res ? res.status + " " + type : "geen antwoord"}.` +
      (url.includes("drive.google.com") ? " Staat het bestand gedeeld met ‘iedereen met de link’?" : ""));
    return "";
  }
  used.add(name);
  let buf = Buffer.from(await res.arrayBuffer());
  if (sharp) {
    buf = await sharp(buf).rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 74, progressive: true }).toBuffer();
  }
  await fs.writeFile(path.join(FOTO, name), buf);
  return "data/foto/" + name;
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
    _id: r.id,
  });
}

// Producties
const producties = [];
for (const r of await queryAll(PRODUCTIES_DB, [{ property: "Volgorde", direction: "ascending" }])) {
  const p = r.properties;
  producties.push({
    titel: text(p.Titel),
    // Soort: Podiumproductie, Installatie of Playlist (leeg = Podiumproductie)
    soort: text(p.Soort) || "Podiumproductie",
    label: text(p.Label),
    makers: text(p.Makers),
    tekst: text(p.Tekst),
    extra: text(p.Extra),
    feiten: [
      ["Bezetting", text(p.Bezetting)], ["Vorm", text(p.Vorm)], ["Speelduur", text(p.Speelduur)],
      ["Periode", text(p.Periode)], ["Geschikt voor", text(p["Geschikt voor"])],
      ["Techniek", text(p.Techniek)], ["Prijs", text(p.Prijs)],
    ].filter(f => f[1]),
    knop: text(p.Knoptekst) || "Vraag een optie",
    contact: text(p.Contact),
    data: regels(p.Data),
    webadres: text(p.Webadres),
    lang: await blokken(r.id),
    videos: videoRegels(p["Video’s"] || p["Video's"]),
    spotify: lines(p.Spotify),
    foto: await foto(r, p.Foto, p.Fotolink),
    uitsnede: (p.Uitsnede?.select?.name || "").toLowerCase(),
  });
}
await write("producties", producties);

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
  if (b.length) {
    e.beelden = b.map(x => ({ src: x.src, alt: x.alt, fotograaf: x.fotograaf }));
    if (!e.foto) { e.foto = b[0].src; e.fotoAlt = b[0].alt; e.fotograaf = b[0].fotograaf; }
  }
  delete e._id;
}
await write("agenda", agenda);
await write("beeldbank", beeldbank.map(({ concerten, ...x }) => x));

// Foto’s die niet meer gebruikt worden opruimen
for (const f of await fs.readdir(FOTO)) if (!used.has(f)) await fs.unlink(path.join(FOTO, f));

console.log(`Klaar: ${agenda.length} agenda-items, ${producties.length} producties, ${beeldbank.length} beelden.`);
