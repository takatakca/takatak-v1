import "server-only";
import { getPrisma } from "@/lib/db/prisma";
import {
  KNOWLEDGEAI_SCOPES, knowledgeAIGrantAllows, type KnowledgeAIScope,
} from "./issuer";

// Kept local to this module: issuer.ts stays free of database access so the
// issuance contract can be tested without a running database.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** An explicit current product row, active membership and per-user grant
 * must all exist. DB failures or absent migrations are DENIALS.
 */
export async function hasLiveKnowledgeAIGrant(
  workspaceId: string, profileId: string, scope: KnowledgeAIScope,
): Promise<boolean> {
  if (!UUID.test(workspaceId) || !UUID.test(profileId) ||
      !KNOWLEDGEAI_SCOPES.includes(scope)) return false;
  const prisma = getPrisma();
  if (!prisma) return false;
  try {
    const [product, member, grant] = await Promise.all([
      prisma.productCatalog.findUnique({where:{code:"knowledgeai"},
        select:{status:true}}),
      prisma.clientMembership.findUnique({
        where:{profileId_clientId:{profileId,clientId:workspaceId}},
        select:{status:true,profile:{select:{status:true}},
          client:{select:{status:true}}}
      }),
      prisma.knowledgeAIWorkspaceGrant.findUnique({
        where:{clientId_profileId:{clientId:workspaceId,profileId}}
      }),
    ]);
    return knowledgeAIGrantAllows({
      productStatus:product?.status,
      membershipStatus:member?.status,
      profileStatus:member?.profile.status,
      clientStatus:member?.client.status,
      grant,
    },scope);
  } catch { return false; }
}
