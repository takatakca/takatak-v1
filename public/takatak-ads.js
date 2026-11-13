(function () {
  "use strict";

  var DEFAULT_VIEWABILITY_MS = 1000;
  var DEFAULT_THRESHOLD = 0.5;
  var activeRenders = new WeakMap();
  var contextLimits = Object.freeze({
    country: 80,
    region: 120,
    city: 120,
    postalPrefix: 3,
    category: 120,
    locale: 16,
    device: 24,
  });

  // Allow coarse contextual fields only: no arbitrary PII or fingerprints.
  function cleanContext(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    var result = {};
    Object.keys(contextLimits).forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) return;
      if (typeof value[key] !== "string") return;
      var text = value[key].trim().slice(0, contextLimits[key]);
      if (key === "postalPrefix") {
        text = value[key].replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase();
      }
      if (key === "device" && !/^(mobile|desktop|tablet)$/i.test(text)) return;
      if (text) result[key] = text;
    });
    return result;
  }

  function isHttpUrl(value) {
    if (typeof value !== "string") return false;
    try {
      var url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch (_) {
      return false;
    }
  }

  function collapse(container) {
    container.hidden = true;
    container.removeAttribute("data-takatak-ad-filled");
  }

  function clear(element) {
    var container =
      typeof element === "string" ? document.querySelector(element) : element;
    if (!container) return;
    var previous = activeRenders.get(container);
    if (previous && previous.cancel) previous.cancel();
    activeRenders.delete(container);
    container.textContent = "";
    collapse(container);
  }

  function normalizeOrigin(value) {
    return String(value || "").replace(/\/$/, "");
  }

  function safeText(value) {
    return typeof value === "string" ? value : "";
  }

  function postJson(url, body, keepalive) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "omit",
      cache: "no-store",
      keepalive: Boolean(keepalive),
    });
  }

  function emit(apiOrigin, ad, eventType, context) {
    if (!ad || !ad.trackingEnabled || !ad.trackingToken) {
      return Promise.resolve();
    }

    return postJson(
      normalizeOrigin(apiOrigin) + "/api/ads/events",
      {
        trackingToken: ad.trackingToken,
        eventType: eventType,
        context: cleanContext(context),
      },
      eventType === "click",
    ).catch(function () {});
  }

  function renderCreative(container, ad, options) {
    container.innerHTML = "";
    container.hidden = false;
    container.setAttribute("data-takatak-ad-filled", "true");

    var link = document.createElement("a");
    link.href = ad.clickUrl || ad.destinationUrl;
    link.rel = "sponsored noopener noreferrer";
    link.target = options.target === "_self" ? "_self" : "_blank";
    link.style.display = "block";
    link.style.textDecoration = "none";
    link.style.color = "inherit";

    var card = document.createElement("div");
    card.className = options.cardClass || "takatak-ad-card";
    card.style.border = "1px solid rgba(148,163,184,.35)";
    card.style.borderRadius = "12px";
    card.style.overflow = "hidden";
    card.style.background = "#fff";

    if (ad.imageUrl) {
      var image = document.createElement("img");
      image.src = ad.imageUrl;
      image.alt = "";
      image.loading = "lazy";
      image.referrerPolicy = "strict-origin-when-cross-origin";
      image.style.width = "100%";
      image.style.height = "auto";
      image.style.display = "block";
      card.appendChild(image);
    }

    var content = document.createElement("div");
    content.style.padding = "12px";

    var label = document.createElement("div");
    label.textContent = safeText(ad.label) || "Advertisement";
    label.style.fontSize = "11px";
    label.style.fontWeight = "700";
    label.style.opacity = ".6";
    label.style.textTransform = "uppercase";
    label.style.letterSpacing = ".06em";
    content.appendChild(label);

    var headline = document.createElement("div");
    headline.textContent = safeText(ad.headline);
    headline.style.marginTop = "5px";
    headline.style.fontSize = "16px";
    headline.style.fontWeight = "700";
    content.appendChild(headline);

    if (ad.body) {
      var body = document.createElement("div");
      body.textContent = safeText(ad.body);
      body.style.marginTop = "4px";
      body.style.fontSize = "14px";
      body.style.opacity = ".78";
      content.appendChild(body);
    }

    if (ad.callToAction) {
      var cta = document.createElement("div");
      cta.textContent = safeText(ad.callToAction);
      cta.style.marginTop = "10px";
      cta.style.fontSize = "13px";
      cta.style.fontWeight = "700";
      content.appendChild(cta);
    }

    card.appendChild(content);
    link.appendChild(card);
    container.appendChild(link);

    return link;
  }

  function trackViewability(container, apiOrigin, ad, context, options, state) {
    // Do not count an impression if the browser cannot measure viewability.
    if (!("IntersectionObserver" in window)) return function () {};

    var timer = null;
    var observer = null;
    var visible = false;
    var sent = false;
    var requestedMs = Number(options.viewabilityMs);
    var duration = Number.isFinite(requestedMs)
      ? Math.min(60000, Math.max(DEFAULT_VIEWABILITY_MS, requestedMs))
      : DEFAULT_VIEWABILITY_MS;

    function stopTimer() {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    }

    function currentAndVisible() {
      return (
        activeRenders.get(container) === state &&
        !document.hidden &&
        !container.hidden &&
        visible
      );
    }

    function schedule() {
      if (sent || !currentAndVisible()) {
        stopTimer();
        return;
      }
      if (timer !== null) return;
      timer = window.setTimeout(function () {
        timer = null;
        if (!currentAndVisible() || sent) return;
        sent = true;
        cancel();
        emit(apiOrigin, ad, "impression", context);
      }, duration);
    }

    function onVisibilityChange() {
      schedule();
    }

    function cancel() {
      stopTimer();
      if (observer) observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", cancel);
    }

    observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i += 1) {
        if (entries[i].target !== container) continue;
        visible =
          entries[i].isIntersecting &&
          entries[i].intersectionRatio >= DEFAULT_THRESHOLD;
        schedule();
      }
    }, { threshold: [0, DEFAULT_THRESHOLD, 1] });

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", cancel);
    observer.observe(container);
    return cancel;
  }

  async function render(options) {
    options = options || {};
    var container =
      typeof options.element === "string"
        ? document.querySelector(options.element)
        : options.element;

    if (!container) {
      throw new Error("TAKATAK ADS: placement element not found.");
    }

    var previous = activeRenders.get(container);
    if (previous && previous.cancel) previous.cancel();
    var state = { cancel: null };
    activeRenders.set(container, state);
    collapse(container);

    var apiOrigin = normalizeOrigin(options.apiOrigin || window.location.origin);
    var publisherCode = safeText(options.publisherCode);
    var placementCode = safeText(options.placementCode);
    var context = cleanContext(options.context);

    if (!isHttpUrl(apiOrigin) || !publisherCode || !placementCode) {
      throw new Error(
        "TAKATAK ADS: valid apiOrigin, publisherCode and placementCode are required.",
      );
    }

    try {
      var response = await postJson(
        apiOrigin + "/api/ads/serve",
        {
          publisherCode: publisherCode,
          placementCode: placementCode,
          context: context,
        },
        false,
      );
      var payload = await response.json();

      // A slower, older request must never overwrite a newer placement.
      if (activeRenders.get(container) !== state) return null;
      if (!response.ok || !payload || !payload.filled || !payload.ad) {
        collapse(container);
        return null;
      }

      var ad = payload.ad;
      if (!isHttpUrl(ad.destinationUrl) ||
          (ad.clickUrl && !isHttpUrl(ad.clickUrl))) {
        collapse(container);
        return null;
      }
      if (ad.imageUrl && !isHttpUrl(ad.imageUrl)) {
        ad = Object.assign({}, ad, { imageUrl: null });
      }

      var link = renderCreative(container, ad, options);
      link.addEventListener("click", function () {
        emit(apiOrigin, ad, "click", context);
      });

      state.cancel = trackViewability(
        container, apiOrigin, ad, context, options, state,
      );
      return ad;
    } catch (_) {
      if (activeRenders.get(container) === state) collapse(container);
      return null;
    }
  }

  window.TAKATAKAds = Object.freeze({ render: render, clear: clear });
})();
