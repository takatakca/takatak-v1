import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { handoffStudioDraft } from '../src/lib/studio/handoff-service.ts';
import { linkStudioOutput } from '../src/lib/studio/output-link.ts';
import { canHandoff } from '../src/lib/studio/agent-policy.ts';
import { STUDIO_OUTPUT_SOURCE } from '../src/lib/studio/production.ts';

const input={clientId:'tenant-a',actorId:'operator',outputId:'output-a',accountId:'account-a'};
const policy={outputSource:STUDIO_OUTPUT_SOURCE,eligible:canHandoff,recordId:seed=>createHash('sha256').update(seed).digest('hex')};
function fixture(){
 const state={output:{id:input.outputId,clientId:input.clientId,businessBrandId:null,content:'An original caption',status:'draft',origin:'ai_generated',metadata:{source:STUDIO_OUTPUT_SOURCE,projectId:'project-a',track:'social',engine:'ollama',requestId:'operation-a'}},account:{id:input.accountId,clientId:input.clientId,businessBrandId:'brand-a',platform:'facebook',status:'connected',accessStatus:'selected',isAvailableThroughAuth:true},posts:[],approvals:[],locks:[],reads:[],afterLock:null,failApproval:false};
 const clone=value=>value==null?null:structuredClone(value);
 const tx={
  $queryRaw:async(strings,...values)=>{state.locks.push({table:strings.join('?').includes('social_accounts')?'account':'output',values});if(state.afterLock)await state.afterLock();return [];},
  savedAiOutput:{
   findFirst:async({where})=>{state.reads.push(where);const o=state.output;return clone(o&&o.id===where.id&&o.clientId===where.clientId&&(!where.origin||where.origin===o.origin)&&(!where.metadata||o.metadata.source===where.metadata.equals)?o:null);},
   update:async({where,data})=>{assert.equal(where.clientId,state.output.clientId);Object.assign(state.output,data);return clone(state.output);},
   updateMany:async({where,data})=>{const o=state.output;if(o.id!==where.id||o.clientId!==where.clientId||o.status!==where.status||o.metadata.source!==where.metadata.equals)return {count:0};Object.assign(o,data);return {count:1};},
  },
  socialAccount:{findFirst:async({where})=>{state.reads.push(where);const a=state.account;assert.deepEqual(where.OR,[{businessBrandId:null},{businessBrand:{clientId:where.clientId}}]);return clone(a&&a.id===where.id&&a.clientId===where.clientId&&a.status===where.status&&where.accessStatus.in.includes(a.accessStatus)&&a.isAvailableThroughAuth===where.isAvailableThroughAuth&&(!a.businessBrandId||!a.businessBrandClientId||a.businessBrandClientId===where.clientId)?a:null);}},
  socialPost:{
   findFirst:async({where})=>{state.reads.push(where);const p=state.posts.find(p=>p.id===where.id&&p.clientId===where.clientId);return p?{...clone(p),approvals:clone(state.approvals.filter(a=>a.socialPostId===p.id&&a.clientId===where.clientId))}:null;},
   create:async({data})=>{assert.ok(!state.posts.some(p=>p.id===data.id));state.posts.push(clone(data));return clone(data);},
  },
  approval:{create:async({data})=>{if(state.failApproval)throw Error('synthetic approval storage failure');const a={...clone(data),id:'approval-a'};state.approvals.push(a);return clone(a);}},
 };
 // Serial, rollback-capable in-memory transaction fixture. This models the
 // contract only; real Postgres row locks and authenticated HTTP remain untested.
 let tail=Promise.resolve();
 async function transaction(fn){const previous=tail;let release;tail=new Promise(r=>{release=r});await previous;const snapshot=clone({output:state.output,posts:state.posts,approvals:state.approvals});try{return await fn(tx);}catch(error){Object.assign(state,snapshot);throw error;}finally{release();}}
 return {state,tx,run:(change={})=>transaction(tx=>handoffStudioDraft(tx,{...input,...change},policy))};
}

test('foreign workspace/output/account pairs never create Social or approval records',async()=>{
 for(const change of [{clientId:'tenant-b'},{outputId:'output-b'},{accountId:'account-b'}]){const f=fixture();const r=await f.run(change);assert.equal(r.statusCode,403);assert.equal(f.state.posts.length,0);assert.equal(f.state.approvals.length,0);assert.ok(f.state.reads.every(w=>w.clientId===(change.clientId??input.clientId)));}
});
test('concurrent service replays create exactly one existing Social post and approval',async()=>{
 const f=fixture();const results=await Promise.all(Array.from({length:12},()=>f.run()));assert.equal(results.filter(r=>!r.replayed).length,1);assert.equal(f.state.posts.length,1);assert.equal(f.state.approvals.length,1);assert.equal(f.state.output.status,'sent_to_approval');assert.ok(results.every(r=>r.ok&&r.publicationVerified===false));assert.deepEqual(f.state.locks[0],{table:'output',values:[input.outputId,input.clientId]});assert.deepEqual(f.state.locks[1],{table:'account',values:[input.accountId,input.clientId]});
});
test('disconnect, lost access, reassignment and changed output after lock are refused',async()=>{
 const changes=[s=>s.account.status='disabled',s=>s.account.accessStatus='permission_lost',s=>s.account.isAvailableThroughAuth=false,s=>s.account.businessBrandClientId='tenant-b',s=>{s.output.businessBrandId='brand-a';s.account.businessBrandId='brand-b';},s=>s.output.metadata.track='video',s=>s.output.metadata.source='takbot',s=>s.output.status='archived'];
 for(const change of changes){const f=fixture();f.state.afterLock=()=>change(f.state);assert.equal((await f.run()).statusCode,403);assert.equal(f.state.posts.length,0);}
});
test('replay preserves progressed review state without claiming a publication receipt',async()=>{
 const f=fixture();await f.run();f.state.posts[0].status='approved';f.state.approvals[0].status='approved';const r=await f.run();assert.equal(r.replayed,true);assert.equal(r.status,'approved');assert.equal(r.approvalStatus,'approved');assert.equal(r.publicationVerified,false);assert.equal(f.state.approvals.length,1);
});
test('changed caption or inconsistent prior handoff is held without overwriting review',async()=>{
 for(const change of [s=>s.output.content='Edited after review',s=>s.posts[0].metadata.savedOutputId='other',s=>s.approvals=[],s=>s.posts[0].socialAccountId='other']){const f=fixture();await f.run();change(f.state);assert.equal((await f.run()).code,'handoff_requires_reconciliation');assert.equal(f.state.posts.length,1);}
});
test('approval write failure rolls back the Social record, then retry can create once',async()=>{
 const f=fixture();f.state.failApproval=true;await assert.rejects(f.run(),/storage failure/);assert.equal(f.state.posts.length,0);assert.equal(f.state.output.status,'draft');f.state.failApproval=false;assert.equal((await f.run()).replayed,false);assert.equal(f.state.posts.length,1);assert.equal(f.state.approvals.length,1);
});
test('central output linking preserves provenance and stable request ID',async()=>{
 const f=fixture();f.state.output.status='saved';f.state.output.metadata={source:'takbot',mode:'write',engine:'ollama',trial:true,requestId:'studio:project:music:stable-request',providerEvidence:{model:'reported-model'}};
 const link={clientId:input.clientId,outputId:input.outputId,projectId:'project-a',track:'music',outputSource:STUDIO_OUTPUT_SOURCE};
 assert.equal(await linkStudioOutput(f.tx,link),true);assert.deepEqual(f.state.output.metadata,{source:STUDIO_OUTPUT_SOURCE,mode:'write',engine:'ollama',trial:true,requestId:'studio:project:music:stable-request',providerEvidence:{model:'reported-model'},originSource:'takbot',version:1,projectId:'project-a',track:'music',generatedBy:'takbot',knowledge:'not_retrieved'});
 assert.equal(await linkStudioOutput(f.tx,link),true);assert.equal(await linkStudioOutput(f.tx,{...link,projectId:'other-project'}),false);assert.equal(await linkStudioOutput(f.tx,{...link,clientId:'tenant-b'}),false);
});
test('manual, archived and unrelated outputs cannot be relabeled as generated Studio media',async()=>{
 for(const change of [s=>s.output.origin='manual',s=>s.output.status='archived',s=>s.output.metadata.source='other']){const f=fixture();change(f.state);assert.equal(await linkStudioOutput(f.tx,{clientId:input.clientId,outputId:input.outputId,projectId:'project-a',track:'video',outputSource:STUDIO_OUTPUT_SOURCE}),false);}
});
