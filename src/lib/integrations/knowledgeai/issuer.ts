// Keep this cryptographic module free of UI imports so the exact issuance
// contract can be tested without a browser or a running database.
import { createPrivateKey, createPublicKey, constants, randomUUID, sign } from "node:crypto";
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
