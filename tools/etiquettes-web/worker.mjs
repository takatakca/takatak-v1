import html from "./index.html";
import client from "./dist/client.js";
import { labelConfigInput } from "./src/label-config.ts";
import { normalizeGtin } from "./src/validation.ts";
const encoder = new TextEncoder();
const hex = (b) =>
  Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join(
    "",
  );
const digest = async (v) =>
  hex(await crypto.subtle.digest("SHA-256", encoder.encode(v)));
function response(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}
export default {
  async fetch(req, env) {
    const url = new URL(req.url),
      path = url.pathname;
    const security = {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'",
    };
    if (path === "/")
      return new Response(html, {
        headers: { ...security, "Content-Type": "text/html; charset=utf-8" },
      });
    if (path === "/app.js")
      return new Response(client, {
        headers: {
          ...security,
          "Content-Type": "text/javascript; charset=utf-8",
        },
      });
    if (path === "/robots.txt")
      return new Response("User-agent: *\nDisallow: /");
    if (!path.startsWith("/api/"))
      return response({ error: "Introuvable" }, 404);
    if (path === "/api/health" && req.method === "GET") {
      try {
        await env.DB.prepare("SELECT id FROM labels LIMIT 1").first();
        await env.DB.prepare("SELECT token FROM sessions LIMIT 1").first();
        return response({ ok: true, database: "ready" });
      } catch {
        return response({ ok: false, database: "unavailable" }, 503);
      }
    }
    const owner = req.headers.get("oai-authenticated-user-id");
    if (!owner)
      return response({ error: "Connexion à cet espace privé requise." }, 401);
    if (!env.DB) return response({ error: "Sauvegarde indisponible." }, 503);
    if (
      req.method !== "GET" &&
      (req.headers.get("Origin") !== url.origin ||
        req.headers.get("Sec-Fetch-Site") === "cross-site")
    )
      return response({ error: "Origine refusée." }, 403);
    const cookie = (req.headers.get("Cookie") || "").match(
      /(?:^|;\s*)__Host-label_session=([a-f0-9]{64})(?:;|$)/,
    )?.[1];
    const token = cookie ? await digest(cookie) : "";
    const session = token
      ? await env.DB.prepare(
          "SELECT owner FROM sessions WHERE token=? AND owner=? AND expires>?",
        )
          .bind(token, owner, Date.now())
          .first()
      : null;
    try {
      if (path === "/api/session" && req.method === "GET")
        return response({
          signedIn: !!session,
          username: session ? env.DEMO_USERNAME : null,
        });
      let body = null;
      if (req.method === "POST") {
        if (!req.headers.get("Content-Type")?.startsWith("application/json"))
          return response({ error: "JSON requis." }, 415);
        if (Number(req.headers.get("Content-Length") || 0) > 650000)
          return response({ error: "Fichier trop volumineux." }, 413);
        const raw = await req.text();
        if (raw.length > 650000)
          return response({ error: "Fichier trop volumineux." }, 413);
        body = JSON.parse(raw);
      }
      if (path === "/api/login" && req.method === "POST") {
        if (!env.DEMO_PASSWORD_HASH || !env.DEMO_SALT)
          return response({ error: "Compte non configuré." }, 503);
        const limit = await env.DB.prepare(
          "SELECT count,until_at FROM login_limits WHERE owner=?",
        )
          .bind(owner)
          .first();
        if (limit && limit.until_at > Date.now() && limit.count >= 8)
          return response(
            { error: "Trop de tentatives. Réessayez dans 15 minutes." },
            429,
          );
        if (
          typeof body.password !== "string" ||
          body.password.length > 200 ||
          typeof body.username !== "string"
        )
          return response({ error: "Identifiants invalides." }, 400);
        const key = await crypto.subtle.importKey(
          "raw",
          encoder.encode(body.password),
          "PBKDF2",
          false,
          ["deriveBits"],
        );
        const hash = hex(
          await crypto.subtle.deriveBits(
            {
              name: "PBKDF2",
              salt: encoder.encode(env.DEMO_SALT),
              iterations: 100000,
              hash: "SHA-256",
            },
            key,
            256,
          ),
        );
        let diff = hash.length ^ env.DEMO_PASSWORD_HASH.length;
        for (let i = 0; i < hash.length; i++)
          diff |=
            hash.charCodeAt(i) ^ (env.DEMO_PASSWORD_HASH.charCodeAt(i) || 0);
        if (diff || body.username !== env.DEMO_USERNAME) {
          await env.DB.prepare(
            "INSERT INTO login_limits(owner,count,until_at) VALUES(?,1,?) ON CONFLICT(owner) DO UPDATE SET count=CASE WHEN until_at<? THEN 1 ELSE count+1 END,until_at=CASE WHEN until_at<? THEN excluded.until_at ELSE until_at END",
          )
            .bind(owner, Date.now() + 900000, Date.now(), Date.now())
            .run();
          return response(
            { error: "Utilisateur ou mot de passe incorrect." },
            401,
          );
        }
        const secret = hex(crypto.getRandomValues(new Uint8Array(32)));
        await env.DB.batch([
          env.DB.prepare("DELETE FROM sessions WHERE expires<?").bind(
            Date.now(),
          ),
          env.DB.prepare("DELETE FROM login_limits WHERE owner=?").bind(owner),
          env.DB.prepare(
            "INSERT INTO sessions(token,owner,expires) VALUES(?,?,?)",
          ).bind(await digest(secret), owner, Date.now() + 28800000),
        ]);
        return response({ ok: true }, 200, {
          "Set-Cookie": `__Host-label_session=${secret}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`,
        });
      }
      if (!session)
        return response(
          { error: "Connectez-vous pour accéder à vos étiquettes." },
          401,
        );
      if (path === "/api/logout" && req.method === "POST") {
        await env.DB.prepare("DELETE FROM sessions WHERE token=? AND owner=?")
          .bind(token, owner)
          .run();
        return response({ ok: true }, 200, {
          "Set-Cookie":
            "__Host-label_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
        });
      }
      if (path === "/api/labels" && req.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT id,title,payload,version,updated_at FROM labels WHERE owner=? ORDER BY updated_at DESC LIMIT 200",
        )
          .bind(owner)
          .all();
        return response({
          labels: results.map((x) => ({
            ...x,
            payload: JSON.parse(x.payload),
          })),
        });
      }
      if (path === "/api/labels" && req.method === "POST") {
        if (
          typeof body.title !== "string" ||
          !body.title.trim() ||
          body.title.length > 160 ||
          !body.payload ||
          typeof body.payload !== "object"
        )
          return response({ error: "Étiquette invalide." }, 400);
        try {
          body.payload.config = labelConfigInput(body.payload.config);
          const p = body.payload.product;
          if (
            !p ||
            typeof p.name !== "string" ||
            !p.name.trim() ||
            p.name.length > 160 ||
            typeof p.sku !== "string" ||
            !p.sku.trim() ||
            p.sku.length > 40 ||
            typeof p.size !== "string" ||
            p.size.length > 80
          )
            return response({ error: "Produit invalide." }, 400);
          if (p.gtin) p.gtin = normalizeGtin(p.gtin);
        } catch {
          return response({ error: "Configuration invalide." }, 400);
        }
        const id = body.id || crypto.randomUUID();
        if (!/^[a-f0-9-]{36}$/.test(id))
          return response({ error: "Identifiant invalide." }, 400);
        const value = JSON.stringify(body.payload);
        if (value.length > 600000)
          return response({ error: "Étiquette trop volumineuse." }, 413);
        const now = new Date().toISOString();
        if (body.id) {
          const result = await env.DB.prepare(
            "UPDATE labels SET title=?,payload=?,version=version+1,updated_at=? WHERE id=? AND owner=? AND version=?",
          )
            .bind(body.title.trim(), value, now, id, owner, body.version)
            .run();
          if (!result.meta.changes)
            return response(
              {
                error:
                  "Cette étiquette a changé. Rechargez-la avant de sauvegarder.",
              },
              409,
            );
        } else {
          const n = await env.DB.prepare(
            "SELECT count(*) AS total FROM labels WHERE owner=?",
          )
            .bind(owner)
            .first();
          if (n.total >= 200)
            return response({ error: "Limite de 200 modèles atteinte." }, 409);
          await env.DB.prepare(
            "INSERT INTO labels(id,owner,title,payload,updated_at) VALUES(?,?,?,?,?)",
          )
            .bind(id, owner, body.title.trim(), value, now)
            .run();
        }
        const saved = await env.DB.prepare(
          "SELECT id,version,updated_at FROM labels WHERE id=? AND owner=?",
        )
          .bind(id, owner)
          .first();
        return response({ ok: true, ...saved });
      }
      return response({ error: "Introuvable" }, 404);
    } catch (error) {
      console.error("labels request failed", error?.name);
      return response({ error: "Action impossible. Réessayez." }, 500);
    }
  },
};
