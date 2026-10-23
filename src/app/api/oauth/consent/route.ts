import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient, getSessionUser } from "@/lib/auth/supabase-server";
import { originFromRequest } from "@/lib/config/app-origin";
import {
  consentLanguage,
  consentLoginPath,
  consentPagePath,
  escapeConsentHtml,
  isConsentPostAllowed,
  parseAuthorizationId,
  safeOAuthRedirectTarget,
  type ConsentLanguage,
} from "@/lib/auth/oauth-consent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FORM_BYTES = 4_096;

const NOTICE = {
  fr: {
    title: "Autorisation interrompue",
    origin: "Cette demande ne vient pas de TAKATAK.",
    invalid: "Cette demande d’autorisation est incomplète.",
    unavailable: "La connexion TAKATAK n’est pas disponible. Réessayez dans un moment.",
    decision: "TAKATAK n’a pas pu confirmer votre choix. Revenez à l’application et recommencez.",
    unsafe: "L’adresse de retour n’est pas autorisée. TAKATAK ne vous y a pas envoyé.",
    back: "Retour à la demande",
  },
  en: {
    title: "Authorization stopped",
    origin: "This request did not come from TAKATAK.",
    invalid: "This authorization request is incomplete.",
    unavailable: "TAKATAK sign-in is unavailable. Try again in a moment.",
    decision: "TAKATAK could not confirm your choice. Return to the application and start again.",
    unsafe: "The return address is not allowed. TAKATAK did not send you there.",
    back: "Back to the request",
  },
} as const;

export async function POST(request: NextRequest) {
  const language = consentLanguage(request.nextUrl.searchParams.get("lang"));
  if (!isConsentPostAllowed(request)) {
    return notice(language, "origin", 403);
  }

  const form = await readConsentForm(request);
  if (form === "too-large") return notice(language, "invalid", 413);
  if (form === "invalid") return notice(language, "invalid", 400);

  const chosenLanguage = consentLanguage(singleField(form, "lang"));
  const decision = singleField(form, "decision");
  const authorizationId = parseAuthorizationId(singleField(form, "authorization_id"));
  if ((decision !== "approve" && decision !== "deny") || !authorizationId) {
    return notice(chosenLanguage, "invalid", 400);
  }

  const user = await getSessionUser();
  if (!user) {
    const login = new URL(consentLoginPath(authorizationId, chosenLanguage), originFromRequest(request));
    return seeOther(login.toString());
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return notice(chosenLanguage, "unavailable", 503);

  let result: Awaited<ReturnType<typeof supabase.auth.oauth.approveAuthorization>>;
  try {
    result = decision === "approve"
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
  } catch {
    return notice(chosenLanguage, "decision", 502, authorizationId);
  }

  if (result.error || !result.data?.redirect_url) {
    const code = result.error && "code" in result.error ? String(result.error.code ?? "") : "";
    if (/^[a-z0-9_]{1,40}$/i.test(code)) {
      console.error(`[oauth-consent] ${decision} failed code=${code}`);
    } else {
      console.error(`[oauth-consent] ${decision} failed`);
    }
    return notice(chosenLanguage, "decision", 400, authorizationId);
  }

  const target = safeOAuthRedirectTarget(result.data.redirect_url);
  if (!target) return notice(chosenLanguage, "unsafe", 400, authorizationId);
  return seeOther(target);
}

async function readConsentForm(
  request: NextRequest,
): Promise<FormData | "too-large" | "invalid"> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (
    contentType !== "application/x-www-form-urlencoded" &&
    contentType !== "multipart/form-data"
  ) {
    return "invalid";
  }

  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const size = Number(declared);
    if (!Number.isSafeInteger(size) || size < 0 || size > MAX_FORM_BYTES) return "too-large";
  }

  const body = await readBoundedBody(request);
  if (body === "too-large" || body === "invalid") return body;

  try {
    return await new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: body,
    }).formData();
  } catch {
    return "invalid";
  }
}

async function readBoundedBody(
  request: NextRequest,
): Promise<ArrayBuffer | "too-large" | "invalid"> {
  if (!request.body) return "invalid";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_FORM_BYTES) {
        await reader.cancel().catch(() => undefined);
        return "too-large";
      }
      chunks.push(value);
    }
  } catch {
    return "invalid";
  } finally {
    reader.releaseLock();
  }

  const body = new ArrayBuffer(length);
  const view = new Uint8Array(body);
  let offset = 0;
  for (const chunk of chunks) {
    view.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function singleField(form: FormData, name: string): string | null {
  const values = form.getAll(name);
  if (values.length !== 1 || typeof values[0] !== "string") return null;
  return values[0];
}

function seeOther(location: string): NextResponse {
  const headers = privateHeaders();
  headers.set("Location", location);
  return new NextResponse(null, { status: 303, headers });
}

function notice(
  language: ConsentLanguage,
  key: keyof Omit<(typeof NOTICE)["fr"], "title" | "back">,
  status: number,
  authorizationId?: string,
): NextResponse {
  const copy = NOTICE[language];
  const back = authorizationId
    ? `<p style="margin-top:24px"><a href="${escapeConsentHtml(consentPagePath(authorizationId, language))}" style="color:#29C3FF">${escapeConsentHtml(copy.back)}</a></p>`
    : "";
  const html = `<!doctype html>
<html lang="${language === "fr" ? "fr-CA" : "en-CA"}">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeConsentHtml(copy.title)} — TAKATAK</title>
</head>
<body style="margin:0;background:#060D1F;color:#F5F8FC;font-family:Montserrat,Inter,sans-serif">
<main style="max-width:32rem;margin:0 auto;padding:4rem 1rem">
<p style="letter-spacing:0.28em;font-size:12px;font-weight:800;color:#29C3FF">GROUPE TAKATAK</p>
<section style="margin-top:2rem;border:1px solid rgba(255,255,255,0.1);background:#0B1B3D;border-radius:16px;padding:2rem">
<h1 style="font-size:1.5rem;margin:0">${escapeConsentHtml(copy.title)}</h1>
<p style="color:#B8C4D3;line-height:1.6">${escapeConsentHtml(copy[key])}</p>
${back}
</section>
</main>
</body>
</html>`;
  const headers = privateHeaders();
  headers.set("Content-Type", "text/html; charset=utf-8");
  return new NextResponse(html, { status, headers });
}

function privateHeaders(): Headers {
  const headers = new Headers();
  headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}
