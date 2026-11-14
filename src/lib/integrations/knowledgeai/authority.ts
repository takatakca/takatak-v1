import "server-only";
import { getPrisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/supabase-server";
import { getServerAccessContext } from "@/lib/security/access-context";
import { getEffectivePermissions } from "@/lib/security/effective-permissions";
import { canIssueKnowledgeAiScope,type KnowledgeAiScope } from "./policy";

export async function resolveKnowledgeAiTokenAuthority(
  scope:KnowledgeAiScope
):Promise<{actorId:string;workspaceId:string}|null> {
  // Never use Supabase user_metadata, client form inputs or a demo session to
  // authorize a product. Existing TAKATAK membership remains the authority.
  const user=await getSessionUser();
  if (!user) return null;
  const {access,runtime}=await getServerAccessContext();
  if (runtime.foundationAllowed || access.mode!=="client_scoped")return null;
  const prisma=getPrisma();
  if (!prisma) return null;
  const {profileId,activeClientId}=access;
  try {
    const [profile,membership,product,grant]=await Promise.all([
      prisma.profile.findUnique({where:{id:profileId},
        select:{authUserId:true,status:true}}),
      prisma.clientMembership.findUnique({
        where:{profileId_clientId:{profileId,clientId:activeClientId}},
        select:{status:true,client:{select:{status:true}}}
      }),
      prisma.productCatalog.findUnique({where:{code:"knowledgeai"},
        select:{status:true}}),
      prisma.knowledgeAiGrant.findUnique({
        where:{clientId_profileId:{clientId:activeClientId,profileId}},
        select:{enabled:true,allowRead:true,allowWrite:true,allowDelete:true,
          allowExport:true,expiresAt:true}
      })
    ]);
    const permitted=canIssueKnowledgeAiScope({
      mode:access.mode,profileId,activeClientId,
      allowedClientIds:access.allowedClientIds,
      sessionMatchesProfile:profile?.authUserId===user.id,
      profileActive:profile?.status==="active",
      membershipActive:membership?.status==="active",
      clientActive:membership?.client.status==="active",
      productActive:product?.status==="active",
      effectivePermissions:getEffectivePermissions(access)
    },grant,scope);
    return permitted?{actorId:profileId,workspaceId:activeClientId}:null;
  } catch {
    // Absent migration, missing entitlement, DB outage => no token.
    return null;
  }
}
