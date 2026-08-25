// Phase 4 — safe Prisma client access.
// MochaHost cannot run Prisma's Rust query engine (nproc + "timer has gone away").
// This client uses node-postgres via @prisma/adapter-pg instead.
import fs from "fs";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import { isDatabaseConfigured } from "./env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

type PrismaClientCtor = new (options: { adapter: unknown }) => PrismaClient;

function runtimeRequire(moduleId: string): Record<string, unknown> {
  const nodeRequire = eval("require") as NodeRequire;
  return nodeRequire(moduleId) as Record<string, unknown>;
}

function loadPrismaClientCtor(): PrismaClientCtor {
  const candidates = [
    path.join("/home/takatakc/app/takatak", "prisma", "generated"),
    path.join(process.cwd(), "prisma", "generated"),
    "@prisma/client",
  ];
  let lastError: unknown;

  for (const moduleId of candidates) {
    try {
      const loaded = runtimeRequire(moduleId);
      const Client = loaded.PrismaClient as PrismaClientCtor | undefined;
      if (typeof Client === "function") {
        return Client;
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Prisma Client module was not found.");
}

function shouldRelaxPostgresTls(): boolean {
  return (
    process.env.PGSSL_REJECT_UNAUTHORIZED === "false" ||
    (process.env.HOME ?? "").includes("/home/takatakc") ||
    fs.existsSync("/usr/local/lsws/fcgi-bin/lsnode.js")
  );
}

function mochaSafeConnectionString(connectionString: string): string {
  if (!shouldRelaxPostgresTls()) {
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

  const { PrismaPg } = runtimeRequire("@prisma/adapter-pg") as {
    PrismaPg: new (config: {
      connectionString: string;
      max?: number;
      ssl?: { rejectUnauthorized: boolean };
    }) => unknown;
  };
  const adapter = new PrismaPg({
    connectionString: mochaSafeConnectionString(connectionString),
    max: 3,
    ...(shouldRelaxPostgresTls() ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  const PrismaClientCtor = loadPrismaClientCtor();
  return new PrismaClientCtor({ adapter });
}

export function getPrisma(): PrismaClient | null {
  if (!isDatabaseConfigured()) return null;
  if (!globalForPrisma.prisma) {
    try {
      globalForPrisma.prisma = createPrismaClient();
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
