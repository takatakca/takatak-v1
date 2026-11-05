import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { generateStudioDraft, parseStudioBrief, parseStudioPack, parseStudioGeneration, studioPack, studioEnabled, STUDIO_PROJECT_SOURCE } from '../src/lib/studio/production.ts';
import { isHighRiskPath } from '../src/lib/security/authenticated-identity.ts';
const pid = '11111111-1111-4111-8111-111111111111';
const brief = { title: 'Triple M', brief: 'An original musical story', language: 'en', audience: 'Families', characters: [{name:'Macyna',profile:''},{name:'Mariella',profile:''},{name:'Matthys',profile:''}] };
const input = {projectId:pid, track:'video', requestId:'test_request_12345678'};
const row = { content:JSON.stringify(brief), metadata:{source:STUDIO_PROJECT_SOURCE} };
function dependencies() {
  const calls=[];
  return {calls, findProject:async (tenant,id) => tenant==='tenant-a' && id===pid ? row:null,
    run:async data => { calls.push(data); return {ok:true,text:'Original draft',savedId:'saved-output',credits:2,balance:8,engineName:'Test engine'}; },
    linkOutput:async () => true};
}
test('feature is off by default and requires explicit true',()=>{assert.equal(studioEnabled({}),false);assert.equal(studioEnabled({TAKATAK_STUDIO_ENABLED:'true'}),true);assert.equal(studioEnabled({TAKATAK_STUDIO_ENABLED:'1'}),false)});
test('shared pack round-trips exact names without tenant or approval authority',()=>{const p=studioPack(brief);p.project.clientId='forged';p.jobs=[{status:'published',approved:true}];assert.deepEqual(parseStudioPack(p),brief);assert.deepEqual(parseStudioBrief({...brief,clientId:'forged',roles:['owner']}),brief)});
test('bad contracts and oversized briefs are rejected',()=>{for(const p of [null,[],{...brief,language:'xx'},{...brief,brief:'a'.repeat(1001)},{...brief,characters:[{name:'A',profile:''},{name:'a',profile:''}]}])assert.equal(parseStudioBrief(p),null);assert.equal(parseStudioPack({...studioPack(brief),version:2}),null)});
test('generation accepts only supported tracks, project UUID and safe operation IDs',()=>{assert.deepEqual(parseStudioGeneration(input),input);for(const v of [{...input,track:'publish'},{...input,projectId:'../other'},{...input,requestId:'short'}])assert.equal(parseStudioGeneration(v),null)});
test('foreign workspace cannot load or generate a project',async()=>{const d=dependencies();assert.equal((await generateStudioDraft(d,'tenant-b',input)).status,404);assert.equal(d.calls.length,0)});
test('all tracks reuse the central metered write engine and carry no publishing authorization',async()=>{for(const track of ['video','book','music']){const d=dependencies();const r=await generateStudioDraft(d,'tenant-a',{...input,track});assert.equal(r.ok,true);assert.equal(r.published,false);assert.equal(r.knowledge,'not_retrieved');assert.equal(d.calls[0].clientId,'tenant-a');assert.equal(d.calls[0].mode,'write');assert.equal(d.calls[0].engine,'auto');assert.ok(d.calls[0].requestId.includes(pid+':'+track));assert.ok(d.calls[0].prompt.includes('Macyna'));assert.ok(d.calls[0].prompt.includes('not a')||track==='music')}});
test('link failures preserve successful billing outcome without suggesting retry',async()=>{const d=dependencies();d.linkOutput=async()=>{throw Error('storage unavailable')};const r=await generateStudioDraft(d,'tenant-a',input);assert.equal(r.ok,true);assert.equal(r.linked,false);assert.equal(r.savedId,'saved-output');assert.equal(d.calls.length,1)});
test('central provider/credit refusal propagates without output linking',async()=>{const d=dependencies();d.run=async()=>({ok:false,status:402,code:'insufficient_credits'});d.linkOutput=async()=>{assert.fail('must not link')};assert.equal((await generateStudioDraft(d,'tenant-a',input)).status,402)});
test('wrong source and malformed project cannot reach billable relay',async()=>{for(const bad of [{...row,metadata:{source:'takbot'}},{...row,content:'not json'}]){const d=dependencies();d.findProject=async()=>bad;assert.equal((await generateStudioDraft(d,'tenant-a',input)).status,404);assert.equal(d.calls.length,0)}});
test('quoted input that expands over engine budget fails before billing',async()=>{const d=dependencies();const b={...brief,brief:'"'.repeat(1000),audience:'"'.repeat(150),title:'"'.repeat(120),characters:[{name:'a',profile:'"'.repeat(250)},{name:'b',profile:'"'.repeat(250)},{name:'c',profile:'"'.repeat(250)}]};d.findProject=async()=>({...row,content:JSON.stringify(b)});assert.equal((await generateStudioDraft(d,'tenant-a',input)).code,'brief_too_large_for_engine');assert.equal(d.calls.length,0)});
test('Studio routes require fresh auth and server-derived workspace',()=>{assert.equal(isHighRiskPath('/api/studio/generate'),true);assert.equal(isHighRiskPath('/dashboard/studio'),true);for(const file of ['src/app/api/studio/projects/route.ts','src/app/api/studio/generate/route.ts']){const s=readFileSync(file,'utf8');assert.ok(s.includes('requireWorkspaceApiPermission("create_content")'));assert.ok(s.includes('gate.access.activeClientId'));assert.ok(s.includes('readJsonBody'));assert.ok(!s.includes('body.clientId'))}});
