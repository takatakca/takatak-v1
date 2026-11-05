/** Actual Studio component + synthetic API records. Never contacts a provider.
 * Uses packages already present on disk; this script never installs dependencies.
 * Optional paths: STUDIO_TYPESCRIPT_PATH, STUDIO_REACT_MODULES_PATH,
 * STUDIO_PLAYWRIGHT_PATH, STUDIO_CHROMIUM_PATH, STUDIO_UI_PROOF_DIR.
 * This is component/interaction QA, not authenticated Next.js or provider E2E.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ts = require(process.env.STUDIO_TYPESCRIPT_PATH || 'typescript');
const modules = process.env.STUDIO_REACT_MODULES_PATH || join(root, 'node_modules');
const { chromium } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const proofs = process.env.STUDIO_UI_PROOF_DIR;
if (proofs) mkdirSync(proofs, { recursive: true });
const source = path => readFileSync(join(root, path), 'utf8');
const compile = path => {
  const result = ts.transpileModule(source(path), { fileName: path, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  assert.deepEqual(result.diagnostics, [], `${path}: syntax diagnostics`);
  return result.outputText;
};
const code = {
  react: readFileSync(join(modules, 'react/cjs/react.development.js'), 'utf8'),
  'react/jsx-runtime': readFileSync(join(modules, 'react/cjs/react-jsx-runtime.development.js'), 'utf8'),
  'react-dom': readFileSync(join(modules, 'react-dom/cjs/react-dom.development.js'), 'utf8'),
  'react-dom/client': readFileSync(join(modules, 'react-dom/client.js'), 'utf8'),
  scheduler: readFileSync(join(modules, 'scheduler/cjs/scheduler.development.js'), 'utf8'),
  './studio-workspace.css': '',
  '@/lib/studio/production': compile('src/lib/studio/production.ts'),
  '@/lib/studio/agent-policy': compile('src/lib/studio/agent-policy.ts'),
  studio: compile('src/components/studio/studio-workspace.tsx'),
};
const optionalClient = join(modules, 'react-dom/cjs/react-dom-client.development.js');
if (existsSync(optionalClient)) code['react-dom/client'] = readFileSync(optionalClient, 'utf8');
const bundle = `const process={env:{NODE_ENV:'development'}};const modules={${Object.entries(code).map(([name,body]) => `${JSON.stringify(name)}:function(require,module,exports){\n${body}\n}`).join(',')}};const cache={};function require(name){if(cache[name])return cache[name].exports;if(!modules[name])throw Error('Unexpected module '+name);const module={exports:{}};cache[name]=module;modules[name](require,module,module.exports);return module.exports;}require('react-dom/client').createRoot(document.getElementById('root')).render(require('react').createElement(require('studio').StudioWorkspace,{creditsPerDraft:2}));`;
const css = source('src/components/studio/studio-workspace.css');
const server = createServer((req,res) => {
  if (req.url === '/bundle.js') { res.setHeader('content-type','text/javascript; charset=utf-8'); res.end(bundle); }
  else if (req.url === '/style.css') { res.setHeader('content-type','text/css; charset=utf-8'); res.end(css); }
  else { res.setHeader('content-type','text/html; charset=utf-8'); res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>body{margin:0;padding:16px;background:#edf2f8}button,input,select,textarea{font-family:Arial,sans-serif}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'); }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const browser = await chromium.launch({ headless: true, ...(process.env.STUDIO_CHROMIUM_PATH ? { executablePath: process.env.STUDIO_CHROMIUM_PATH } : {}), args:['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(()=>{const original=window.setInterval;window.__studioPolls=0;window.setInterval=(callback,delay,...args)=>original(()=>{if(delay===15000){window.__studioPolls++;if(window.__skipStudioPoll)return;}callback(...args);},delay===15000?250:delay);});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  
  const idA='11111111-1111-4111-8111-111111111111',idB='22222222-2222-4222-8222-222222222222',idC='33333333-3333-4333-8333-333333333333';
  const project = (id,title) => ({id,title,brief:'An original imaginary journey for this synthetic UI check.',audience:'Families',language:'en',characters:[],createdAt:'2026-11-05T12:00:00Z'});
  const projects = [project(idA,'Production A'),project(idB,'Production B')];
  const oldProject = project(idC,'An older production');
  const scene = title => ({ title, visual:'An original landscape. '.repeat(21).trim(), narration:'', seconds:10 });
  const plans = [ {id:'scene-a',content:JSON.stringify([scene('A opening')]),metadata:{projectId:idA,revision:4}}, {id:'scene-b',content:JSON.stringify([scene('B opening')]),metadata:{projectId:idB,revision:8}} ];
  const outputs = ['one','two'].map(n=>({id:`output-${n}`,title:'Synthetic social draft',content:`Original synthetic social caption ${n}`,metadata:{projectId:idA,track:'social'}}));
  const calls=[];let failRefresh=false;let uncertainGenerate=false;
  await page.route('**/api/studio/**',async route => {
    const request=route.request(),url=new URL(request.url());
    const body=request.method()==='POST'?request.postDataJSON():null;
    calls.push({path:url.pathname,method:request.method(),body});
    const respond=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if (url.pathname==='/api/studio/projects') {
      if(failRefresh){failRefresh=false;return respond({message:'Synthetic list outage'},503);}
      const older=url.searchParams.get('offset')==='20';
      return respond({projects:older?[oldProject]:projects,outputs,scenePlans:plans,accounts:[{id:'account-one',platform:'facebook',displayName:'Synthetic account one'},{id:'account-two',platform:'facebook',displayName:'Synthetic account two'}],balance:20,engines:['ollama'],agentEnabled:false,agentJobs:[{id:'job-a',status:'queued',scheduledFor:'2026-11-05T12:00:00Z',leaseExpiresAt:null,errorMessage:null,metadata:{projectId:idA,track:'video'}},{id:'job-held',status:'completed',scheduledFor:'2026-11-05T12:00:00Z',leaseExpiresAt:null,errorMessage:'requires_reconciliation',metadata:{projectId:idA,track:'music',linked:false,reconciliationRequired:true}}],nextOffset:older?null:20});
    }
    if(url.pathname==='/api/studio/scenes'){if(request.method()==='GET'){const p=plans.find(p=>p.metadata.projectId===url.searchParams.get('projectId'));return respond({ok:true,plan:p??null});}return respond({revision:body.revision+1});}
    if(url.pathname==='/api/studio/generate'){
      if(uncertainGenerate){uncertainGenerate=false;return respond({message:'Synthetic uncertain generation'},503);}
      failRefresh=true;return respond({ok:true,linked:true,text:'Synthetic new draft',savedId:'new-output',credits:2});
    }
    if(url.pathname==='/api/studio/library'){const q=url.searchParams.get('q')??'',track=url.searchParams.get('track');return respond({ok:true,outputs:outputs.filter(o=>(!q||o.content.includes(q))&&(!track||o.metadata.track===track)),hasMore:false,nextOffset:null});}
    if(url.pathname==='/api/studio/handoff')return respond({ok:true,replayed:true,status:'approved',published:false});
    return respond({ok:true,count:2,runnerEnabled:false});
  });
  page.setDefaultTimeout(10000);console.log('Loading component fixture');await page.goto(`http://127.0.0.1:${server.address().port}`);console.log('Fixture loaded');
  await page.getByRole('heading',{name:'What would you like to create?'}).waitFor();if(proofs)await page.screenshot({path:join(proofs,'studio-create-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:900});if(proofs)await page.screenshot({path:join(proofs,'studio-create-390.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'Projects',exact:true}).click();
  await page.getByRole('button',{name:'Load more projects'}).click();
  await page.locator('.ts-library-grid').getByRole('button',{name:/An older production/}).waitFor();
  await page.evaluate(()=>{window.__studioPolls=0;});await page.waitForFunction(()=>window.__studioPolls>0);
  await page.locator('.ts-library-grid').getByRole('button',{name:/An older production/}).waitFor();
  await page.evaluate(()=>{window.__skipStudioPoll=true;});console.log('Pagination checked');await page.locator('.ts-library-grid').getByRole('button',{name:/Production A/}).click();
  await page.getByRole('button',{name:'Edit this scene'}).click();
  await page.getByLabel('Scene title',{exact:true}).fill('A unsaved opening');
  await page.getByRole('button',{name:'Your agent',exact:false}).first().click();
  await page.getByLabel('Production',{exact:true}).selectOption(idB);
  await page.getByRole('button',{name:'Create',exact:true}).click();
  await page.getByRole('heading',{name:'B opening',exact:true}).waitFor();
  await page.getByRole('button',{name:'Your agent',exact:false}).first().click();
  await page.getByLabel('Production',{exact:true}).selectOption(idA);
  await page.getByRole('button',{name:'Create',exact:true}).click();
  await page.getByRole('heading',{name:'A unsaved opening',exact:true}).waitFor();
  await page.getByRole('button',{name:'Edit this scene'}).click();
  await page.getByLabel('Duration (2–30 seconds)').fill('31');
  assert.equal(await page.getByRole('button',{name:'Save scene plan',exact:true}).isDisabled(),true);
  await page.getByLabel('Duration (2–30 seconds)').fill('12');
  await page.getByRole('button',{name:'Save scene plan',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Scene plan saved'}).waitFor();
  const save=calls.find(c=>c.path==='/api/studio/scenes'&&c.method==='POST');
  assert.equal(save.body.projectId,idA);assert.equal(save.body.revision,4);assert.equal(save.body.scenes[0].title,'A unsaved opening');
  await page.getByRole('button',{name:'Generate draft',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Draft ready'}).waitFor();
  assert.match(await page.getByRole('status').innerText(),/could not refresh/);
  assert.doesNotMatch(await page.getByRole('status').innerText(),/before starting another request/);
  uncertainGenerate=true;
  await page.getByRole('button',{name:'Generate draft',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Synthetic uncertain generation'}).waitFor();
  const uncertain=calls.filter(c=>c.path==='/api/studio/generate').at(-1).body.requestId;
  await page.getByRole('button',{name:'Generate draft',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Draft ready'}).waitFor();
  assert.equal(calls.filter(c=>c.path==='/api/studio/generate').at(-1).body.requestId,uncertain);
  await page.getByRole('button',{name:'Social',exact:true}).click();
  const accountSelects=page.getByLabel('Send to your connected account');
  await accountSelects.nth(0).selectOption('account-one');
  assert.equal(await accountSelects.nth(1).inputValue(),'');
  await page.getByRole('button',{name:'Send to Social review',exact:false}).first().click();
  await page.getByRole('status').filter({hasText:'Status: approved'}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Learn Studio in TAKATAK Academy'}).count(),1);
  if(proofs)await page.screenshot({path:join(proofs,'studio-desktop.png'),fullPage:true});
  for(const width of [320,390,768]){
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`No document overflow at ${width}px`);
    if(proofs)await page.screenshot({path:join(proofs,`studio-social-${width}.png`),fullPage:true});
  }
  await page.getByRole('button',{name:'Video',exact:true}).click();
  await page.setViewportSize({width:320,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No long scene overflow at 320px');
  const caption=await page.locator('.ts-stage-caption').boundingBox();const stage=await page.locator('.ts-scene-stage').boundingBox();assert.ok(caption.y+caption.height<=stage.y+stage.height,'Long description has a bounded scrollable preview');
  if(proofs)await page.screenshot({path:join(proofs,'studio-scenes-320.png'),fullPage:true});
  await page.getByRole('button',{name:'Open workspace menu'}).click();await page.getByRole('button',{name:'Your agent',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No agent overflow at 320px');
  await page.getByRole('button',{name:'Book',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Book',exact:true}).getAttribute('aria-pressed'),'true');
  if(proofs)await page.screenshot({path:join(proofs,'studio-agent-320.png'),fullPage:true});
  await page.getByRole('button',{name:'Open workspace menu'}).click();await page.getByRole('dialog',{name:'Studio workspace menu'}).waitFor();await page.waitForFunction(()=>Math.abs(document.querySelector('#studio-sidebar').getBoundingClientRect().x)<1);const drawer=await page.locator('#studio-sidebar').boundingBox();assert.ok(drawer.x>=0&&drawer.width<=320);assert.ok(await page.getByRole('button',{name:'Apps & connections',exact:true}).isVisible());if(proofs)await page.screenshot({path:join(proofs,'studio-drawer-320.png'),fullPage:false});await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Open workspace menu'}).getAttribute('aria-expanded'),'false');
  await page.getByRole('button',{name:'Open workspace menu'}).click();await page.getByRole('button',{name:'Library',exact:true}).click();await page.getByRole('heading',{name:'Your library.'}).waitFor();await page.getByLabel('Search saved drafts').fill('caption one');await page.getByRole('button',{name:'Search',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.ts-library-output').length===1);assert.equal(await page.locator('.ts-library-output').count(),1);if(proofs)await page.screenshot({path:join(proofs,'studio-library-320.png'),fullPage:true});
  await page.getByRole('button',{name:'Open workspace menu'}).click();await page.getByRole('button',{name:'Apps & connections',exact:true}).click();await page.getByRole('heading',{name:'Apps & connections.'}).waitFor();assert.equal(await page.getByRole('button',{name:'Open workspace menu'}).getAttribute('aria-expanded'),'false');assert.equal(await page.getByRole('dialog',{name:'Studio workspace menu'}).count(),0);await page.getByRole('heading',{name:'SONGER',exact:true}).waitFor();assert.match(await page.locator('.ts-app-card').filter({hasText:'SONGER'}).innerText(),/Manual workflow/);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No Apps overflow at 320px');if(proofs)await page.screenshot({path:join(proofs,'studio-apps-320.png'),fullPage:true});
  await page.getByRole('button',{name:'Open workspace menu'}).click();await page.getByRole('button',{name:/Scheduled/}).click();await page.getByRole('heading',{name:'Scheduled drafts.'}).waitFor();assert.equal(await page.locator('.ts-scheduled-job').count(),2);assert.equal(await page.getByText('Needs review',{exact:true}).count(),1);if(proofs)await page.screenshot({path:join(proofs,'studio-scheduled-320.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: actual component fixture — project/scene switching, unsaved scene restoration, duration validation, pagination poll, successful mutation + refresh outage, ambiguous request ID reuse, per-output account choice, truthful handoff replay, accessible selection, mobile drawer Escape/focus, real Library search, Apps/SONGER manual workflow, Scheduled records and desktop/320/390/768px overflow.');
  console.log(`Fixture React ${JSON.parse(readFileSync(join(modules,'react/package.json'),'utf8')).version}; authenticated app, database and provider E2E remain unverified.`);
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
