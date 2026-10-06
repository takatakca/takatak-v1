/*! TAKATAK Web Chat — floating chat bubble for client websites.
 * <script defer src="https://takatak.ca/takatak-chat.js" data-widget="tc_…"></script>
 * Optional: data-api="https://takatak.ca" (defaults to the script's own origin).
 * Renders in a Shadow DOM; all text is inserted with textContent (no HTML).
 */
(function () {
  "use strict";
  var script = document.currentScript;
  if (!script || window.__takatakChat) return;
  window.__takatakChat = true;

  var key = script.getAttribute("data-widget") || "";
  var api = (script.getAttribute("data-api") || new URL(script.src).origin).replace(/\/$/, "");
  var endpoint = api + "/api/public/chat";
  var storeKey = "takatak_chat_" + key;
  var fr = /^fr/i.test(document.documentElement.lang || navigator.language || "");
  var T = fr
    ? { title: "Écrivez-nous", placeholder: "Votre message…", send: "Envoyer", name: "Nom (facultatif)", email: "Courriel ou téléphone (facultatif)", hello: "Bonjour ! Comment pouvons-nous vous aider ?", whatsapp: "Continuer sur WhatsApp", closed: "Cette conversation est terminée.", error: "Message non envoyé. Réessayez.", powered: "Propulsé par TAKATAK" }
    : { title: "Chat with us", placeholder: "Your message…", send: "Send", name: "Name (optional)", email: "Email or phone (optional)", hello: "Hi! How can we help?", whatsapp: "Continue on WhatsApp", closed: "This conversation has ended.", error: "Message not sent. Please try again.", powered: "Powered by TAKATAK" };

  function load() { try { return localStorage.getItem(storeKey); } catch (_e) { return null; } }
  function save(v) { try { localStorage.setItem(storeKey, v); } catch (_e) {} }

  var token = load();
  var lastAt = null;
  var seen = {};
  var open = false;
  var pollTimer = null;
  var config = null;

  function get(params) {
    var q = Object.keys(params).filter(function (k) { return params[k]; }).map(function (k) { return k + "=" + encodeURIComponent(params[k]); }).join("&");
    return fetch(endpoint + "?" + q, { credentials: "omit", cache: "no-store" }).then(function (r) { return r.json(); });
  }
  function post(body) {
    return fetch(endpoint, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "text/plain" }, credentials: "omit" }).then(function (r) { return r.json(); });
  }

  get({ k: key }).then(function (res) {
    if (!res || !res.ok) return;
    config = res.widget;
    build();
  }).catch(function () {});

  function el(tag, style, text) {
    var node = document.createElement(tag);
    if (style) node.setAttribute("style", style);
    if (text) node.textContent = text;
    return node;
  }

  function build() {
    var accent = /^#[0-9a-f]{6}$/i.test(config.accentColor) ? config.accentColor : "#4f46e5";
    var host = el("div", "position:fixed;right:20px;bottom:20px;z-index:2147483000;");
    document.body.appendChild(host);
    var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    var font = "font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;";

    var bubble = el("button", font + "width:58px;height:58px;border-radius:999px;border:0;cursor:pointer;color:#fff;font-size:26px;box-shadow:0 8px 24px rgba(0,0,0,.25);background:" + accent + ";position:relative;", "💬");
    bubble.setAttribute("aria-label", T.title);
    var badge = el("span", "position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;border-radius:9px;background:#e11d48;color:#fff;font:600 11px/18px system-ui;display:none;");
    bubble.appendChild(badge);

    var panel = el("div", font + "display:none;position:absolute;right:0;bottom:72px;width:min(360px,calc(100vw - 32px));height:min(520px,calc(100vh - 120px));background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.25);overflow:hidden;flex-direction:column;");
    var head = el("div", "background:" + accent + ";color:#fff;padding:14px 16px;");
    head.appendChild(el("div", "font-weight:700;font-size:15px;", config.name));
    head.appendChild(el("div", "font-size:12px;opacity:.9;", T.title));
    var list = el("div", "flex:1;overflow-y:auto;padding:12px;background:#f8fafc;display:flex;flex-direction:column;gap:8px;");
    var form = el("form", "border-top:1px solid #e2e8f0;padding:10px;display:flex;flex-direction:column;gap:6px;background:#fff;");
    var nameInput = el("input", "border:1px solid #cbd5e1;border-radius:10px;padding:8px;font-size:13px;");
    nameInput.placeholder = T.name; nameInput.maxLength = 80;
    var contactInput = el("input", "border:1px solid #cbd5e1;border-radius:10px;padding:8px;font-size:13px;");
    contactInput.placeholder = T.email; contactInput.maxLength = 254;
    var row = el("div", "display:flex;gap:6px;");
    var input = el("textarea", "flex:1;border:1px solid #cbd5e1;border-radius:10px;padding:8px;font-size:14px;resize:none;height:42px;");
    input.placeholder = T.placeholder; input.maxLength = 2000;
    var send = el("button", "border:0;border-radius:10px;padding:0 14px;color:#fff;font-weight:600;cursor:pointer;background:" + accent + ";", T.send);
    send.type = "submit";
    row.appendChild(input); row.appendChild(send);
    var status = el("div", "font-size:11px;color:#e11d48;min-height:0;");
    if (!token) { form.appendChild(nameInput); form.appendChild(contactInput); }
    form.appendChild(row);
    form.appendChild(status);
    if (config.whatsappNumber) {
      var wa = el("a", "font-size:12px;color:#15803d;text-decoration:none;text-align:center;", T.whatsapp + " →");
      wa.href = "https://wa.me/" + String(config.whatsappNumber).replace(/\D/g, "");
      wa.target = "_blank"; wa.rel = "noopener";
      form.appendChild(wa);
    }
    form.appendChild(el("div", "font-size:10px;color:#94a3b8;text-align:center;", T.powered));
    panel.appendChild(head); panel.appendChild(list); panel.appendChild(form);
    root.appendChild(panel); root.appendChild(bubble);

    function addMessage(m) {
      if (seen[m.id]) return;
      seen[m.id] = true;
      var mine = m.sender === "visitor";
      var b = el("div", "max-width:80%;padding:8px 11px;border-radius:12px;font-size:14px;line-height:1.4;white-space:pre-wrap;word-wrap:break-word;" + (mine ? "align-self:flex-end;color:#fff;background:" + accent + ";" : "align-self:flex-start;background:#fff;color:#0f172a;border:1px solid #e2e8f0;"), m.body);
      list.appendChild(b);
      list.scrollTop = list.scrollHeight;
      if (!mine && !open) { badge.style.display = "block"; badge.textContent = "•"; }
      lastAt = m.createdAt;
    }

    list.appendChild(el("div", "align-self:flex-start;max-width:80%;padding:8px 11px;border-radius:12px;font-size:14px;background:#fff;border:1px solid #e2e8f0;color:#0f172a;", config.greeting || T.hello));

    function poll() {
      if (!token) return;
      get({ k: key, v: token, after: lastAt }).then(function (res) {
        if (!res || !res.ok) { if (res && res.error === "unknown_conversation") { token = null; save(""); } return; }
        (res.messages || []).forEach(addMessage);
        if (res.status === "closed") { status.textContent = T.closed; input.disabled = true; send.disabled = true; }
      }).catch(function () {});
    }
    function schedule() {
      clearInterval(pollTimer);
      pollTimer = setInterval(poll, open ? 4000 : 30000);
    }

    bubble.addEventListener("click", function () {
      open = !open;
      panel.style.display = open ? "flex" : "none";
      if (open) { badge.style.display = "none"; input.focus(); poll(); }
      schedule();
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var body = input.value.trim();
      if (!body) return;
      send.disabled = true; status.textContent = "";
      var contact = contactInput.value.trim();
      post({ k: key, v: token || undefined, body: body, name: nameInput.value.trim() || undefined, email: /@/.test(contact) ? contact : undefined, phone: contact && !/@/.test(contact) ? contact : undefined, page: location.href.slice(0, 500) })
        .then(function (res) {
          send.disabled = false;
          if (!res || !res.ok) { status.textContent = res && res.error === "closed" ? T.closed : T.error; return; }
          if (!token) { token = res.visitorToken; save(token); if (nameInput.parentNode) { form.removeChild(nameInput); form.removeChild(contactInput); } }
          input.value = "";
          addMessage(res.message);
        })
        .catch(function () { send.disabled = false; status.textContent = T.error; });
    });

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (form.requestSubmit) form.requestSubmit(); else send.click(); }
    });

    if (token) { poll(); }
    schedule();
  }
})();
