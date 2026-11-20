import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  quoteStudioPlanCost, estimateStudioProviderCost, cheapestStudioRoute,
  studioReuseKey, reusableStudioArtifact, STUDIO_MAX_RATE_AGE_MS,
} from '../src/lib/studio/cost-policy.ts';

const now = Date.parse('2026-11-05T12:00:00Z');
// Synthetic test rates, deliberately not a price claim about any provider.
const rate = {
  version:'fixture-v1', currency:'USD', inputMicrosPerMillionTokens:100_000,
  outputMicrosPerMillionTokens:200_000, fixedMicros:20,
  verifiedAtMs:now-1000, expiresAtMs:now+60_000, sourceUrl:'https://example.test/rates',
  completeForRequest:true,
};
const bound = {nowMs:now,currency:'USD',maxInputTokens:1000,maxOutputTokens:1200,maxProviderCostMicros:10_000};
const route = (id,cost,extra={}) => ({id,engine:id,model:'fixture-model',eligible:true,available:true,
  requiresApproval:false,rate:{...rate,inputMicrosPerMillionTokens:cost,outputMicrosPerMillionTokens:cost},...extra});
const plan = {tracks:['video','social'],days:3,retailCreditsPerDraft:2,budgetCredits:12};

test('collaborating agents share one bounded writer task per format/day',()=>{
  const single=quoteStudioPlanCost(plan), team=quoteStudioPlanCost({...plan,collaboratorCount:4});
  assert.equal(single.ok,true);assert.equal(team.ok,true);
  assert.equal(team.providerTasks,6);assert.equal(team.providerTasks,single.providerTasks);
  assert.equal(team.retailCreditCeiling,12);assert.equal(team.collaboratorCount,4);
  assert.equal(team.automaticEscalation,false);assert.equal(team.reservesCredits,false);
});
test('retail credits are never reported as supplier money or platform profit',()=>{
  const quote=quoteStudioPlanCost(plan);
  assert.equal(quote.providerCostStatus,'unknown');assert.equal(quote.providerCostMicros,null);assert.equal(quote.marginMicros,null);
});
test('plan rejects hidden agent fan-out, invalid arithmetic and insufficient retail budget',()=>{
  for(const change of [{collaboratorCount:5},{collaboratorCount:0},{days:8},{days:NaN},
    {retailCreditsPerDraft:Infinity},{budgetCredits:11},{tracks:['video','video']},{tracks:['publish']},
    {maxProviderTasks:5},{maxProviderTasks:29}])assert.equal(quoteStudioPlanCost({...plan,...change}).ok,false);
  const full=quoteStudioPlanCost({tracks:['video','book','music','social'],days:7,retailCreditsPerDraft:2,budgetCredits:56});
  assert.equal(full.ok,true);assert.equal(full.providerTasks,28);
});
test('provider estimate uses bounded tokens, fixed cost and integer rounding upwards',()=>{
  assert.equal(estimateStudioProviderCost(rate,bound),360);
  assert.equal(estimateStudioProviderCost({...rate,inputMicrosPerMillionTokens:1,outputMicrosPerMillionTokens:1,fixedMicros:0},
    {...bound,maxInputTokens:1,maxOutputTokens:1}),1);
  assert.equal(estimateStudioProviderCost({...rate,inputMicrosPerMillionTokens:1_000_000_000_000,outputMicrosPerMillionTokens:1_000_000_000_000},
    {...bound,maxInputTokens:1_000_000,maxOutputTokens:1_000_000}),2_000_000_000_020);
});
test('unknown, future, expired, stale or malformed supplier rates fail closed',()=>{
  for(const change of [{currency:'CAD'},{verifiedAtMs:now+1},{expiresAtMs:now},
    {verifiedAtMs:now-STUDIO_MAX_RATE_AGE_MS-1},{sourceUrl:'http://example.test/rates'},
    {sourceUrl:'https://user:secret@example.test/rates'},{outputMicrosPerMillionTokens:-1},{fixedMicros:0.1},{completeForRequest:false}]){
    assert.equal(estimateStudioProviderCost({...rate,...change},bound),null);
  }
  assert.equal(estimateStudioProviderCost(rate,{...bound,maxOutputTokens:0}),null);
  assert.equal(cheapestStudioRoute([route('unknown',0,{rate:null})],bound).state,'blocked');
});
test('routing chooses the cheapest eligible fresh model rather than catalog order',()=>{
  const candidates=[route('costly',2_000_000),route('cheap',100_000),route('offline',0,{available:false}),route('forbidden',0,{eligible:false})];
  const decision=cheapestStudioRoute(candidates,bound);
  assert.equal(decision.state,'selected');assert.equal(decision.engine,'cheap');assert.equal(decision.model,'fixture-model');
  assert.equal(decision.providerCostCeilingMicros,240);assert.equal(decision.maxOutputTokens,1200);
  assert.equal(decision.rateVersion,'fixture-v1');assert.equal(decision.currency,'USD');
});
test('unknown cheap-looking routes never beat verified quotes and budget is enforced',()=>{
  const known=route('known',100_000), unknown=route('unknown',0,{rate:null});
  assert.equal(cheapestStudioRoute([unknown,known],bound).engine,'known');
  assert.equal(cheapestStudioRoute([known],{...bound,maxProviderCostMicros:239}).state,'blocked');
  assert.equal(cheapestStudioRoute([known,known],bound).code,'invalid_cost_policy');
});
test('premium escalation requires a matching explicit route and rate-version approval',()=>{
  const premium=route('premium',500_000,{requiresApproval:true});
  assert.equal(cheapestStudioRoute([premium],bound).state,'approval_required');
  for(const approval of [{routeId:'other',rateVersion:'fixture-v1',maxProviderCostMicros:10_000},
    {routeId:'premium',rateVersion:'old',maxProviderCostMicros:10_000},
    {routeId:'premium',rateVersion:'fixture-v1',maxProviderCostMicros:100}]){
    assert.equal(cheapestStudioRoute([premium],{...bound,approval}).state,'approval_required');
  }
  assert.equal(cheapestStudioRoute([premium],{...bound,approval:{routeId:'premium',rateVersion:'fixture-v1',maxProviderCostMicros:1120}}).state,'selected');
});
test('cheaper ordinary route remains preferred when a premium grant exists',()=>{
  const decision=cheapestStudioRoute([route('premium',500_000,{requiresApproval:true}),route('economy',100_000)],
    {...bound,approval:{routeId:'premium',rateVersion:'fixture-v1',maxProviderCostMicros:10_000}});
  assert.equal(decision.engine,'economy');
});
const scope={clientId:'tenant-a',projectId:'project-a',briefDigest:'a'.repeat(64),briefVersion:1,track:'music',taskRevision:'lyrics-v1'};
const artifact={scope,outputId:'output-a',state:'completed',archived:false};
test('reuse is exact and isolated by tenant, project, source revision and task',()=>{
  assert.equal(reusableStudioArtifact(scope,artifact),true);
  for(const change of [{clientId:'tenant-b'},{projectId:'project-b'},{briefDigest:'b'.repeat(64)},
    {briefVersion:2},{track:'book'},{taskRevision:'lyrics-v2'}]){
    assert.equal(reusableStudioArtifact({...scope,...change},artifact),false);
    assert.notEqual(studioReuseKey({...scope,...change}),studioReuseKey(scope));
  }
});
test('incomplete, archived or unidentifiable artifacts never qualify for reuse',()=>{
  for(const change of [{state:'running'},{state:'failed'},{archived:true},{outputId:''}]){
    assert.equal(reusableStudioArtifact(scope,{...artifact,...change}),false);
  }
  assert.equal(studioReuseKey({...scope,briefDigest:'unknown'}),null);
  assert.equal(studioReuseKey({...scope,briefVersion:0}),null);
  assert.equal(reusableStudioArtifact({...scope,briefVersion:0},artifact),false);
});
test('canonical reuse keys resist delimiter collisions and normalize digest casing',()=>{
  assert.equal(studioReuseKey({...scope,briefDigest:'A'.repeat(64)}),studioReuseKey(scope));
  assert.notEqual(studioReuseKey({...scope,clientId:'tenant:a',projectId:'b'}),
    studioReuseKey({...scope,clientId:'tenant',projectId:'a:b'}));
});
