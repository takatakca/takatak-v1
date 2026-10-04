import { NextResponse } from "next/server";
import { verifyAhmvContentRequest } from "@/lib/contributions/ahmv-auth";
import { uploadAhmvContributionAsset } from "@/lib/contributions/assets";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const auth = verifyAhmvContentRequest(request.headers);
  if (!auth.valid) return NextResponse.json({ ok:false,error:auth.error },{ status:auth.status });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok:false,error:"A file is required." },{ status:400 });
  try {
    const asset = await uploadAhmvContributionAsset(file);
    return NextResponse.json({ ok:true,asset },{ status:201,headers:{ "Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow" }});
  } catch (error) {
    const message = error instanceof Error ? error.message : "ASSET_UPLOAD_FAILED";
    const status = message === "UNSUPPORTED_ASSET_TYPE" || message === "ASSET_SIZE_INVALID" ? 400 : message === "CONTRIBUTION_STORAGE_NOT_CONFIGURED" ? 503 : 500;
    return NextResponse.json({ ok:false,error:message },{ status });
  }
}
