// Maakt per concert een eigen pagina in site/concert/, plus een agendabestand (.ics)
// en een sitemap. Draait na sync-notion.mjs, maar werkt ook los:
//   node scripts/build-pages.mjs
// SITE_URL bepaalt de volledige adressen voor delen op sociale media.

import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

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
const S = ctx.window.SEIZOEN || {};

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
    `URL:${SITE}/concert/${e.slug}.html`,
    "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

function jsonld(e, beeld) {
  const t = tijd(e.time);
  const data = {
    "@context": "https://schema.org", "@type": "MusicEvent",
    name: e.artist,
    startDate: t ? `${e.start}T${t[0]}:${t[1]}` : e.start,
    ...(e.end ? { endDate: e.end } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Place", name: e.place, address: { "@type": "PostalAddress", addressLocality: e.village, addressCountry: "BE" } },
    image: [beeld],
    description: e.sub || e.kind,
    organizer: { "@type": "Organization", name: "Merodefestival / WESP vzw", url: SITE },
    ...(e.tickets ? { offers: { "@type": "Offer", url: e.tickets, availability: e.volzet ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      ...(e.price && /\d/.test(e.price) ? { price: e.price.replace(/[^\d,.]/g, "").replace(",", "."), priceCurrency: "EUR" } : {}) } } : {}),
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function blokkenHtml(bl) {
  let h = "", lijst = false;
  for (const b of bl) {
    if (b.type === "li") { if (!lijst) { h += "<ul>"; lijst = true; } h += `<li>${b.html}</li>`; continue; }
    if (lijst) { h += "</ul>"; lijst = false; }
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
  const yts = (e.videos || []).map(youtubeId).filter(Boolean);
  const sps = (e.spotify || []).map(spotifyEmbed).filter(Boolean);
  const kerk = /kerkconcert/i.test(e.kind);
  const route = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.adres || [e.place, e.village].filter(Boolean).join(", "))}`;
  const ticket = e.volzet ? `<span class="soldout">Volzet</span>`
    : e.tickets ? `<a class="btn" href="${esc(e.tickets)}">${esc(e.cta || "Koop tickets")}${e.price ? ` (${esc(e.price)})` : ""}</a>` : "";

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(e.artist)} – ${esc(langeDatum(e.start))} | Merodefestival</title>
<meta name="description" content="${esc(omschrijving.slice(0, 220))}">
<link rel="canonical" href="${SITE}/concert/${e.slug}.html">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(e.artist)}">
<meta property="og:description" content="${esc(datumregel)}, ${esc([e.place, e.village].filter(Boolean).join(", "))}">
<meta property="og:image" content="${esc(beeldAbs)}">
<meta property="og:url" content="${SITE}/concert/${e.slug}.html">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="32x32" href="../img/favicon-32.png">
<link rel="apple-touch-icon" href="../img/favicon.png">
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
    <button class="menu-toggle" aria-expanded="false" aria-controls="hoofdmenu">Menu</button>
    <nav id="hoofdmenu" aria-label="Hoofdmenu">
      <ul>
        <li><a href="../index.html#agenda">Agenda</a></li>
        <li><a href="../index.html#festival">Festival 2027</a></li>
        <li><a href="../index.html#beleef">Beleef de Merode</a></li>
        <li><a href="../vorige-edities.html">Vorige edities</a></li>
        <li><a href="../index.html#nieuwsbrief">Nieuwsbrief</a></li>
      </ul>
    </nav>
    <a class="btn" href="${esc(S.ticketlink || e.tickets || "#")}">Tickets</a>
  </div>
</header>

<main>
  <section class="chero" aria-labelledby="titel">
    <div class="wrap">
      <div class="chero-tekst">
        <a class="terug" href="../index.html#agenda">← Agenda</a>
        <p class="label datumregel">${esc(datumregel)}</p>
        ${e.sub ? `<p class="csub">${esc(e.sub)}</p>` : ""}
        <h1 id="titel">${esc(e.artist)}${e.origin ? ` <span class="herkomst">(${esc(e.origin)})</span>` : ""}</h1>
        <p class="waar">${esc([e.place, e.village].filter(Boolean).join(", "))}</p>
        <div class="acties" id="acties">${ticket}</div>
      </div>
      <figure class="cbeeld${e.foto ? " foto" : ""}">
        <img src="${esc(beeldLokaal)}" alt="${e.foto ? esc(e.fotoAlt || e.artist) : esc(S.artworkAlt || "")}">
        ${e.foto && e.fotograaf ? `<figcaption>Foto: ${esc(e.fotograaf)}</figcaption>` : ""}
      </figure>
    </div>
  </section>

  <section class="papier" aria-label="Over dit concert">
    <div class="wrap cgrid">
      <article class="ctekst">
        ${(e.lang || []).length ? blokkenHtml(e.lang)
          : alineas.length ? alineas.map(p => `<p>${esc(p)}</p>`).join("\n        ")
          : `<p>${esc(e.kind)} in ${esc(e.place)}, ${esc(e.village)}.</p>`}
        ${extraBeelden.length ? `<section class="beelden" aria-labelledby="beelden-titel">
          <h2 class="label" id="beelden-titel">Foto’s</h2>
          <div class="beeldgrid">${extraBeelden.map(b => `<figure><a href="../${esc(b.src)}" target="_blank" rel="noopener"><img src="../${esc(b.src)}" alt="${esc(b.alt)}" loading="lazy"></a>${b.fotograaf ? `<figcaption>Foto: ${esc(b.fotograaf)}</figcaption>` : ""}</figure>`).join("")}</div>
        </section>` : ""}
        ${yts.length || sps.length ? `<section class="luister" id="luister" aria-labelledby="luister-titel">
          <h2 class="label" id="luister-titel">Kijk en luister</h2>
          ${yts.length ? `<div class="videos${yts.length > 1 ? " meer" : ""}">${yts.map((id, i) => `<div class="video"><button class="yt" type="button" data-id="${id}" aria-label="Speel video ${i + 1} af: ${esc(e.artist)}" style="background-image:url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)"><span class="play" aria-hidden="true"></span></button></div>`).join("")}</div>` : ""}
          ${sps.length ? `<div class="spotify">${sps.map(x => `<iframe src="https://open.spotify.com/embed/${x.type}/${x.id}?utm_source=generator&amp;theme=0" title="Spotify: ${esc(e.artist)}" height="${/album|playlist|show/.test(x.type) ? 352 : 152}" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>`).join("")}</div>` : ""}
        </section>` : ""}
      </article>
      <aside class="praktisch">
        <h2 class="label">Praktisch</h2>
        <dl>
          <div><dt>Wanneer</dt><dd>${esc(datumregel)}</dd></div>
          <div><dt>Waar</dt><dd>${esc(e.place)}${e.adres ? `<br>${esc(e.adres)}` : e.village ? `<br>${esc(e.village)}` : ""}<br><a href="${route}">Route</a></dd></div>
          ${e.duur ? `<div><dt>Duur</dt><dd>${esc(e.duur)}</dd></div>` : ""}
          ${e.price ? `<div><dt>Prijs</dt><dd>${esc(e.price)}</dd></div>` : ""}
          ${kerk ? (S.tickets || []).filter(([k]) => /combi/i.test(k)).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("") : ""}
        </dl>
        <div class="acties" id="acties-2">${ticket}</div>
        <p class="ics"><a href="${e.slug}.ics" download>Zet in je agenda</a></p>
      </aside>
    </div>
  </section>

  ${overige.length ? `<section class="donker ook" aria-labelledby="ook-titel">
    <div class="wrap">
      <h2 id="ook-titel">Ook in de agenda</h2>
      <ul class="ook-lijst">
        ${overige.map(o => { const x = d(o.start); return `<li><a href="${o.slug}.html"><span class="label">${x.getUTCDate()} ${MAAND_KORT[x.getUTCMonth()]} · ${esc(o.village)}</span><span class="naam">${esc(o.artist)}</span></a></li>`; }).join("\n        ")}
      </ul>
      <a class="btn ghost" href="../index.html#agenda">Hele agenda</a>
    </div>
  </section>` : ""}
</main>

<footer>
  <div class="wrap"><img class="foot-logo" src="../${esc(S.logo)}" alt="Merodefestival" width="147" height="100" loading="lazy"></div>
  <div class="wrap cols">
    <div>
      <h3>Contact</h3>
      <p><a href="mailto:info@merodefestival.be">info@merodefestival.be</a></p>
      <p><a href="tel:+32498758296">0498 75 82 96</a></p>
      <p>Merodefestival is een project van WESP vzw, BE 0863 441 738, Jozef Wautersstraat 4, 3010 Kessel-Lo</p>
    </div>
    <div>
      <h3>Volg ons</h3>
      <ul>
        <li><a href="https://www.facebook.com/merodefestival">Facebook</a></li>
        <li><a href="https://www.instagram.com/merodefestival/">Instagram</a></li>
        <li><a href="https://www.youtube.com/channel/UCahKa1lM3yaWEwXdV_bBJdw">YouTube</a></li>
      </ul>
    </div>
    <div>
      <h3>Met steun van</h3>
      <p>De Vlaamse overheid, kunsten en erfgoed, de provincie Vlaams-Brabant, de Nationale Loterij en projectvereniging de Merode.</p>
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
      if (el) el.innerHTML = '<span class="soldout">Dit concert is voorbij</span>';
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
<link rel="canonical" href="${SITE}/vorige-edities.html">
<meta property="og:title" content="Merodefestival sinds 2015">
<meta property="og:image" content="${SITE}/${S.artwork}">
<link rel="icon" type="image/png" sizes="32x32" href="img/favicon-32.png">
<link rel="apple-touch-icon" href="img/favicon.png">
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
    <button class="menu-toggle" aria-expanded="false" aria-controls="hoofdmenu">Menu</button>
    <nav id="hoofdmenu" aria-label="Hoofdmenu">
      <ul>
        <li><a href="index.html#agenda">Agenda</a></li>
        <li><a href="index.html#festival">Festival 2027</a></li>
        <li><a href="index.html#beleef">Beleef de Merode</a></li>
        <li><a href="vorige-edities.html">Vorige edities</a></li>
        <li><a href="index.html#nieuwsbrief">Nieuwsbrief</a></li>
      </ul>
    </nav>
    <a class="btn" href="${esc(S.ticketlink || "#")}">Tickets</a>
  </div>
</header>
<main>
  <section class="ed-hero">
    <div class="wrap">
      <a class="terug" href="index.html">← Homepage</a>
      <h1>Merodefestival sinds 2015</h1>
      <p>Na de eerste editie in 2015 mocht Merodefestival rustig groeien: elk jaar het beste van de Europese folkscene in de Meroderegio, en sinds 2017 ook een concertreeks door het jaar heen. Grasduin door meer dan tien jaar festival.</p>
      <p class="ed-sub label">Festival</p>
      <ul class="ed-nav">${edities.map(x => `<li><a href="#${x.jaar}">${x.jaar}</a></li>`).join("")}</ul>
      <p class="ed-sub label">Kerkconcerten</p>
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
          ${x.concerten ? `<div class="prog"><strong>${x.onvolledig ? "Op het programma onder meer" : "Concerten"}</strong><ul class="namen">${x.concerten.map(n => `<li>${esc(n)}</li>`).join("")}</ul></div>` : ""}
          ${x.wandelingen ? `<div class="prog"><strong>Muzikale wandelingen${x.wandelplekken ? ` in ${esc(x.wandelplekken)}` : ""}</strong><ul class="namen klein">${x.wandelingen.map(n => `<li>${esc(n)}</li>`).join("")}</ul></div>` : ""}
          ${(x.videos || []).length ? `<div class="videos">${x.videos.map((id, i) => videoKnop(id, `Video ${i + 1} van ${x.jaar}`)).join("")}</div>` : ""}
          ${x.fotos ? `<p class="dank">Foto’s en video’s: met dank aan ${esc(x.fotos)}.</p>` : ""}
        </div>
      </article>`).join("\n      ")}
    </div>
  </section>
  <section class="papier kerk-archief" aria-labelledby="kerk-titel">
    <div class="wrap" style="display:block">
      <h2 id="kerk-titel">Kerkconcerten</h2>
      <p class="kerk-intro">Sinds 2017 brengt Merodefestival ook buiten het festival wereld- en folkmuziek naar de dorpskerken van de Merode.</p>
      <div class="kgrid">
      ${seizoenen.map(z => `<article class="kseizoen" id="kerk-${z.seizoen.slice(0, 4)}">
        ${z.brochure ? `<img class="kcover" src="${esc(z.brochure)}" alt="Brochure kerkconcerten ${esc(z.seizoen)}" loading="lazy">` : ""}
        <h3 class="kt"><span>kerk – concerten</span><span>${esc(z.seizoen).replace(/(\d{3})(\d)/g, "$1<em>$2</em>")}</span></h3>
        ${z.opmerking ? `<p class="kopm">${esc(z.opmerking)}</p>` : ""}
        <ol class="kerk-lijst">${z.concerten.map(k => `<li>
          ${k.datum ? `<span class="kd">${esc(cap(langeDatum(k.datum)))}</span>` : ""}
          <span class="ka">${esc(k.artiest)}</span>
          ${k.kerk ? `<span class="kk">${esc(k.kerk)}</span>` : ""}
          ${k.video ? `<div class="video kvid"><button class="yt" type="button" data-id="${k.video}" aria-label="Video: ${esc(k.artiest)}" style="background-image:url(https://i.ytimg.com/vi/${k.video}/hqdefault.jpg)"><span class="play" aria-hidden="true"></span></button></div>` : ""}
        </li>`).join("")}</ol>
        ${z.onvolledig ? `<p class="kopm">Dit seizoen is nog niet volledig aangevuld.</p>` : ""}
      </article>`).join("\n      ")}
      </div>
    </div>
  </section>
</main>
<footer>
  <div class="wrap"><img class="foot-logo" src="${esc(S.logo)}" alt="Merodefestival" width="147" height="100" loading="lazy"></div>
  <div class="wrap cols">
    <div><h3>Contact</h3><p><a href="mailto:info@merodefestival.be">info@merodefestival.be</a></p><p><a href="tel:+32498758296">0498 75 82 96</a></p><p>Merodefestival is een project van WESP vzw, BE 0863 441 738, Jozef Wautersstraat 4, 3010 Kessel-Lo</p></div>
    <div><h3>Volg ons</h3><ul><li><a href="https://www.facebook.com/merodefestival">Facebook</a></li><li><a href="https://www.instagram.com/merodefestival/">Instagram</a></li><li><a href="https://www.youtube.com/channel/UCahKa1lM3yaWEwXdV_bBJdw">YouTube</a></li></ul></div>
    <div><h3>Met steun van</h3><p>De Vlaamse overheid, kunsten en erfgoed, de provincie Vlaams-Brabant, de Nationale Loterij en projectvereniging de Merode.</p><p>${esc(S.credit || "")}</p></div>
  </div>
</footer>
<script>
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
</script>
</body>
</html>
`;
await fs.writeFile(path.join(ROOT, "vorige-edities.html"), editiesHtml);
// ---------- Beleef de Merode (uit site/data/beleef.json) ----------
const beleef = JSON.parse(await fs.readFile(path.join(ROOT, "data/beleef.json"), "utf8"));
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
        <a class="terug" href="index.html#beleef">← Beleef de Merode</a>
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
      ${b.tracklist ? `<div class="bl-sectie" id="luister"><h2>De tracklist</h2><p>Van elk nummer maakte Bert Huysentruyt een video in de abdij.</p>${b.spotifyEmbed ? `<iframe class="sp-album" title="${esc(b.titel)} op Spotify" src="${esc(b.spotifyEmbed)}" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>` : ""}<ol class="trackvideos">${b.tracklist.map((t, i) => { const tt = typeof t === "string" ? { titel: t } : t; const [wie, wat] = tt.titel.split(" — "); return `<li>${tt.video ? ytKnop(tt.video, tt.titel) : ""}<span class="tnr">${i + 1}</span><span class="twie">${esc(wie)}</span>${wat ? `<span class="twat">${esc(wat)}</span>` : ""}</li>`; }).join("")}</ol></div>` : ""}
      ${b.afleveringen ? `<div class="bl-sectie"><h2>De afleveringen</h2>${b.afleveringen.map(a => `<article class="afl">
        <div><span class="nr">Aflevering ${a.nr}</span><h3>${esc(a.titel)}</h3><p class="plek">${esc(a.plek)}</p><p>${esc(a.tekst)}</p>
          ${a.spotify ? `<div class="knoppen"><a class="btn" href="${esc(a.spotify)}">Beluister op Spotify</a>${b.apple ? `<a class="btn lijn" href="${esc(b.apple)}">Beluister op Apple Podcasts</a>` : ""}</div>` : ""}</div>
        <div>${a.youtube ? ytKnop(a.youtube, a.titel) : (a.beeld ? `<img src="${esc(a.beeld)}" alt="${esc(a.titel + ", " + a.plek)}" loading="lazy" style="display:block;width:100%;height:auto;border-radius:3px">` : "")}</div>
      </article>`).join("")}</div>` : ""}
      ${b.luister ? `<div class="bl-sectie" id="luister"><h2>Kijk en luister</h2>
        ${(b.luister.youtube || []).length ? `<div class="videos">${b.luister.youtube.map(id => ytKnop(id, b.titel)).join("")}</div>` : ""}
        ${b.luister.soundcloud ? `<iframe class="sc" title="${esc(b.titel)} op SoundCloud" loading="lazy" allow="autoplay" src="https://w.soundcloud.com/player/?url=${encodeURIComponent(b.luister.soundcloud)}&color=%23e8761a&visual=false"></iframe>` : ""}
      </div>` : ""}
      ${beelden.length > 1 ? `<div class="bl-sectie"><h2>Beelden</h2><div class="galerij">${beelden.slice(1).map(x => `<img src="${esc(x.src)}" alt="${esc(x.alt || "")}" loading="lazy">`).join("")}</div></div>` : ""}
      ${b.pers ? `<div class="bl-sectie"><h2>In de pers</h2><p>${b.pers.map(([t, u]) => `<a href="${esc(u)}">${esc(t)}</a>`).join(" · ")}</p></div>` : ""}
      ${b.extra ? `<div class="bl-sectie"><h2>${esc(b.extra.titel)}</h2><p>${esc(b.extra.tekst)}</p><p><a class="btn" href="${esc(b.extra.url)}">${esc(b.extra.knop)}</a></p></div>` : ""}
      <div class="bl-sectie"><p class="bl-credits">${esc(b.credits)}</p>
        <h2 style="margin-top:2rem">Meer beleven</h2>
        <ul class="meer-beleven">${beleef.filter(x => x.slug !== b.slug).map(x => `<li><a href="${x.slug}.html"><span class="label">${esc(x.label)}</span><span class="naam">${esc(x.titel)}</span></a></li>`).join("")}</ul>
      </div>
    </div>
  </section>`;
  let kop = kopEd.replace(/<title>[^<]*<\/title>/, `<title>${esc(b.titel)} | Merodefestival</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(b.ondertitel || b.titel)}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${SITE}/${b.slug}.html">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(b.titel)}">`)
    .replace(/<style>[\s\S]*?<\/style>/, beleefCss);
  if (hoofd) kop = kop.replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${SITE}/${hoofd.src}">`);
  await fs.writeFile(path.join(ROOT, `${b.slug}.html`), kop + "<main>" + body + "\n</main>" + voetEd);
}


// Sitemap voor zoekmachines
const urls = ["", "vorige-edities.html", ...beleef.map(b => `${b.slug}.html`), ...agenda.map(e => `concert/${e.slug}.html`)];
await fs.writeFile(path.join(ROOT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${SITE}/${u}</loc></url>`).join("\n")}\n</urlset>\n`);

console.log(`Concertpagina’s: ${agenda.length}`);
