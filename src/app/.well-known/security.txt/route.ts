import { getApplicationOrigin } from "@/lib/config/app-origin";

// RFC 9116: where to report a security problem. The support address is the one
// already published in the site footer. Expires rolls forward (180 days) so the
// file never goes stale; the RFC asks for less than a year.
export const dynamic = "force-dynamic";

export function GET(): Response {
  const origin = getApplicationOrigin().replace(/\/+$/, "");
  const expires = new Date(Date.now() + 180 * 86_400_000);
  expires.setUTCHours(0, 0, 0, 0);
  const body = [
    "Contact: mailto:support@takatak.ca",
    `Expires: ${expires.toISOString()}`,
    "Preferred-Languages: fr, en",
    `Canonical: ${origin}/.well-known/security.txt`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
  });
}
