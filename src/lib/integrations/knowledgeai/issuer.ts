import "server-only";
import {
  createPrivateKey, createPublicKey, randomUUID, sign, constants,
  type KeyObject,
} from "node:crypto";
import { getPrisma } from "@/lib/db/prisma";
import type { TenantAccess } from "@/lib/security/tenant-access";

export const KNOWLEDGEAI_SCOPES = [
  "knowledge:read", "knowledge:write", "knowledge:delete", "knowledge:export",
] as const;
export type KnowledgeAIScope = (typeof KNOWLEDGEAI_SCOPES)[number];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KID = /^[A-Za-z0-9._:-]{1,128}$/;
export type KnowledgeAIConfig = {
  issuer: string; audience: string; kid: string;
  key: KeyObject; privateOrigin: string;
};
function exactOrigin(value: string): string | null {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.origin !== value ||
      u.username || u.password || u.search || u.hash) return null;
    return u.origin;
  } catch { return null; }
}
export function getKnowledgeAIConfig(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): KnowledgeAIConfig | null {
  if (env.TAKATAK_KNOWLEDGEAI_ENABLED !== "1") return null;
  const issuer = exactOrigin(env.TAKATAK_KNOWLEDGEAI_ISSUER ?? "");
  const privateOrigin = exactOrigin(env.TAKATAK_KNOWLEDGEAI_PRIVATE_ORIGIN ?? "");
  const audience = env.TAKATAK_KNOWLEDGEAI_AUDIENCE ?? "";
  const kid = env.TAKATAK_KNOWLEDGEAI_KID ?? "";
  const pem = env.TAKATAK_KNOWLEDGEAI_SIGNING_KEY_PEM ?? "";
  if (!issuer || !privateOrigin || !audience || !KID.test(kid) || !pem)
    return null;
  try {
    const key = createPrivateKey(pem);
    if (key.asymmetricKeyType !== "rsa" ||
      (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) return null;
    return { issuer, privateOrigin, audience, kid, key };
  } catch { return null; }
}
export function knowledgeAIJwks(config: KnowledgeAIConfig) {
  const key = createPublicKey(config.key).export({format: "jwk"});
  return { keys: [{ kty: "RSA", n: key.n, e: key.e,
    kid: config.kid, use: "sig", alg: "RS256" }] };
}
export function clientCanRequestKnowledgeAI(
  access: TenantAccess, scope: KnowledgeAIScope,
): access is Extract<TenantAccess, {mode:"client_scoped"}> {
  return KNOWLEDGEAI_SCOPES.includes(scope) &&
    access.mode === "client_scoped" &&
    UUID.test(access.profileId) && UUID.test(access.activeClientId) &&
    access.allowedClientIds.includes(access.activeClientId);
}
/** One pure decision table makes every fail-closed condition regression-testable. */
export function knowledgeAIGrantAllows(input: {
  productStatus?: string | null;
  membershipStatus?: string | null;
  profileStatus?: string | null;
  clientStatus?: string | null;
  grant?: {
    enabled: boolean; expiresAt: Date;
    allowRead: boolean; allowWrite: boolean;
    allowDelete: boolean; allowExport: boolean;
  } | null;
}, scope: KnowledgeAIScope, now:Date = new Date()): boolean {
  const g=input.grant;
  if (!KNOWLEDGEAI_SCOPES.includes(scope) || !g ||
      input.productStatus !== "active" ||
      input.membershipStatus !== "active" ||
      input.profileStatus !== "active" ||
      input.clientStatus !== "active" ||
      g.enabled !== true || !Number.isFinite(g.expiresAt.getTime()) ||
      g.expiresAt <= now) return false;
  return ({
    "knowledge:read": g.allowRead,
    "knowledge:write": g.allowWrite,
    "knowledge:delete": g.allowDelete,
    "knowledge:export": g.allowExport,
  })[scope] === true;
}

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
const enc = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
export function signKnowledgeAIJWT(config: KnowledgeAIConfig, principal: {
  profileId: string; workspaceId: string; scope: KnowledgeAIScope;
}): string {
  if (!UUID.test(principal.profileId) || !UUID.test(principal.workspaceId) ||
      !KNOWLEDGEAI_SCOPES.includes(principal.scope)) throw new Error("Issuer denied");
  const now = Math.floor(Date.now() / 1000);
  const claims = {iss:config.issuer,aud:config.audience,sub:principal.profileId,
    workspace_id:principal.workspaceId,product:"knowledgeai",scope:principal.scope,
    iat:now,exp:now+60,jti:randomUUID()};
  const content = enc({typ:"JWT",alg:"RS256",kid:config.kid})+"."+enc(claims);
  const signature = sign("RSA-SHA256",Buffer.from(content),{
    key:config.key,padding:constants.RSA_PKCS1_PADDING
  }).toString("base64url");
  return content+"."+signature;
}
