// Phase 8 — DB-aware Upmind coordination. DB status upgrades to "connected"
// only after a REAL successful test; configured_untested maps to
// pending_credentials at the IntegrationAccount level.
import "server-only";
import { getPrisma } from "@/lib/db/prisma";
import { getProviderStatus } from "./adapter";
import type { UpmindConnectionState, UpmindProviderStatus, UpmindTestConnectionResult } from "./types";

export interface UpmindReadiness extends UpmindProviderStatus {
  dbAccounts: { id: string; clientName: string; status: string }[];
  dbSource: "database" | "mock";
}

export async function getUpmindReadiness(): Promise<UpmindReadiness> {
  const status = getProviderStatus();
  const prisma = getPrisma();
  if (prisma) {
    try {
      const accounts = await prisma.integrationAccount.findMany({
        where: { provider: "upmind" },
        include: { client: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      });
      return {
        ...status,
        dbSource: "database",
        dbAccounts: accounts.map((a) => ({ id: a.id, clientName: a.client.name, status: a.status })),
      };
    } catch (error) {
      console.error("[upmind-service] DB read failed:", error instanceof Error ? error.message : "unknown");
    }
  }
  return { ...status, dbSource: "mock", dbAccounts: [] };
}

function dbStatusForState(state: UpmindConnectionState): "not_connected" | "pending_credentials" | "connected" | "error" | "disabled" {
  switch (state) {
    case "connected": return "connected"; // only after a REAL successful test
    case "error": return "error";
    case "configured_untested": return "pending_credentials";
    case "disabled": return "disabled";
    default: return "not_connected";
  }
}

export async function recordUpmindTestResult(result: UpmindTestConnectionResult): Promise<{ persisted: boolean }> {
  const prisma = getPrisma();
  if (!prisma) return { persisted: false };
  try {
    await prisma.integrationAccount.updateMany({
      where: { provider: "upmind" },
      data: {
        status: dbStatusForState(result.state),
        ...(result.state === "connected" ? { lastSyncAt: new Date() } : {}),
      },
    });
    await prisma.integrationEvent.create({
      data: {
        provider: "upmind",
        eventType: "test_connection",
        status: result.state === "connected" ? "processed" : "failed",
        payload: { state: result.state, httpStatus: result.httpStatus ?? null, testedAt: result.testedAt ?? null },
        errorMessage: result.state === "error" ? result.message : null,
      },
    });
    return { persisted: true };
  } catch (error) {
    console.error("[upmind-service] Could not persist test result:", error instanceof Error ? error.message : "unknown");
    return { persisted: false };
  }
}

/** Records a webhook receipt summary. Never stores the raw body. */
export async function recordUpmindWebhookReceipt(
  state: string,
  status: "ignored" | "failed" | "processed" = "ignored",
): Promise<{ recorded: boolean }> {
  const prisma = getPrisma();
  if (!prisma) return { recorded: false };
  try {
    await prisma.integrationEvent.create({
      data: {
        provider: "upmind",
        eventType: "webhook_received",
        status,
        payload: { verificationState: state },
      },
    });
    return { recorded: true };
  } catch {
    return { recorded: false };
  }
}
