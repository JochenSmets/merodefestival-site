// Maakt de overzichtspagina site/producties.html en per productie een pagina
// site/productie-<webadres>.html, op basis van site/data/producties.json (uit Notion).
// Wordt aangeroepen door build-pages.mjs.

import fs from "node:fs/promises";
import path from "node:path";
import { T } from "./teksten.mjs";

const SOORTEN = [
  { naam: "Podiumproductie", id: "podium", titel: "Podiumproducties", meer: "Bekijk de productie →", praktisch: "Praktisch",
    intro: "Concerten en voorstellingen voor cultuurcentra, festivals en bijzondere locaties." },
  { naam: "Installatie", id: "installaties", titel: "Installaties", meer: "Bekijk de installatie →", praktisch: "Praktisch",
    intro: "Muziek en beeld die een plek een verhaal geven, op erfgoedsites en in natuurdomeinen." },
  { naam: "Playlist", id: "playlists", titel: "Playlists", meer: "Bekijk de playlist →", praktisch: "Over deze playlist",
    intro: "Albums en playlists die Merodefestival mee maakte, om te beluisteren en te bestellen." },
  { naam: "Concept op maat", id: "concepten", titel: "Concepten op maat", meer: "Bekijk het concept →", praktisch: "Praktisch",
    intro: "Concepten die je bij ons kunt boeken, uitgewerkt op jouw plek." },
];
const POSITIE = { boven: "center top", onder: "center bottom", links: "left center", rechts: "right center" };

export async function bouwProducties({ ROOT, SITE, S, esc, kopEd, voetEd }) {
  let lijst;
  try { lijst = JSON.parse(await fs.readFile(path.join(ROOT, "data/producties.json"), "utf8")); }
  catch { console.log("Geen producties gevonden."); return []; }
  lijst = lijst.filter(p => p.slug && p.titel);
  if (!lijst.length) { console.log("Geen producties met webadres: sla productiepagina’s over."); return []; }

  // Een tekst met lege regels wordt een reeks alinea’s
  const alinea = t => esc(t).split(/\n{2,}/).map(x => `<p>${x.replace(/\n/g, "<br>")}</p>`).join("");

  const bestand = p => `productie-${p.slug}.html`;
  const soortVan = p => (SOORTEN.find(s => s.naam === p.soort) || SOORTEN[0]).naam;
  const br = t => esc(t).replace(/\n/g, "<br>");
  const transp = f => /\.png$/i.test(f || "");

  // ---------- spelers en video's ----------
  const ytId = u => (u.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{11})/) || [])[1];
  const vimeo = u => {
    const m = String(u || "").match(/vimeo\.com\/(?:video\/|channels\/[\w-]+\/)?(\d{6,})(?:\/([0-9a-f]{8,}))?/);
    if (!m) return null;
    const h = m[2] || (u.match(/[?&]h=([0-9a-f]+)/) || [])[1];
    return { id: m[1], h };
  };
  // Vimeo: miniatuur en verborgen deel opzoeken bij Vimeo. Een link met een eigen naam
  // (vimeo.com/naam/video) volgen we tot het nummer. Lukt dat niet, dan bouwen we gewoon verder.
  const VIMEO = {};
  const vimeoLinks = [...new Set(lijst.flatMap(p => (p.videos || []).map(v => v.url)).filter(u => /vimeo\.com\//.test(u || "")))];
  await Promise.all(vimeoLinks.map(async u => {
    let vm = vimeo(u), thumb = "";
    try {
      if (!vm) vm = vimeo((await fetch(u, { redirect: "follow" })).url);
      const r = await fetch("https://vimeo.com/api/oembed.json?width=640&url=" +
        encodeURIComponent(vm ? `https://vimeo.com/${vm.id}${vm.h ? "/" + vm.h : ""}` : u));
      const o = r.ok ? await r.json() : {};
      if (!vm && o.video_id) vm = { id: String(o.video_id) };
      if (vm && !vm.h) vm.h = (String(o.html || "").match(/[?&;]h=([0-9a-f]{6,})/) || [])[1];
      thumb = o.thumbnail_url || "";
    } catch (err) { console.warn(`Vimeo-link ${u} niet opgezocht: ${err.message}`); }
    if (vm) VIMEO[u] = { ...vm, thumb };
  }));

  const video = v => {
    const t = v.titel || "";
    const label = esc("Speel video af" + (t ? ": " + t : ""));
    const tekst = t ? `<p class="vtitel">${esc(t)}</p>` : "";
    const yt = ytId(v.url);
    if (yt) return `<div class="vblok"><div class="video"><button class="yt" type="button" data-id="${yt}" aria-label="${label}" style="background-image:url(https://i.ytimg.com/vi/${yt}/hqdefault.jpg)"><span class="play" aria-hidden="true"></span></button></div>${tekst}</div>`;
    const vm = VIMEO[v.url] || vimeo(v.url);
    if (vm) return `<div class="vblok"><div class="video"><button class="yt" type="button" data-vimeo="${vm.id}"${vm.h ? ` data-h="${vm.h}"` : ""} aria-label="${label}"${vm.thumb ? ` style="background-image:url(${esc(vm.thumb)})"` : ""}><span class="play" aria-hidden="true"></span></button></div>${tekst}</div>`;
    return `<div class="vblok"><p><a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(t || v.url)} ↗</a></p></div>`;
  };
  const allow = 'allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"';
  const spotify = (u, titel) => {
    const m = u.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]+)/);
    if (!m) return "";
    const hoogte = ["track", "episode"].includes(m[1]) ? 152 : 352;
    return `<iframe class="speler" src="https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator" title="${esc(titel)} op Spotify" width="100%" height="${hoogte}" loading="lazy" ${allow}></iframe>`;
  };
  const soundcloud = (u, titel) =>
    `<iframe class="speler" src="https://w.soundcloud.com/player/?url=${encodeURIComponent(u)}&amp;color=%23e8761a&amp;visual=false" title="${esc(titel)} op SoundCloud" width="100%" height="450" loading="lazy" allow="autoplay"></iframe>`;

  // ---------- tekst uit Notion (blokken) ----------
  const tekstHtml = blokken => {
    const uit = [];
    for (let i = 0; i < (blokken || []).length; i++) {
      const b = blokken[i];
      if (b.type === "ul" || b.type === "ol") {
        const items = [b];
        while (blokken[i + 1]?.type === b.type) items.push(blokken[++i]);
        uit.push(`<${b.type} class="${b.type === "ul" ? "lijst" : "nrs lijst"}">${items.map(x => `<li>${x.html}</li>`).join("")}</${b.type}>`);
      } else if (b.type === "quote") uit.push(`<blockquote>${b.html}</blockquote>`);
      else uit.push(`<${b.type}>${b.html}</${b.type}>`);
    }
    return uit.join("\n      ");
  };

  // ---------- gemeenschappelijke pagina-opmaak ----------
  const pagina = ({ titel, beschrijving, naam, afbeelding, body }) => {
    let kop = kopEd
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(titel)} | Merodefestival</title>`)
      .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(beschrijving)}">`)
      .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${SITE}/${naam.replace(/\.html$/, "")}">`)
      .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(titel)}">`)
      .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${SITE}/${afbeelding}">`)
      .replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="css/producties.css">');
    return kop + "<main>" + body + "\n</main>" + voetEd;
  };

  // ---------- overzichtspagina ----------
  const groepen = SOORTEN.map(s => ({
    ...s,
    titel: T(`soort.${s.id}.titel`, s.titel),
    intro: T(`soort.${s.id}.intro`, s.intro),
    meer: T(`soort.${s.id}.meer`, s.meer),
    praktisch: T(`soort.${s.id}.praktisch`, s.praktisch),
    items: lijst.filter(p => soortVan(p) === s.naam),
  })).filter(g => g.items.length);
  const kaart = (p, g) => {
    const stijl = POSITIE[p.uitsnede] ? ` style="object-position:${POSITIE[p.uitsnede]}"` : "";
    const klasse = p.uitsnede === "volledig tonen" ? ` class="contain"` : transp(p.foto) ? ` class="transp"` : "";
    const beeld = p.foto
      ? `<img src="${esc(p.foto)}"${klasse}${stijl} alt="${esc(p.titel)}" width="640" height="480" loading="lazy">`
      : `<span class="ph">${esc(p.titel)}</span>`;
    return `<li><a class="kaart" href="${bestand(p)}">${beeld}<span class="klabel">${esc(p.label)}</span><span class="ktitel">${esc(p.titel)}</span><span class="kmakers">${esc(p.makers)}</span><span class="ktekst">${esc(p.tekst)}</span><span class="kmeer">${g.meer}</span></a></li>`;
  };
  const overzicht = `
  <section class="pr-hero">
    <div class="wrap" style="display:block">
      <p class="label">${esc(T("producties.label", "Voor programmatoren"))}</p>
      <h1>${esc(T("producties.titel", "Producties"))}</h1>
      ${alinea(T("producties.intro", "Concerten en programma’s die Merodefestival mee maakt en op tournee stuurt. Elke productie kan geboekt worden door cultuurcentra, festivals en organisatoren van bijzondere locaties."))}
    </div>
  </section>
  <section class="papier pr-sectie">
    <div class="wrap">
      <nav class="soorten" aria-label="Soort productie">${groepen.map(g => `<a href="#${g.id}">${g.titel} <span>${g.items.length}</span></a>`).join("")}</nav>
      ${groepen.map(g => `<section class="soort" id="${g.id}"><h2>${g.titel}</h2><p class="soort-intro">${g.intro}</p><ul class="kaarten">${g.items.map(p => kaart(p, g)).join("")}</ul></section>`).join("\n      ")}
    </div>
  </section>`;
  await fs.writeFile(path.join(ROOT, "producties.html"), pagina({
    titel: T("producties.titel", "Producties"), naam: "producties.html", afbeelding: S.artwork,
    beschrijving: T("producties.beschrijving", "Concerten, installaties, playlists en concepten op maat van Merodefestival, om te boeken voor cultuurcentra, festivals en bijzondere locaties."),
    body: overzicht,
  }));

  // ---------- detailpagina’s ----------
  for (const p of lijst) {
    const g = SOORTEN.map(x => ({ ...x, praktisch: T(`soort.${x.id}.praktisch`, x.praktisch) })).find(x => x.naam === soortVan(p));
    const mail = `mailto:${p.contact || "info@merodefestival.be"}?subject=${encodeURIComponent(p.titel)}`;
    const knop = p.knoplink
      ? `<a class="btn" href="${esc(p.knoplink)}" target="_blank" rel="noopener">${esc(p.knop || T("producties.knop-standaard", "Vraag een optie"))}</a>`
      : `<a class="btn" href="${mail}">${esc(p.knop || T("producties.knop-standaard", "Vraag een optie"))}</a>`;
    const hero = p.foto
      ? `<figure class="cbeeld foto${transp(p.foto) ? " transp" : ""}"><img src="${esc(p.foto)}" alt="${esc(p.titel)}"></figure>`
      : `<figure class="cbeeld"><img src="${esc(S.artwork)}" alt=""></figure>`;
    const V = (sleutel, standaard) => T(`veld.${sleutel}`, standaard);
    const feiten = [[V("waar", "Waar"), p.waar], [V("vorm", "Vorm"), p.vorm], [V("speelduur", "Speelduur"), p.speelduur], [V("periode", "Periode"), p.periode],
      [V("bezetting", "Bezetting"), p.bezetting], [V("techniek", "Techniek"), p.techniek], [V("geschikt", "Geschikt voor"), p.geschikt], [V("prijs", "Prijs"), p.prijs]].filter(f => f[1]);
    const spelers = [
      ...(p.spotify || []).map(u => spotify(u, p.titel)),
      ...(p.soundcloud || []).map(u => soundcloud(u, p.titel)),
    ].filter(Boolean).join("\n        ");
    const videos = (p.videos || []).map(video).join("");
    const luister = spelers || videos
      ? `<section class="luister"><h2 class="label">${esc(T("producties.luister", "Kijk en luister"))}</h2>${spelers}${videos ? `<div class="pvideos">${videos}</div>` : ""}</section>`
      : "";
    const reeks = (p.fotos || []).length
      ? `<div class="galerij3${p.fotos.length < 3 ? " twee" : ""}">${p.fotos.map(f => `<figure><img src="${esc(f)}" alt="${esc(p.titel)}" loading="lazy"></figure>`).join("")}</div>`
      : "";
    const body = `
  <section class="chero">
    <div class="wrap">
      <div class="chero-tekst">
        <a class="terug" href="producties.html">${esc(T("producties.terug", "← Producties"))}</a>
        <p class="label datumregel">${esc(p.label)}</p>
        <h1>${esc(p.titel)}</h1>
        ${p.makers ? `<p class="waar">${esc(p.makers)}</p>` : ""}
        ${p.tekst ? `<p class="lead">${esc(p.tekst)}</p>` : ""}
        <div class="acties">${knop}</div>
      </div>
      ${hero}
    </div>
  </section>
  <section class="papier">
    <div class="wrap cgrid">
      <article class="ctekst">
      ${tekstHtml(p.lang)}
      ${reeks}
      ${luister}
      </article>
      <aside class="praktisch">
        <h2 class="label">${g.praktisch}</h2>
        <dl>
          ${feiten.map(([k, v]) => `<div><dt>${k}</dt><dd>${br(v)}</dd></div>`).join("\n          ")}
          ${(p.data || []).length ? `<div><dt>${esc(V("data", "Data"))}</dt><dd><ul class="data">${p.data.map(x => `<li>${esc(x)}</li>`).join("")}</ul></dd></div>` : ""}
          <div><dt>${esc(V("contact", "Contact"))}</dt><dd><a href="mailto:${esc(p.contact || "info@merodefestival.be")}">${esc(p.contact || "info@merodefestival.be")}</a></dd></div>
        </dl>
        ${p.extra ? `<p class="extra">${esc(p.extra)}</p>` : ""}
        <div class="acties">${knop}</div>
      </aside>
    </div>
  </section>`;
    await fs.writeFile(path.join(ROOT, bestand(p)), pagina({
      titel: p.titel, naam: bestand(p), afbeelding: p.foto || S.artwork,
      beschrijving: p.tekst || p.makers || p.titel, body,
    }));
  }
  console.log(`Productiepagina’s: ${lijst.length}`);
  return ["producties.html", ...lijst.map(bestand)];
}
