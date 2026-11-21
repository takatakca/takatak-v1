import assert from "node:assert/strict";
import { createPublicKey, generateKeyPairSync, verify, constants } from "node:crypto";
import {
  getKnowledgeAIConfig, knowledgeAIJwks, signKnowledgeAIJWT,
  clientCanRequestKnowledgeAI, knowledgeAIGrantAllows,
} from "../src/lib/integrations/knowledgeai/issuer";
import type { TenantAccess } from "../src/lib/security/tenant-access";

assert.equal(getKnowledgeAIConfig({}),null);
assert.equal(getKnowledgeAIConfig({TAKATAK_KNOWLEDGEAI_ENABLED:"1"}),null);
const {privateKey}=generateKeyPairSync("rsa",{modulusLength:2048});
const pem=privateKey.export({type:"pkcs8",format:"pem"}).toString();
const env={
  TAKATAK_KNOWLEDGEAI_ENABLED:"1",
  TAKATAK_KNOWLEDGEAI_ISSUER:"https://takatak.test",
  TAKATAK_KNOWLEDGEAI_PRIVATE_ORIGIN:"https://private-knowledge.test",
  TAKATAK_KNOWLEDGEAI_AUDIENCE:"knowledge-private",
  TAKATAK_KNOWLEDGEAI_KID:"knowledge-rs256-v1",
  TAKATAK_KNOWLEDGEAI_SIGNING_KEY_PEM:pem
};
assert.equal(getKnowledgeAIConfig({...env,TAKATAK_KNOWLEDGEAI_PRIVATE_ORIGIN:"http://localhost:8080"}),null);
assert.equal(getKnowledgeAIConfig({...env,TAKATAK_KNOWLEDGEAI_KID:"bad kid"}),null);
const config=getKnowledgeAIConfig(env);
assert.ok(config);
const jwks=knowledgeAIJwks(config);
assert.equal(jwks.keys.length,1);
assert.equal(Object.hasOwn(jwks.keys[0],"d"),false);
assert.equal(Object.hasOwn(jwks.keys[0],"p"),false);
const workspaceId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const profileId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const access:TenantAccess={
  mode:"client_scoped",activeClientId:workspaceId,profileId,
  role:"viewer",allowedClientIds:[workspaceId],
  customPermissions:[],deniedPermissions:[]
};
assert.equal(clientCanRequestKnowledgeAI(access,"knowledge:read"),true);
assert.equal(clientCanRequestKnowledgeAI({...access,activeClientId:"cccccccc-cccc-4ccc-8ccc-cccccccccccc"},"knowledge:read"),false);
assert.equal(clientCanRequestKnowledgeAI({mode:"foundation_demo",role:"owner",warning:"test"},"knowledge:read"),false);
assert.equal(clientCanRequestKnowledgeAI({
  mode:"platform_admin",profileId,role:"owner",allowedClientIds:"all",
  customPermissions:[],deniedPermissions:[]
},"knowledge:read"),false);
const sample={
  productStatus:"active",membershipStatus:"active",profileStatus:"active",
  clientStatus:"active",grant:{
    enabled:true,expiresAt:new Date(Date.now()+60000),allowRead:true,
    allowWrite:false,allowDelete:false,allowExport:false
  }
};
assert.equal(knowledgeAIGrantAllows(sample,"knowledge:read"),true);
assert.equal(knowledgeAIGrantAllows(sample,"knowledge:write"),false);
for(const bad of [
  {...sample,productStatus:"planned"},
  {...sample,membershipStatus:"suspended"},
  {...sample,profileStatus:"disabled"},
  {...sample,clientStatus:"paused"},
  {...sample,grant:null},
  {...sample,grant:{...sample.grant,enabled:false}},
  {...sample,grant:{...sample.grant,expiresAt:new Date(Date.now()-60000)}}
]) assert.equal(knowledgeAIGrantAllows(bad,"knowledge:read"),false);
const jwt=signKnowledgeAIJWT(config,{workspaceId,profileId,scope:"knowledge:read"});
const parts=jwt.split(".");
assert.equal(parts.length,3);
const header=JSON.parse(Buffer.from(parts[0],"base64url").toString());
const claims=JSON.parse(Buffer.from(parts[1],"base64url").toString());
assert.deepEqual(header,{typ:"JWT",alg:"RS256",kid:config.kid});
assert.equal(claims.workspace_id,workspaceId);
assert.equal(claims.sub,profileId);
assert.equal(claims.product,"knowledgeai");
assert.equal(claims.exp-claims.iat,60);
assert.equal(claims.scope,"knowledge:read");
const key=createPublicKey({key:jwks.keys[0],format:"jwk"});
assert.equal(verify("RSA-SHA256",Buffer.from(parts[0]+"."+parts[1]),{
  key,padding:constants.RSA_PKCS1_PADDING
},Buffer.from(parts[2],"base64url")),true);
const forged=Buffer.from(JSON.stringify({...claims,workspace_id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc"})).toString("base64url");
assert.equal(verify("RSA-SHA256",Buffer.from(parts[0]+"."+forged),{
  key,padding:constants.RSA_PKCS1_PADDING
},Buffer.from(parts[2],"base64url")),false);
console.log("KnowledgeAI issuer checks passed; no customer data or secrets used.");
