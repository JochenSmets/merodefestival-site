// Bouwt de pagina’s Privacyverklaring (privacy.html), Vrienden van Merodefestival (vrienden-van.html) en Partners (partners.html).
// Lijsten (formules van de vrienden, partners) komen uit de database “Over WESP (website)” via site/data/wesp.json.

import fs from "node:fs/promises";
import path from "node:path";
import { T } from "./teksten.mjs";
import { statistiek } from "./afwerking.mjs";
import { privacyHtml, PRIVACY_VERSIE } from "./privacy-tekst.mjs";

const MAIL = "info@merodefestival.be";

export async function bouwInfo({ ROOT, SITE, S, esc, kopEd, voetEd }) {
  let rijen = [];
  try { rijen = JSON.parse(await fs.readFile(path.join(ROOT, "data/wesp.json"), "utf8")); } catch { /* nog geen gegevens */ }
  const van = soort => rijen.filter(r => r.soort === soort);
  const href = u => {
    if (!u) return "";
    if (u.startsWith(SITE)) {
      const [pad, anker] = u.slice(SITE.length).split("#");
      const bestand = !pad || pad === "/" ? "index.html" : pad.replace(/^\//, "").replace(/\/$/, "") + (/\.[a-z]+$/.test(pad) ? "" : ".html");
      return bestand + (anker ? "#" + anker : "");
    }
    return u;
  };
  const extern = u => /^https?:/.test(u) && !u.startsWith(SITE);
  const alinea = t => esc(t).split(/\n{2,}/).map(x => `<p>${x.replace(/\n/g, "<br>")}</p>`).join("");

  const pagina = async ({ bestand, titel, beschrijving, canonical, body }) => {
    const hoofd = kopEd
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(titel)} | Merodefestival</title>`)
      .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(beschrijving)}">`)
      .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${SITE}/${canonical}">`)
      .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(titel)}">`)
      .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${SITE}/${S.artwork}">`)
      .replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="css/info.css">');
    await fs.writeFile(path.join(ROOT, bestand), hoofd + "<main>" + body + "\n</main>" + voetEd);
  };
  const hero = (label, titel, lead) => `<section class="i-hero"><div class="wrap"><p class="label">${esc(label)}</p><h1>${esc(titel)}</h1>${lead ? `<p class="i-lead">${esc(lead)}</p>` : ""}</div></section>`;
  const sectie = (klasse, inhoud, extra = "") => `<section class="i-sec ${klasse}"><div class="wrap${extra}">${inhoud}</div></section>`;

  // ---------- Privacyverklaring ----------
  await pagina({
    bestand: "privacy.html", canonical: "privacy",
    titel: T("privacy.titel", "Privacyverklaring"),
    beschrijving: T("privacy.beschrijving", "Hoe WESP vzw en Merodefestival omgaan met persoonsgegevens, cookies en spelers van andere diensten op deze website."),
    body: hero(T("privacy.label", "WESP vzw"), T("privacy.titel", "Privacyverklaring"), "") +
      sectie("licht", `<div class="i-tekst"><p class="i-versie">Versie ${PRIVACY_VERSIE}</p>${privacyHtml({ statistiek: statistiek(), esc })}</div>`),
  });

  // ---------- Vrienden van Merodefestival ----------
  const GIFTEN = T("vrienden.link", "https://pierrot.io/wesp-vzw/giften");
  const knop = (extra = "") => `<a class="btn${extra}" href="${esc(GIFTEN)}" target="_blank" rel="noopener">${esc(T("vrienden.knop", "Word vriend"))}</a>`;
  const regels = (sleutel, standaard) => T(sleutel, standaard).split(/\n+/).map(r => r.trim()).filter(Boolean);
  const voordelen = regels("vrienden.voordelen", "Inside-informatie en updates over onze projecten.\nElk jaar een nieuwsbrief met onze successen en de impact van jouw gift.\nIn maart een fiscaal attest voor giften vanaf € 40: 30 % belastingvermindering, dus elke 40 euro kost je netto 28 euro.");
  const formules = van("Vriend").map(r => `<article class="i-kaart">${r.label ? `<p class="label">${esc(r.label)}</p>` : ""}<h3>${esc(r.titel)}</h3>${r.tekst ? alinea(r.tekst) : ""}${r.link ? `<a class="btn" href="${esc(href(r.link))}"${extern(r.link) ? ' target="_blank" rel="noopener"' : ""}>${esc(r.linktekst || T("vrienden.knop", "Word vriend"))}</a>` : ""}</article>`).join("");
  await pagina({
    bestand: "vrienden-van.html", canonical: "vrienden-van",
    titel: T("vrienden.titel", "Vrienden van Merodefestival"),
    beschrijving: T("vrienden.beschrijving", "Steun de werking van Merodefestival en kom dichter bij de muziek: word vriend van Merodefestival."),
    body: hero(T("vrienden.label", "Steun ons"), T("vrienden.titel", "Vrienden van Merodefestival"), T("vrienden.lead", "Steun de werking en kom dichter bij de muziek.")) +
      sectie("licht", `<div class="i-tekst">${alinea(T("vrienden.tekst", "Als Vriend steun je de werking van WESP vzw, de organisatie achter Merodefestival. Met jouw steun investeren we in kwalitatieve concerten, nieuwe muziek, eerlijk betaalde muzikanten, unieke residenties en inspirerende samenwerkingen. Want talent verdient niet alleen een podium, maar ook de omkadering en ondersteuning om te groeien."))}
        <h2>${esc(T("vrienden.voordelen-kop", "Wat krijg je als Vriend?"))}</h2><ul>${voordelen.map(v => `<li>${esc(v)}</li>`).join("")}</ul>
        <p>${knop()}</p></div>
        ${formules ? `<div class="i-kaarten">${formules}</div>` : ""}`) +
      sectie("donker", `<div class="i-tekst"><h2>${esc(T("vrienden.missie-kop", "Onze missie"))}</h2>
        ${alinea(T("vrienden.missie", "WESP is dé incubator voor het folklandschap in Vlaanderen. We ondersteunen muzikanten in hun ontwikkeling, laten hen nieuwe muziek maken, bieden hen een podium op maat en leggen internationale verbindingen.\n\nWe bouwen aan een duurzame toekomst, geïnspireerd door gewortelde verhalen, erfgoed en natuur. We organiseren ontmoeting, nabijheid en verbinding met en tussen muzikanten, het genre en een breed publiek."))}
        <blockquote class="i-citaat">${esc(T("vrienden.citaat", "Tradition is passing on the flame and not worshipping the ashes."))}</blockquote>
        ${alinea(T("vrienden.slot", "Sluit je aan bij de Vrienden van Merodefestival en bouw mee aan een duurzame toekomst voor folk- en wereldmuziek."))}
        <p>${knop()}</p>
        <p class="i-versie">${esc(T("vrienden.vragen", "Vragen over je gift? Mail naar"))} <a href="mailto:${MAIL}">${MAIL}</a>.</p></div>`),
  });

  // ---------- Partners ----------
  const steun = van("Partner").filter(r => r.label === "Met steun van");
  const samen = van("Partner").filter(r => r.label !== "Met steun van");
  const naam = r => {
    const inhoud = r.foto ? `<img src="${esc(r.foto)}" alt="${esc(r.titel)}" loading="lazy">` : esc(r.titel);
    const a = r.link ? `<a href="${esc(href(r.link))}"${extern(r.link) ? ' target="_blank" rel="noopener"' : ""}>${inhoud}</a>` : inhoud;
    return `<li class="${r.foto ? "met-logo" : ""}">${a}${r.tekst ? `<span class="i-sub">${esc(r.tekst)}</span>` : ""}</li>`;
  };
  await pagina({
    bestand: "partners.html", canonical: "partners",
    titel: T("partners.titel", "Partners"),
    beschrijving: T("partners.beschrijving", "De overheden, erfgoedsites en muziekorganisaties die Merodefestival en WESP vzw steunen en er mee aan bouwen."),
    body: hero(T("partners.label", "Samen sterk"), T("partners.titel", "Partners"), T("partners.lead", "Overheden, erfgoedsites en muziekorganisaties die mee bouwen.")) +
      (steun.length ? sectie("donker", `<h2>${esc(T("partners.steun-kop", "Met steun van"))}</h2><div class="i-steun"><img class="i-vl-logo" src="img/vlaanderen-verbeelding-werkt.png" alt="${esc(T("footer.logo-alt", "Vlaanderen, verbeelding werkt"))}" width="240" height="104" loading="lazy"><ul class="i-lijst">${steun.map(naam).join("")}</ul></div>`) : "") +
      (samen.length ? sectie("licht", `<h2>${esc(T("partners.samen-kop", "In samenwerking met"))}</h2><ul class="i-lijst">${samen.map(naam).join("")}</ul>`) : "") +
      sectie(steun.length ? "donker" : "licht", `<div class="i-tekst"><h2>${esc(T("partners.word-kop", "Partner worden?"))}</h2>${alinea(T("partners.word", "Een gemeente, erfgoedsite of organisatie die wil samenwerken? Vertel ons waar je mee bezig bent."))}<p><a class="btn" href="mailto:jochen@wespvzw.be?subject=${encodeURIComponent("Samenwerking")}">${esc(T("partners.knop", "Neem contact op"))}</a> <a class="btn ghost" href="wesp.html">${esc(T("partners.wesp", "Over WESP"))}</a></p></div>`),
  });

  await fs.writeFile(path.join(ROOT, "css/info.css"), CSS);
  console.log(`Info-pagina’s: privacy, vrienden-van en partners gebouwd (${steun.length} steun, ${samen.length} partners, ${van("Vriend").length} formules).`);
  return ["privacy.html", "vrienden-van.html", "partners.html"];
}

const CSS = String.raw`/* Privacy, Vrienden en Partners */
.i-hero{padding:4rem 0 2.5rem}
.i-hero h1{font-size:clamp(2.1rem,5vw,3.4rem);margin:.4rem 0 1rem}
.i-lead{font-size:1.3rem;max-width:40rem;margin:0}
.i-sec{padding:3.5rem 0}
.i-sec .wrap{display:block}
.i-sec.licht{background:var(--s-papier);color:var(--s-papier-inkt)}
.i-sec.donker{background:var(--s-nacht);color:var(--s-licht)}
.i-sec h2{font-size:clamp(1.5rem,3vw,2rem);margin:0 0 1rem}
.i-tekst{max-width:46rem}
.i-tekst h2{margin:2.4rem 0 .6rem}
.i-tekst h2:first-child{margin-top:0}
.i-tekst p,.i-tekst li{font-size:1.1rem}
.i-tekst ul{padding-left:1.25rem}
.i-tekst li{margin:.3rem 0}
.i-versie{opacity:.75;font-family:var(--label);font-size:.95rem}
.i-tekst a{text-underline-offset:3px}
.i-sec .btn.ghost{color:inherit}
.i-kaarten{display:grid;grid-template-columns:repeat(auto-fill,minmax(16rem,1fr));gap:1.75rem;margin:2rem 0}
.i-kaart{border-top:3px solid var(--s-oranje);padding-top:.8rem}
.i-kaart h3{font-size:1.4rem;margin:.2rem 0 .5rem}
.i-kaart p{margin:.3rem 0}
.i-steun{display:grid;grid-template-columns:auto 1fr;gap:2.5rem;align-items:center}
.i-vl-logo{display:block;width:240px;max-width:100%;height:auto}
.i-lijst{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.9rem 2.25rem;font-size:1.15rem}
.i-lijst a{text-underline-offset:4px}
.i-lijst li{display:flex;flex-direction:column}
.i-lijst li.met-logo img{display:block;max-height:64px;width:auto}
.i-sub{font-size:.9rem;opacity:.8}
.i-citaat{margin:1.5rem 0;padding-left:1.1rem;border-left:3px solid var(--s-oranje);font-style:italic;font-size:1.2rem}
.i-missie{margin:0 0 1.5rem}
.i-missie div{padding:.8rem 0;border-top:1px solid rgba(239,231,218,.25)}
.i-missie dt{font-family:var(--label);font-size:1rem;color:var(--s-oranje)}
.i-missie dd{margin:.25rem 0 0;font-size:1.1rem}
@media (max-width:760px){.i-steun{grid-template-columns:1fr;gap:1.5rem}.i-sec{padding:2.75rem 0}}
`;
