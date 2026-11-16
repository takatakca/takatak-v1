// Real disposable CI PostgreSQL fixture. Never run against hosted customer DB.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPrisma, disconnectPrisma } from "../src/lib/db/prisma";
import { STUDIO_OUTPUT_SOURCE, STUDIO_PROJECT_SOURCE } from "../src/lib/studio/production";
async function main(){
 const db=getPrisma();
 if(!db) throw new Error("organizer_filing_db_requires_migrated_disposable_database");
 const a=randomUUID(),b=randomUUID(),srcA=randomUUID(),pA=randomUUID(),pA2=randomUUID(),pB=randomUUID();
 const creator=randomUUID();
 try{
   await db.client.createMany({data:[
     {id:a,name:"Organizer Filing CI A",status:"active"},
     {id:b,name:"Organizer Filing CI B",status:"active"},
   ]});
   await db.savedAiOutput.createMany({data:[
     {id:srcA,clientId:a,origin:"ai_generated",status:"saved",
       kind:"creative_brief",title:"CI synthetic output",content:"source-unchanged",
       metadata:{source:STUDIO_OUTPUT_SOURCE}},
     {id:pA,clientId:a,origin:"manual",status:"draft",
       kind:"creative_brief",title:"CI A project",content:"{}",
       metadata:{source:STUDIO_PROJECT_SOURCE}},
     {id:pA2,clientId:a,origin:"manual",status:"draft",
       kind:"creative_brief",title:"CI A project two",content:"{}",
       metadata:{source:STUDIO_PROJECT_SOURCE}},
     {id:pB,clientId:b,origin:"manual",status:"draft",
       kind:"creative_brief",title:"CI B project",content:"{}",
       metadata:{source:STUDIO_PROJECT_SOURCE}},
   ]});
   const source=await db.savedAiOutput.findUniqueOrThrow({where:{id:srcA}});
   await db.organizerWorkspacePolicy.createMany({data:[
     {clientId:a,mode:"suggest",consentGranted:true,providerProcessingConsent:false,
       requireApproval:true,allowedSourceKinds:["studio"],allowedDestinationIds:[pA,pA2]},
     {clientId:b,mode:"suggest",consentGranted:true,providerProcessingConsent:false,
       requireApproval:true,allowedSourceKinds:["studio"],allowedDestinationIds:[pB]},
   ]});
   const values={clientId:a,sourceOutputId:srcA,destinationProjectId:pA,
      sourceUpdatedAt:source.updatedAt,policyRevision:1,requestedBy:creator};
   const first=await db.organizerFilingProposal.create({data:{
      ...values,requestId:"request_test_1234567890",
   }});
   assert.equal(first.status,"pending");
   assert.equal(first.revision,1);
   await assert.rejects(()=>db.organizerFilingProposal.create({data:{
      ...values,requestId:"request_test_1234567890",
   }}),"idempotent request ID is unique");
   await assert.rejects(()=>db.organizerFilingProposal.create({data:{
      ...values,requestId:"request_test_1234567891",
   }}),"same destination cannot be duplicated with a new request ID");
   await assert.rejects(()=>db.organizerFilingProposal.create({data:{
      ...values,clientId:b,requestId:"request_test_1234567892",destinationProjectId:pB,
   }}),"database trigger must reject source from another client");
   await assert.rejects(()=>db.organizerFilingProposal.create({data:{
      ...values,requestId:"request_test_1234567893",policyRevision:2,
   }}),"database must reject stale policy version");
   await assert.rejects(()=>db.organizerFilingProposal.create({data:{
      ...values,requestId:"request_test_1234567894",sourceUpdatedAt:new Date("2020-01-01T00:00:00Z"),
   }}),"database must reject a fabricated source version");
   const second=await db.organizerFilingProposal.create({data:{
      ...values,requestId:"request_test_1234567895",destinationProjectId:pA2,
   }});
   const reviewer=randomUUID(),now=new Date();
   await db.organizerFilingProposal.update({where:{id:first.id},data:{
      status:"approved",revision:{increment:1},reviewedBy:reviewer,reviewedAt:now,
   }});
   await assert.rejects(()=>db.organizerFilingProposal.update({where:{id:second.id},data:{
      status:"approved",revision:{increment:1},reviewedBy:reviewer,reviewedAt:now,
   }}),"only one approved assignment per source");
   await db.organizerFilingProposal.update({where:{id:first.id},data:{
      status:"undone",revision:{increment:1},reviewedBy:reviewer,undoneAt:new Date(),
   }});
   await db.organizerFilingProposal.update({where:{id:second.id},data:{
      status:"approved",revision:{increment:1},reviewedBy:reviewer,reviewedAt:new Date(),
   }});
   const confirmed=await db.organizerFilingProposal.findMany({
      where:{clientId:a,status:"approved"},
   });
   assert.equal(confirmed.length,1);
   assert.equal(confirmed[0].id,second.id);
   const original=await db.savedAiOutput.findUniqueOrThrow({where:{id:srcA}});
   assert.equal(original.content,"source-unchanged","metadata transitions never modify original bytes");
   const rls=await db.$queryRawUnsafe<Array<{relrowsecurity:boolean}>>(
     "SELECT c.relrowsecurity FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='organizer_filing_proposals'"
   );
   assert.equal(rls[0]?.relrowsecurity,true);
   console.log("AI organizer filing: disposable PostgreSQL tenant/provenance/idempotency/unique/undo/RLS PASS");
 }finally{
   await db.client.deleteMany({where:{id:{in:[a,b]}}});
   await disconnectPrisma();
 }
}
void main();
