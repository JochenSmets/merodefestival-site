(function () {
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
  if (aside && !document.querySelector(".ctekst")) {
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
  var fotos = [].slice.call(document.querySelectorAll(".cbeeld.foto img, .galerij3 img, .beeldrij img"));
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
