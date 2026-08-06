// Phase 6 — DB-aware Metricool coordination.
// Combines env-derived provider state with IntegrationAccount records.
// DB status is only upgraded to "connected" after a REAL successful test.
import "server-only";
import { getPrisma } from "@/lib/db/prisma";
import { getProviderStatus } from "./adapter";
import type { MetricoolConnectionState, MetricoolProviderStatus, MetricoolTestConnectionResult } from "./types";

export interface MetricoolReadiness extends MetricoolProviderStatus {
  dbAccounts: { id: string; clientName: string; status: string }[];
  dbSource: "database" | "mock";
}

export async function getMetricoolReadiness(): Promise<MetricoolReadiness> {
  const status = getProviderStatus();
  const prisma = getPrisma();
  if (prisma) {
    try {
      const accounts = await prisma.integrationAccount.findMany({
        where: { provider: "metricool" },
        include: { client: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      });
      return {
        ...status,
        dbSource: "database",
        dbAccounts: accounts.map((a) => ({ id: a.id, clientName: a.client.name, status: a.status })),
      };
    } catch (error) {
      console.error("[metricool-service] DB read failed:", error instanceof Error ? error.message : "unknown");
    }
  }
  return { ...status, dbSource: "mock", dbAccounts: [] };
}

/** Maps a provider connection state to the IntegrationAccount status enum. */
function dbStatusForState(state: MetricoolConnectionState): "not_connected" | "pending_credentials" | "connected" | "error" | "disabled" {
  switch (state) {
    case "connected":
      return "connected"; // only reachable after a REAL successful test
    case "error":
      return "error";
    case "configured_untested":
      return "pending_credentials";
    case "disabled":
      return "disabled";
    default:
      return "not_connected";
  }
}

/** Persists a REAL test result to Metricool IntegrationAccount rows (if DB configured). */
export async function recordMetricoolTestResult(result: MetricoolTestConnectionResult): Promise<{ persisted: boolean }> {
  const prisma = getPrisma();
  if (!prisma) return { persisted: false };
  try {
    await prisma.integrationAccount.updateMany({
      where: { provider: "metricool" },
      data: {
        status: dbStatusForState(result.state),
        ...(result.state === "connected" ? { lastSyncAt: new Date() } : {}),
      },
    });
    await prisma.integrationEvent.create({
      data: {
        provider: "metricool",
        eventType: "test_connection",
        status: result.state === "connected" ? "processed" : "failed",
        payload: { state: result.state, httpStatus: result.httpStatus ?? null, testedAt: result.testedAt ?? null },
        errorMessage: result.state === "error" ? result.message : null,
      },
    });
    return { persisted: true };
  } catch (error) {
    console.error("[metricool-service] Could not persist test result:", error instanceof Error ? error.message : "unknown");
    return { persisted: false };
  }
}
