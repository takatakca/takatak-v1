import { NextResponse } from "next/server";
import {
  createKnowledgeAiJwks, readKnowledgeAiIssuerConfig,
  getKnowledgeAIConfig, knowledgeAIJwks,
} from "@/lib/integrations/knowledgeai/issuer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rebase arbitration (2026-11-20): main (PR #194 content) and PR #195 each
// added this route for their own issuer contract. The merged route publishes
// the union of the configured keys so tokens from either contract can be
// verified; with neither contract configured it stays 503, exactly like
// both originals. Operators must keep the two kids distinct.
export async function GET(): Promise<NextResponse> {
  const keys: Record<string, unknown>[] = [];
  const issuerConfig = readKnowledgeAiIssuerConfig();
  if (issuerConfig) keys.push(...createKnowledgeAiJwks(issuerConfig).keys);
  const bridgeConfig = getKnowledgeAIConfig();
  if (bridgeConfig) keys.push(...knowledgeAIJwks(bridgeConfig).keys);
  if (!keys.length) return NextResponse.json({error:"Service unavailable"},{
    status:503,headers:{"Cache-Control":"no-store"}
  });
  return NextResponse.json({keys},{
    status:200,headers:{
      "Cache-Control":"public, max-age=30","X-Content-Type-Options":"nosniff"
    }
  });
}
