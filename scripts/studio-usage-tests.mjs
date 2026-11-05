import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readRelayUsage, relayPrompt } from '../src/lib/takbot/relay.ts';

test('OpenAI-compatible usage distinguishes total input, cached input and reasoning units',()=>{
 assert.deepEqual(readRelayUsage({relay:'openai_compat'},{usage:{prompt_tokens:500,completion_tokens:120,prompt_tokens_details:{cached_tokens:400},completion_tokens_details:{reasoning_tokens:20}}}),{inputTokens:500,outputTokens:120,cachedInputTokens:400,cacheWriteTokens:null,reasoningTokens:20});
});
test('Anthropic cache writes and reads remain separate from regular input',()=>{
 assert.deepEqual(readRelayUsage({relay:'anthropic'},{usage:{input_tokens:50,output_tokens:100,cache_read_input_tokens:500,cache_creation_input_tokens:200}}),{inputTokens:50,outputTokens:100,cachedInputTokens:500,cacheWriteTokens:200,reasoningTokens:null});
});
test('Gemini usage retains cached and thought tokens without inventing money amounts',()=>{
 assert.deepEqual(readRelayUsage({relay:'gemini'},{usageMetadata:{promptTokenCount:500,candidatesTokenCount:100,cachedContentTokenCount:300,thoughtsTokenCount:20}}),{inputTokens:500,outputTokens:100,cachedInputTokens:300,cacheWriteTokens:null,reasoningTokens:20});
});
test('missing, malformed or negative provider usage is unknown rather than free',()=>{
 for(const body of [null,{},[],{usage:'broken'},{usage:{prompt_tokens:-1,completion_tokens:Infinity}},{usage:{prompt_tokens:'5',completion_tokens:1.5}}])assert.deepEqual(readRelayUsage({relay:'openai_compat'},body),{inputTokens:null,outputTokens:null,cachedInputTokens:null,cacheWriteTokens:null,reasoningTokens:null});
 assert.equal(readRelayUsage({relay:'openai_compat'},{usage:{prompt_tokens:0}}).inputTokens,0);
});
test('one bounded provider call retains the actual requested model and reported usage',async()=>{
 const calls=[];const result=await relayPrompt({engine:{key:'ollama',relay:'openai_compat',endpoint:'https://example.invalid/v1/chat/completions',defaultModel:'configured-model'},mode:'write',apiKey:'synthetic-placeholder',prompt:'An original synthetic brief'},async(url,init)=>{calls.push({url,body:JSON.parse(init.body)});return new Response(JSON.stringify({choices:[{message:{content:'Original draft'}}],usage:{prompt_tokens:18,completion_tokens:7}}),{status:200});},{});
 assert.equal(calls.length,1);assert.equal(calls[0].body.max_tokens,1200);assert.equal(result.ok,true);assert.equal(result.model,'configured-model');assert.equal(result.usage.inputTokens,18);assert.equal(result.usage.outputTokens,7);assert.equal(result.providerCost,undefined);
});
test('ambiguous transport failure returns once without a fallback model request',async()=>{
 let calls=0;const result=await relayPrompt({engine:{key:'ollama',relay:'openai_compat',endpoint:'https://example.invalid/v1/chat/completions',defaultModel:'configured-model'},mode:'write',apiKey:'synthetic-placeholder',prompt:'Synthetic'},async()=>{calls++;throw new Error('network interruption');},{});assert.equal(result.code,'network');assert.equal(calls,1);
});
test('malformed successful provider bodies fail without throwing or replaying a billed call',async()=>{
 for(const [relay,body] of [['anthropic',{content:{}}],['gemini',{candidates:[{content:{parts:{}}}]}],['openai_compat',{choices:{}}],['anthropic',null]]){
  let calls=0;const r=await relayPrompt({engine:{key:'synthetic',relay,endpoint:'https://example.invalid/chat',defaultModel:'configured-model'},mode:'write',apiKey:'synthetic',prompt:'Synthetic'},async()=>{calls++;return new Response(JSON.stringify(body),{status:200});},{});assert.equal(r.ok,false);assert.equal(r.code,'empty');assert.equal(calls,1);
 }
});
