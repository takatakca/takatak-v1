/**
 * Production OAuth callback relay (Cloudflare Worker example).
 *
 * Register THIS Worker's HTTPS URL as META_OAUTH_REDIRECT_URI in the Meta app
 * and in the Next.js environment. Meta's browser redirect (GET + query) hits
 * the Worker — not the Next.js origin — so Vercel/host access logs never see
 * authorization codes or state.
 *
 * The Worker forwards fields as POST JSON to the Next.js origin callback
 * (no query string). Do not console.log request URLs or bodies here.
 *
 * Bind secrets:
 *   ORIGIN_CALLBACK_URL = https://<your-app>/api/social/callback/facebook
 *   RELAY_SHARED_SECRET  = optional shared secret sent as X-Takatak-OAuth-Relay
 *
 * Deploy: wrangler publish (or paste into Cloudflare dashboard).
 */

export default {
  async fetch(request, env) {
    if (request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const inbound = new URL(request.url);
    const originCallback = env.ORIGIN_CALLBACK_URL;

    if (!originCallback || typeof originCallback !== "string") {
      return new Response("Relay not configured", { status: 503 });
    }

    const payload = {
      code: inbound.searchParams.get("code") ?? undefined,
      state: inbound.searchParams.get("state") ?? undefined,
      error: inbound.searchParams.get("error") ?? undefined,
      error_reason:
        inbound.searchParams.get("error_reason") ?? undefined,
      error_description:
        inbound.searchParams.get("error_description") ??
        undefined,
    };

    const headers = {
      "content-type": "application/json",
      accept: "application/json",
    };

    if (
      env.RELAY_SHARED_SECRET &&
      typeof env.RELAY_SHARED_SECRET === "string"
    ) {
      headers["x-takatak-oauth-relay"] = env.RELAY_SHARED_SECRET;
    }

    // Forward Cookie so the Next.js session can finish authorization.
    const cookie = request.headers.get("cookie");
    if (cookie) {
      headers.cookie = cookie;
    }

    let upstream;
    try {
      upstream = await fetch(originCallback, {
        method: "POST",
        redirect: "manual",
        headers,
        body: JSON.stringify(payload),
      });
    } catch {
      return new Response("Upstream unavailable", { status: 502 });
    }

    // Preserve redirects (Location) back to the browser without logging.
    const responseHeaders = new Headers();
    const location = upstream.headers.get("location");
    if (location) {
      responseHeaders.set("location", location);
    }

    const setCookies = upstream.headers.getSetCookie?.() ?? [];
    for (const value of setCookies) {
      responseHeaders.append("set-cookie", value);
    }

    return new Response(null, {
      status: upstream.status,
      headers: responseHeaders,
    });
  },
};
