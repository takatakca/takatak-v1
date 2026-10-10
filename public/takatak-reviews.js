/*! TAKATAK Reviews showcase — rating badge + customer comments.
 * <div data-takatak-reviews="garage-verdun-ab12cd"></div>
 * <script defer src="https://takatak.ca/takatak-reviews.js"></script>
 * Optional on the div: data-count="6" data-review-link="1" (adds a "Leave a review" button).
 * Only comments customers explicitly agreed to publish are shown; the average
 * includes every rating. All text is inserted with textContent.
 */
(function () {
  "use strict";
  var script = document.currentScript;
  var api = ((script && script.getAttribute("data-api")) || (script ? new URL(script.src).origin : "")).replace(/\/$/, "");
  var fr = /^fr/i.test(document.documentElement.lang || navigator.language || "");
  var T = fr
    ? { based: function (n) { return "Moyenne de " + n + " avis"; }, leave: "Laisser un avis", verified: "Client vérifié", powered: "Avis recueillis par TAKATAK" }
    : { based: function (n) { return "Average of " + n + " ratings"; }, leave: "Leave a review", verified: "Verified customer", powered: "Reviews collected by TAKATAK" };

  function el(tag, style, text) {
    var n = document.createElement(tag);
    if (style) n.setAttribute("style", style);
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function stars(r) {
    var full = Math.round(r);
    return "★★★★★".slice(0, full) + "☆☆☆☆☆".slice(0, 5 - full);
  }

  function render(host, data, slug, withLink) {
    var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    var wrap = el("div", "font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;");
    var badge = el("div", "display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;");
    if (data.averageRating !== null) {
      badge.appendChild(el("span", "font-size:28px;font-weight:700;", String(data.averageRating.toFixed ? data.averageRating.toFixed(1) : data.averageRating)));
      badge.appendChild(el("span", "color:#f59e0b;font-size:20px;letter-spacing:1px;", stars(data.averageRating)));
      badge.appendChild(el("span", "color:#64748b;font-size:13px;", T.based(data.ratingCount)));
    }
    wrap.appendChild(badge);
    var grid = el("div", "display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));");
    (data.reviews || []).forEach(function (r) {
      var card = el("div", "border:1px solid #e2e8f0;border-radius:12px;padding:12px;background:#fff;");
      card.appendChild(el("div", "color:#f59e0b;font-size:14px;", stars(r.rating)));
      card.appendChild(el("p", "margin:6px 0;font-size:14px;line-height:1.45;white-space:pre-wrap;", "“" + r.text + "”"));
      card.appendChild(el("div", "font-size:12px;color:#64748b;", (r.firstName || T.verified) + " · " + r.date));
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
    var foot = el("div", "display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:8px;flex-wrap:wrap;");
    if (withLink) {
      var a = el("a", "background:#4f46e5;color:#fff;text-decoration:none;padding:8px 14px;border-radius:10px;font-size:13px;font-weight:600;", T.leave);
      a.href = api + "/r/" + encodeURIComponent(slug);
      a.target = "_blank";
      a.rel = "noopener";
      foot.appendChild(a);
    }
    foot.appendChild(el("span", "font-size:11px;color:#94a3b8;", T.powered));
    wrap.appendChild(foot);
    root.appendChild(wrap);
  }

  var hosts = document.querySelectorAll("[data-takatak-reviews]");
  Array.prototype.forEach.call(hosts, function (host) {
    if (host.__takatakReviews) return;
    host.__takatakReviews = true;
    var slug = host.getAttribute("data-takatak-reviews") || "";
    var count = host.getAttribute("data-count") || "6";
    fetch(api + "/api/public/reviews?p=" + encodeURIComponent(slug) + "&n=" + encodeURIComponent(count), { credentials: "omit" })
      .then(function (r) { return r.json(); })
      .then(function (data) { if (data && data.ok) render(host, data, slug, host.getAttribute("data-review-link") === "1"); })
      .catch(function () {});
  });
})();
