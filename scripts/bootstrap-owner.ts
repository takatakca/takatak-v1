// Phase 15A — Controlled owner bootstrap. The ONLY sanctioned way to create
// the first owner. Never runs implicitly; requires BOOTSTRAP_OWNER_EMAIL.
// Idempotent: promotes an existing profile or upserts by email; logs an
// AuditLog entry; refuses obviously wrong states loudly.
import { PrismaClient } from "@prisma/client";

async function main() {
  const email = process.env.BOOTSTRAP_OWNER_EMAIL;
  if (!email || !email.includes("@")) {
    console.error("[bootstrap-owner] Set BOOTSTRAP_OWNER_EMAIL=<real owner email> to run. Nothing was changed.");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("[bootstrap-owner] DATABASE_URL is not set. Nothing was changed.");
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    const existingOwner = await prisma.profile.findFirst({ where: { role: "owner" } });
    if (existingOwner && existingOwner.email !== email) {
      console.error(
        `[bootstrap-owner] An owner already exists (${existingOwner.email}). ` +
          "Refusing to create a second owner via bootstrap. Change roles deliberately via a future admin flow.",
      );
      process.exit(1);
    }
    const existing = await prisma.profile.findUnique({ where: { email } });
    if (existing) {
      if (existing.role === "owner" && existing.status === "active") {
        console.log(`[bootstrap-owner] ${email} is already the active owner. No change.`);
        return;
      }
      await prisma.profile.update({ where: { id: existing.id }, data: { role: "owner", status: "active" } });
      await prisma.auditLog.create({
        data: { profileId: existing.id, action: "security.owner_bootstrap_promoted", entityType: "profile", entityId: existing.id, metadata: { note: `Existing profile promoted to owner via bootstrap script for ${email}.` } },
      });
      console.log(`[bootstrap-owner] Promoted existing profile ${email} to owner (active).`);
      return;
    }
    // No profile yet (user has not signed in): create a pending owner profile
    // keyed by email; profile-sync will attach authUserId on first sign-in.
    // NOTE: authUserId is required+unique — we cannot invent one honestly, so
    // in this case we instruct instead of writing a fake id.
    console.error(
      `[bootstrap-owner] No profile exists for ${email} yet. Have that person sign in once ` +
        "(profile-sync creates a least-privileged profile), then re-run this script to promote it. " +
        "No fake auth ids are ever written.",
    );
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}
main();
