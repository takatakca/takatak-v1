// Phase 4 — safe Prisma client access.
// Returns null when the database is not configured; NEVER instantiates
// PrismaClient without DATABASE_URL (instantiation would throw).
// Dev singleton avoids exhausting connections during hot reload.
import { PrismaClient } from "@prisma/client";
import { isDatabaseConfigured } from "./env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrisma(): PrismaClient | null {
  if (!isDatabaseConfigured()) return null;
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}
