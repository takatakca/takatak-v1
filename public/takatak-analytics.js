/*! TAKATAK Analytics — cookie-free first-party analytics.
 * <script defer src="https://takatak.ca/takatak-analytics.js" data-site="tk_…"></script>
 * Optional: data-api="https://takatak.ca" (defaults to the script's own origin).
 * Respects Global Privacy Control and Do Not Track. No cookies, no storage.
 * API: window.takatak.track("name", { conversion: true })
 */
(function () {
  "use strict";
  var script = document.currentScript;
  if (!script || window.__takatakAnalytics) return;
  window.__takatakAnalytics = true;

  var siteKey = script.getAttribute("data-site") || "";
  var api = (script.getAttribute("data-api") || new URL(script.src).origin).replace(/\/$/, "");
  var endpoint = api + "/api/public/analytics/collect";
  var optedOut = navigator.globalPrivacyControl === true || navigator.doNotTrack === "1" || window.doNotTrack === "1";
  var lastPath = null;

  function send(type, name) {
    if (!siteKey || optedOut) return;
    if (/^localhost$|^127\.|^\[::1\]$/.test(location.hostname)) return;
    var body = JSON.stringify({ k: siteKey, t: type, n: name || undefined, u: location.href, r: document.referrer || undefined });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob([body], { type: "text/plain" }))) return;
    } catch (_e) {}
    try {
      fetch(endpoint, { method: "POST", body: body, headers: { "Content-Type": "text/plain" }, keepalive: true, credentials: "omit", mode: "cors" }).catch(function () {});
    } catch (_e) {}
  }

  function pageview() {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    send("pageview");
  }

  // Single-page apps: follow history changes.
  ["pushState", "replaceState"].forEach(function (method) {
    var original = history[method];
    if (typeof original !== "function") return;
    history[method] = function () {
      var result = original.apply(this, arguments);
      setTimeout(pageview, 0);
      return result;
    };
  });
  window.addEventListener("popstate", pageview);

  // Automatic conversions: phone and email clicks, form submissions.
  document.addEventListener("click", function (event) {
    var link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!link) return;
    var href = link.getAttribute("href") || "";
    if (/^tel:/i.test(href)) send("conversion", "call_click");
    else if (/^mailto:/i.test(href)) send("conversion", "email_click");
    else if (/wa\.me\/|api\.whatsapp\.com/i.test(href)) send("conversion", "whatsapp_click");
  }, true);
  document.addEventListener("submit", function () {
    send("conversion", "form_submit");
  }, true);

  window.takatak = window.takatak || {};
  window.takatak.track = function (name, options) {
    var clean = String(name || "").toLowerCase().replace(/[^a-z0-9_.:-]/g, "_").slice(0, 64);
    if (clean) send(options && options.conversion ? "conversion" : "event", clean);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pageview);
  else pageview();
})();
