// Foto’s klaarmaken voor de site (gebruikt door sync-notion.mjs).
//
// - Gewone foto’s worden JPEG, ook PNG’s en schermafbeeldingen met een alfakanaal dat (bijna)
//   nergens doorzichtig is. Die vullen op de site de kaart, bijgesneden volgens Uitsnede, zonder rand.
// - Enkel echt doorzichtige beelden (uitgeknipte figuren, logo’s) blijven PNG. De lege doorzichtige
//   rand rond het beeld wordt weggeknipt, zodat het beeld de kaart zo goed mogelijk vult.
//
// Los te gebruiken om foto’s na te kijken (verandert niets):
//   node scripts/foto.mjs site/data/foto/*.png

import fs from "node:fs/promises";

// Vanaf dit aandeel doorzichtige pixels geldt een beeld als doorzichtig.
// Een paar doorzichtige hoekpixels (afgeronde hoeken, schaduw van een schermafbeelding) tellen niet.
const DREMPEL = 0.02;

// Kijkt hoeveel van het beeld doorzichtig is en waar het niet-doorzichtige deel zit.
export async function doorzichtigheid(buf, sharp) {
  const meta = await sharp(buf).metadata();
  if (!meta.hasAlpha) return { aandeel: 0, kader: null };
  const { data, info } = await sharp(buf).extractChannel("alpha").raw({ depth: "uchar" }).toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let leeg = 0, x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = data[y * W + x];
    if (a < 250) leeg++;
    if (a >= 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const kader = x1 < 0 ? null : { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  return { aandeel: leeg / (W * H), kader, W, H };
}

// Geeft { buf, ext } terug: verkleind tot maximaal 1600 px breed, als JPEG of (doorzichtig) PNG.
export async function verwerkFoto(buf, sharp) {
  const d = await doorzichtigheid(buf, sharp);
  if (d.aandeel >= DREMPEL) {
    let img = sharp(buf);
    if (d.kader && (d.kader.width < d.W || d.kader.height < d.H)) img = img.extract(d.kader);
    buf = await img.resize({ width: 1600, withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
    return { buf, ext: "png" };
  }
  buf = await sharp(buf).rotate().resize({ width: 1600, withoutEnlargement: true })
    .flatten({ background: "#ffffff" }).jpeg({ quality: 74, progressive: true }).toBuffer();
  return { buf, ext: "jpg" };
}

// Rapport voor bestaande bestanden
if (import.meta.url === `file://${process.argv[1]}`) {
  const sharp = (await import("sharp")).default;
  for (const f of process.argv.slice(2)) {
    const d = await doorzichtigheid(await fs.readFile(f), sharp);
    const pct = (100 * d.aandeel).toFixed(1) + "% doorzichtig";
    console.log(`${f}: ${d.aandeel >= DREMPEL ? `blijft PNG (${pct})` : `wordt JPEG (${pct})`}`);
  }
}
