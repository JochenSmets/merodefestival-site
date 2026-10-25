// Bouwt de pagina site/wesp.html (Over WESP).
// Vaste teksten komen uit de database “Teksten (website)” (sleutels wesp.…), de lijsten (aanbod, verhalen, projecten,
// opdrachtgevers, partners en team) uit de database “Over WESP (website)” via site/data/wesp.json.

import fs from "node:fs/promises";
import path from "node:path";
import { T } from "./teksten.mjs";

const MAIL = "jochen@wespvzw.be";
const TEL = "0498 75 82 96";

// De uitwaaierende kaart: Merode in het midden, de plaatsen waar de werking naartoe groeit.
const KNOPEN = [
  { naam: "Holsbeek", sub: "Holsbeek Sessies", cx: 186, cy: 314, px: 198, py: 330, sx: 198, sy: 347 },
  { naam: "Leuven", sub: "PARK Festival, Beleuvenissen", cx: 158, cy: 381, px: 170, py: 398, sx: 170, sy: 415 },
  { naam: "Limburg", sub: "Limburg Sessies", cx: 410, cy: 250, px: 400, py: 225, sx: 400, sy: 290, einde: true },
  { naam: "Antwerpen", sub: "Muziekmuseum Vleeshuis", cx: 89, cy: 89, px: 101, py: 80, sx: 101, sy: 112 },
  { naam: "Brussel", sub: "Klanken van de Steden", cx: 36, cy: 328, px: 22, py: 306, sx: 22, sy: 355 },
];

export async function bouwWesp({ ROOT, SITE, S, esc, kopEd, voetEd }) {
  let rijen = [];
  try { rijen = JSON.parse(await fs.readFile(path.join(ROOT, "data/wesp.json"), "utf8")); } catch { /* nog geen gegevens */ }
  const van = soort => rijen.filter(r => r.soort === soort);

  // Een link uit Notion: adressen van onze eigen site worden interne links.
  const href = u => {
    if (!u) return "";
    if (u.startsWith(SITE)) {
      let rest = u.slice(SITE.length);
      const [pad, anker] = rest.split("#");
      const bestand = !pad || pad === "/" ? "index.html" : pad.replace(/^\//, "").replace(/\/$/, "") + (/\.[a-z]+$/.test(pad) ? "" : ".html");
      return bestand + (anker ? "#" + anker : "");
    }
    return u;
  };
  const extern = u => /^https?:/.test(u) && !u.startsWith(SITE);
  const alinea = t => esc(t).split(/\n{2,}/).map(x => `<p>${x.replace(/\n/g, "<br>")}</p>`).join("");
  const lijstRegels = (sleutel, standaard) => T(sleutel, standaard).split(/\n+/).map(r => r.trim()).filter(Boolean).map(r => {
    const [k, ...rest] = r.split("|");
    return { kop: k.trim(), tekst: rest.join("|").trim() };
  });
  const link = r => r.link ? `<a class="w-link" href="${esc(href(r.link))}"${extern(r.link) ? ' target="_blank" rel="noopener"' : ""}>${esc(r.linktekst || "Meer info")}${extern(r.link) ? ' ↗' : ' →'}</a>` : "";

  // ---------- onderdelen ----------
  const kaart = `<svg class="radius" viewBox="0 0 500 500" role="img" aria-labelledby="kaart-titel kaart-uitleg">
        <title id="kaart-titel">${esc(T("wesp.kaart-titel", "Hoe de werking uitwaaiert vanuit de Merode"))}</title>
        <desc id="kaart-uitleg">${esc(T("wesp.kaart-uitleg", "Vanuit Landschapspark de Merode naar Holsbeek (Holsbeek Sessies), Leuven (PARK Festival en Beleuvenissen), Limburg (Limburg Sessies), Antwerpen (Muziekmuseum Vleeshuis) en Brussel (Klanken van de Steden)."))}</desc>
        <circle class="ring" cx="250" cy="250" r="90"/>
        <circle class="ring" cx="250" cy="250" r="160"/>
        <circle class="ring" cx="250" cy="250" r="228"/>
        ${KNOPEN.map((k, i) => `<line class="link" style="--d:${(0.7 + i * 0.22).toFixed(2)}s" x1="250" y1="250" x2="${k.cx}" y2="${k.cy}"/>`).join("\n        ")}
        <circle class="core" cx="250" cy="250" r="52"/>
        <text class="core-t" x="250" y="246" text-anchor="middle">de</text>
        <text class="core-t" x="250" y="266" text-anchor="middle">Merode</text>
        ${KNOPEN.map((k, i) => `<g class="knoop" style="--d:${(0.9 + i * 0.22).toFixed(2)}s"><circle class="dot" cx="${k.cx}" cy="${k.cy}" r="7"/>
          <text class="place" x="${k.px}" y="${k.py}"${k.einde ? ' text-anchor="end"' : ""}>${esc(k.naam)}</text>
          <text class="sub" x="${k.sx}" y="${k.sy}"${k.einde ? ' text-anchor="end"' : ""}>${esc(k.sub)}</text></g>`).join("\n        ")}
      </svg>`;

  // De drie sporen, elk met een beeld. Zonder rijen of foto in Notion gelden deze standaardwaarden.
  const SPOREN = [
    { titel: "We organiseren op erfgoed- en natuurplekken", tekst: "Zelf, of in opdracht van gemeenten of locaties: Merodefestival, kerkconcerten, zomerprogrammatie in Leuven, muzikale wandelingen.", link: "index.html#agenda", linktekst: "Naar de agenda", foto: "img/beeld/kerk.jpg", alt: "Vier muzikanten spelen in een kerk" },
    { titel: "We ontwikkelen mee muzikantencarrières", tekst: "We staan naast artiesten: we begeleiden, zoeken mee spreidingskansen, bieden een eerste podium en denken mee na over elk project.", link: "#samenwerken", linktekst: "Voor muzikanten", foto: "img/beeld/jong.jpg", alt: "Jonge muzikanten samen in een café" },
    { titel: "We vertellen het verhaal van de folk- en wereldmuziekscene", tekst: "Via video, opnames, boeken of podcast leggen we vast wat er op die bijzondere plekken gebeurt, zodat het niet stopt bij het laatste applaus.", link: "index.html#beleef", linktekst: "Beleef de Merode", foto: "img/beleef/podcast-6.webp", alt: "Twee muzikanten met accordeon bij een windmolen" },
  ];
  const sporenRijen = van("Spoor");
  const sporen = SPOREN.map((d, i) => {
    const r = sporenRijen[i];
    const titel = r?.titel || d.titel;
    const foto = r?.foto || d.foto;
    const l = r?.link ? href(r.link) : d.link;
    const lt = r ? (r.linktekst || "Meer info") : d.linktekst;
    return `<article class="w-spoor"><figure><img src="${esc(foto)}" alt="${esc(r?.foto ? titel : d.alt)}" loading="lazy" width="800" height="600"></figure><div class="w-spoor-tekst"><h3>${esc(titel)}</h3><p>${esc(r?.tekst || d.tekst)}</p>${l ? `<a class="w-link" href="${esc(l)}">${esc(lt)} →</a>` : ""}</div></article>`;
  }).join("");

  const pijlers = lijstRegels("wesp.pijlers", "Muziek | akoestisch, melodisch, verhalend\nLandschap | wandelingen, natuurgebieden, luisterplekken\nErfgoed | abdijen, kerken, kapellen, volkscafés\nGemeenschap | kerkfabrieken, gemeenten, 40 vrijwilligers");

  const projecten = van("Project").map(r => `<article class="w-rij"><p class="label w-label">${esc(r.label)}</p><div><h3>${esc(r.titel)}</h3><p>${esc(r.tekst)}</p></div><div>${link(r)}</div></article>`).join("");
  const opdrachtgevers = van("Opdrachtgever").map(r => `${esc(r.titel)}${r.tekst ? ` (${esc(r.tekst)})` : ""}`).join(", ");
  const partners = van("Partner").filter(r => r.label !== "Met steun van").map(r => esc(r.titel)).join(", ");
  const team = van("Team").map(r => `<div><dt>${esc(r.titel)}</dt><dd>${esc(r.tekst).replace(/\n/g, "<br>")}</dd></div>`).join("");

  const sectie = (id, klasse, inhoud, extra = "") => inhoud ? `<section class="w-sec ${klasse}" id="${id}"${extra}><div class="wrap">${inhoud}</div></section>` : "";
  const kop = (sleutel, standaard) => `<h2>${esc(T(sleutel, standaard))}</h2>`;
  const mailKnop = (sleutel, standaard, onderwerp, ghost) => `<a class="btn${ghost ? " ghost" : ""}" href="mailto:${MAIL}?subject=${encodeURIComponent(onderwerp)}">${esc(T(sleutel, standaard))}</a>`;

  const ankers = [
    ["sporen", T("wesp.nav.sporen", "Wat we doen")],
    ["samenwerken", T("wesp.nav.samenwerken", "Samenwerken")],
    projecten && ["projecten", T("wesp.nav.projecten", "Projecten")],
    ["team", T("wesp.nav.team", "Team en contact")],
  ].filter(Boolean);

  const samenwerken = `${kop("wesp.samenwerken.kop", "Samenwerken")}
    <div class="w-twee">
      <div class="w-col"><figure><img src="img/beeld/ovatie.jpg" alt="Een festivalpodium bij avond met veel publiek" loading="lazy" width="800" height="600"></figure>
        <h3>${esc(T("wesp.organisatoren.kop", "Voor gemeenten, kerkfabrieken en abdijen"))}</h3>
        <p>${esc(T("wesp.organisatoren.tekst", "Heeft jouw locatie een plek die om muziek vraagt? WESP zet ervaring, artiestennetwerk en productiekennis in: curatie, productie, communicatie en verantwoording, voor één concert, een reeks, een zomerprogrammatie of een festival."))}</p>
        <p class="w-klein">${esc(T("wesp.organisatoren.budget", "Elke samenwerking is anders van schaal en ambitie, en dus ook van budget: we bekijken samen wat mogelijk is."))}</p>
        ${opdrachtgevers ? `<p class="w-klein"><strong>${esc(T("wesp.opdrachtgevers.kop", "Zij werkten al met ons samen:"))}</strong> ${opdrachtgevers}.</p>` : ""}
        <div class="acties">${mailKnop("wesp.organisatoren.knop", "Bespreek jouw locatie", "Locatie voor muziek")}<a class="btn ghost" href="producties.html">${esc(T("wesp.knop-hero2", "Bekijk de producties"))}</a></div></div>
      <div class="w-col"><figure><img src="img/beeld/trio.jpg" alt="Drie muzikanten spelen in een kapel" loading="lazy" width="800" height="600"></figure>
        <h3>${esc(T("wesp.muzikanten.kop", "Voor muzikanten: een samenwerking, geen boeking"))}</h3>
        <p>${esc(T("wesp.muzikanten.tekst", "Een traject start met een gesprek, niet met een contract. We bespreken eerst wat je artistiek voor ogen hebt en zoeken dan de plek, het moment en de ondersteuning die passen: een residentie in een abdij of in het landschapspark, een concert op een bijzondere plek, hulp bij financiering, spreiding of promotie."))}</p>
        <p class="w-klein">${esc(T("wesp.muzikanten.contact", "We krijgen meer aanvragen dan we aankunnen. Vaker benaderen we zelf een artiest, wanneer plek, moment en artistieke klik samenkomen."))}</p>
        <p class="w-klein"><strong>${esc(T("wesp.artiesten.kop", "We werkten onder meer met"))}</strong> ${esc(T("wesp.artiesten", "Sara Salvérius, Laura Cortese, Andries Boone, Naragonia, Griff Trio, Rénélius Ensemble, Myrddin, Wouter Vandenabeele, Airboxes, Bamako Express, WÖR, Kongero, Shalan Alhamwy en vele anderen."))}</p>
        <div class="acties">${mailKnop("wesp.muzikanten.knop", "Vertel ons je plannen", "Projectvoorstel")}</div></div>
    </div>`;

  const body = `
  <section class="w-hero">
    <div class="wrap">
      <div class="w-hero-tekst">
        <p class="label">${esc(T("wesp.label", "Over WESP"))}</p>
        <p class="w-voorzin">${esc(T("wesp.voorzin", "WESP is het huis achter Merodefestival."))}</p>
        <h1>${esc(T("wesp.titel", "WESP brengt muziek naar plekken die er om vragen"))}</h1>
        <p class="w-lead">${esc(T("wesp.intro", "… en laat beide niet meer los. Een verlaten abdij, een vennengebied waar je de kikkers hoort, een kerk met een akoestiek die geen concertzaal je geeft."))}</p>
        <div class="acties">${mailKnop("wesp.knop-hero", "Praat met ons", "Samenwerking")}<a class="btn ghost" href="producties.html">${esc(T("wesp.knop-hero2", "Bekijk de producties"))}</a></div>
      </div>
      ${kaart}
    </div>
  </section>
  <nav class="w-ankers" aria-label="Op deze pagina"><div class="wrap">${ankers.map(([id, t]) => `<a href="#${id}">${esc(t)}</a>`).join("")}</div></nav>
  ${sectie("sporen", "licht", `<div class="w-sporen">${sporen}</div>`)}
  ${sectie("methode", "band", `<div class="w-methode"><div>${kop("wesp.methode.kop", "De Merode-methode")}<p class="w-intro">${esc(T("wesp.methode.tekst", "Het landschap is bij ons nooit decor. Een abdij, een dorpskerk of een broekbos is een bewuste artistieke keuze die mee bepaalt hoe muziek klinkt, wat ze vertelt en wie ernaar komt luisteren."))}</p></div><dl class="w-pijlers">${pijlers.map(p => `<div><dt>${esc(p.kop)}</dt><dd>${esc(p.tekst)}</dd></div>`).join("")}</dl></div>`, ' style="--bg:url(img/beeld/demer.jpg)"')}
  ${sectie("samenwerken", "licht", samenwerken)}
  ${sectie("projecten", "donker", projecten && `${kop("wesp.projecten.kop", "Projecten en netwerk")}<div class="w-rijen">${projecten}</div>`)}
  ${sectie("team", "licht", `<div class="w-team"><div>${kop("wesp.team.kop", "Team")}<p class="w-intro">${esc(T("wesp.team.intro", "WESP draait niet op één persoon. Zo’n 40 vrijwilligers zetten mee hun schouders onder elk evenement, project of verhaal."))}</p>${team ? `<dl class="w-lijst">${team}</dl>` : ""}</div>
    <div><h2>${esc(T("wesp.contact.kop", "Contact"))}</h2><p><a href="mailto:${MAIL}">${MAIL}</a><br><a href="tel:+32498758296">${TEL}</a></p><p class="w-klein">${esc(T("wesp.contact.adres", "WESP vzw, Jozef Wautersstraat 4, 3010 Kessel-Lo, BE 0863 441 738"))}</p>
    ${partners ? `<h3>${esc(T("wesp.partners.kop", "We werken onder meer samen met"))}</h3><p class="w-klein">${partners}. <a href="partners.html">${esc(T("wesp.partners.alle", "Alle partners"))} →</a></p>` : ""}</div></div>`)}`;

  // ---------- pagina-opmaak ----------
  const titel = "Over WESP";
  const beschrijving = T("wesp.beschrijving", "WESP vzw brengt folk- en wereldmuziek naar erfgoed- en natuurplekken, begeleidt muzikanten en vertelt hun verhaal. De organisatie achter Merodefestival.");
  const hoofd = kopEd
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(titel)} | Merodefestival</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(beschrijving)}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${SITE}/wesp">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(titel)}">`)
    .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${SITE}/${S.artwork}">`)
    .replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="css/wesp.css">');
  await fs.writeFile(path.join(ROOT, "wesp.html"), hoofd + "<main>" + body + "\n</main>" + voetEd);
  await fs.writeFile(path.join(ROOT, "css/wesp.css"), CSS);
  console.log(`Over WESP: pagina gebouwd (${rijen.length} rijen uit Notion).`);
  return ["wesp.html"];
}

const CSS = String.raw`/* Pagina Over WESP */
.w-hero{padding:4rem 0 3rem}
.w-hero .wrap{display:grid;grid-template-columns:1.1fr .9fr;gap:3rem;align-items:center}
.w-voorzin{margin:.5rem 0 0;font-size:1.3rem;color:var(--s-licht)}
.w-hero h1{font-size:clamp(2.1rem,5.2vw,3.7rem);margin:1.1rem 0 1.25rem;max-width:18ch}
.w-lead{font-size:1.3rem;color:var(--s-licht);max-width:34rem}
.w-hero .acties{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.5rem}
.radius{width:100%;max-width:480px;justify-self:center;overflow:visible}
.radius .ring{fill:none;stroke:rgba(239,231,218,.28);stroke-width:1.5}
.radius .core{fill:var(--s-oranje)}
.radius .core-t{fill:var(--s-op-oranje);font-family:var(--serif);font-size:17px}
.radius .dot{fill:var(--s-oranje)}
.radius .place{font-family:var(--serif);font-size:19px;fill:var(--s-licht)}
.radius .sub{font-size:14px;fill:var(--s-zand);font-family:var(--label)}
.radius .link{stroke:var(--s-oranje);stroke-width:1;stroke-dasharray:3 5;opacity:.6}
@media (prefers-reduced-motion:no-preference){
  .radius .ring{transform-origin:250px 250px;animation:w-grow 1.1s ease-out both}
  .radius .ring:nth-of-type(2){animation-delay:.15s}
  .radius .ring:nth-of-type(3){animation-delay:.3s}
  .radius .link,.radius .knoop{animation:w-in .9s ease-out both;animation-delay:var(--d,.8s)}
  @keyframes w-grow{from{opacity:0;transform:scale(.55)}to{opacity:1;transform:scale(1)}}
  @keyframes w-in{from{opacity:0}to{opacity:1}}
}
@media (max-width:860px){.w-hero .wrap{grid-template-columns:1fr;gap:2rem}}
.w-ankers{border-top:1px solid var(--s-nacht-2);border-bottom:1px solid var(--s-nacht-2);padding:.9rem 0}
.w-ankers .wrap{display:flex;flex-wrap:wrap;gap:.5rem}
.w-ankers a{padding:.4rem .95rem;border-radius:999px;font-family:var(--label);font-size:.95rem;text-decoration:none;box-shadow:inset 0 0 0 1.5px rgba(239,231,218,.35)}
.w-ankers a:hover{background:var(--s-licht);color:var(--s-nacht);box-shadow:none}
.w-sec{padding:4rem 0}
.w-sec .wrap{display:block}
.w-sec.licht{background:var(--s-papier);color:var(--s-papier-inkt)}
.w-sec.donker{background:var(--s-nacht);color:var(--s-licht)}
.w-sec.band{background:linear-gradient(rgba(28,20,15,.74),rgba(28,20,15,.86)),var(--bg) center/cover;color:var(--s-licht);padding:5rem 0}
.w-sec h2{font-size:clamp(1.8rem,3.5vw,2.4rem);margin:0 0 1rem}
.w-sec h3{font-size:1.35rem;margin:.9rem 0 .5rem}
.w-intro{max-width:44rem;font-size:1.15rem;margin:0}
.w-klein{font-size:1rem;opacity:.92;max-width:44rem}
.w-link{display:inline-block;margin-top:.6rem;font-family:var(--label);font-size:.95rem;text-underline-offset:4px}
.w-sec .acties{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.5rem}
.w-sec.licht .btn.ghost{color:var(--s-papier-inkt)}
.w-sporen{display:grid;grid-template-columns:repeat(3,1fr);gap:2rem}
.w-spoor figure,.w-col figure{margin:0}
.w-spoor img,.w-col img{display:block;width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;border-radius:4px}
.w-spoor-tekst{border-top:3px solid var(--s-oranje);margin-top:1rem;padding-top:.5rem}
.w-spoor h3{margin-top:.4rem}
.w-spoor p{margin:0}
.w-methode{display:grid;grid-template-columns:1.2fr 1fr;gap:3rem;align-items:center}
.w-pijlers,.w-lijst{margin:0}
.w-pijlers div,.w-lijst div{padding:.65rem 0;border-top:1px solid rgba(239,231,218,.25)}
.w-sec.licht .w-lijst div{border-top-color:var(--s-papier-lijn)}
.w-pijlers dt,.w-lijst dt{font-family:var(--label);font-size:1rem;color:var(--s-oranje)}
.w-sec.licht .w-lijst dt{color:var(--s-papier-zacht)}
.w-pijlers dd,.w-lijst dd{margin:.15rem 0 0}
.w-twee{display:grid;grid-template-columns:1fr 1fr;gap:3rem;margin-top:1.5rem}
.w-col h3{margin-top:1.1rem}
.w-col p{max-width:none}
.w-rijen{margin-top:1rem}
.w-rij{display:grid;grid-template-columns:8rem 1fr auto;gap:1.25rem;padding:1.1rem 0;border-top:1px solid rgba(239,231,218,.25);align-items:start}
.w-rij h3{margin:0 0 .3rem}
.w-rij p{margin:0}
.w-rij .w-label{opacity:.8}
.w-rij .w-link{margin-top:0}
.w-label{margin:0}
.w-team{display:grid;grid-template-columns:1.3fr 1fr;gap:3rem;align-items:start}
.w-team a{color:inherit}
@media (max-width:860px){
  .w-sporen,.w-methode,.w-twee,.w-team{grid-template-columns:1fr;gap:1.75rem}
  .w-rij{grid-template-columns:1fr;gap:.4rem}
  .w-sec{padding:3rem 0}
}
`;
