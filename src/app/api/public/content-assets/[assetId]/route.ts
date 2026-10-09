import { NextResponse } from "next/server";
import { publicApprovedAssetRedirect } from "@/lib/contributions/assets";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) return NextResponse.json({ ok:false },{ status:404 });
  try {
    const asset = await publicApprovedAssetRedirect(assetId);
    if (!asset) return NextResponse.json({ ok:false },{ status:404 });
    return NextResponse.redirect(asset.url,{ status:302,headers:{ "Cache-Control":"public, max-age=120, stale-while-revalidate=120","X-Robots-Tag":"noindex, nofollow" }});
  } catch {
    return NextResponse.json({ ok:false },{ status:503 });
  }
}
