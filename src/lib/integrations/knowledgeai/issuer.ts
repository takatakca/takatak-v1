// Keep this cryptographic module free of UI imports so the exact issuance
// contract can be tested without a browser or a running database.
import { createPrivateKey, createPublicKey, constants, randomUUID, sign, type KeyObject } from "node:crypto";
import type { TenantAccess } from "@/lib/security/tenant-access";
import type { KnowledgeAiScope } from "./policy";

export interface KnowledgeAiIssuerConfig {
  issuer:string;
  audience:string;
  kid:string;
  privateKeyPem:string;
}
function encoded(value:unknown):string {
  return Buffer.from(JSON.stringify(value),"utf8").toString("base64url");
}
function validatedKey(config:KnowledgeAiIssuerConfig) {
  if (!config?.issuer || !config.audience ||
      !/^[A-Za-z0-9._:-]{1,128}$/.test(config.kid||"") ||
      !config.privateKeyPem) throw new Error("KnowledgeAI issuer unavailable");
  let url:URL;
  let key:ReturnType<typeof createPrivateKey>;
  try { url=new URL(config.issuer);key=createPrivateKey(config.privateKeyPem); }
  catch { throw new Error("KnowledgeAI issuer unavailable"); }
  if (url.origin!==config.issuer || url.protocol!=="https:" ||
      url.username || url.password || url.search || url.hash ||
      key.asymmetricKeyType!=="rsa" ||
      (key.asymmetricKeyDetails?.modulusLength??0)<2048)
    throw new Error("KnowledgeAI issuer unavailable");
  return key;
}
export function readKnowledgeAiIssuerConfig(
  env:Record<string,string|undefined>=process.env
):KnowledgeAiIssuerConfig|null {
  // Enable only after the product has an approved operator, signer and private
  // backend. No auto-generated development/production fallback secret.
  if (env.KNOWLEDGEAI_ISSUER_ENABLED!=="1") return null;
  const config={
    issuer:env.KNOWLEDGEAI_ISSUER_ORIGIN||"",
    audience:env.KNOWLEDGEAI_AUDIENCE||"",
    kid:env.KNOWLEDGEAI_SIGNING_KID||"",
    privateKeyPem:env.KNOWLEDGEAI_SIGNING_KEY_PEM||"",
  };
  try {validatedKey(config);return config;}
  catch {return null;}
}
export function createKnowledgeAiJwks(config:KnowledgeAiIssuerConfig) {
  const privateKey=validatedKey(config);
  const publicKey=createPublicKey(privateKey).export({format:"jwk"});
  // Explicit allowlist means no JWK private parameters can leak.
  return {keys:[{
    kty:"RSA",kid:config.kid,use:"sig",alg:"RS256",
    n:publicKey.n,e:publicKey.e,
  }]};
}
export function signKnowledgeAiToken(
  config:KnowledgeAiIssuerConfig,
  input:{actorId:string;workspaceId:string;scope:KnowledgeAiScope},
  nowMs:number=Date.now()
):string {
  const privateKey=validatedKey(config);
  if (!/^[A-Za-z0-9._:-]{8,200}$/.test(input.actorId) ||
      !/^[A-Za-z0-9_-]{8,64}$/.test(input.workspaceId) ||
      !Number.isSafeInteger(nowMs) || nowMs<=0)
    throw new Error("KnowledgeAI issuance denied");
  const iat=Math.floor(nowMs/1000);
  const header={typ:"JWT",alg:"RS256",kid:config.kid};
  const claims={
    iss:config.issuer,aud:config.audience,sub:input.actorId,
    workspace_id:input.workspaceId,product:"knowledgeai",
    scope:input.scope,iat,exp:iat+60,jti:randomUUID(),
  };
  const signed=encoded(header)+"."+encoded(claims);
  const signature=sign("RSA-SHA256",Buffer.from(signed),{
    key:privateKey,padding:constants.RSA_PKCS1_PADDING,
  }).toString("base64url");
  return signed+"."+signature;
}

// ─────────────────────────────────────────────────────────────────────────────
// KnowledgeAI private bridge (PR #195) — second, independent issuer contract.
//
// Rebase arbitration (2026-11-20): main already carries the PR #194 issuer
// above (applied directly by commit 95ac427f). This section keeps the #195
// contract intact — its own TAKATAK_KNOWLEDGEAI_* environment, its own
// per-workspace grant decision table — without touching the #194 API, so the
// #194 contract tests keep running against a DB-free module. The only #195
// function that touches the database, hasLiveKnowledgeAIGrant, lives in
// ./workspace-grants.ts (server-only) instead of here.
// Both contracts stay disabled by default and fail closed.
// ─────────────────────────────────────────────────────────────────────────────

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
