import "server-only";
import type { PrismaClient } from "@prisma/client";
import { runTakbot } from "@/lib/takbot/server";
import { STUDIO_OUTPUT_SOURCE, STUDIO_PROJECT_SOURCE, type StudioDependencies } from "./production";
export function studioGenerationDependencies(db:PrismaClient):StudioDependencies {
  return {
    findProject:(clientId,id)=>db.savedAiOutput.findFirst({where:{id,clientId,status:{not:"archived"},metadata:{path:["source"],equals:STUDIO_PROJECT_SOURCE}},select:{content:true,metadata:true}}),
    run:runTakbot,
    linkOutput:async(clientId,outputId,projectId,track)=>{
      const claimed=await db.savedAiOutput.updateMany({where:{id:outputId,clientId,origin:"ai_generated",status:"saved",metadata:{path:["source"],equals:"takbot"}},
        data:{status:"draft",metadata:{source:STUDIO_OUTPUT_SOURCE,version:1,projectId,track,generatedBy:"takbot",knowledge:"not_retrieved"}}});
      return claimed.count===1;
    },
  };
}
