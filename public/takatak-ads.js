(function () {
  "use strict";

  var DEFAULT_VIEWABILITY_MS = 1000;
  var DEFAULT_THRESHOLD = 0.5;

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
        context: context || {},
      },
      eventType === "click",
    ).catch(function () {});
  }

  function renderCreative(container, ad, options) {
    container.innerHTML = "";
    container.hidden = false;
    container.setAttribute("data-takatak-ad-filled", "true");

    var link = document.createElement("a");
    link.href = ad.destinationUrl;
    link.rel = "sponsored noopener noreferrer";
    link.target = options.target || "_blank";
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

  function trackViewability(container, apiOrigin, ad, context, options) {
    if (!("IntersectionObserver" in window)) {
      emit(apiOrigin, ad, "impression", context);
      return;
    }

    var timer = null;
    var sent = false;
    var observer = new IntersectionObserver(
      function (entries) {
        var entry = entries[0];
        if (!entry || sent) return;

        if (entry.isIntersecting && entry.intersectionRatio >= DEFAULT_THRESHOLD) {
          if (!timer) {
            timer = window.setTimeout(function () {
              sent = true;
              observer.disconnect();
              emit(apiOrigin, ad, "impression", context);
            }, options.viewabilityMs || DEFAULT_VIEWABILITY_MS);
          }
        } else if (timer) {
          window.clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: [DEFAULT_THRESHOLD] },
    );

    observer.observe(container);
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

    container.hidden = true;
    container.removeAttribute("data-takatak-ad-filled");

    var apiOrigin = normalizeOrigin(options.apiOrigin || window.location.origin);
    var publisherCode = safeText(options.publisherCode);
    var placementCode = safeText(options.placementCode);

    if (!publisherCode || !placementCode) {
      throw new Error(
        "TAKATAK ADS: publisherCode and placementCode are required.",
      );
    }

    try {
      var response = await postJson(
        apiOrigin + "/api/ads/serve",
        {
          publisherCode: publisherCode,
          placementCode: placementCode,
          context: options.context || {},
        },
        false,
      );
      var payload = await response.json();

      if (!response.ok || !payload || !payload.filled || !payload.ad) {
        container.hidden = true;
        return null;
      }

      var ad = payload.ad;
      var link = renderCreative(container, ad, options);

      link.addEventListener("click", function () {
        emit(apiOrigin, ad, "click", options.context || {});
      });

      trackViewability(
        container,
        apiOrigin,
        ad,
        options.context || {},
        options,
      );

      return ad;
    } catch (_) {
      container.hidden = true;
      return null;
    }
  }

  window.TAKATAKAds = Object.freeze({ render: render });
})();
