// Phase 15A — Brand IDs from URLs/forms/metadata are never trusted; they
// must belong to a client the caller may access.
// (server-only marker removed: these modules are server-side by usage —
// next/headers + Prisma — and must stay importable by tsx QA scripts.)
import { getPrisma } from "@/lib/db/prisma";

export type BrandAccessResult =
  | { allowed: true; brandId: string; clientId: string }
  | { allowed: false; reason: "not_found" | "wrong_client" | "database_unavailable" };

export async function checkBrandBelongsToClient(
  brandId: string,
  allowedClientIds: string[] | null, // null = platform admin (any client)
): Promise<BrandAccessResult> {
  const prisma = getPrisma();
  if (!prisma) return { allowed: false, reason: "database_unavailable" };
  const brand = await prisma.businessBrand.findUnique({
    where: { id: brandId },
    select: { id: true, clientId: true },
  });
  if (!brand) return { allowed: false, reason: "not_found" };
  if (allowedClientIds && !allowedClientIds.includes(brand.clientId)) {
    return { allowed: false, reason: "wrong_client" };
  }
  return { allowed: true, brandId: brand.id, clientId: brand.clientId };
}
