// Haalt de lijsten voor de pagina Over WESP uit Notion (database “Over WESP (website)”)
// en schrijft ze naar site/data/wesp.json. Mislukt dit, dan blijft het vorige bestand staan.

import fs from "node:fs/promises";
import path from "node:path";

const TOKEN = process.env.NOTION_TOKEN;
const DB = process.env.WESP_DB || "7cfc3964403d4e0d924e82f1e5ffc78f";
if (!TOKEN) { console.log("Geen NOTION_TOKEN: Over WESP niet bijgewerkt."); process.exit(0); }

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
const tekst = p => (p?.title || p?.rich_text || []).map(t => t.plain_text).join("");

// Foto’s bij een rij (veld Foto): eerste foto, verkleind en als JPEG bewaard in site/data/wesp-foto/
let sharp = null;
try { sharp = (await import("sharp")).default; } catch { /* geen sharp: foto’s blijven zoals ze zijn */ }
const FOTO = path.resolve("site/data/wesp-foto");
const gebruikt = new Set();
async function haalFoto(p, id) {
  const f = p.Foto?.files?.[0];
  if (!f) return "";
  const url = f.type === "external" ? f.external.url : f.file.url;
  try {
    const res = await fetch(url, { redirect: "follow" });
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !type.startsWith("image/")) { console.warn(`Foto niet bruikbaar voor ${id}: ${res.status} ${type}`); return ""; }
    let buf = Buffer.from(await res.arrayBuffer());
    let ext = "jpg";
    if (sharp) buf = await sharp(buf).rotate().resize({ width: 1600, withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 76, progressive: true }).toBuffer();
    else if (type.includes("png")) ext = "png";
    else if (type.includes("webp")) ext = "webp";
    await fs.mkdir(FOTO, { recursive: true });
    const naam = `${id.replace(/-/g, "")}.${ext}`;
    gebruikt.add(naam);
    await fs.writeFile(path.join(FOTO, naam), buf);
    return "data/wesp-foto/" + naam;
  } catch (err) { console.warn(`Foto mislukt voor ${id}: ${err.message}`); return ""; }
}

try {
  const rijen = [];
  let cursor;
  do {
    const r = await notion(`databases/${DB}/query`, {
      start_cursor: cursor, page_size: 100,
      filter: { property: "Online", checkbox: { equals: true } },
      sorts: [{ property: "Volgorde", direction: "ascending" }],
    });
    for (const pagina of r.results) {
      const p = pagina.properties;
      rijen.push({
        soort: p.Soort?.select?.name || "",
        titel: tekst(p.Titel).trim(),
        label: tekst(p.Label).trim(),
        tekst: tekst(p.Tekst).trim(),
        link: p.Link?.url || "",
        linktekst: tekst(p.Linktekst).trim(),
        foto: await haalFoto(p, pagina.id),
      });
    }
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  const rijenMetTitel = rijen.filter(x => x.soort && x.titel);
  await fs.mkdir(path.resolve("site/data"), { recursive: true });
  await fs.writeFile(path.resolve("site/data/wesp.json"), JSON.stringify(rijenMetTitel, null, 2) + "\n");
  // Foto’s die niet meer gebruikt worden opruimen
  try { for (const f of await fs.readdir(FOTO)) if (!gebruikt.has(f)) await fs.unlink(path.join(FOTO, f)); } catch { /* map bestaat nog niet */ }
  console.log(`Over WESP: ${rijenMetTitel.length} rijen uit Notion.`);
} catch (err) {
  console.warn("Over WESP niet bijgewerkt:", err.message);
}
