import { NextResponse } from "next/server";
import {createKnowledgeAiJwks,readKnowledgeAiIssuerConfig} from "@/lib/integrations/knowledgeai/issuer";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET():Promise<NextResponse> {
  const config=readKnowledgeAiIssuerConfig();
  if (!config) return NextResponse.json({error:"Service unavailable"},{
    status:503,headers:{"Cache-Control":"no-store"}
  });
  const response=NextResponse.json(createKnowledgeAiJwks(config));
  response.headers.set("Cache-Control","public, max-age=30");
  response.headers.set("X-Content-Type-Options","nosniff");
  return response;
}
