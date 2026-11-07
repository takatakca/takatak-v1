"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const sdkSource = fs.readFileSync(
  path.join(__dirname, "..", "public", "takatak-ads.js"),
  "utf8",
);

function fixture({ observer = true, fetchImpl } = {}) {
  const requests = [];
  const timers = new Map();
  const observers = [];
  const documentListeners = new Map();
  const windowListeners = new Map();
  let timerId = 0;

  class Element {
    constructor(tagName) {
      this.tagName = tagName;
      this.children = [];
      this.attributes = {};
      this.listeners = {};
      this.hidden = false;
      this.style = {};
    }

    set innerHTML(value) {
      if (value === "") this.children = [];
    }

    set textContent(value) {
      this._textContent = value;
      if (value === "") this.children = [];
    }

    get textContent() {
      return this._textContent;
    }

    appendChild(child) {
      this.children.push(child);
    }

    setAttribute(key, value) {
      this.attributes[key] = value;
    }

    removeAttribute(key) {
      delete this.attributes[key];
    }

    addEventListener(type, handler) {
      this.listeners[type] = handler;
    }
  }

  class FakeObserver {
    constructor(callback) {
      this.callback = callback;
      this.disconnected = false;
      observers.push(this);
    }

    observe(target) {
      this.target = target;
    }

    disconnect() {
      this.disconnected = true;
    }

    trigger(ratio) {
      this.callback([{
        target: this.target,
        isIntersecting: ratio > 0,
        intersectionRatio: ratio,
      }]);
    }
  }

  const element = new Element("div");
  const document = {
    hidden: false,
    createElement: (tagName) => new Element(tagName),
    querySelector: (selector) => selector === "#ad" ? element : null,
    addEventListener(type, handler) {
      documentListeners.set(type, handler);
    },
    removeEventListener(type, handler) {
      if (documentListeners.get(type) === handler) documentListeners.delete(type);
    },
  };
  const window = {
    location: { origin: "https://publisher.example" },
    addEventListener(type, handler) {
      windowListeners.set(type, handler);
    },
    removeEventListener(type, handler) {
      if (windowListeners.get(type) === handler) windowListeners.delete(type);
    },
    setTimeout(handler, ms) {
      const id = ++timerId;
      timers.set(id, { handler, ms });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };
  if (observer) window.IntersectionObserver = FakeObserver;

  const defaultAd = {
    headline: "Local hockey",
    destinationUrl: "https://merchant.example/offer",
    clickUrl: "https://publisher.example/api/ads/click?t=token",
    trackingToken: "token",
    trackingEnabled: true,
  };
  const fetch = (url, init) => {
    requests.push({ url, body: JSON.parse(init.body) });
    if (fetchImpl) return fetchImpl(url, init);
    return Promise.resolve({
      ok: true,
      json: async () => ({ filled: true, ad: defaultAd }),
    });
  };
  const context = { window, document, fetch, URL, console };
  if (observer) context.IntersectionObserver = FakeObserver;
  vm.runInNewContext(sdkSource, context, { filename: "takatak-ads.js" });

  return {
    ads: window.TAKATAKAds,
    element,
    requests,
    timers,
    observers,
    document,
    documentListeners,
    tick() {
      const pending = [...timers.values()];
      timers.clear();
      pending.forEach(({ handler }) => handler());
    },
  };
}

function renderOptions(element, context) {
  return {
    element,
    publisherCode: "ahmv",
    placementCode: "home-hero-01",
    context,
  };
}

test("serve and events forward only coarse allowlisted context", async () => {
  const f = fixture();
  await f.ads.render(renderOptions(f.element, {
    city: " Verdun ",
    postalPrefix: "H4G 9Z9",
    device: "mobile",
    email: "private@example.com",
    fingerprint: "do-not-send",
    latitude: "45.2",
    region: { secret: "ignored" },
  }));
  assert.deepEqual(JSON.parse(JSON.stringify(f.requests[0].body.context)), {
    city: "Verdun",
    postalPrefix: "H4G",
    device: "mobile",
  });
  f.observers[0].trigger(0.5);
  assert.ok([...f.timers.values()][0].ms >= 1000);
  f.tick();
  const impression = f.requests.find((r) => r.url.endsWith("/api/ads/events"));
  assert.equal(impression.body.eventType, "impression");
  assert.deepEqual(JSON.parse(JSON.stringify(impression.body.context)), {
    city: "Verdun",
    postalPrefix: "H4G",
    device: "mobile",
  });
});

test("viewability timer pauses while the document is hidden", async () => {
  const f = fixture();
  await f.ads.render(renderOptions(f.element));
  f.observers[0].trigger(0.49);
  assert.equal(f.timers.size, 0);
  f.observers[0].trigger(0.5);
  assert.equal(f.timers.size, 1);
  f.document.hidden = true;
  f.documentListeners.get("visibilitychange")();
  assert.equal(f.timers.size, 0);
  f.document.hidden = false;
  f.documentListeners.get("visibilitychange")();
  f.tick();
  assert.equal(f.requests.filter((r) => r.body.eventType === "impression").length, 1);
  assert.equal(f.observers[0].disconnected, true);
});

test("without IntersectionObserver, never claim an unmeasured impression", async () => {
  const f = fixture({ observer: false });
  await f.ads.render(renderOptions(f.element));
  f.tick();
  assert.equal(f.requests.length, 1);
});

test("stale network responses cannot overwrite newer ads", async () => {
  const responses = [];
  const f = fixture({
    fetchImpl: () => new Promise((resolve) => responses.push(resolve)),
  });
  const older = f.ads.render(renderOptions(f.element));
  const newer = f.ads.render(renderOptions(f.element));
  responses[1]({
    ok: true,
    json: async () => ({ filled: true, ad: {
      headline: "New creative",
      destinationUrl: "https://merchant.example/new",
    } }),
  });
  assert.equal((await newer).headline, "New creative");
  responses[0]({
    ok: true,
    json: async () => ({ filled: true, ad: {
      headline: "Old creative",
      destinationUrl: "https://merchant.example/old",
    } }),
  });
  assert.equal(await older, null);
  assert.equal(f.element.children.length, 1);
  assert.equal(f.element.children[0].href, "https://merchant.example/new");
});

test("reject unsafe creative links and clear pending viewability on teardown", async () => {
  const unsafe = fixture({
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ filled: true, ad: {
        headline: "Bad creative",
        destinationUrl: "javascript:alert(1)",
      } }),
    }),
  });
  assert.equal(await unsafe.ads.render(renderOptions(unsafe.element)), null);
  assert.equal(unsafe.element.hidden, true);
  assert.equal(unsafe.element.children.length, 0);

  const f = fixture();
  await f.ads.render(renderOptions(f.element));
  f.observers[0].trigger(1);
  assert.equal(f.timers.size, 1);
  f.ads.clear(f.element);
  assert.equal(f.timers.size, 0);
  assert.equal(f.observers[0].disconnected, true);
  assert.equal(f.element.hidden, true);
});
