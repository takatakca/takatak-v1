import "server-only";
import type { PrismaClient } from "@prisma/client";
import { runTakbot } from "@/lib/takbot/server";
import { STUDIO_OUTPUT_SOURCE, STUDIO_PROJECT_SOURCE, type StudioDependencies } from "./production";
import { linkStudioOutput } from "./output-link";
export function studioGenerationDependencies(db:PrismaClient):StudioDependencies {
  return {
    findProject:(clientId,id)=>db.savedAiOutput.findFirst({where:{id,clientId,status:{not:"archived"},metadata:{path:["source"],equals:STUDIO_PROJECT_SOURCE}},select:{content:true,metadata:true}}),
    run:runTakbot,
    linkOutput:(clientId,outputId,projectId,track)=>db.$transaction(tx=>linkStudioOutput(tx,{clientId,outputId,projectId,track,outputSource:STUDIO_OUTPUT_SOURCE})),
  };
}
