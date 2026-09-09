// Phase 4 — safe Prisma client access.
// MochaHost cannot run Prisma's Rust query engine (nproc + "timer has gone away").
// This client uses node-postgres via @prisma/adapter-pg instead.
import { createRequire } from "node:module";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { isDatabaseConfigured } from "./env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaTlsMode?: "relaxed" | "strict";
};

type PrismaClientCtor = new (options: { adapter: unknown }) => PrismaClient;

function loadPrismaClientCtor(): PrismaClientCtor {
  try {
    const nodeRequire = createRequire(
      path.join(process.cwd(), "package.json"),
    );
    const candidates = [
      path.join("/home/takatakc/app/takatak", "prisma", "generated"),
      path.join(process.cwd(), "prisma", "generated"),
    ];

    for (const moduleId of candidates) {
      try {
        const loaded = nodeRequire(moduleId) as {
          PrismaClient?: PrismaClientCtor;
        };
        if (typeof loaded.PrismaClient === "function") {
          return loaded.PrismaClient;
        }
      } catch {
        // Generated client is optional on Mac; required on MochaHost.
      }
    }
  } catch {
    // ESM bundlers can still provide @prisma/client below.
  }

  return PrismaClient as unknown as PrismaClientCtor;
}

function isLoopbackDatabaseHost(connectionString: string): boolean {
  try {
    const { hostname } = new URL(connectionString);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return /(?:localhost|127\.0\.0\.1)/i.test(connectionString);
  }
}

function shouldRelaxPostgresTls(connectionString: string): boolean {
  if (process.env.PGSSL_REJECT_UNAUTHORIZED === "true") {
    return false;
  }

  return (
    process.env.PGSSL_REJECT_UNAUTHORIZED === "false" ||
    /sslmode=no-verify/i.test(connectionString) ||
    (process.env.HOME ?? "").includes("/home/takatakc") ||
    fs.existsSync("/usr/local/lsws/fcgi-bin/lsnode.js") ||
    // next dev on a Mac against MochaHost (or similar) Postgres, whose
    // certificate chain is not in the local trust store.
    (process.env.NODE_ENV !== "production" &&
      !isLoopbackDatabaseHost(connectionString))
  );
}

function mochaSafeConnectionString(connectionString: string): string {
  if (!shouldRelaxPostgresTls(connectionString)) {
    return connectionString;
  }

  const withoutSslMode = connectionString.replace(/([?&])sslmode=[^&]*/g, "$1").replace(/\?&/, "?").replace(/[?&]$/, "");
  const separator = withoutSslMode.includes("?") ? "&" : "?";
  return `${withoutSslMode}${separator}sslmode=no-verify`;
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  const adapter = new PrismaPg({
    connectionString: mochaSafeConnectionString(connectionString),
    max:
      (process.env.HOME ?? "").includes("/home/takatakc") ||
      fs.existsSync("/usr/local/lsws/fcgi-bin/lsnode.js")
        ? 3
        : 8,
    ...(shouldRelaxPostgresTls(connectionString)
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
  });
  const PrismaClientCtor = loadPrismaClientCtor();
  return new PrismaClientCtor({ adapter });
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
        "[prisma] Client could not start. Install pg and @prisma/adapter-pg, then upload prisma/generated.",
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }
  return globalForPrisma.prisma;
}
