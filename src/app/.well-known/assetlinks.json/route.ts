import { androidAssetLinks } from "@/lib/pwa/manifest";

// Google Play (Trusted Web Activity) checks this file to open takatak.ca without an address bar.
export const dynamic = "force-dynamic";

export function GET() {
  const links = androidAssetLinks(process.env);
  if (!links) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return Response.json(links, { headers: { "Cache-Control": "public, max-age=3600" } });
}
