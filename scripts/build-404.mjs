// Bouwt 404.html: de pagina die bezoekers zien als een adres niet bestaat.
// De teksten staan in Notion (Teksten (website), sleutels 404.*). De zinnen staan één per regel in 404.zinnen.

import fs from "node:fs/promises";
import path from "node:path";
import { T } from "./teksten.mjs";

export async function bouw404({ ROOT, SITE, esc, kopEd, voetEd }) {
  const zinnen = T("404.zinnen", [
    "De accordeonist is verdwaald in een andere kerk.",
    "Deze pagina is op tournee in Zweden en komt pas in mei terug.",
    "Zelfs de mooiste dorpskerk heeft deze pagina niet gevonden.",
    "Hier stond vroeger iets. Nu enkel stilte en een beetje galm.",
    "Deze pagina stemt nog haar instrumenten.",
    "De sleutel van de kerk is zoek. Deze pagina ook.",
    "Verkeerde zaal, verkeerde avond. De goede muziek speelt elders.",
  ].join("\n")).split(/\n+/).map(x => x.trim()).filter(Boolean);

  const titel = T("404.titel", "Hier speelt niemand vanavond.");
  const body = `
  <section class="f-hero"><div class="wrap">
    <p class="f-nr" aria-hidden="true"><span>4</span><span class="f-plaat"></span><span>4</span></p>
    <h1>${esc(titel)}</h1>
    <p class="f-zin" id="f-zin">${esc(zinnen[0] || "")}</p>
    <p class="f-uitleg">${esc(T("404.uitleg", "Deze pagina bestaat niet (meer). Misschien is een adres veranderd, of tikte iemand een letter te veel."))}</p>
    <p class="f-knoppen"><a class="btn" href="index.html#agenda">${esc(T("404.knop-agenda", "Naar de agenda"))}</a> <a class="btn ghost" href="index.html">${esc(T("404.knop-home", "Naar de homepage"))}</a></p>
  </div></section>
  <script>
  (function(){ var z=${JSON.stringify(zinnen)}; var e=document.getElementById("f-zin"); if(e&&z.length) e.textContent=z[Math.floor(Math.random()*z.length)]; })();
  </script>`;

  const hoofd = kopEd
    .replace(/<head>/, '<head>\n<base href="/">\n<meta name="robots" content="noindex">')
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(T("404.tab", "Pagina niet gevonden"))} | Merodefestival</title>`)
    .replace(/<meta name="description" content="[^"]*">/, "")
    .replace(/<link rel="canonical" href="[^"]*">/, "")
    .replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="css/fout.css">');
  await fs.writeFile(path.join(ROOT, "404.html"), hoofd + "<main>" + body + "\n</main>" + voetEd);
  await fs.writeFile(path.join(ROOT, "css/fout.css"), CSS);
  console.log("404-pagina gebouwd.");
}

const CSS = String.raw`/* 404-pagina */
.f-hero{padding:clamp(3rem,10vw,7rem) 0 clamp(3rem,8vw,6rem);text-align:center}
.f-nr{display:flex;justify-content:center;align-items:center;gap:.05em;margin:0 0 1rem;font-family:var(--label);font-size:clamp(5rem,22vw,12rem);line-height:1;color:var(--s-oranje);letter-spacing:.02em}
.f-plaat{display:inline-block;width:.78em;height:.78em;border-radius:50%;background:radial-gradient(circle at 50% 50%,var(--s-nacht) 0 7%,var(--s-oranje) 7.5% 17%,var(--s-nacht) 17.5% 24%,#2b221c 24.5% 100%);box-shadow:inset 0 0 0 .04em var(--s-oranje);animation:f-draai 5s linear infinite}
.f-plaat::after{content:"";display:block;width:100%;height:100%;border-radius:50%;background:repeating-radial-gradient(circle at 50% 50%,transparent 0 .05em,rgba(239,231,218,.12) .05em .06em)}
@keyframes f-draai{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.f-plaat{animation:none}}
.f-hero h1{font-size:clamp(1.8rem,5vw,3rem);margin:0 0 1rem}
.f-zin{font-size:clamp(1.2rem,3vw,1.6rem);font-style:italic;margin:0 auto 1.5rem;max-width:34rem;min-height:3.2em}
.f-uitleg{margin:0 auto 2rem;max-width:34rem;opacity:.8}
.f-knoppen{display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap}
`;
