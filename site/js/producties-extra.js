(function () {
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
