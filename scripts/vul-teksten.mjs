// Zet alle teksten die de site gebruikt, maar die nog niet in Notion staan, als nieuwe rijen in de
// database “Teksten (website)”, met de standaardtekst erin. Zo staat daar vanzelf alles wat je kunt aanpassen.
// Draait na de bouw (zie .github/workflows/notion.yml) en leest .build/teksten-catalogus.json.

import fs from "node:fs/promises";
import path from "node:path";

const TOKEN = process.env.NOTION_TOKEN;
const DB = process.env.TEKSTEN_DB || "57e78e458ed5461f8166cafdb391d7af";
if (!TOKEN) { console.log("Geen NOTION_TOKEN: teksten niet aangevuld."); process.exit(0); }

async function notion(pad, body, poging = 0) {
  const res = await fetch(`https://api.notion.com/v1/${pad}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${TOKEN}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429 && poging < 5) {
    await new Promise(r => setTimeout(r, 1500 * (poging + 1)));
    return notion(pad, body, poging + 1);
  }
  if (!res.ok) throw new Error(`Notion ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

let catalogus;
try { catalogus = JSON.parse(await fs.readFile(path.resolve(".build/teksten-catalogus.json"), "utf8")); }
catch { console.log("Geen catalogus gevonden: niets aan te vullen."); process.exit(0); }

// Alle bestaande sleutels, ook van rijen die uit staan
const bestaand = new Set();
let cursor;
do {
  const r = await notion(`databases/${DB}/query`, { start_cursor: cursor, page_size: 100 });
  for (const p of r.results) bestaand.add((p.properties.Sleutel?.title || []).map(t => t.plain_text).join("").trim());
  cursor = r.has_more ? r.next_cursor : undefined;
} while (cursor);

const nieuw = catalogus.filter(c => c.sleutel && !bestaand.has(c.sleutel));
const rich = t => t ? [{ type: "text", text: { content: String(t).slice(0, 1990) } }] : [];
for (const c of nieuw) {
  await notion("pages", {
    parent: { database_id: DB },
    properties: {
      Sleutel: { title: rich(c.sleutel) },
      Tekst: { rich_text: rich(c.standaard) },
      Pagina: { select: { name: c.pagina || "Overig" } },
      Uitleg: { rich_text: rich(c.uitleg) },
      Online: { checkbox: true },
    },
  });
  await new Promise(r => setTimeout(r, 350)); // Notion staat ongeveer 3 aanvragen per seconde toe
}
console.log(`Teksten in Notion: ${bestaand.size} bestonden al, ${nieuw.length} nieuw toegevoegd.`);
