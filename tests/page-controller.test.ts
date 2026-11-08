import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import type {ForestApi,ForestState} from '../shared/model';
import type {PageBlockInput,PageMaterial,PageView} from '../shared/page';
import {ForestRepository} from '../plugin/domain';
import {PageRepository} from '../plugin/pages';
import {PageController,pageController,reviewEditKey} from '../client/pageStore';
import {merge3,contentOf,type Content} from '../client/pageModel';
import {beginPageCreation,clearPageCreation} from '../client/pageCreation';
const text=(id:string,value=id):PageBlockInput=>({id,type:'text',text:value});
const content=(ids:string[]):Content=>({title:'test',experimentDate:null,blocks:ids.map(id=>text(id))});
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve};}
async function fixture(){
  let state:ForestState|null=null;
  const repo=new ForestRepository({read:async()=>state,write:async s=>{state=structuredClone(s);}}),pages=new PageRepository(repo);
  const view=await pages.createPage({requestId:randomUUID(),title:'client software test'});
  const unused=async():Promise<never>=>{throw new Error('unexpected fixture API');};
  const api:ForestApi={list:f=>repo.list(f),get:id=>repo.get(id),snapshot:()=>repo.snapshot(),create:i=>repo.create(i),update:i=>repo.update(i),archive:i=>repo.archive(i),
    export:()=>repo.export(),previewImport:i=>repo.previewImport(i),import:i=>repo.import(i),createRun:i=>repo.createRun(i),updateRunStep:i=>repo.updateRunStep(i),context:i=>repo.context(i),
    obsidianStatus:unused,configureObsidian:unused,syncObsidian:unused,createPage:i=>pages.createPage(i),getPage:id=>pages.getPage(id),savePage:i=>pages.savePage(i),
    decideProposal:i=>pages.decideProposal(i),confirmPageBlock:i=>pages.confirmPageBlock(i),beginMaterial:unused,appendMaterial:unused,finishMaterial:unused,cancelMaterial:async()=>{},readMaterial:unused};
  return {repo,pages,view,api};
}
async function until(predicate:()=>boolean){const deadline=Date.now()+3000;while(!predicate()){if(Date.now()>deadline)throw new Error('state did not settle');await new Promise(r=>setTimeout(r,5));}}

test('three-way merge preserves remote-only reorder and exposes competing reorders',()=>{
  const base=content(['a','b','c']),mine={...base,title:'local title'},theirs=content(['c','a','b']);
  const merged=merge3(base,mine,theirs);assert.equal(merged.clashes.length,0);assert.deepEqual(merged.mine.blocks.map(b=>b.id),['c','a','b']);assert.equal(merged.mine.title,'local title');
  const both=merge3(base,content(['b','a','c']),theirs);assert.ok(both.clashes.some(c=>c.key==='order'));
  assert.deepEqual(both.mine.blocks.map(b=>b.id),['b','a','c']);assert.deepEqual(both.theirs.blocks.map(b=>b.id),['c','a','b']);
});

test('date deletion is authoritative; it never falls back to an earlier saved date',async()=>{
  const {view,repo}=await fixture();view.entity.data.date='2026-11-08';assert.equal(contentOf(view).experimentDate,'2026-11-08');
  delete view.entity.data.date;view.entity.data.experimentDate='2020-01-01';assert.equal(contentOf(view).experimentDate,null);await repo.close();
});

test('typing during a save retains the later input and saves it in a subsequent revision',async()=>{
  const {api,pages,view,repo}=await fixture(),gate=deferred<void>(),arrived=deferred<void>();let first=true;
  api.savePage=async input=>{const result=await pages.savePage(input);if(first){first=false;arrived.resolve();await gate.promise;}return result;};
  const c=new PageController(api,view.entity.id,view);c.edit(v=>({...v,blocks:[text('a','first input')]}));
  const saving=c.saveNowFromUser();await arrived.promise;c.edit(v=>({...v,blocks:[text('a','later input')]}));gate.resolve();await saving;
  assert.equal((c.getState().local.blocks[0] as {text:string}).text,'later input');assert.equal(c.getState().dirty,true);
  assert.equal(await c.flush(),true);assert.equal((await pages.getPage(view.entity.id)).entity.content,'later input');await repo.close();
});

test('failed save blocks acceptance and manual retries are bounded',async()=>{
  const {api,view,repo}=await fixture();let saves=0,decisions=0;
  api.savePage=async()=>{saves++;throw new TypeError('Failed to fetch');};api.decideProposal=async()=>{decisions++;return view;};
  const c=new PageController(api,view.entity.id,view);c.edit(v=>({...v,blocks:[text('a','keep me')]}));
  assert.equal(await c.saveNowFromUser(),false);assert.equal(saves,3);assert.equal(c.getState().dirty,true);
  assert.equal(await c.decide('proposal',['op'],'accept'),false);assert.equal(decisions,0);assert.equal(c.getState().local.blocks.length,1);await repo.close();
});

test('edits for identically named operations remain scoped to their own proposal',async()=>{
  const {api,pages,view,repo}=await fixture();let saved=await pages.savePage({id:view.entity.id,expectedRevision:view.entity.revision,requestId:'seed',title:'test',experimentDate:null,blocks:[text('source')]});
  const read=await pages.readForModel(view.entity.id);
  const proposal=async(requestId:string,blockId:string)=>pages.propose({id:view.entity.id,requestId,readIds:[read.readId],summary:'test',operations:[{id:'op1',action:'append',block:text(blockId),sources:[{snapshotId:read.blocks[0]!.id}],kind:'layout'}]});
  const a=await proposal('p1','out1'),b=await proposal('p2','out2');saved=await pages.getPage(view.entity.id);
  const c=new PageController(api,view.entity.id,saved);c.setReviewEdit(a.proposalId,'op1',text('out1','edited A'));c.setReviewEdit(b.proposalId,'op1',text('out2','edited B'));
  assert.equal(Object.keys(c.getState().reviewEdits).length,2);
  assert.equal(await c.decide(a.proposalId,['op1'],'accept'),true);
  assert.ok(c.getState().reviewEdits[reviewEditKey(b.proposalId,'op1')]);assert.equal(c.getState().reviewEdits[reviewEditKey(a.proposalId,'op1')],undefined);
  assert.equal((await pages.getPage(view.entity.id)).entity.content.includes('edited B'),false);
  assert.equal(await c.decide(b.proposalId,['op1'],'accept'),true);assert.match((await pages.getPage(view.entity.id)).entity.content,/edited A[\s\S]*edited B/);await repo.close();
});

test('uncertain upload cannot be matched to somebody else’s same-name same-size file',async()=>{
  const {api,pages,view,repo}=await fixture();let finishes=0;
  const material=(id:string):PageMaterial=>({id,requestId:id,name:'same.txt',mime:'text/plain',bytes:1,sha256:'a'.repeat(64),file:{attachmentId:`sha256:${'a'.repeat(64)}`,name:'same.txt',bytes:1},addedAt:new Date().toISOString()});
  api.beginMaterial=async()=>({uploadId:'this-upload',received:0,chunkBytes:256000});api.appendMaterial=async()=>({received:1});
  api.finishMaterial=async input=>{
    assert.equal(input.uploadId,'this-upload');finishes++;
    if(finishes===1){await pages.registerMaterial(view.entity.id,material('other-upload'));throw new TypeError('Failed to fetch');}
    return pages.registerMaterial(view.entity.id,material('actual-upload'));
  };
  const c=new PageController(api,view.entity.id,view);c.addFiles([new File(['a'],'same.txt',{type:'text/plain'})]);
  await until(()=>c.getState().uploads[0]?.stage==='failed');const item=c.getState().uploads[0]!;
  assert.equal(item.failedAt,'register');assert.equal(c.canReupload(item.key),true);assert.equal(finishes,1);
  c.retryUpload(item.key);await until(()=>c.getState().uploads[0]?.stage==='done');assert.equal(finishes,2);assert.equal((await pages.getPage(view.entity.id)).page.materials.length,2);await repo.close();
});

test('uncertain creation survives remount/project change and shares concurrent submissions',async()=>{
  const {api,pages,repo}=await fixture();const session=randomUUID(),seen:Parameters<ForestApi['createPage']>[0][]=[];let first=true;
  const project=await repo.create({kind:'project',title:'original project'});
  api.createPage=async input=>{seen.push(structuredClone(input));const result=await pages.createPage(input);if(first){first=false;throw new TypeError('Failed to fetch');}return result;};
  const a=beginPageCreation(api,session,project.id);await assert.rejects(a.result);
  const b=beginPageCreation(api,session,null),c=beginPageCreation(api,session,null);assert.equal(b.result,c.result);const created=await b.result;
  assert.deepEqual(seen[1],seen[0]);assert.equal(created.entity.projectId,project.id);
  assert.equal((await repo.list({kind:'record'})).filter(e=>e.projectId===project.id).length,1);
  clearPageCreation(session,a.input.requestId);await repo.close();
});

test('a multi-file batch waits for registration before starting the third upload',async()=>{
  const {api,view,repo}=await fixture(),gate=deferred<void>();let active=0,begun=0,peak=0;
  api.beginMaterial=async()=>{active++;peak=Math.max(peak,active);assert.ok(active<=2);return {uploadId:`upload-${++begun}`,received:0,chunkBytes:256000};};
  api.appendMaterial=async()=>({received:1});
  api.finishMaterial=async()=>{await gate.promise;active--;return view;};
  const c=new PageController(api,view.entity.id,view);
  c.addFiles([1,2,3].map(n=>new File(['a'],`batch-${n}.txt`,{type:'text/plain'})));
  await until(()=>c.getState().uploads.filter(u=>u.stage==='registering').length===2);
  assert.equal(begun,2);assert.equal(c.getState().uploads[2]?.stage,'queued');
  gate.resolve();await until(()=>c.getState().uploads.every(u=>u.stage==='done'));
  assert.equal(begun,3);assert.equal(peak,2);await repo.close();
});

test('uncommitted capture survives a page switch and is saved before the model reads',async()=>{
  const {api,view,pages,repo}=await fixture();
  const c=pageController(api,view.entity.id);await c.load();
  const release=c.subscribe(()=>{});
  const note='11:30 补记：B 需要复测，第三组数据待补。\n';
  c.setComposer(note);release();
  assert.equal(c.hasUnsaved(),true);assert.match(c.unsavedLabel()!.label,/待记下/);
  const reopened=pageController(api,view.entity.id);assert.equal(reopened,c);assert.equal(reopened.getState().composer,note);
  assert.equal(await reopened.prepareOrganize(),true);
  const read=await pages.readForModel(view.entity.id);
  assert.ok(read.blocks.some(b=>b.block.type==='text'&&b.block.text===note));
  assert.equal(c.getState().composer,'');assert.equal(c.hasUnsaved(),false);
  assert.equal(await c.prepareOrganize(),true);assert.equal((await pages.getPage(view.entity.id)).page.blocks.length,1);
  await repo.close();
});

test('capture at block limit stays intact and blocks AI instead of silently discarding it',async()=>{
  const {api,view,pages,repo}=await fixture();
  const full=await pages.savePage({id:view.entity.id,expectedRevision:view.entity.revision,requestId:'full',title:'full',experimentDate:null,
    blocks:Array.from({length:200},(_,i)=>text(`b${i}`))});
  const c=new PageController(api,view.entity.id,full);c.setComposer('keep original input\n');
  assert.equal(c.commitComposer(),false);assert.equal(await c.prepareOrganize(),false);
  assert.equal(c.getState().composer,'keep original input\n');assert.equal(c.getState().local.blocks.length,200);
  assert.match(c.getState().notice!.text,/200/);assert.equal((await pages.getPage(view.entity.id)).entity.revision,full.entity.revision);
  await repo.close();
});

test('input typed while preparing AI is retained and prevents a partial handoff',async()=>{
  const {api,pages,view,repo}=await fixture(),gate=deferred<void>(),arrived=deferred<void>();
  let first=true;api.savePage=async input=>{const saved=await pages.savePage(input);if(first){first=false;arrived.resolve();await gate.promise;}return saved;};
  const c=new PageController(api,view.entity.id,view);c.setComposer('before send');
  const preparing=c.prepareOrganize();await arrived.promise;c.setComposer('new observation during save');gate.resolve();
  assert.equal(await preparing,false);assert.equal(c.getState().composer,'new observation during save');assert.equal(c.hasUnsaved(),true);
  assert.equal(await c.prepareOrganize(),true);
  assert.deepEqual((await pages.getPage(view.entity.id)).page.blocks.map(b=>b.type==='text'?b.text:null),['before send','new observation during save']);
  await repo.close();
});

test('failed persistence retains committed capture and blocks the AI handoff',async()=>{
  const {api,pages,view,repo}=await fixture();api.savePage=async()=>{throw new TypeError('offline');};
  const c=new PageController(api,view.entity.id,view);c.setComposer('must remain available');
  assert.equal(await c.prepareOrganize(),false);assert.equal(c.getState().dirty,true);assert.equal(c.hasUnsaved(),true);
  assert.equal((c.getState().local.blocks[0] as {text:string}).text,'must remain available');
  api.savePage=i=>pages.savePage(i);assert.equal(await c.saveNowFromUser(),true);
  assert.equal((await pages.getPage(view.entity.id)).page.blocks.length,1);await repo.close();
});

test('AI preparation waits for chosen materials and preserves TSV missing-value distinctions',async()=>{
  const {api,pages,view,repo}=await fixture(),gate=deferred<void>();
  api.beginMaterial=async()=>{await gate.promise;return {uploadId:'material',received:0,chunkBytes:256000};};
  api.appendMaterial=async()=>({received:1});api.finishMaterial=async()=>view;
  const c=new PageController(api,view.entity.id,view);c.addFiles([new File(['a'],'sample.txt',{type:'text/plain'})]);
  c.setComposer('样品\t读数\nA\t0\nB\tND\nC\t\n');
  assert.equal(await c.prepareOrganize(),false);assert.match(c.getState().notice!.text,/上传或登记/);
  assert.ok(c.getState().composer.length);gate.resolve();await until(()=>c.getState().uploads.every(u=>u.stage==='done'));
  assert.equal(await c.prepareOrganize(),true);
  const table=(await pages.getPage(view.entity.id)).page.blocks[0]!;assert.equal(table.type,'table');
  if(table.type==='table') assert.deepEqual(table.rows.map(r=>r.cells[table.columns[1]!.id]),['0','ND','']);
  await repo.close();
});
