(function () {
  // Spotify en SoundCloud: de speler wordt pas geladen na een klik
  document.addEventListener("click", function (e) {
    var knop = e.target.closest ? e.target.closest(".speler-knop") : null;
    if (!knop) return;
    var w = knop.closest(".speler-wacht");
    if (!w) return;
    var f = document.createElement("iframe");
    f.src = w.getAttribute("data-embed");
    f.title = w.getAttribute("data-titel") || "";
    f.setAttribute("height", w.getAttribute("data-hoogte") || "152");
    f.setAttribute("allow", w.getAttribute("data-allow") || "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture");
    f.className = "speler-geladen" + (w.getAttribute("data-klasse") ? " " + w.getAttribute("data-klasse") : "");
    w.parentNode.replaceChild(f, w);
    f.focus();
  });
})();
