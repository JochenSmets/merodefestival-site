// Maakt per concert een eigen pagina in site/concert/, plus een agendabestand (.ics)
// en een sitemap. Draait na sync-notion.mjs, maar werkt ook los:
//   node scripts/build-pages.mjs
// SITE_URL bepaalt de volledige adressen voor delen op sociale media.

import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { T, laadTeksten, pasHomepage, seizoenOverrides, schrijfCatalogus } from "./teksten.mjs";
import { voorbouwHomepage } from "./voorbouw.mjs";
import { maakOmleidingen } from "./omleidingen.mjs";
import { bouwWesp } from "./build-wesp.mjs";
import { bouwInfo } from "./build-info.mjs";
import { bouw404 } from "./build-404.mjs";
import { afwerking } from "./afwerking.mjs";

const SITE = (process.env.SITE_URL || "https://www.merodefestival.be").replace(/\/$/, "");
const ROOT = path.resolve("site");
const OUT = path.join(ROOT, "concert");

const alles = JSON.parse(await fs.readFile(path.join(ROOT, "data/agenda.json"), "utf8"));
// Deze site toont enkel de concerten van Merodefestival (veld Website leeg = Merodefestival)
const SITE_NAAM = process.env.SITE_NAAM || "Merodefestival";
const hoortHier = e => !(e.sites || []).length ? SITE_NAAM === "Merodefestival" : e.sites.includes(SITE_NAAM);
const agenda = alles.filter(hoortHier);
const ctx = { window: {} };
vm.runInNewContext(await fs.readFile(path.join(ROOT, "seizoen/seizoen.js"), "utf8"), ctx);
await laadTeksten(ROOT);
const S = seizoenOverrides(ctx.window.SEIZOEN || {});

const MAAND = ["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"];
const MAAND_KORT = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];
const DAG = ["zondag","maandag","dinsdag","woensdag","donderdag","vrijdag","zaterdag"];
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const d = s => { const [y, m, dd] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, dd)); };
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const langeDatum = s => { const x = d(s); return `${DAG[x.getUTCDay()]} ${x.getUTCDate()} ${MAAND[x.getUTCMonth()]} ${x.getUTCFullYear()}`; };
const slugify = t => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Webadres: uit het veld Webadres, anders uit de naam (tot de eerste komma of dubbelpunt) en de datum
const gebruikt = new Set();
for (const e of agenda) {
  let s = e.webadres ? slugify(e.webadres)
    : `${slugify(e.artist.split(/[:,]| met /)[0]).slice(0, 48).replace(/-+$/, "")}-${e.start}`;
  let uniek = s, i = 2;
  while (gebruikt.has(uniek)) uniek = `${s}-${i++}`;
  gebruikt.add(uniek);
  e.slug = uniek;
}

// Eerste tijdstip uit "20.00 uur" of "18.30 en 20.00 uur"
const tijd = t => { const m = String(t || "").match(/(\d{1,2})[.:h](\d{2})/); return m ? [m[1].padStart(2, "0"), m[2]] : null; };

function spotifyEmbed(url) {
  const m = String(url || "").match(/open\.spotify\.com\/(?:intl-\w+\/)?(?:embed\/)?(track|album|artist|playlist|episode|show)\/([A-Za-z0-9]{22})/);
  return m ? { type: m[1], id: m[2] } : null;
}

function youtubeId(url) {
  const m = String(url || "").match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function ics(e) {
  const t = tijd(e.time);
  const dag = e.start.replace(/-/g, "");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Merodefestival//NL", "BEGIN:VEVENT",
    `UID:${e.slug}@merodefestival.be`,
    `DTSTAMP:${dag}T000000Z`, // vast, zodat de bestanden niet elk uur veranderen
    t ? `DTSTART;TZID=Europe/Brussels:${dag}T${t[0]}${t[1]}00` : `DTSTART;VALUE=DATE:${dag}`,
    t ? `DURATION:PT2H` : `DTEND;VALUE=DATE:${(e.end || e.start).replace(/-/g, "")}`,
    `SUMMARY:${e.artist.replace(/[,;]/g, "\\$&")}`,
    `LOCATION:${[e.place, e.adres || e.village].filter(Boolean).join(", ").replace(/[,;]/g, "\\$&")}`,
    `URL:${SITE}/concert/${e.slug}`,
    "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

// Einde van het evenement voor de zoekmachines: de einddatum als die er is, anders het laatste beginuur plus de duur (of 2 uur, zoals in de agenda-export).
function eindMoment(e) {
  const uren = [...String(e.time || "").matchAll(/(\d{1,2})[.:](\d{2})/g)];
  if (e.end || !uren.length) return e.end || e.start;
  const laatste = uren[uren.length - 1];
  let min = 120;
  const d = String(e.duur || "");
  const u = d.match(/(\d+(?:[.,]\d+)?)\s*(?:uur|u\b|h\b)/i), m = d.match(/(\d+)\s*min/i);
  if (u || m) min = Math.round((u ? parseFloat(u[1].replace(",", ".")) * 60 : 0) + (m ? +m[1] : 0));
  const [J, M, D] = e.start.split("-").map(Number);
  const eind = new Date(Date.UTC(J, M - 1, D, +laatste[1], +laatste[2]) + min * 60000);
  const p = n => String(n).padStart(2, "0");
  return `${eind.getUTCFullYear()}-${p(eind.getUTCMonth() + 1)}-${p(eind.getUTCDate())}T${p(eind.getUTCHours())}:${p(eind.getUTCMinutes())}`;
}

function jsonld(e, beeld) {
  const t = tijd(e.time);
  const voorbij = (e.end || e.start) < new Date().toISOString().slice(0, 10);
  const data = {
    "@context": "https://schema.org", "@type": "MusicEvent",
    name: e.artist,
    startDate: t ? `${e.start}T${t[0]}:${t[1]}` : e.start,
    endDate: eindMoment(e),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Place", name: e.place, address: { "@type": "PostalAddress", addressLocality: e.village, addressCountry: "BE" } },
    image: [beeld],
    description: e.sub || e.kind,
    // Een festival of een reeks met een einddatum heeft geen enkele uitvoerder; een concert wel
    ...(e.end ? {} : { performer: { "@type": "PerformingGroup", name: e.artist } }),
    organizer: { "@type": "Organization", name: "Merodefestival / WESP vzw", url: SITE },
    // Na het concert geen ticketaanbod meer
    ...(e.tickets && !voorbij ? { offers: { "@type": "Offer", url: e.tickets, availability: e.volzet ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      ...(e.price && /\d/.test(e.price) ? { price: e.price.replace(/[^\d,.]/g, "").replace(",", "."), priceCurrency: "EUR" } : {}) } } : {}),
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function blokkenHtml(bl) {
  let h = "", lijst = false;
  for (const b of bl) {
    if (b.type === "li") { if (!lijst) { h += "<ul>"; lijst = true; } h += `<li>${b.html}</li>`; continue; }
    if (lijst) { h += "</ul>"; lijst = false; }
    if (b.type === "raw") { h += b.html; continue; }
    h += b.type === "quote" ? `<blockquote>${b.html}</blockquote>` : b.type === "h" ? `<h3>${b.html}</h3>` : `<p>${b.html}</p>`;
  }
  return lijst ? h + "</ul>" : h;
}

function pagina(e, overige) {
  const datumregel = `${cap(langeDatum(e.start))}${e.end ? ` tot ${langeDatum(e.end)}` : ""}${e.time ? ` · ${e.time}` : ""}`;
  const beeldLokaal = e.foto ? `../${e.foto}` : `../${S.artwork}`;
  const extraBeelden = (e.beelden || []).filter(b => b.src !== e.foto);
  const beeldAbs = `${SITE}/${e.foto || S.artwork}`;
  const alineas = String(e.text || "").split(/\n\s*\n/).filter(Boolean);
  const omschrijving = (e.sub ? e.sub + ". " : "") + (alineas[0] || `${e.kind} in ${e.place}, ${e.village}.`);
  let yts = (e.videos || []).map(youtubeId).filter(Boolean);
  const sps = (e.spotify || []).map(spotifyEmbed).filter(Boolean);
  const kerk = /kerkconcert/i.test(e.kind);
  const route = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.adres || [e.place, e.village].filter(Boolean).join(", "))}`;
  const ticket = e.volzet ? `<span class="soldout">${T("concert.volzet", "Volzet")}</span>`
    : e.tickets ? `<a class="btn" href="${esc(e.tickets)}">${esc(e.cta || T("concert.koop", "Koop tickets"))}${e.price ? ` (${esc(e.price)})` : ""}</a>` : "";

  // Foto’s en video’s midden in de tekst: een alinea [foto’s] of [video: adres] in de Notion-pagina bepaalt waar ze komen.
  // Zonder zo’n alinea staan de foto’s en video’s onder de tekst, zoals voorheen.
  const beeldenHtml = extraBeelden.length ? `<section class="beelden" aria-labelledby="beelden-titel">
          <h2 class="label" id="beelden-titel">${T("concert.fotos", "Foto’s")}</h2>
          <div class="beeldgrid">${extraBeelden.map(b => `<figure><a href="../${esc(b.src)}" target="_blank" rel="noopener"><img src="../${esc(b.src)}" alt="${esc(b.alt)}" loading="lazy"></a>${b.fotograaf ? `<figcaption>${T("algemeen.foto", "Foto:")} ${esc(b.fotograaf)}</figcaption>` : ""}</figure>`).join("")}</div>
        </section>` : "";
  const platTekst = h => String(h || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").trim();
  let fotosInTekst = false;
  const inlineVideos = [];
  const tekstBlokken = (e.lang || []).map(bl => {
    if (bl.type !== "p") return bl;
    const t = platTekst(bl.html);
    if (/^\[(?:foto['’]?s|beelden)\]$/i.test(t)) {
      // Geen foto’s (of al getoond)? Dan verdwijnt de markering, zodat er nooit "[foto's]" op de pagina staat
      if (!beeldenHtml || fotosInTekst) return { type: "raw", html: "" };
      fotosInTekst = true;
      return { type: "raw", html: beeldenHtml };
    }
    const v = t.match(/^\[video:\s*(\S+?)\s*\]$/i);
    const id = v && youtubeId(v[1]);
    if (id) {
      inlineVideos.push(id);
      return { type: "raw", html: `<div class="videos"><div class="video"><button class="yt" type="button" data-id="${id}" aria-label="Speel video af: ${esc(e.artist)}" style="background-image:url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)"><span class="play" aria-hidden="true"></span></button></div></div>` };
    }
    return bl;
  });
  yts = yts.filter(id => !inlineVideos.includes(id));

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(e.artist)} – ${esc(langeDatum(e.start))} | Merodefestival</title>
<meta name="description" content="${esc(omschrijving.slice(0, 220))}">
<link rel="canonical" href="${SITE}/concert/${e.slug}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(e.artist)}">
<meta property="og:description" content="${esc(datumregel)}, ${esc([e.place, e.village].filter(Boolean).join(", "))}">
<meta property="og:image" content="${esc(beeldAbs)}">
<meta property="og:url" content="${SITE}/concert/${e.slug}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="32x32" href="../img/favicon-32.png">
<link rel="apple-touch-icon" href="../img/favicon.png">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="192x192" href="/img/favicon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Alatsi&family=Alegreya:ital,wght@0,400;0,500;0,700;1,400;1,500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../seizoen/seizoen.css">
<link rel="stylesheet" href="../css/publiek.css">
<link rel="stylesheet" href="../css/concert.css">
<script type="application/ld+json">${jsonld(e, beeldAbs)}</script>
</head>
<body>

<header>
  <div class="wrap bar">
    <a class="brand" href="../index.html"><img src="../${esc(S.logo)}" alt="Merodefestival" width="82" height="56"></a>
    <button class="menu-toggle" aria-expanded="false" aria-controls="hoofdmenu">${T("menu.menu", "Menu")}</button>
    <nav id="hoofdmenu" aria-label="Hoofdmenu">
      <ul>
        <li><a href="../index.html#agenda">${T("menu.agenda", "Agenda")}</a></li>
        <li><a href="../index.html#festival">${T("menu.festival", "Festival 2027")}</a></li>
        <li><a href="../producties.html">${T("menu.producties", "Producties")}</a></li>
        <li><a href="../wesp.html">${T("menu.wesp", "Over WESP")}</a></li>
        <li><a href="../vorige-edities.html">${T("menu.edities", "Vorige edities")}</a></li>
      </ul>
    </nav>
    <a class="btn" href="${esc(S.ticketlink || e.tickets || "#")}">${T("menu.tickets", "Tickets")}</a>
  </div>
</header>

<main>
  <section class="chero" aria-labelledby="titel">
    <div class="wrap">
      <div class="chero-tekst">
        <a class="terug" href="../index.html#agenda">${T("concert.terug", "← Agenda")}</a>
        <p class="label datumregel">${esc(datumregel)}</p>
        ${e.sub ? `<p class="csub">${esc(e.sub)}</p>` : ""}
        <h1 id="titel">${esc(e.artist)}${e.origin ? ` <span class="herkomst">(${esc(e.origin)})</span>` : ""}</h1>
        <p class="waar">${esc([e.place, e.village].filter(Boolean).join(", "))}</p>
        <div class="acties" id="acties">${ticket}</div>
      </div>
      <figure class="cbeeld${e.foto ? " foto" : ""}">
        <img src="${esc(beeldLokaal)}" alt="${e.foto ? esc(e.fotoAlt || e.artist) : esc(S.artworkAlt || "")}">
        ${e.foto && e.fotograaf ? `<figcaption>${T("algemeen.foto", "Foto:")} ${esc(e.fotograaf)}</figcaption>` : ""}
      </figure>
    </div>
  </section>

  <section class="papier" aria-label="Over dit concert">
    <div class="wrap cgrid">
      <article class="ctekst">
        ${tekstBlokken.length ? blokkenHtml(tekstBlokken)
          : alineas.length ? alineas.map(p => `<p>${esc(p)}</p>`).join("\n        ")
          : `<p>${esc(e.kind)} in ${esc(e.place)}, ${esc(e.village)}.</p>`}
        ${fotosInTekst ? "" : beeldenHtml}
        ${yts.length || sps.length ? `<section class="luister" id="luister" aria-labelledby="luister-titel">
          <h2 class="label" id="luister-titel">${T("concert.luister", "Kijk en luister")}</h2>
          ${yts.length ? `<div class="videos${yts.length > 1 ? " meer" : ""}">${yts.map((id, i) => `<div class="video"><button class="yt" type="button" data-id="${id}" aria-label="Speel video ${i + 1} af: ${esc(e.artist)}" style="background-image:url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)"><span class="play" aria-hidden="true"></span></button></div>`).join("")}</div>` : ""}
          ${sps.length ? `<div class="spotify">${sps.map(x => `<iframe src="https://open.spotify.com/embed/${x.type}/${x.id}?utm_source=generator&amp;theme=0" title="Spotify: ${esc(e.artist)}" height="${/album|playlist|show/.test(x.type) ? 352 : 152}" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>`).join("")}</div>` : ""}
        </section>` : ""}
      </article>
      <aside class="praktisch">
        <h2 class="label">${T("concert.praktisch", "Praktisch")}</h2>
        <dl>
          <div><dt>${T("concert.wanneer", "Wanneer")}</dt><dd>${esc(datumregel)}</dd></div>
          <div><dt>${T("concert.waar", "Waar")}</dt><dd>${esc(e.place)}${e.adres ? `<br>${esc(e.adres)}` : e.village ? `<br>${esc(e.village)}` : ""}<br><a href="${route}">${T("concert.route", "Route")}</a></dd></div>
          ${e.duur ? `<div><dt>${T("concert.duur", "Duur")}</dt><dd>${esc(e.duur)}</dd></div>` : ""}
          ${e.price ? `<div><dt>${T("concert.prijs", "Prijs")}</dt><dd>${esc(e.price)}</dd></div>` : ""}
          ${kerk ? (S.tickets || []).filter(([k]) => /combi/i.test(k)).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("") : ""}
        </dl>
        <div class="acties" id="acties-2">${ticket}</div>
        <p class="ics"><a href="${e.slug}.ics" download>${T("concert.ics", "Zet in je agenda")}</a></p>
      </aside>
    </div>
  </section>

  ${overige.length ? `<section class="donker ook" aria-labelledby="ook-titel">
    <div class="wrap">
      <h2 id="ook-titel">${T("concert.ook", "Ook in de agenda")}</h2>
      <ul class="ook-lijst">
        ${overige.map(o => { const x = d(o.start); return `<li><a href="${o.slug}.html"><span class="label">${x.getUTCDate()} ${MAAND_KORT[x.getUTCMonth()]} · ${esc(o.village)}</span><span class="naam">${esc(o.artist)}</span></a></li>`; }).join("\n        ")}
      </ul>
      <a class="btn ghost" href="../index.html#agenda">${T("concert.hele-agenda", "Hele agenda")}</a>
    </div>
  </section>` : ""}
</main>

<footer>
  <div class="wrap"><img class="foot-logo" src="../${esc(S.logo)}" alt="Merodefestival" width="147" height="100" loading="lazy"></div>
  <div class="wrap cols">
    <div>
      <h3>${T("footer.contact", "Contact")}</h3>
      <p><a href="mailto:info@merodefestival.be">info@merodefestival.be</a></p>
      <p><a href="tel:+32498758296">0498 75 82 96</a></p>
      <p>${T("footer.organisatie", "Merodefestival is een project van WESP vzw, BE 0863 441 738, Jozef Wautersstraat 4, 3010 Kessel-Lo")}</p>
    </div>
    <div>
      <h3>${T("footer.volg", "Volg ons")}</h3>
      <ul>
        <li><a href="https://www.facebook.com/merodefestival">Facebook</a></li>
        <li><a href="https://www.instagram.com/merodefestival/">Instagram</a></li>
        <li><a href="https://www.youtube.com/channel/UCahKa1lM3yaWEwXdV_bBJdw">YouTube</a></li>
      </ul>
    </div>
    <div>
      <h3>${T("footer.steun-kop", "Met steun van")}</h3>
      <p>${T("footer.steun", "De Vlaamse overheid, kunsten en erfgoed, de provincie Vlaams-Brabant, de Nationale Loterij en projectvereniging de Merode. Met de medewerking van de parochies en kerkfabrieken.")}</p>
      <p>${esc(S.credit || "")}</p>
    </div>
  </div>
</footer>

<script>
// Voorbij? Dan geen ticketknop meer
(function () {
  var einde = new Date("${e.end || e.start}T23:59:59");
  if (new Date() > einde) {
    ["acties", "acties-2"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = '<span class="soldout">${esc(T("concert.voorbij", "Dit concert is voorbij")).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}</span>';
    });
  }
  // Video's laden pas bij een klik (sneller, en geen YouTube-cookies vooraf).
  // Vanaf je eigen computer (file://) weigert YouTube in te sluiten: dan openen we YouTube zelf.
  document.querySelectorAll(".yt").forEach(function (b) {
    b.addEventListener("click", function () {
      var id = b.getAttribute("data-id");
      if (location.protocol === "file:") { window.open("https://www.youtube.com/watch?v=" + id, "_blank", "noopener"); return; }
      var f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0";
      f.title = b.getAttribute("aria-label");
      f.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture; fullscreen");
      f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      f.allowFullscreen = true;
      b.replaceWith(f);
    });
  });
  var t = document.querySelector(".menu-toggle"), n = document.getElementById("hoofdmenu");
  t.addEventListener("click", function () { var o = n.classList.toggle("open"); t.setAttribute("aria-expanded", o); });
})();
</script>
</body>
</html>
`;
}

// Oude pagina's opruimen en nieuwe schrijven
await fs.mkdir(OUT, { recursive: true });
for (const f of await fs.readdir(OUT)) await fs.unlink(path.join(OUT, f));

const vandaag = new Date().toISOString().slice(0, 10);
const komend = agenda.filter(e => (e.end || e.start) >= vandaag);
for (const e of agenda) {
  // Eerst wat erna komt, aangevuld met wat ervoor ligt
  const na = komend.filter(o => o !== e && o.start >= e.start);
  const voor = komend.filter(o => o !== e && o.start < e.start).reverse();
  const overige = [...na, ...voor].slice(0, 3);
  await fs.writeFile(path.join(OUT, `${e.slug}.html`), pagina(e, overige));
  await fs.writeFile(path.join(OUT, `${e.slug}.ics`), ics(e));
}

// Webadressen terugschrijven zodat de homepage ernaar kan linken
const json = JSON.stringify(alles, null, 2);
await fs.writeFile(path.join(ROOT, "data/agenda.json"), json + "\n");
await fs.writeFile(path.join(ROOT, "data/agenda.js"), `window.AGENDA = ${json};\n`);


// ---------- Vorige edities (uit site/data/edities.json) ----------
const edities = JSON.parse(await fs.readFile(path.join(ROOT, "data/edities.json"), "utf8"));
const seizoenen = JSON.parse(await fs.readFile(path.join(ROOT, "data/kerkconcerten.json"), "utf8"));
// Affiche tonen als site/img/affiches/<jaar>.jpg bestaat
const affiche = async j => { try { await fs.access(path.join(ROOT, `img/affiches/${j}.jpg`)); return `img/affiches/${j}.jpg`; } catch { return ""; } };
for (const x of edities) x._affiche = await affiche(x.jaar);
const korteDatum = s => { const x = d(s); return `${DAG[x.getUTCDay()].slice(0, 2)} ${x.getUTCDate()} ${MAAND_KORT[x.getUTCMonth()]} ${x.getUTCFullYear()}`; };
await fs.writeFile(path.join(ROOT, "data/edities.js"), `window.EDITIES = ${JSON.stringify(edities.map(({ _affiche, ...x }) => x), null, 2)};\n`);
const videoKnop = (id, label) => `<div class="video"><button class="yt" type="button" data-id="${id}" aria-label="${esc(label)}" style="background-image:url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)"><span class="play" aria-hidden="true"></span></button></div>`;
const editiesHtml = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Vorige edities | Merodefestival</title>
<meta name="description" content="Meer dan tien jaar Merodefestival: alle edities sinds 2015, met programma, foto’s en video’s.">
<link rel="canonical" href="${SITE}/vorige-edities">
<meta property="og:title" content="Merodefestival sinds 2015">
<meta property="og:image" content="${SITE}/${S.artwork}">
<link rel="icon" type="image/png" sizes="32x32" href="img/favicon-32.png">
<link rel="apple-touch-icon" href="img/favicon.png">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="192x192" href="/img/favicon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Alatsi&family=Alegreya:ital,wght@0,400;0,500;0,700;1,400;1,500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="seizoen/seizoen.css">
<link rel="stylesheet" href="css/publiek.css">
<link rel="stylesheet" href="css/concert.css">
<style>
.ed-hero{padding:4rem 0 3rem}
.ed-hero h1{font-size:clamp(2.6rem,7vw,5rem);margin:.5rem 0 1rem}
.ed-hero p{max-width:42rem;font-size:1.25rem;color:var(--s-licht)}
.ed-nav{list-style:none;display:flex;flex-wrap:wrap;gap:.5rem;padding:0;margin:2rem 0 0}
.ed-nav a{display:inline-block;padding:.35rem .8rem;border:1px solid var(--s-zand);border-radius:999px;font-family:var(--label);text-decoration:none}
.ed-nav a:hover{border-color:var(--s-oranje);color:var(--s-oranje)}
.editie{display:grid;grid-template-columns:12rem 1fr;gap:2.5rem;padding:3rem 0;border-top:1px solid var(--s-papier-lijn)}
.editie:first-child{border-top:0}
.editie>div{min-width:0}
.editie .jaar{font-family:var(--label);font-size:clamp(3rem,7vw,4.5rem);line-height:.9;color:var(--s-oranje);filter:brightness(.85)}
.editie .plek{display:block;margin-top:.5rem;font-size:1.15rem}
.editie h2{font-size:1.5rem;margin:0 0 .75rem}
.editie .prog{font-size:1.2rem;margin:0 0 1rem;max-width:44rem}
.editie .prog strong{font-family:var(--label);font-weight:400;font-size:.9rem;color:var(--s-papier-zacht);display:block;margin-bottom:.25rem}
.editie .tekst{font-style:italic;margin:0 0 1rem}
.ed-sub{color:var(--s-zand);margin:1.75rem 0 -.75rem}
.editie .plek.zacht{font-size:.98rem;color:var(--s-papier-zacht);margin-top:.15rem}
.affiche{display:block;width:100%;max-width:12rem;margin-top:1.25rem;border-radius:2px;box-shadow:0 6px 18px rgba(0,0,0,.18)}
.namen{list-style:none;margin:.25rem 0 0;padding:0;columns:2;column-gap:2rem}
.namen li{break-inside:avoid;padding:.15rem 0}
.namen.klein{font-size:1rem;columns:3}
.editie .prog{margin-bottom:1.5rem}
.kerk-archief{padding:4.5rem 0 5rem;border-top:1px solid var(--s-papier-lijn)}
.kerk-archief h2{font-size:clamp(2rem,4.5vw,3rem);margin-bottom:.5rem}
.kerk-intro{font-style:italic;color:var(--s-papier-zacht);margin:0 0 2.5rem;max-width:40rem}
.kgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:2.5rem 3rem;align-items:start}
.kseizoen{text-align:center;padding:2rem 1.5rem;border:1px solid var(--s-papier-lijn);border-radius:3px}
.kcover{display:block;width:9rem;margin:0 auto 1.5rem;box-shadow:0 6px 18px rgba(0,0,0,.2);border-radius:2px}
.kt{font-weight:400;font-size:clamp(1.4rem,2.6vw,1.9rem);letter-spacing:.28em;line-height:1.15;color:var(--s-papier-zacht);margin:0 0 1.5rem}
.kt span{display:block}
.kt em{font-style:normal;color:var(--s-oranje)}
.kopm{font-style:italic;color:var(--s-papier-zacht);font-size:.98rem;margin:0 0 1rem}
.kerk-lijst{list-style:none;margin:0;padding:0}
.kerk-lijst li{padding:.2rem 0 .9rem}
.kerk-lijst li + li::before{content:"× × ×";display:block;letter-spacing:.4em;color:var(--s-papier-zacht);font-family:var(--label);font-size:.85rem;margin-bottom:.9rem}
.kd{display:block;font-family:var(--label);font-size:.92rem;color:var(--s-papier-inkt)}
.ka{display:block;font-weight:700;font-size:1.08rem;line-height:1.3;margin:.1rem 0}
.kk{display:block;font-size:.95rem;color:var(--s-papier-zacht)}
.kvid{width:13rem;max-width:100%;margin:.6rem auto 0}
.kvid .play{transform:scale(.7)}
@media (max-width:820px){.kgrid{grid-template-columns:1fr}}
.editie .dank{font-size:.95rem;color:var(--s-papier-zacht);margin:1rem 0 0}
.editie .videos{grid-template-columns:repeat(3,1fr)}
.editie .videos .video:first-child{grid-column:auto}
@media (max-width:820px){.editie{grid-template-columns:1fr;gap:1rem}.editie .videos{grid-template-columns:1fr 1fr}}
@media (max-width:520px){.editie .videos{grid-template-columns:1fr}}
</style>
</head>
<body>
<header>
  <div class="wrap bar">
    <a class="brand" href="index.html"><img src="${esc(S.logo)}" alt="Merodefestival" width="82" height="56"></a>
    <button class="menu-toggle" aria-expanded="false" aria-controls="hoofdmenu">${T("menu.menu", "Menu")}</button>
    <nav id="hoofdmenu" aria-label="Hoofdmenu">
      <ul>
        <li><a href="index.html#agenda">${T("menu.agenda", "Agenda")}</a></li>
        <li><a href="index.html#festival">${T("menu.festival", "Festival 2027")}</a></li>
        <li><a href="producties.html">${T("menu.producties", "Producties")}</a></li>
        <li><a href="wesp.html">${T("menu.wesp", "Over WESP")}</a></li>
        <li><a href="vorige-edities.html">${T("menu.edities", "Vorige edities")}</a></li>
      </ul>
    </nav>
    <a class="btn" href="${esc(S.ticketlink || "#")}">${T("menu.tickets", "Tickets")}</a>
  </div>
</header>
<main>
  <section class="ed-hero">
    <div class="wrap">
      <a class="terug" href="index.html">${T("edities.terug", "← Homepage")}</a>
      <h1>${T("edities.titel", "Merodefestival sinds 2015")}</h1>
      <p>${T("edities.intro", "Na de eerste editie in 2015 mocht Merodefestival rustig groeien: elk jaar het beste van de Europese folkscene in de Meroderegio, en sinds 2017 ook een concertreeks door het jaar heen. Grasduin door meer dan tien jaar festival.")}</p>
      <p class="ed-sub label">${T("edities.festival", "Festival")}</p>
      <ul class="ed-nav">${edities.map(x => `<li><a href="#${x.jaar}">${x.jaar}</a></li>`).join("")}</ul>
      <p class="ed-sub label">${T("edities.kerkconcerten", "Kerkconcerten")}</p>
      <ul class="ed-nav">${seizoenen.map(z => `<li><a href="#kerk-${z.seizoen.slice(0, 4)}">${z.seizoen}</a></li>`).join("")}</ul>
    </div>
  </section>
  <section class="papier">
    <div class="wrap" style="display:block">
      ${edities.map(x => `<article class="editie" id="${x.jaar}">
        <div>
          <span class="jaar">${x.jaar}</span>
          ${x.datum ? `<span class="plek">${esc(x.datum)}</span>` : ""}
          ${x.plek ? `<span class="plek zacht">${esc(x.plek)}</span>` : ""}
          ${x._affiche ? `<img class="affiche" src="${x._affiche}" alt="Affiche Merodefestival ${x.jaar}" loading="lazy">` : ""}
        </div>
        <div>
          ${x.titel ? `<h2>${esc(x.titel)}</h2>` : ""}
          ${x.tekst ? `<p class="tekst">${esc(x.tekst)}</p>` : ""}
          ${x.concerten ? `<div class="prog"><strong>${x.onvolledig ? T("edities.programma-onvolledig", "Op het programma onder meer") : T("edities.concerten", "Concerten")}</strong><ul class="namen">${x.concerten.map(n => `<li>${esc(n)}</li>`).join("")}</ul></div>` : ""}
          ${x.wandelingen ? `<div class="prog"><strong>${T("edities.wandelingen", "Muzikale wandelingen")}${x.wandelplekken ? ` ${T("edities.in", "in")} ${esc(x.wandelplekken)}` : ""}</strong><ul class="namen klein">${x.wandelingen.map(n => `<li>${esc(n)}</li>`).join("")}</ul></div>` : ""}
          ${(x.videos || []).length ? `<div class="videos">${x.videos.map((id, i) => videoKnop(id, `Video ${i + 1} van ${x.jaar}`)).join("")}</div>` : ""}
          ${x.fotos ? `<p class="dank">${T("edities.dank", "Foto’s en video’s: met dank aan")} ${esc(x.fotos)}.</p>` : ""}
        </div>
      </article>`).join("\n      ")}
    </div>
  </section>
  <section class="papier kerk-archief" aria-labelledby="kerk-titel">
    <div class="wrap" style="display:block">
      <h2 id="kerk-titel">${T("edities.kerk-titel", "Kerkconcerten")}</h2>
      <p class="kerk-intro">${T("edities.kerk-intro", "Sinds 2017 brengt Merodefestival ook buiten het festival wereld- en folkmuziek naar de dorpskerken van de Merode.")}</p>
      <div class="kgrid">
      ${seizoenen.map(z => `<article class="kseizoen" id="kerk-${z.seizoen.slice(0, 4)}">
        ${z.brochure ? `<img class="kcover" src="${esc(z.brochure)}" alt="Brochure kerkconcerten ${esc(z.seizoen)}" loading="lazy">` : ""}
        <h3 class="kt"><span>${T("edities.kerk-reeks", "kerk – concerten")}</span><span>${esc(z.seizoen).replace(/(\d{3})(\d)/g, "$1<em>$2</em>")}</span></h3>
        ${z.opmerking ? `<p class="kopm">${esc(z.opmerking)}</p>` : ""}
        <ol class="kerk-lijst">${z.concerten.map(k => `<li>
          ${k.datum ? `<span class="kd">${esc(cap(langeDatum(k.datum)))}</span>` : ""}
          <span class="ka">${esc(k.artiest)}</span>
          ${k.kerk ? `<span class="kk">${esc(k.kerk)}</span>` : ""}
          ${k.video ? `<div class="video kvid"><button class="yt" type="button" data-id="${k.video}" aria-label="Video: ${esc(k.artiest)}" style="background-image:url(https://i.ytimg.com/vi/${k.video}/hqdefault.jpg)"><span class="play" aria-hidden="true"></span></button></div>` : ""}
        </li>`).join("")}</ol>
        ${z.onvolledig ? `<p class="kopm">${T("edities.onvolledig", "Dit seizoen is nog niet volledig aangevuld.")}</p>` : ""}
      </article>`).join("\n      ")}
      </div>
    </div>
  </section>
</main>
<footer>
  <div class="wrap"><img class="foot-logo" src="${esc(S.logo)}" alt="Merodefestival" width="147" height="100" loading="lazy"></div>
  <div class="wrap cols">
    <div><h3>${T("footer.contact", "Contact")}</h3><p><a href="mailto:info@merodefestival.be">info@merodefestival.be</a></p><p><a href="tel:+32498758296">0498 75 82 96</a></p><p>${T("footer.organisatie", "Merodefestival is een project van WESP vzw, BE 0863 441 738, Jozef Wautersstraat 4, 3010 Kessel-Lo")}</p></div>
    <div><h3>${T("footer.volg", "Volg ons")}</h3><ul><li><a href="https://www.facebook.com/merodefestival">Facebook</a></li><li><a href="https://www.instagram.com/merodefestival/">Instagram</a></li><li><a href="https://www.youtube.com/channel/UCahKa1lM3yaWEwXdV_bBJdw">YouTube</a></li></ul></div>
    <div><h3>${T("footer.steun-kop", "Met steun van")}</h3><p>${T("footer.steun", "De Vlaamse overheid, kunsten en erfgoed, de provincie Vlaams-Brabant, de Nationale Loterij en projectvereniging de Merode. Met de medewerking van de parochies en kerkfabrieken.")}</p><p>${esc(S.credit || "")}</p></div>
  </div>
</footer>
<script>
document.querySelectorAll(".yt").forEach(function (b) {
  b.addEventListener("click", function () {
    var id = b.getAttribute("data-id"), vm = b.getAttribute("data-vimeo"), h = b.getAttribute("data-h");
    if (location.protocol === "file:") { window.open(vm ? "https://vimeo.com/" + vm : "https://www.youtube.com/watch?v=" + id, "_blank", "noopener"); return; }
    var f = document.createElement("iframe");
    f.src = vm ? "https://player.vimeo.com/video/" + vm + "?" + (h ? "h=" + h + "&" : "") + "autoplay=1"
              : "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0";
    f.title = b.getAttribute("aria-label");
    f.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture; fullscreen");
    f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    f.allowFullscreen = true;
    b.replaceWith(f);
  });
});
var t = document.querySelector(".menu-toggle"), n = document.getElementById("hoofdmenu");
t.addEventListener("click", function () { var o = n.classList.toggle("open"); t.setAttribute("aria-expanded", o); });
</script>
</body>
</html>
`;
await fs.writeFile(path.join(ROOT, "vorige-edities.html"), editiesHtml);
// ---------- Beleef de Merode (uit site/data/beleef.json) ----------
const beleefAlle = JSON.parse(await fs.readFile(path.join(ROOT, "data/beleef.json"), "utf8"));
// De vroegere Beleef-pagina’s zijn volwaardige producties geworden (pagina’s onder Producties): geen aparte pagina’s meer
const NAAR_PRODUCTIE = {
  "ode-aan-de-merode": "productie-ode-aan-de-merode",
  "the-sound-of-the-abbey": "productie-the-sound-of-the-abbey",
  "podcast": "productie-wandelpodcast",
  "volkscafes": "productie-volkscafes",
};
const beleef = beleefAlle.filter(b => !NAAR_PRODUCTIE[b.slug]);
const beleefHref = slug => (NAAR_PRODUCTIE[slug] || slug) + ".html";
for (const slug of Object.keys(NAAR_PRODUCTIE)) await fs.rm(path.join(ROOT, `${slug}.html`), { force: true });
const [kopEd, restEd] = editiesHtml.split("<main>");
const voetEd = restEd.split("</main>")[1];
const ytKnop = (id, label) => `<div class="video"><button class="yt" type="button" data-id="${id}" aria-label="${esc(label)}" style="background-image:url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)"><span class="play" aria-hidden="true"></span></button></div>`;
const beleefCss = `<style>
.bl-hero{padding:4rem 0 3.5rem}
.bl-hero .wrap{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:3rem;align-items:center}
.bl-hero h1{font-size:clamp(2.4rem,6vw,4.4rem);margin:.4rem 0 .5rem;line-height:1.05}
.bl-hero .onder{font-style:italic;color:var(--s-zand);font-size:1.25rem;margin:0 0 1.25rem}
.bl-hero .intro{font-size:1.15rem;color:var(--s-licht);max-width:40rem}
.bl-hero figure{margin:0}
.bl-hero figure img{display:block;width:100%;height:auto;max-height:34rem;object-fit:contain;border-radius:3px}
.bl-inhoud .wrap{display:block}
.bl-blokken{display:grid;grid-template-columns:repeat(auto-fit,minmax(18rem,1fr));gap:2rem 3rem;margin-bottom:3rem}
.bl-blokken h2,.bl-sectie h2{font-size:1.6rem;margin:0 0 .6rem}
.bl-blokken p{margin:0 0 .6rem}
.bl-sectie{margin:3rem 0;padding-top:2.5rem;border-top:1px solid var(--s-papier-lijn)}
.tracks{columns:2;column-gap:3rem;padding-left:1.4rem;margin:0}
.tracks li{break-inside:avoid;padding:.2rem 0}
.trackvideos{list-style:none;padding:0;margin:1.25rem 0 0;display:grid;grid-template-columns:repeat(auto-fill,minmax(16rem,1fr));gap:2rem 1.5rem}
.trackvideos .video{margin-bottom:.6rem}
.tnr{font-family:var(--label);color:var(--s-oranje);margin-right:.5rem}
.twie{font-weight:700}
.twat{display:block;font-style:italic;color:var(--s-papier-zacht)}
.bl-knoppen{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.5rem}
.btn.lijn{background:transparent;color:var(--s-papier-inkt);box-shadow:inset 0 0 0 1.5px currentColor}
.btn.lijn:hover{background:var(--s-papier-inkt);color:var(--s-papier)}
.sp-album{display:block;width:100%;height:380px;border:0;border-radius:12px;margin:1rem 0 2rem}
.afl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:2.5rem;padding:2.5rem 0;border-top:1px solid var(--s-papier-lijn)}
.afl:first-of-type{border-top:0;padding-top:0}
.afl .nr{font-family:var(--label);color:var(--s-papier-zacht)}
.afl h3{font-size:1.6rem;margin:.2rem 0}
.afl .plek{font-style:italic;color:var(--s-papier-zacht);margin:0 0 .8rem}
.afl .knoppen{display:flex;flex-wrap:wrap;gap:.6rem;margin-top:1rem}
.galerij{display:grid;grid-template-columns:repeat(auto-fill,minmax(14rem,1fr));gap:1rem}
.galerij img{display:block;width:100%;height:auto;border-radius:2px}
.sc{width:100%;height:450px;border:0;margin-top:1rem}
.bl-credits{font-size:.98rem;color:var(--s-papier-zacht);font-style:italic}
.meer-beleven{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;list-style:none;padding:0;margin:1rem 0 0}
.meer-beleven a{display:block;padding:1.1rem 1.2rem;border:1px solid var(--s-papier-lijn);border-radius:3px;text-decoration:none}
.meer-beleven .label{display:block;color:var(--s-papier-zacht)}
.meer-beleven .naam{font-size:1.2rem}
@media (max-width:820px){.bl-hero .wrap,.afl{grid-template-columns:1fr;gap:1.5rem}.tracks{columns:1}.meer-beleven{grid-template-columns:1fr}}
</style>`;
for (const b of beleef) {
  const beelden = b.beelden || [];
  const hoofd = beelden[0];
  const body = `
  <section class="bl-hero">
    <div class="wrap">
      <div>
        <a class="terug" href="index.html#beleef">${T("beleef.terug", "← Beleef de Merode")}</a>
        <p class="label" style="margin-top:1.5rem">${esc(b.label)}</p>
        <h1>${esc(b.titel)}</h1>
        ${b.ondertitel ? `<p class="onder">${esc(b.ondertitel)}</p>` : ""}
        <p class="intro">${esc(b.intro)}</p>
        ${b.knop || b.knop2 ? `<p class="bl-knoppen">${b.knop ? `<a class="btn" href="${esc(b.knop.url)}">${esc(b.knop.tekst)}</a>` : ""}${b.knop2 ? `<a class="btn ghost" href="${esc(b.knop2.url)}">${esc(b.knop2.tekst)}</a>` : ""}</p>` : ""}
      </div>
      ${hoofd ? `<figure><img src="${esc(hoofd.src)}" alt="${esc(hoofd.alt || "")}"></figure>` : ""}
    </div>
  </section>
  <section class="papier bl-inhoud">
    <div class="wrap">
      ${(b.blokken || []).length ? `<div class="bl-blokken">${b.blokken.map(k => `<div><h2>${esc(k.titel)}</h2><p>${esc(k.tekst)}</p>${(k.links || []).map(([t, u]) => `<a href="${esc(u)}">${esc(t)}</a>`).join(" · ")}</div>`).join("")}</div>` : ""}
      ${b.tracklist ? `<div class="bl-sectie" id="luister"><h2>${T("beleef.tracklist", "De tracklist")}</h2><p>${T("beleef.tracklist-uitleg", "Van elk nummer maakte Bert Huysentruyt een video in de abdij.")}</p>${b.spotifyEmbed ? `<iframe class="sp-album" title="${esc(b.titel)} op Spotify" src="${esc(b.spotifyEmbed)}" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>` : ""}<ol class="trackvideos">${b.tracklist.map((t, i) => { const tt = typeof t === "string" ? { titel: t } : t; const [wie, wat] = tt.titel.split(" — "); return `<li>${tt.video ? ytKnop(tt.video, tt.titel) : ""}<span class="tnr">${i + 1}</span><span class="twie">${esc(wie)}</span>${wat ? `<span class="twat">${esc(wat)}</span>` : ""}</li>`; }).join("")}</ol></div>` : ""}
      ${b.afleveringen ? `<div class="bl-sectie"><h2>${T("beleef.afleveringen", "De afleveringen")}</h2>${b.afleveringen.map(a => `<article class="afl">
        <div><span class="nr">${T("beleef.aflevering", "Aflevering")} ${a.nr}</span><h3>${esc(a.titel)}</h3><p class="plek">${esc(a.plek)}</p><p>${esc(a.tekst)}</p>
          ${a.spotify ? `<div class="knoppen"><a class="btn" href="${esc(a.spotify)}">${T("beleef.spotify", "Beluister op Spotify")}</a>${b.apple ? `<a class="btn lijn" href="${esc(b.apple)}">${T("beleef.apple", "Beluister op Apple Podcasts")}</a>` : ""}</div>` : ""}</div>
        <div>${a.youtube ? ytKnop(a.youtube, a.titel) : (a.beeld ? `<img src="${esc(a.beeld)}" alt="${esc(a.titel + ", " + a.plek)}" loading="lazy" style="display:block;width:100%;height:auto;border-radius:3px">` : "")}</div>
      </article>`).join("")}</div>` : ""}
      ${b.luister ? `<div class="bl-sectie" id="luister"><h2>${T("beleef.luister", "Kijk en luister")}</h2>
        ${(b.luister.youtube || []).length ? `<div class="videos">${b.luister.youtube.map(id => ytKnop(id, b.titel)).join("")}</div>` : ""}
        ${b.luister.soundcloud ? `<iframe class="sc" title="${esc(b.titel)} op SoundCloud" loading="lazy" allow="autoplay" src="https://w.soundcloud.com/player/?url=${encodeURIComponent(b.luister.soundcloud)}&color=%23e8761a&visual=false"></iframe>` : ""}
      </div>` : ""}
      ${beelden.length > 1 ? `<div class="bl-sectie"><h2>${T("beleef.beelden", "Beelden")}</h2><div class="galerij">${beelden.slice(1).map(x => `<img src="${esc(x.src)}" alt="${esc(x.alt || "")}" loading="lazy">`).join("")}</div></div>` : ""}
      ${b.pers ? `<div class="bl-sectie"><h2>${T("beleef.pers", "In de pers")}</h2><p>${b.pers.map(([t, u]) => `<a href="${esc(u)}">${esc(t)}</a>`).join(" · ")}</p></div>` : ""}
      ${b.extra ? `<div class="bl-sectie"><h2>${esc(b.extra.titel)}</h2><p>${esc(b.extra.tekst)}</p><p><a class="btn" href="${esc(b.extra.url)}">${esc(b.extra.knop)}</a></p></div>` : ""}
      <div class="bl-sectie"><p class="bl-credits">${esc(b.credits)}</p>
        <h2 style="margin-top:2rem">${T("beleef.meer", "Meer beleven")}</h2>
        <ul class="meer-beleven">${beleefAlle.filter(x => x.slug !== b.slug).map(x => `<li><a href="${beleefHref(x.slug)}"><span class="label">${esc(x.label)}</span><span class="naam">${esc(x.titel)}</span></a></li>`).join("")}</ul>
      </div>
    </div>
  </section>`;
  let kop = kopEd.replace(/<title>[^<]*<\/title>/, `<title>${esc(b.titel)} | Merodefestival</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(b.ondertitel || b.titel)}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${SITE}/${b.slug}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(b.titel)}">`)
    .replace(/<style>[\s\S]*?<\/style>/, beleefCss);
  if (hoofd) kop = kop.replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${SITE}/${hoofd.src}">`);
  await fs.writeFile(path.join(ROOT, `${b.slug}.html`), kop + "<main>" + body + "\n</main>" + voetEd);
}


// Sitemap voor zoekmachines
// ---------- Homepage: sjabloon + teksten uit Notion, al in de pagina opgebouwd ----------
try {
  const sjabloon = await fs.readFile(path.resolve("scripts/sjablonen/index.html"), "utf8");
  let hp = await voorbouwHomepage(pasHomepage(sjabloon), { ROOT, S, alles });
  // Adres, delen op sociale media en gegevens voor zoekmachines
  const titel = T("homepage.titel", "Merodefestival – folk en wereldmuziek in de kerken van de Merode");
  const beschrijving = T("homepage.beschrijving", "Kerkconcerten met folk en wereldmuziek in de dorpskerken van Landschapspark de Merode, en elk Hemelvaartweekend het Merodefestival.");
  const logo = `${SITE}/${S.logo}`;
  const gegevens = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${SITE}/#organisatie`, name: "Merodefestival", legalName: "WESP vzw", url: `${SITE}/`, logo,
        email: "info@merodefestival.be", telephone: "+32498758296", vatID: "BE0863441738",
        address: { "@type": "PostalAddress", streetAddress: "Jozef Wautersstraat 4", postalCode: "3010", addressLocality: "Kessel-Lo", addressCountry: "BE" },
        sameAs: ["https://www.facebook.com/merodefestival", "https://www.instagram.com/merodefestival/", "https://www.youtube.com/channel/UCahKa1lM3yaWEwXdV_bBJdw"] },
      { "@type": "WebSite", "@id": `${SITE}/#website`, url: `${SITE}/`, name: "Merodefestival", inLanguage: "nl", publisher: { "@id": `${SITE}/#organisatie` } },
    ],
  };
  const kopExtra = `<link rel="canonical" href="${SITE}/">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(titel)}">
<meta property="og:description" content="${esc(beschrijving)}">
<meta property="og:image" content="${SITE}/${esc(S.artwork)}">
<meta property="og:url" content="${SITE}/">
<meta property="og:locale" content="nl_BE">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(gegevens).replace(/</g, "\\u003c")}</script>
`;
  hp = hp.replace("</head>", kopExtra + "</head>");
  await fs.writeFile(path.join(ROOT, "index.html"), hp);
} catch (err) {
  console.warn("Homepage niet bijgewerkt (sjabloon scripts/sjablonen/index.html ontbreekt?):", err.message);
}

// ---------- Producties (uit site/data/producties.json) ----------
import { bouwProducties } from "./build-producties.mjs";
const productiePaginas = await bouwProducties({ ROOT, SITE, S, esc, kopEd, voetEd });
const wespPaginas = await bouwWesp({ ROOT, SITE, S, esc, kopEd, voetEd });
const infoPaginas = await bouwInfo({ ROOT, SITE, S, esc, kopEd, voetEd });
await bouw404({ ROOT, SITE, esc, kopEd, voetEd });

// Extra’s voor de productiepagina’s: ‘Praktisch’ als uitrolmenu en foto’s die je kunt vergroten.
// De pagina’s zelf blijven gewone HTML; dit komt er als aanvulling bij (css/producties-extra.css en js/producties-extra.js).
const PRODUCTIE_EXTRA_CSS = String.raw`/* Uitrolmenu ‘Praktisch’ */
details.uitrol{margin:0 0 1rem}
details.uitrol>summary{display:flex;width:100%;justify-content:space-between;align-items:center;gap:1rem;cursor:pointer;list-style:none;padding:.35rem 0;margin:0;font-size:1rem;color:var(--s-papier-zacht);text-decoration:none}
details.uitrol[open]>summary{margin-bottom:0}
details.uitrol>summary::-webkit-details-marker{display:none}
details.uitrol>summary::after{content:"+";font-size:1.5rem;line-height:1;font-weight:400}
details.uitrol[open]>summary::after{content:"\2212"}
details.uitrol>summary:focus-visible{outline:2px solid currentColor;outline-offset:3px}
details.uitrol>dl{margin-top:.75rem}
/* Foto’s vergroten */
.lb-klik{cursor:zoom-in}
.lb-klik:focus-visible{outline:3px solid #f6771c;outline-offset:3px}
.lb{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:3vmin;background:rgba(15,10,7,.93)}
.lb[hidden]{display:none}
.lb img{display:block;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;border-radius:3px}
.lb button{position:absolute;display:grid;place-items:center;width:3rem;height:3rem;border:0;border-radius:50%;background:rgba(0,0,0,.5);color:#fff;font-size:1.8rem;line-height:1;cursor:pointer}
.lb button:hover,.lb button:focus-visible{background:#f6771c;color:#1a120d;outline:none}
.lb-sluit{top:1rem;right:1rem}
.lb-vorig{left:1rem;top:50%;transform:translateY(-50%)}
.lb-volgend{right:1rem;top:50%;transform:translateY(-50%)}
.lb.een .lb-vorig,.lb.een .lb-volgend{display:none}
body.lb-open{overflow:hidden}
/* Overzicht Producties: een rubriek tegelijk */
/* de rubrieknavigatie is een gewone balk, geen uitklapmenu zoals het hoofdmenu op een telefoon */
.pr-sectie nav.soorten{position:static;left:auto;right:auto;top:auto;background:transparent;padding:0}
.soorten a{cursor:pointer}
.soorten a.actief{background:var(--s-papier-inkt);color:var(--s-papier);box-shadow:none}
.soort[hidden]{display:none}
.wrap.enkel>.soort{margin-top:0}
`;
const PRODUCTIE_EXTRA_JS = String.raw`(function () {
  // 0. Overzicht Producties: een rubriek tegelijk tonen, de eerste (Podiumproducties) bovenaan
  var chips = document.querySelector("nav.soorten");
  if (chips) {
    var secties = [].slice.call(document.querySelectorAll("section.soort"));
    var wrap = chips.parentNode;
    var links = [].slice.call(chips.querySelectorAll("a"));
    var totaal = 0;
    secties.forEach(function (s) { totaal += s.querySelectorAll("li").length; });
    var alles = document.createElement("a");
    alles.href = "#alles";
    alles.innerHTML = "Alles <span>" + totaal + "</span>";
    chips.appendChild(alles);
    links.push(alles);
    var toonRubriek = function (id, bewaar) {
      var gevonden = secties.some(function (s) { return s.id === id; });
      if (id !== "alles" && !gevonden) id = secties.length ? secties[0].id : "alles";
      secties.forEach(function (s) { s.hidden = id !== "alles" && s.id !== id; });
      wrap.classList.toggle("enkel", id !== "alles");
      links.forEach(function (a) {
        var actief = a.getAttribute("href") === "#" + id;
        a.classList.toggle("actief", actief);
        if (actief) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
      });
      if (bewaar && window.history && history.replaceState) history.replaceState(null, "", "#" + id);
    };
    chips.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest("a") : null;
      if (!a || !chips.contains(a)) return;
      e.preventDefault();
      toonRubriek(a.getAttribute("href").slice(1), true);
    });
    window.addEventListener("hashchange", function () { toonRubriek(location.hash.slice(1), false); });
    toonRubriek(location.hash.slice(1), false);
    if (location.hash.length > 1) window.scrollTo(0, Math.max(0, chips.getBoundingClientRect().top + window.pageYOffset - 100));
  }

  // 1. ‘Praktisch’ als uitrolmenu: open op een groot scherm, dicht op een telefoon
  var aside = document.querySelector("aside.praktisch");
  if (aside) {
    var kop = aside.querySelector("h2"), lijst = aside.querySelector("dl");
    if (kop && lijst) {
      var det = document.createElement("details");
      det.className = "uitrol";
      var sum = document.createElement("summary");
      sum.className = "label";
      sum.textContent = kop.textContent;
      det.appendChild(sum);
      det.appendChild(lijst);
      aside.replaceChild(det, kop);
      if (window.matchMedia && window.matchMedia("(min-width: 900px)").matches) det.open = true;
    }
  }

  // 2. Foto’s aanklikken om ze groter te zien (pijltjes en Esc werken ook)
  var fotos = [].slice.call(document.querySelectorAll(".cbeeld.foto img, .galerij3 img"));
  if (!fotos.length) return;
  var lb, beeld, idx = 0, terug, startX = null;
  function bouw() {
    lb = document.createElement("div");
    lb.className = "lb" + (fotos.length < 2 ? " een" : "");
    lb.hidden = true;
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.setAttribute("aria-label", "Foto vergroot");
    lb.innerHTML = '<button type="button" class="lb-sluit" aria-label="Sluiten">\u00d7</button>' +
      '<button type="button" class="lb-vorig" aria-label="Vorige foto">\u2039</button>' +
      '<img alt="">' +
      '<button type="button" class="lb-volgend" aria-label="Volgende foto">\u203a</button>';
    document.body.appendChild(lb);
    beeld = lb.querySelector("img");
    lb.addEventListener("click", function (e) { if (e.target === lb || e.target.className === "lb-sluit") sluit(); });
    lb.querySelector(".lb-vorig").addEventListener("click", function (e) { e.stopPropagation(); toon(idx - 1); });
    lb.querySelector(".lb-volgend").addEventListener("click", function (e) { e.stopPropagation(); toon(idx + 1); });
    lb.addEventListener("touchstart", function (e) { startX = e.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(dx) > 50) toon(idx + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }
  function toon(i) {
    idx = (i + fotos.length) % fotos.length;
    var bron = fotos[idx].currentSrc || fotos[idx].src;
    beeld.src = bron;
    beeld.alt = fotos[idx].alt || "";
    beeld.style.background = /\.png(\?|$)/i.test(bron) ? "#EEE2CE" : "";
  }
  function open(i) {
    if (!lb) bouw();
    terug = document.activeElement;
    toon(i);
    lb.hidden = false;
    document.body.classList.add("lb-open");
    lb.querySelector(".lb-sluit").focus();
  }
  function sluit() {
    lb.hidden = true;
    document.body.classList.remove("lb-open");
    if (terug && terug.focus) terug.focus();
  }
  fotos.forEach(function (f, i) {
    f.classList.add("lb-klik");
    f.tabIndex = 0;
    f.setAttribute("role", "button");
    f.setAttribute("aria-label", (f.alt || "Foto") + ", vergroten");
    f.addEventListener("click", function () { open(i); });
    f.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(i); } });
  });
  document.addEventListener("keydown", function (e) {
    if (!lb || lb.hidden) return;
    if (e.key === "Escape") sluit();
    else if (e.key === "ArrowLeft") toon(idx - 1);
    else if (e.key === "ArrowRight") toon(idx + 1);
  });
})();
`;
await fs.mkdir(path.join(ROOT, "js"), { recursive: true });
await fs.writeFile(path.join(ROOT, "css/producties-extra.css"), PRODUCTIE_EXTRA_CSS);
await fs.writeFile(path.join(ROOT, "js/producties-extra.js"), PRODUCTIE_EXTRA_JS);
for (const f of productiePaginas.filter(x => x.startsWith("productie-") || x === "producties.html")) {
  const pad = path.join(ROOT, f);
  let h = await fs.readFile(pad, "utf8");
  if (!h.includes("producties-extra.css")) h = h.replace("</head>", '<link rel="stylesheet" href="css/producties-extra.css">\n</head>');
  if (!h.includes("producties-extra.js")) h = h.replace("</body>", '<script src="js/producties-extra.js" defer></script>\n</body>');
  await fs.writeFile(pad, h);
}

// Afwerking van alle pagina’s: lettertypes, spelers met klik, statistieken, voettekst
await afwerking({ ROOT, SITE });

const adres = u => (u === "" ? "" : u.replace(/\.html$/, ""));
const urls = ["", "vorige-edities.html", ...beleef.map(b => `${b.slug}.html`), ...productiePaginas, ...wespPaginas, ...infoPaginas, ...agenda.map(e => `concert/${e.slug}.html`)];
const uniek = [...new Set(urls.map(adres))];
await fs.writeFile(path.join(ROOT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${uniek.map(u => `  <url><loc>${SITE}/${u}</loc></url>`).join("\n")}\n</urlset>\n`);

// Voor zoekmachines en AI-tools: welkom, met de sitemap erbij
await fs.writeFile(path.join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

// Favicon in alle gangbare maten: Google wil een veelvoud van 48 px en sommige browsers vragen /favicon.ico op
try {
  const sharp = (await import("sharp")).default;
  const bron = path.join(ROOT, "img/favicon.png");
  for (const m of [48, 192]) await sharp(bron).resize(m, m).png().toFile(path.join(ROOT, `img/favicon-${m}.png`));
  const png = await fs.readFile(path.join(ROOT, "img/favicon-48.png"));
  const kop = Buffer.alloc(22); // ICO met één afbeelding (48 x 48, PNG)
  kop.writeUInt16LE(1, 2); kop.writeUInt16LE(1, 4);
  kop[6] = 48; kop[7] = 48; kop.writeUInt16LE(1, 10); kop.writeUInt16LE(32, 12); kop.writeUInt32LE(png.length, 14); kop.writeUInt32LE(22, 18);
  await fs.writeFile(path.join(ROOT, "favicon.ico"), Buffer.concat([kop, png]));
} catch (err) { console.warn("Favicon-maten niet gemaakt:", err.message); }

// Samenvatting in gewone tekst, handig voor AI-tools (geen standaard, kan geen kwaad)
const komende = agenda.filter(e => (e.end || e.start) >= vandaag).slice(0, 12);
const llms = [
  "# Merodefestival",
  "",
  `> ${T("homepage.beschrijving", "Kerkconcerten met folk en wereldmuziek in de dorpskerken van Landschapspark de Merode, en elk Hemelvaartweekend het Merodefestival.")} Een project van WESP vzw, Kessel-Lo (België).`,
  "",
  "## Belangrijkste pagina’s",
  `- [Agenda en kerkconcerten](${SITE}/): komende concerten`,
  `- [Producties](${SITE}/producties): concerten, installaties, playlists en concepten op maat om te boeken`,
  `- [Over WESP](${SITE}/wesp): de organisatie achter Merodefestival: wat we doen, voor wie, projecten, team en contact`,
  `- [Partners](${SITE}/partners): wie Merodefestival steunt en mee bouwt`,
  `- [Vrienden van Merodefestival](${SITE}/vrienden-van): de werking steunen`,
  `- [Vorige edities](${SITE}/vorige-edities): alle festivals sinds 2015 en het archief van de kerkconcerten`,
  ...beleef.map(x => `- [${x.titel}](${SITE}/${x.slug}): ${x.ondertitel || x.label}`),
  "",
  "## Komende concerten",
  ...komende.map(e => `- [${e.artist}](${SITE}/concert/${e.slug}): ${langeDatum(e.start)}, ${[e.place, e.village].filter(Boolean).join(", ")}`),
  "",
  "## Contact",
  "- info@merodefestival.be, 0498 75 82 96",
  "",
].join("\n");
await fs.writeFile(path.join(ROOT, "llms.txt"), llms);

// Oude adressen van de vorige website doorsturen
await fs.writeFile(path.join(ROOT, "_redirects"), await maakOmleidingen({ agenda, ROOT }));

// Extra beveiliging, en het testadres blijft buiten Google
await fs.writeFile(path.join(ROOT, "_headers"), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()

https://merodefestival-site.smetsjochen.workers.dev/*
  X-Robots-Tag: noindex
`);

await schrijfCatalogus(path.resolve(".build/teksten-catalogus.json"));
console.log(`Concertpagina’s: ${agenda.length}`);
