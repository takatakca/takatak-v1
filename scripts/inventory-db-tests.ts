// Synthetic fixtures, loopback PostgreSQL only. Never runs against a hosted database.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPrisma, disconnectPrisma } from "../src/lib/db/prisma";
import {
  saveInventoryProduct,
  adjustInventoryStock,
  inventoryDirectory,
  getInventoryLabel,
  saveInventoryLabel,
} from "../src/lib/db/inventory";
import { mielAissaLabelConfig } from "../src/lib/inventory/label-config";
import { productInput } from "../src/lib/inventory/validation";
async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "http://missing");
  assert.ok(
    ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname),
    "Inventory DB tests require a loopback-only database",
  );
  const db = getPrisma();
  assert.ok(db);
  const a = randomUUID(),
    b = randomUUID(),
    brandA = randomUUID(),
    brandB = randomUUID(),
    actor = randomUUID();
  try {
    await db.profile.create({
      data: { id: actor, authUserId: randomUUID(), status: "active" },
    });
    await db.client.createMany({
      data: [
        { id: a, name: "Inventory test A", status: "active" },
        { id: b, name: "Inventory test B", status: "active" },
      ],
    });
    await db.businessBrand.createMany({
      data: [
        { id: brandA, clientId: a, name: "Honey A", status: "active" },
        { id: brandB, clientId: b, name: "Honey B", status: "active" },
      ],
    });
    const input = productInput({
      businessBrandId: brandA,
      name: "Clover honey",
      sku: "HNY-500",
      category: "Clover",
      size: "500 g",
      ingredients: "Honey",
      gtin: "036000291452",
      priceCents: 1495,
      threshold: 5,
    });
    await assert.rejects(
      saveInventoryProduct(b, actor, input),
      /Business not found/,
    );
    const product = await saveInventoryProduct(a, actor, input);
    assert.equal(product.quantity, 0);
    const layout = {
      ...mielAissaLabelConfig(),
      gs1Confirmed: true,
      textReviewed: true,
    };
    await assert.rejects(
      saveInventoryLabel(b, actor, product.id, layout),
      /not found/,
    );
    await saveInventoryLabel(a, actor, product.id, layout);
    assert.equal(
      (
        (await getInventoryLabel(a, product.id)).labelConfig as {
          brand: string;
        }
      ).brand,
      "MIEL AISSA",
    );
    await assert.rejects(getInventoryLabel(b, product.id), /not found/);
    assert.equal(
      "labelConfig" in (await inventoryDirectory(a)).products[0],
      false,
    );

    await assert.rejects(
      saveInventoryProduct(a, actor, input),
      /already exists/,
    );
    assert.equal((await inventoryDirectory(b)).products.length, 0);
    const movement = {
      productId: product.id,
      requestId: randomUUID(),
      delta: 10,
      reason: "Opening stock",
      lot: "LOT-A",
    };
    await assert.rejects(
      adjustInventoryStock(b, actor, movement),
      /unavailable|bounds/,
    );
    const first = await adjustInventoryStock(a, actor, movement);
    assert.equal((await adjustInventoryStock(a, actor, movement)).id, first.id);
    assert.equal(
      (
        await db.inventoryProduct.findUniqueOrThrow({
          where: { id: product.id },
        })
      ).quantity,
      10,
    );
    await assert.rejects(
      adjustInventoryStock(a, actor, {
        ...movement,
        reason: "Changed payload",
      }),
      /already used/,
    );
    await assert.rejects(
      adjustInventoryStock(a, actor, {
        ...movement,
        requestId: randomUUID(),
        delta: -11,
      }),
      /bounds/,
    );
    // Concurrent withdrawals cannot oversell: exactly one 7-unit sale succeeds.
    const sales = await Promise.allSettled(
      [1, 2].map(() =>
        adjustInventoryStock(a, actor, {
          ...movement,
          requestId: randomUUID(),
          delta: -7,
          reason: "Sale",
        }),
      ),
    );
    assert.equal(sales.filter((s) => s.status === "fulfilled").length, 1);
    assert.equal(
      (
        await db.inventoryProduct.findUniqueOrThrow({
          where: { id: product.id },
        })
      ).quantity,
      3,
    );
    const duplicate = {
      ...movement,
      requestId: randomUUID(),
      delta: 2,
      reason: "Concurrent same request",
    };
    await Promise.allSettled([
      adjustInventoryStock(a, actor, duplicate),
      adjustInventoryStock(a, actor, duplicate),
    ]);
    assert.equal(
      (
        await db.inventoryProduct.findUniqueOrThrow({
          where: { id: product.id },
        })
      ).quantity,
      5,
    );
    assert.equal(
      await db.inventoryMovement.count({
        where: { requestId: duplicate.requestId },
      }),
      1,
    );
    // Product metadata edits cannot alter quantity; cross-workspace edits cannot find the row.
    await saveInventoryProduct(
      a,
      actor,
      { ...input, name: "Edited honey" },
      product.id,
    );
    assert.equal(
      (
        await db.inventoryProduct.findUniqueOrThrow({
          where: { id: product.id },
        })
      ).quantity,
      5,
    );
    await assert.rejects(
      saveInventoryProduct(
        b,
        actor,
        { ...input, businessBrandId: brandB },
        product.id,
      ),
      /not found/,
    );
    const editedLabel = (await getInventoryLabel(a, product.id))
      .labelConfig as { gs1Confirmed: boolean; textReviewed: boolean };
    assert.equal(editedLabel.gs1Confirmed, false);
    assert.equal(editedLabel.textReviewed, false);
    // DB constraints and composite FK protect direct writes, not just route validation.
    await assert.rejects(
      db.inventoryProduct.update({
        where: { id: product.id },
        data: { quantity: -1 },
      }),
    );
    await assert.rejects(
      db.inventoryProduct.create({
        data: { ...input, clientId: b, sku: "WRONG-TENANT" },
      }),
    );
    const rows = await db.$queryRaw<
      Array<{ relname: string; relrowsecurity: boolean }>
    >`SELECT relname::text AS relname, relrowsecurity FROM pg_class WHERE relname IN ('inventory_products','inventory_movements')`;
    assert.equal(rows.length, 2);
    assert.ok(rows.every((r) => r.relrowsecurity));
    const permissionValues = await db.$queryRaw<
      Array<{ value: string }>
    >`SELECT enumlabel::text AS value FROM pg_enum JOIN pg_type ON pg_type.oid = pg_enum.enumtypid WHERE typname = 'PermissionKey' AND enumlabel IN ('view_inventory','manage_inventory')`;
    assert.equal(permissionValues.length, 2);
    const grants = await db.$queryRaw<
      Array<{ allowed: boolean }>
    >`SELECT has_table_privilege('authenticated','inventory_products','SELECT') AS allowed UNION ALL SELECT has_table_privilege('anon','inventory_movements','INSERT') AS allowed`;
    assert.ok(grants.every((g) => !g.allowed));
    assert.equal(
      await db.auditLog.count({
        where: { clientId: a, action: "inventory_stock_adjusted" },
      }),
      3,
    );
    console.log(
      "Inventory PostgreSQL checks passed: isolation, duplicate prevention, concurrent sales, atomic ledger, metadata edit, constraints and RLS grants.",
    );
  } finally {
    await db.inventoryMovement.deleteMany({
      where: { clientId: { in: [a, b] } },
    });
    await db.inventoryProduct.deleteMany({
      where: { clientId: { in: [a, b] } },
    });
    await db.auditLog.deleteMany({ where: { clientId: { in: [a, b] } } });
    await db.businessBrand.deleteMany({ where: { clientId: { in: [a, b] } } });
    await db.client.deleteMany({ where: { id: { in: [a, b] } } });
    await db.profile.deleteMany({ where: { id: actor } });
    await disconnectPrisma();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
