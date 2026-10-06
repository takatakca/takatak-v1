// Link a QMAPS business to a TAKATAK client workspace so QMAPS listing and
// review events are applied to that workspace. Idempotent; audited.
//
// Usage:
//   npm run qmaps:link -- --client <takatak-client-uuid> --business <qmaps-business-uuid> --name "Business name"
//
// Refuses to move a business that is already linked to another workspace.
import { getPrisma } from "../src/lib/db/prisma";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function arg(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? "").trim() : "";
}

async function main() {
  const clientId = arg("client").toLowerCase();
  const businessId = arg("business").toLowerCase();
  const name = arg("name") || "QMAPS business";

  if (!UUID_RE.test(clientId) || !UUID_RE.test(businessId) || name.length > 200) {
    console.error("Usage: --client <uuid> --business <uuid> [--name <text>]");
    process.exit(2);
  }

  const prisma = getPrisma();
  if (!prisma) {
    console.error("DATABASE_URL is not configured.");
    process.exit(2);
  }

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } });
  if (!client) {
    console.error("TAKATAK client workspace not found.");
    process.exit(1);
  }

  const existing = await prisma.localListing.findUnique({
    where: { provider_externalId: { provider: "qmaps", externalId: businessId } },
    select: { id: true, clientId: true },
  });
  if (existing && existing.clientId !== clientId) {
    console.error("This QMAPS business is already linked to another workspace. Unlink it first.");
    process.exit(1);
  }
  if (existing) {
    console.log(`Already linked: listing ${existing.id} → workspace "${client.name}".`);
    await prisma.$disconnect();
    return;
  }

  const listing = await prisma.$transaction(async (tx) => {
    const created = await tx.localListing.create({
      data: {
        clientId,
        provider: "qmaps",
        externalId: businessId,
        name,
        platformName: "QMAPS",
        status: "pending_review",
        metadata: { note: "Linked to QMAPS; details arrive with the next QMAPS business event." },
      },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        clientId,
        action: "qmaps_business_linked",
        entityType: "LocalListing",
        entityId: created.id,
        metadata: { note: "QMAPS business linked to this workspace by an administrator script." },
      },
    });
    return created;
  });

  console.log(`Linked QMAPS business → listing ${listing.id} in workspace "${client.name}".`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Link failed.");
  process.exit(1);
});
