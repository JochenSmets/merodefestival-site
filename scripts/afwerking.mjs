// Afwerking van alle gebouwde pagina’s (draait helemaal op het einde van de bouw):
//  1. lettertypes van de eigen server in plaats van Google Fonts
//  2. Spotify en SoundCloud laden pas na een klik
//  3. voorbeeldafbeeldingen van YouTube en Vimeo worden lokaal bewaard (er gaat dus niets naar die diensten vóór een klik)
//  4. statistieken (Cloudflare Web Analytics en/of Plausible), zonder cookies, enkel op het echte domein
//  5. onderaan elke pagina: logo van de Vlaamse overheid, en links naar Partners, Vrienden en de privacyverklaring
// Alles is idempotent: een pagina die al bewerkt is, wordt niet nog eens bewerkt.

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { T } from "./teksten.mjs";
import { VLAANDEREN_PNG } from "./afwerking-beeld.mjs";

const FONTS_CSS = "/* Lettertypes Alegreya en Alatsi (SIL Open Font License), zelf gehost zodat er geen verbinding met Google nodig is. */\n@font-face{font-family:\"Alegreya\";font-style:normal;font-weight:400;font-display:swap;src:url(../fonts/alegreya-latin-400-normal.woff2) format(\"woff2\");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}\n@font-face{font-family:\"Alegreya\";font-style:normal;font-weight:400;font-display:swap;src:url(../fonts/alegreya-latin-ext-400-normal.woff2) format(\"woff2\");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}\n@font-face{font-family:\"Alegreya\";font-style:normal;font-weight:500;font-display:swap;src:url(../fonts/alegreya-latin-500-normal.woff2) format(\"woff2\");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}\n@font-face{font-family:\"Alegreya\";font-style:normal;font-weight:500;font-display:swap;src:url(../fonts/alegreya-latin-ext-500-normal.woff2) format(\"woff2\");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}\n@font-face{font-family:\"Alegreya\";font-style:normal;font-weight:700;font-display:swap;src:url(../fonts/alegreya-latin-700-normal.woff2) format(\"woff2\");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}\n@font-face{font-family:\"Alegreya\";font-style:normal;font-weight:700;font-display:swap;src:url(../fonts/alegreya-latin-ext-700-normal.woff2) format(\"woff2\");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}\n@font-face{font-family:\"Alegreya\";font-style:italic;font-weight:400;font-display:swap;src:url(../fonts/alegreya-latin-400-italic.woff2) format(\"woff2\");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}\n@font-face{font-family:\"Alegreya\";font-style:italic;font-weight:400;font-display:swap;src:url(../fonts/alegreya-latin-ext-400-italic.woff2) format(\"woff2\");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}\n@font-face{font-family:\"Alegreya\";font-style:italic;font-weight:500;font-display:swap;src:url(../fonts/alegreya-latin-500-italic.woff2) format(\"woff2\");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}\n@font-face{font-family:\"Alegreya\";font-style:italic;font-weight:500;font-display:swap;src:url(../fonts/alegreya-latin-ext-500-italic.woff2) format(\"woff2\");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}\n@font-face{font-family:\"Alatsi\";font-style:normal;font-weight:400;font-display:swap;src:url(../fonts/alatsi-latin-400-normal.woff2) format(\"woff2\");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}\n@font-face{font-family:\"Alatsi\";font-style:normal;font-weight:400;font-display:swap;src:url(../fonts/alatsi-latin-ext-400-normal.woff2) format(\"woff2\");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}\n";

const CSS = String.raw`/* Afwerking: spelers met klik, voettekst */
.speler-wacht{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:.55rem;min-height:152px;margin:1rem 0;padding:1rem 1.15rem;border:1px solid rgba(127,127,127,.45);border-radius:8px;background:rgba(127,127,127,.12);box-sizing:border-box}
.speler-wacht .speler-titel{margin:0;font-family:var(--label,system-ui);font-size:.92rem;opacity:.85}
.speler-wacht .speler-uitleg{margin:0;font-size:.86rem;line-height:1.4;opacity:.85;max-width:44rem}
.speler-wacht .speler-uitleg a{color:inherit}
.speler-wacht .btn{font-size:.95rem}
iframe.speler-geladen{display:block;width:100%;border:0;border-radius:8px}
footer .steun-logo{display:block;width:200px;max-width:100%;height:auto;margin:.5rem 0 1rem}
footer .foot-onder{margin-top:1.75rem;padding-top:1.1rem;border-top:1px solid rgba(239,231,218,.18)}
footer .foot-links{margin:0;font-family:var(--label,system-ui);font-size:.95rem;display:flex;flex-wrap:wrap;gap:.35rem 1.5rem}
footer .foot-links a{text-underline-offset:3px}
`;

const JS = String.raw`(function () {
  // Spotify en SoundCloud: de speler wordt pas geladen na een klik
  document.addEventListener("click", function (e) {
    var knop = e.target.closest ? e.target.closest(".speler-knop") : null;
    if (!knop) return;
    var w = knop.closest(".speler-wacht");
    if (!w) return;
    var f = document.createElement("iframe");
    f.src = w.getAttribute("data-embed");
    f.title = w.getAttribute("data-titel") || "";
    f.setAttribute("height", w.getAttribute("data-hoogte") || "152");
    f.setAttribute("allow", w.getAttribute("data-allow") || "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture");
    f.className = "speler-geladen" + (w.getAttribute("data-klasse") ? " " + w.getAttribute("data-klasse") : "");
    w.parentNode.replaceChild(f, w);
    f.focus();
  });
})();
`;

const lijstHtml = async (dir, rel = "") => {
  const uit = [];
  for (const e of await fs.readdir(path.join(dir, rel), { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!rel && ["data", "fonts", "img", "css", "js", "seizoen"].includes(e.name)) continue;
      uit.push(...await lijstHtml(dir, path.join(rel, e.name)));
    } else if (e.name.endsWith(".html")) uit.push(path.join(rel, e.name));
  }
  return uit;
};

// Instellingen voor de statistieken, beheerd in Notion (Teksten, sleutels statistiek.…)
export function statistiek() {
  const schoon = t => String(t || "").trim().replace(/[^A-Za-z0-9._-]/g, "");
  return {
    cf: schoon(T("statistiek.cloudflare-token", "", "Token van Cloudflare Web Analytics (Cloudflare, Analytics, Web Analytics, site toevoegen). Leeg laten = uit.")),
    pl: schoon(T("statistiek.plausible-domein", "", "Domein voor Plausible Analytics, bijvoorbeeld merodefestival.be. Leeg laten = uit.")),
  };
}

export async function afwerking({ ROOT, SITE }) {
  const { cf, pl } = statistiek();
  const host = new URL(SITE).hostname;
  const kaal = host.replace(/^www\./, "");

  // Bestanden die elke pagina nodig heeft
  await fs.mkdir(path.join(ROOT, "css"), { recursive: true });
  await fs.mkdir(path.join(ROOT, "js"), { recursive: true });
  await fs.mkdir(path.join(ROOT, "img"), { recursive: true });
  await fs.writeFile(path.join(ROOT, "css/fonts.css"), FONTS_CSS);
  await fs.writeFile(path.join(ROOT, "css/afwerking.css"), CSS);
  await fs.writeFile(path.join(ROOT, "js/afwerking.js"), JS);
  await fs.writeFile(path.join(ROOT, "img/vlaanderen-verbeelding-werkt.png"), Buffer.from(VLAANDEREN_PNG, "base64"));

  // Lokale kopieën van de voorbeeldafbeeldingen bij video’s
  let sharp = null;
  try { sharp = (await import("sharp")).default; } catch { /* zonder sharp blijft het origineel staan */ }
  const thumbMap = new Map();
  const haalThumb = async url => {
    if (thumbMap.has(url)) return thumbMap.get(url);
    const naam = crypto.createHash("sha1").update(url).digest("hex").slice(0, 16) + ".jpg";
    const pad = path.join(ROOT, "data/vthumb", naam);
    let resultaat = "";
    try { await fs.access(pad); resultaat = naam; }
    catch {
      try {
        const res = await fetch(url.replace(/&amp;/g, "&"));
        if (res.ok && (res.headers.get("content-type") || "").startsWith("image/")) {
          let buf = Buffer.from(await res.arrayBuffer());
          if (sharp) buf = await sharp(buf).resize({ width: 640, withoutEnlargement: true }).jpeg({ quality: 72, progressive: true }).toBuffer();
          await fs.mkdir(path.dirname(pad), { recursive: true });
          await fs.writeFile(pad, buf);
          resultaat = naam;
        }
      } catch { /* geen verbinding of afbeelding: de knop blijft dan zonder voorbeeldbeeld */ }
    }
    thumbMap.set(url, resultaat);
    return resultaat;
  };

  const dienstNaam = h => /spotify/.test(h) ? "Spotify" : /soundcloud/.test(h) ? "SoundCloud" : h;
  const attr = (a, n) => { const m = a.match(new RegExp(`(?:^|\\s)${n}="([^"]*)"`)); return m ? m[1] : ""; };
  const eventKlasse = (a, naam) => {
    if (!pl) return a;
    const k = `plausible-event-name=${naam}`;
    return /(?:^|\s)class="/.test(a) ? a.replace(/(?:(^|\s))class="([^"]*)"/, (m, v, c) => `${v}class="${c} ${k}"`) : `${a} class="${k}"`;
  };

  const bestanden = await lijstHtml(ROOT);
  let nSpelers = 0, nThumbs = 0, nVerwerkt = 0;
  for (const rel of bestanden) {
    const pad = path.join(ROOT, rel);
    let h = await fs.readFile(pad, "utf8");
    const voor = h;
    const diepte = rel.split(path.sep).length - 1;
    const up = "../".repeat(diepte);

    // 1. lettertypes
    if (/fonts\.(?:googleapis|gstatic)\.com/.test(h)) {
      let eerste = true;
      h = h.replace(/<link\b[^>]*fonts\.(?:googleapis|gstatic)\.com[^>]*>\s*/gi, () => {
        if (!eerste) return "";
        eerste = false;
        return `<link rel="preload" href="${up}fonts/alegreya-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>\n<link rel="preload" href="${up}fonts/alatsi-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>\n<link rel="stylesheet" href="${up}css/fonts.css">\n`;
      });
    }

    // 2. spelers pas na een klik
    h = h.replace(/<iframe\b([^>]*)>\s*<\/iframe>/gi, (m, a) => {
      const src = attr(a, "src").replace(/&amp;/g, "&");
      let hostSpeler = "";
      try { hostSpeler = new URL(src).hostname; } catch { return m; }
      if (!/(^|\.)(open\.spotify\.com|w\.soundcloud\.com)$/.test(hostSpeler)) return m;
      nSpelers++;
      const dienst = dienstNaam(hostSpeler);
      const titel = attr(a, "title") || `Speler van ${dienst}`;
      const hoogte = attr(a, "height") || (/soundcloud/.test(hostSpeler) ? "166" : "152");
      const klasse = attr(a, "class");
      const allow = attr(a, "allow");
      const uitleg = T("speler.uitleg", "Pas na je klik laden we de speler van {dienst}. Die ziet dan je IP-adres en kan cookies plaatsen.").replace("{dienst}", dienst);
      const knopTekst = T("speler.knop", "Speel af via {dienst}").replace("{dienst}", dienst);
      const meer = T("speler.meer", "Meer info");
      const esc2 = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
      return `<div class="speler-wacht" data-embed="${esc2(src)}" data-titel="${esc2(titel)}" data-hoogte="${esc2(hoogte)}"${klasse ? ` data-klasse="${esc2(klasse)}"` : ""}${allow ? ` data-allow="${esc2(allow)}"` : ""}><p class="speler-titel">${esc2(titel)}</p><button type="button" class="${pl ? "btn speler-knop plausible-event-name=Speler+laden" : "btn speler-knop"}">▶ ${esc2(knopTekst)}</button><p class="speler-uitleg">${esc2(uitleg)} <a href="${up}privacy.html#website">${esc2(meer)}</a></p></div>`;
    });

    // 3. voorbeeldafbeeldingen van video’s lokaal
    const thumbs = [...h.matchAll(/url\((['"]?)(https:\/\/(?:i\.ytimg\.com|i\.vimeocdn\.com)\/[^)'"]+)\1\)/g)];
    if (thumbs.length) {
      const vervang = new Map();
      for (const t of thumbs) if (!vervang.has(t[2])) vervang.set(t[2], await haalThumb(t[2]));
      h = h.replace(/url\((['"]?)(https:\/\/(?:i\.ytimg\.com|i\.vimeocdn\.com)\/[^)'"]+)\1\)/g, (m, q, u) => {
        nThumbs++;
        const naam = vervang.get(u);
        return naam ? `url(${up}data/vthumb/${naam})` : "none";
      });
    }

    // 4. statistieken
    if ((cf || pl) && !h.includes("data-statistiek")) {
      const s = `<script data-statistiek>(function(){var h=location.hostname;if(h!=="${host}"&&h!=="${kaal}")return;function s(src,a){var e=document.createElement("script");e.defer=true;e.src=src;for(var k in a)e.setAttribute(k,a[k]);document.head.appendChild(e)}${cf ? `s("https://static.cloudflareinsights.com/beacon.min.js",{"data-cf-beacon":'{"token":"${cf}"}'});` : ""}${pl ? `s("https://plausible.io/js/script.outbound-links.tagged-events.js",{"data-domain":"${pl}"});` : ""}})();</script>\n`;
      h = h.replace("</body>", s + "</body>");
      if (pl) {
        h = h.replace(/<a\b([^>]*\bhref="[^"]*pierrot\.io[^"]*"[^>]*)>/gi, (m, a) => /plausible-event-name/.test(a) ? m : `<a${eventKlasse(a, "Tickets")}>`);
        h = h.replace(/<a\b([^>]*\bhref="[^"]*eepurl\.com[^"]*"[^>]*)>/gi, (m, a) => /plausible-event-name/.test(a) ? m : `<a${eventKlasse(a, "Nieuwsbrief")}>`);
        h = h.replace(/<a\b([^>]*\bhref="mailto:[^"]*"[^>]*)>/gi, (m, a) => /plausible-event-name/.test(a) ? m : `<a${eventKlasse(a, "Mail")}>`);
      }
    }

    // 5. voettekst: logo en links
    if (h.includes("<footer") && !h.includes("steun-logo")) {
      h = h.replace(/(<h3>Met steun van<\/h3>)/, `$1<a class="steun-link" href="https://www.vlaanderen.be" target="_blank" rel="noopener"><img class="steun-logo" src="${up}img/vlaanderen-verbeelding-werkt.png" alt="${T("footer.logo-alt", "Vlaanderen, verbeelding werkt")}" width="200" height="87" loading="lazy"></a>`);
    }
    if (h.includes("<footer") && !h.includes("foot-onder")) {
      const links = [
        [`${up}partners.html`, T("footer.link-partners", "Partners")],
        [`${up}vrienden-van.html`, T("footer.link-vrienden", "Vrienden van Merodefestival")],
        [`${up}wesp.html`, T("footer.link-wesp", "Over WESP")],
        [`${up}privacy.html`, T("footer.link-privacy", "Privacyverklaring")],
      ];
      h = h.replace("</footer>", `<div class="wrap foot-onder"><p class="foot-links">${links.map(([u, t]) => `<a href="${u}">${t}</a>`).join("")}</p></div>\n</footer>`);
    }

    // stijl en script erbij
    if (!h.includes("css/afwerking.css")) h = h.replace("</head>", `<link rel="stylesheet" href="${up}css/afwerking.css">\n</head>`);
    if (h.includes("speler-wacht") && !h.includes("js/afwerking.js")) h = h.replace("</body>", `<script src="${up}js/afwerking.js" defer></script>\n</body>`);

    if (h !== voor) { await fs.writeFile(pad, h); nVerwerkt++; }
  }
  console.log(`Afwerking: ${nVerwerkt} pagina’s bewerkt, ${nSpelers} spelers achter een klik, ${nThumbs} voorbeeldbeelden lokaal${cf || pl ? ", statistieken aan" : ", statistieken uit (nog geen token ingevuld)"}.`);
}
