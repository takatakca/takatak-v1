import assert from "node:assert/strict";
import {createPublicKey,generateKeyPairSync,verify,constants} from "node:crypto";
import {canIssueKnowledgeAiScope,isKnowledgeAiScope} from "../src/lib/integrations/knowledgeai/policy";
import {createKnowledgeAiJwks,readKnowledgeAiIssuerConfig,signKnowledgeAiToken} from "../src/lib/integrations/knowledgeai/issuer";

const {privateKey}=generateKeyPairSync("rsa",{modulusLength:2048});
const config={
  issuer:"https://takatak.example",audience:"knowledge-private",
  kid:"knowledge-ci-1",
  privateKeyPem:privateKey.export({format:"pem",type:"pkcs8"}).toString()
};
const workspace="11111111-1111-4111-8111-111111111111";
const actor="22222222-2222-4222-8222-222222222222";
const identity={
  mode:"client_scoped",profileId:actor,activeClientId:workspace,
  allowedClientIds:[workspace],sessionMatchesProfile:true,profileActive:true,
  membershipActive:true,clientActive:true,productActive:true,
  effectivePermissions:["view_reports","create_content","manage_services","manage_settings"]
};
const grant={enabled:true,allowRead:true,allowWrite:true,allowDelete:true,
  allowExport:true,expiresAt:new Date(Date.now()+60_000)};
const scopes=["knowledge:read","knowledge:write","knowledge:delete","knowledge:export"] as const;
for(const scope of scopes) {
  assert.equal(isKnowledgeAiScope(scope),true);
  assert.equal(canIssueKnowledgeAiScope(identity,grant,scope),true);
  const jwt=signKnowledgeAiToken(config,{actorId:actor,workspaceId:workspace,scope});
  const [header,payload,signature]=jwt.split(".");
  const claims=JSON.parse(Buffer.from(payload,"base64url").toString());
  assert.equal(claims.scope,scope);
  assert.equal(claims.iss,config.issuer);
  assert.equal(claims.aud,config.audience);
  assert.equal(claims.product,"knowledgeai");
  assert.equal(claims.workspace_id,workspace);
  assert.equal(claims.exp-claims.iat,60);
  const jwks=createKnowledgeAiJwks(config);
  assert.equal(Object.keys(jwks.keys[0]).sort().join(","),"alg,e,kid,kty,n,use");
  const pub=createPublicKey({key:jwks.keys[0],format:"jwk"});
  assert.equal(verify("RSA-SHA256",Buffer.from(header+"."+payload),{
    key:pub,padding:constants.RSA_PKCS1_PADDING,
  },Buffer.from(signature,"base64url")),true);
  assert.equal(verify("RSA-SHA256",Buffer.from(header+"."+payload+"altered"),{
    key:pub,padding:constants.RSA_PKCS1_PADDING,
  },Buffer.from(signature,"base64url")),false);
}
assert.equal(readKnowledgeAiIssuerConfig({}),null);
assert.equal(readKnowledgeAiIssuerConfig({KNOWLEDGEAI_ISSUER_ENABLED:"1"}),null);
assert.equal(readKnowledgeAiIssuerConfig({
  KNOWLEDGEAI_ISSUER_ENABLED:"1",
  KNOWLEDGEAI_ISSUER_ORIGIN:config.issuer,
  KNOWLEDGEAI_AUDIENCE:config.audience,
  KNOWLEDGEAI_SIGNING_KID:config.kid,
  KNOWLEDGEAI_SIGNING_KEY_PEM:config.privateKeyPem
})?.kid,config.kid);
for(const patch of [
  {mode:"platform_admin"}, {mode:"foundation_demo"},
  {profileActive:false},{membershipActive:false},{clientActive:false},
  {productActive:false},{sessionMatchesProfile:false},
  {allowedClientIds:[]},
  {effectivePermissions:[]}
]){
  assert.equal(canIssueKnowledgeAiScope({...identity,...patch},grant,"knowledge:read"),false);
}
for(const patch of [
  {enabled:false}, {allowRead:false},
  {expiresAt:null}, {expiresAt:new Date(Date.now()-1000)}
]){
  assert.equal(canIssueKnowledgeAiScope(identity,{...grant,...patch},"knowledge:read"),false);
}
assert.equal(canIssueKnowledgeAiScope(identity,null,"knowledge:read"),false);
assert.equal(canIssueKnowledgeAiScope(identity,{...grant,allowDelete:false},"knowledge:delete"),false);
assert.equal(canIssueKnowledgeAiScope(identity,{...grant,allowExport:false},"knowledge:export"),false);
assert.equal(isKnowledgeAiScope("knowledge:admin"),false);
assert.throws(()=>createKnowledgeAiJwks({...config,issuer:"http://insecure.example"}),/issuer unavailable/);
const weak=generateKeyPairSync("rsa",{modulusLength:1024});
assert.throws(()=>signKnowledgeAiToken({...config,
  privateKeyPem:weak.privateKey.export({format:"pem",type:"pkcs8"}).toString()
},{actorId:actor,workspaceId:workspace,scope:"knowledge:read"}),/issuer unavailable/);
console.log("KnowledgeAI TAKATAK issuer tests: PASS (signatures, scope, entitlements and deny-by-default)");
