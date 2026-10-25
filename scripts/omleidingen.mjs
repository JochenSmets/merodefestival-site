// Omleidingen van de oude Strikingly-adressen naar de nieuwe pagina’s (bestand site/_redirects).
// Zo blijft Google (en elke bezoeker met een oude link) de juiste pagina vinden na de verhuis van het domein.
// Een doel kan een lijst zijn: het eerste adres waarvan de pagina bestaat, wordt gebruikt; het laatste is de terugval.
// Een doel { artiest: /regex/ } wijst naar de concertpagina van het eerste concert waarvan de naam past.

import fs from "node:fs/promises";
import path from "node:path";

const REGELS = [
  // vaste pagina’s
  ["/home", ["/"]],
  ["/muzikale-wandelingen", ["/productie-muzikale-wandelingen", "/producties", "/"]],
  ["/wandelapp", ["/productie-muzikale-wandelingen", "/producties", "/"]],
  ["/b2b", ["/productie-muzikale-wandelingen", "/producties", "/"]],
  ["/klanken", ["/productie-klanken-in-de-kapel", "/producties", "/"]],
  ["/klanken-systeem", ["/productie-klanken-in-de-kapel", "/producties", "/"]],
  ["/klankenvandesteden", ["https://klankenvandesteden.be"]],
  ["/boek", ["/productie-ode-aan-de-merode", "/producties", "/"]],
  ["/ode-aan-de-merode", ["/productie-ode-aan-de-merode", "/producties", "/"]],
  ["/the-sound-of-the-abbey", ["/productie-the-sound-of-the-abbey", "/producties", "/"]],
  ["/sound", ["/productie-the-sound-of-the-abbey", "/producties", "/"]],
  ["/volksliekes", ["/volkscafes", "/"]],
  ["/creaties", ["/producties", "/"]],
  ["/projecten", ["/producties", "/"]],
  ["/in-opdracht", ["/producties", "/"]],
  // festivals, edities en oude acties
  ["/merodefestival-2023", ["/vorige-edities"]],
  ["/merodefestival-2024", ["/vorige-edities"]],
  ["/merodefestival-2025-1", ["/vorige-edities"]],
  ["/merodefestival-2026-archive", ["/vorige-edities"]],
  ["/merodefestival-2027", [{ artiest: /merodefestival 2027/i }, "/"]],
  ["/save-the-date", [{ artiest: /merodefestival 2027/i }, "/"]],
  ["/artiesten", ["/vorige-edities"]],
  ["/zomeraanbod-2020", ["/vorige-edities"]],
  ["/zomeraanbod-2022", ["/vorige-edities"]],
  ["/covid-19", ["/vorige-edities"]],
  ["/uitgesteld", ["/vorige-edities"]],
  ["/terugbetaling", ["/vorige-edities"]],
  ["/kerkconcerten2022", ["/vorige-edities"]],
  ["/kerkconcerten-copy", ["/vorige-edities"]],
  ["/bier-van-het-festival", ["/vorige-edities"]],
  ["/davidsfonds", ["/"]],
  ["/klasseactie", ["/"]],
  // praktische pagina’s zonder eigen plek op de nieuwe site (voorlopig naar de homepage)
  ["/contact", ["/wesp", "/"]],
  ["/parking", ["/"]],
  ["/de-merode-overnachten", ["/"]],
  ["/tickets", ["/"]],
  ["/nieuwsbrief", ["/"]],
  // blog, winkel en categorieën
  ["/blog", ["/"]],
  ["/blog/categories", ["/"]],
  ["/blog/categories/kerk-26-27", ["/"]],
  ["/store/categories", ["/"]],
  ["/store/products/werner-i-een-fris-gehopte-blonde-prins", ["/"]],
  // concerten
  ["/stijnkuppens", [{ artiest: /stijn kuppens/i }, "/"]],
  ["/lydiethonnard", [{ artiest: /lydie thonnard/i }, "/"]],
  ["/kerst", [{ artiest: /ster bleef stille/i }, "/"]],
  ["/echo", [{ artiest: /echo/i }, "/"]],
  ["/blog/aram-shahab-azinmehr-iran-derya-turkan-tur-robbe-kieckens", [{ artiest: /^aram/i }, "/"]],
  ["/blog/dubbelconcert-amber-haddad-trio-en-simon-leleux-manuel-hermia", [{ artiest: /amber haddad/i }, "/"]],
  ["/blog/gwen", [{ artiest: /gwen cresens/i }, "/"]],
  ["/blog/la-mal-coiffee-fr", [{ artiest: /la mal coiff/i }, "/"]],
  ["/blog/laura-cortese-s-acoustic-evening-iv-met-eliza-carthy-jake-blount-sarah", [{ artiest: /acoustic evening iv/i }, "/"]],
  ["/blog/livia", [{ artiest: /livia giaffreda/i }, "/"]],
  ["/blog/rioghnach-connolly-nir", [{ artiest: /rioghnach/i }, "/"]],
  ["/blog/sam-grassie-sco-dylan-fowler-wal-haroun-iqbal-be", [{ artiest: /sam grassie/i }, "/"]],
  ["/blog/sara-salverius-en-blazerskwartet-adem", [{ artiest: /sara salv/i }, "/"]],
  ["/blog/the-weaving-irl-uk", [{ artiest: /the weaving/i }, "/"]],
];

export async function maakOmleidingen({ agenda, ROOT }) {
  const bestaat = async pad => {
    if (pad === "/" || /^https?:/.test(pad)) return true;
    try { await fs.access(path.join(ROOT, pad.replace(/^\//, "") + ".html")); return true; } catch { return false; }
  };
  const concertDoel = d => {
    const kand = agenda.filter(e => d.artiest.test(e.artist));
    const e = kand[0];
    return e ? `/concert/${e.slug}` : null;
  };
  const regels = [];
  for (const [oud, doelen] of REGELS) {
    let doel = null;
    for (const d of doelen) {
      const kandidaat = typeof d === "string" ? ((await bestaat(d)) ? d : null) : concertDoel(d);
      if (kandidaat) { doel = kandidaat; break; }
    }
    if (doel && doel !== oud) regels.push(`${oud} ${doel} 301`);
  }
  return [
    "# Oude adressen van de vorige website, doorgestuurd naar de nieuwe pagina’s.",
    "# Dit bestand wordt bij elke bouw opnieuw gemaakt (scripts/omleidingen.mjs).",
    ...regels, "",
  ].join("\n");
}
