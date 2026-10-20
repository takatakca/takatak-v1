import "server-only";
import { getPrisma } from "@/lib/db/prisma";
import { isPrismaKnownRequestError } from "@/lib/db/prisma-errors";
import { ServiceError } from "@/lib/services/service-error";
import { invalidateQuebecReview } from "@/lib/inventory/quebec-requirements";
import {
  MAX_QUANTITY,
  type ProductInput,
  type MovementInput,
} from "@/lib/inventory/validation";
function database() {
  const db = getPrisma();
  if (!db)
    throw new ServiceError(
      "unavailable",
      "Inventory database is not configured.",
    );
  return db;
}
export async function inventoryDirectory(clientId: string) {
  const db = database();
  return db.$transaction(
    async (tx) => {
      const brands = await tx.businessBrand.findMany({
        where: { clientId, status: { not: "archived" } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      // Do not silently truncate a workspace's stock counts or export.
      const count = await tx.inventoryProduct.count({ where: { clientId } });
      if (count > 5000)
        throw new ServiceError(
          "unavailable",
          "This workspace exceeds the 5,000-product pilot limit. Contact support before adding more products.",
        );
      const products = await tx.inventoryProduct.findMany({
        omit: { labelConfig: true },
        where: { clientId },
        orderBy: { createdAt: "asc" },
        take: 5000,
      });
      const movements = await tx.inventoryMovement.findMany({
        where: { clientId },
        include: { product: { select: { name: true, sku: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return { brands, products, movements };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
export async function saveInventoryProduct(
  clientId: string,
  actorProfileId: string,
  input: ProductInput,
  id?: string,
) {
  const db = database();
  try {
    return await db.$transaction(async (tx) => {
      const brand = await tx.businessBrand.findFirst({
        where: {
          id: input.businessBrandId,
          clientId,
          status: { not: "archived" },
        },
        select: { id: true },
      });
      if (!brand)
        throw new ServiceError(
          "not_found",
          "Business not found in this workspace.",
        );
      let product;
      if (id) {
        const previous = await tx.inventoryProduct.findFirst({
          where: { id, clientId, businessBrandId: input.businessBrandId },
          select: { labelConfig: true },
        });
        const layout = previous?.labelConfig;
        const changed = await tx.inventoryProduct.updateMany({
          where: { id, clientId, businessBrandId: input.businessBrandId },
          data: {
            ...input,
            ...(layout && typeof layout === "object" && !Array.isArray(layout)
              ? {
                  labelConfig: {
                    ...layout,
                    gs1Confirmed: false,
                    textReviewed: false,
                    ...(layout.quebec
                      ? { quebec: invalidateQuebecReview(layout.quebec) }
                      : {}),
                  },
                }
              : {}),
          },
        });
        if (!changed.count)
          throw new ServiceError(
            "not_found",
            "Product not found in this business.",
          );
        product = await tx.inventoryProduct.findFirstOrThrow({
          where: { id, clientId },
        });
      } else {
        product = await tx.inventoryProduct.create({
          data: { ...input, clientId },
        });
      }
      await tx.auditLog.create({
        data: {
          clientId,
          profileId: actorProfileId,
          action: id
            ? "inventory_product_updated"
            : "inventory_product_created",
          entityType: "InventoryProduct",
          entityId: product.id,
        },
      });
      return product;
    });
  } catch (e) {
    if (isPrismaKnownRequestError(e) && e.code === "P2002")
      throw new ServiceError(
        "conflict",
        "That SKU already exists in this business, or the retail barcode already exists in this workspace.",
      );
    throw e;
  }
}
export async function adjustInventoryStock(
  clientId: string,
  actorProfileId: string,
  input: MovementInput,
) {
  const db = database();
  const existing = await db.inventoryMovement.findUnique({
    where: { requestId: input.requestId },
  });
  if (existing) {
    if (
      existing.clientId !== clientId ||
      existing.productId !== input.productId ||
      existing.delta !== input.delta ||
      existing.reason !== input.reason ||
      existing.lot !== input.lot ||
      existing.actorProfileId !== actorProfileId
    )
      throw new ServiceError(
        "conflict",
        "This adjustment request was already used.",
      );
    return existing;
  }
  try {
    return await db.$transaction(async (tx) => {
      // Conditional increment locks the row and evaluates bounds against the latest quantity.
      const changed = await tx.inventoryProduct.updateMany({
        where: {
          id: input.productId,
          clientId,
          businessBrand: { status: { not: "archived" } },
          quantity: {
            gte: Math.max(0, -input.delta),
            lte: MAX_QUANTITY - Math.max(0, input.delta),
          },
        },
        data: { quantity: { increment: input.delta } },
      });
      if (!changed.count)
        throw new ServiceError(
          "conflict",
          "Product unavailable or adjustment would exceed stock bounds. Refresh and check the quantity.",
        );
      const movement = await tx.inventoryMovement.create({
        data: { ...input, clientId, actorProfileId },
      });
      await tx.auditLog.create({
        data: {
          clientId,
          profileId: actorProfileId,
          action: "inventory_stock_adjusted",
          entityType: "InventoryProduct",
          entityId: input.productId,
          metadata: { movementId: movement.id, delta: input.delta },
        },
      });
      return movement;
    });
  } catch (e) {
    // A concurrent duplicate request rolls back its increment with its transaction.
    if (isPrismaKnownRequestError(e) && e.code === "P2002")
      throw new ServiceError(
        "conflict",
        "This adjustment was already recorded. Refresh the inventory.",
      );
    throw e;
  }
}

export async function saveInventoryLabel(
  clientId: string,
  actorProfileId: string,
  productId: string,
  config: import("@/lib/inventory/label-config").LabelConfig,
) {
  return database().$transaction(async (tx) => {
    const changed = await tx.inventoryProduct.updateMany({
      where: {
        id: productId,
        clientId,
        businessBrand: { status: { not: "archived" } },
      },
      data: { labelConfig: { ...config } },
    });
    if (!changed.count)
      throw new ServiceError(
        "not_found",
        "Product not found in this workspace.",
      );
    await tx.auditLog.create({
      data: {
        clientId,
        profileId: actorProfileId,
        action: "inventory_label_saved",
        entityType: "InventoryProduct",
        entityId: productId,
      },
    });
    return { ok: true };
  });
}

export async function getInventoryLabel(clientId: string, productId: string) {
  const product = await database().inventoryProduct.findFirst({
    where: { id: productId, clientId },
  });
  if (!product)
    throw new ServiceError("not_found", "Product not found in this workspace.");
  return product;
}
