import { cookies } from "next/headers";

import { getPrisma } from "@/lib/db/prisma";
import type { ClientScopedAccess } from "@/lib/security/workspace-guard";

export const ACTIVE_BRAND_COOKIE =
  "takatak_active_brand";

export interface BrandSessionOption {
  id: string;
  name: string;
  status: string;
}

export interface BrandSessionContext {
  activeBrandId: string | null;
  activeBrandName: string | null;
  availableBrands: BrandSessionOption[];
}

export async function resolveBrandSessionContext(
  access: ClientScopedAccess,
): Promise<BrandSessionContext> {
  const prisma = getPrisma();

  if (!prisma) {
    return {
      activeBrandId: null,
      activeBrandName: null,
      availableBrands: [],
    };
  }

  let requestedBrandId: string | null = null;

  try {
    const cookieStore = await cookies();

    requestedBrandId =
      cookieStore.get(ACTIVE_BRAND_COOKIE)
        ?.value ?? null;
  } catch {
    requestedBrandId = null;
  }

  try {
    const brands =
      await prisma.businessBrand.findMany({
        where: {
          clientId: access.activeClientId,
          status: {
            not: "archived",
          },
        },
        orderBy: [
          {
            status: "asc",
          },
          {
            name: "asc",
          },
        ],
        select: {
          id: true,
          name: true,
          status: true,
        },
      });

    const selected = requestedBrandId
      ? brands.find(
          (brand) =>
            brand.id === requestedBrandId,
        ) ?? null
      : brands.length === 1
        ? brands[0]
        : null;

    return {
      activeBrandId:
        selected?.id ?? null,
      activeBrandName:
        selected?.name ?? null,
      availableBrands: brands,
    };
  } catch (error) {
    console.error(
      "[brand-context] Brand session query failed:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return {
      activeBrandId: null,
      activeBrandName: null,
      availableBrands: [],
    };
  }
}