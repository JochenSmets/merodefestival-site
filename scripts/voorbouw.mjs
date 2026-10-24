// Bouwt de homepage al in de pagina zelf op (titel, inleiding, agenda, festival, edities...), zodat
// Google en AI-tools die geen JavaScript uitvoeren de echte inhoud zien. In de browser neemt dezelfde code het over
// en berekent dan bijvoorbeeld “vanavond” of “morgen”.
//
// Gebruikt jsdom (wordt in de workflow geïnstalleerd). Ontbreekt het of gaat er iets mis, dan blijft de pagina zoals ze was.

import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

export async function voorbouwHomepage(html, { ROOT, S, alles }) {
  let JSDOM;
  try { ({ JSDOM } = await import("jsdom")); }
  catch { console.warn("jsdom niet gevonden: de homepage wordt niet voorgebouwd."); return html; }
  try {
    const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://www.merodefestival.be/" });
    const w = dom.window;
    w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    const lees = async f => { try { return await fs.readFile(path.join(ROOT, f), "utf8"); } catch { return ""; } };
    const ctx = { window: {} };
    vm.runInNewContext(await lees("data/reeksen.js"), ctx);
    w.SEIZOEN = S;
    w.AGENDA = alles;
    w.REEKSEN = ctx.window.REEKSEN || {};
    try { w.EDITIES = JSON.parse(await lees("data/edities.json") || "[]"); } catch { w.EDITIES = []; }
    w.BEELDBANK = []; // het wisselende beeld komt pas in de browser
    w.__PRERENDER = true; // geen ‘vanavond’ of ‘morgen’ in de vaste pagina
    for (const s of [...w.document.querySelectorAll("script:not([src])")]) w.eval(s.textContent);
    const uit = dom.serialize();
    w.close();
    return uit;
  } catch (err) {
    console.warn("Homepage niet voorgebouwd:", err.message);
    return html;
  }
}
