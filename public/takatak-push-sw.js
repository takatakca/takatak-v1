/* TAKATAK deal alerts service worker. Push and notification clicks only: no
   fetch handler, no caching. Pushes carry no payload; the live offer is read
   from the server, so a notification never shows an offer that has ended. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function copy(lang) {
  return lang === "en"
    ? { title: "A TAKATAK promotion just started", generic: "See today’s TAKATAK offers.", ends: "ends" }
    : { title: "Une promotion TAKATAK vient de commencer", generic: "Voir les offres TAKATAK du moment.", ends: "se termine le" };
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      const lang = (self.navigator && self.navigator.language || "fr").toLowerCase().startsWith("en") ? "en" : "fr";
      const c = copy(lang);
      let campaign = null;
      try {
        const res = await fetch("/api/public/push/latest", { cache: "no-store" });
        if (res.ok) campaign = (await res.json()).campaign;
      } catch (_) {
        campaign = null;
      }
      if (!campaign) {
        // A push must show something; without a live campaign it points to regular offers.
        return self.registration.showNotification("TAKATAK", { body: c.generic, icon: "/icon.png", data: { url: "/" }, tag: "takatak-offers" });
      }
      const end = new Date(campaign.endsAt).toLocaleString(lang === "en" ? "en-CA" : "fr-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Montreal" });
      const name = (campaign.title && campaign.title[lang]) || campaign.code;
      return self.registration.showNotification(c.title, {
        body: `${name} · −${campaign.percentOff} % · ${c.ends} ${end}`,
        icon: "/icon.png",
        tag: `takatak-${campaign.code}`,
        data: { url: `/offres/${encodeURIComponent(campaign.code)}` },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.navigate(url).catch(() => undefined);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
