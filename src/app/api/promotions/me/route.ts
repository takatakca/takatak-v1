import { getSessionUser } from "@/lib/auth/supabase-server";
import { getPrisma } from "@/lib/db/prisma";
import { promoAuditStore } from "@/lib/promotions/audit-store";
import { listAvailablePromos } from "@/lib/promotions/catalog";
import { listMyPromos } from "@/lib/promotions/service";
import { jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return jsonResponse({ ok: false, code: "sign_in_required" }, 401);
  }

  const prisma = getPrisma();
  if (!prisma) {
    return jsonResponse({ ok: false, code: "unavailable" }, 503);
  }

  const profile = await prisma.profile.findUnique({
    where: { authUserId: user.id },
    select: { id: true },
  });
  if (!profile) {
    return jsonResponse(
      {
        ok: true,
        promotions: [],
        available: listAvailablePromos().map((promo) => ({
          code: promo.code,
          percentOff: promo.percentOff,
          status: "available" as const,
        })),
      },
      200,
    );
  }

  const mine = await listMyPromos(promoAuditStore(prisma), profile.id);
  return jsonResponse({ ok: true, ...mine }, 200);
}
