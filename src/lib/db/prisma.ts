// Phase 4 — safe Prisma client access.
// MochaHost / CloudLinux cannot run Prisma's Rust query engine
// ("timer has gone away" / nproc). Production uses the JavaScript
// client engine (`engineType = "client"`) with the node-postgres adapter.
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { isDatabaseConfigured } from "./env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaTlsMode?: "relaxed" | "strict";
};

function isLoopbackDatabaseHost(connectionString: string): boolean {
  try {
    const { hostname } = new URL(connectionString);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return /(?:localhost|127\.0\.0\.1)/i.test(connectionString);
  }
}

export function isPassengerOrSharedHost(): boolean {
  return (
    typeof (globalThis as { PhusionPassenger?: unknown }).PhusionPassenger !==
      "undefined" ||
    Boolean(process.env.PASSENGER_APP_ENV) ||
    Boolean(process.env.PASSENGER_BASE_URI) ||
    (process.env.HOME ?? "").includes("/home/takatakc") ||
    (process.env.HOME ?? "").includes("/home/bolonca") ||
    fs.existsSync("/usr/local/lsws/fcgi-bin/lsnode.js")
  );
}

function shouldRelaxPostgresTls(connectionString: string): boolean {
  if (process.env.PGSSL_REJECT_UNAUTHORIZED === "true") {
    return false;
  }

  return (
    process.env.PGSSL_REJECT_UNAUTHORIZED === "false" ||
    /sslmode=no-verify/i.test(connectionString) ||
    isPassengerOrSharedHost() ||
    (process.env.NODE_ENV !== "production" &&
      !isLoopbackDatabaseHost(connectionString))
  );
}

function mochaSafeConnectionString(connectionString: string): string {
  if (!shouldRelaxPostgresTls(connectionString)) {
    return connectionString;
  }

  const withoutSslMode = connectionString
    .replace(/([?&])sslmode=[^&]*/g, "$1")
    .replace(/\?&/, "?")
    .replace(/[?&]$/, "");
  const separator = withoutSslMode.includes("?") ? "&" : "?";
  return `${withoutSslMode}${separator}sslmode=no-verify`;
}

function prismaPoolMax(): number {
  const configured = Number(process.env.PRISMA_POOL_MAX ?? "");
  if (Number.isFinite(configured) && configured > 0 && configured <= 10) {
    return Math.floor(configured);
  }
  return isPassengerOrSharedHost() ? 3 : 8;
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  const adapter = new PrismaPg({
    connectionString: mochaSafeConnectionString(connectionString),
    max: prismaPoolMax(),
    ...(shouldRelaxPostgresTls(connectionString)
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
  });
  return new PrismaClient({ adapter });
}

export function getPrisma(): PrismaClient | null {
  if (!isDatabaseConfigured()) return null;
  const tlsMode: "relaxed" | "strict" = shouldRelaxPostgresTls(
    process.env.DATABASE_URL ?? "",
  )
    ? "relaxed"
    : "strict";
  if (globalForPrisma.prisma && globalForPrisma.prismaTlsMode !== tlsMode) {
    globalForPrisma.prisma = undefined;
  }
  if (!globalForPrisma.prisma) {
    try {
      globalForPrisma.prisma = createPrismaClient();
      globalForPrisma.prismaTlsMode = tlsMode;
    } catch (error) {
      console.error(
        "[prisma] Client could not start.",
        error instanceof Error ? error.message : "unknown_error",
      );
      return null;
    }
  }
  return globalForPrisma.prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (!globalForPrisma.prisma) {
    return;
  }
  try {
    await globalForPrisma.prisma.$disconnect();
  } catch {
    // Process is exiting; ignore disconnect failures.
  }
  globalForPrisma.prisma = undefined;
}
