import { NextResponse } from "next/server";
import { getKnowledgeAIConfig, knowledgeAIJwks } from "@/lib/integrations/knowledgeai/issuer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  const config = getKnowledgeAIConfig();
  if (!config) return NextResponse.json({error:"Not configured"},{
    status:503,headers:{"Cache-Control":"no-store"}
  });
  return NextResponse.json(knowledgeAIJwks(config),{
    status:200,headers:{
      "Cache-Control":"public, max-age=30","X-Content-Type-Options":"nosniff"
    }
  });
}
