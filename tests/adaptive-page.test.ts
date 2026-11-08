import assert from 'node:assert/strict';
import {test,type TestContext} from 'node:test';
import {randomUUID} from 'node:crypto';
import {mkdtemp,realpath,mkdir,readFile,writeFile,rm,readdir,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Context} from '@deepseek-ai/cordis';
import LocalAttachments from '@deepseek-ai/dsh-attachment-local';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import Tools from '@deepseek-ai/dsh-tools';
import * as NativeExecutor from '@deepseek-ai/dsh-tool-executor-native';
import type {ToolCallId} from '@deepseek-ai/dsh-llm';
import type {Agent} from '@deepseek-ai/dsh-agent';
import {ForestRepository} from '../plugin/domain';
import {PageRepository,plainBlock} from '../plugin/pages';
import {MaterialRepository,type MaterialRegistryPort} from '../plugin/materials';
import {registerForestTools} from '../plugin/tools';
import {ObsidianMirrorSync} from '../plugin/obsidian-sync';
import {materialMirrorPath,createObsidianMirror} from '../shared/obsidian';
import {buildAgenda} from '../shared/workflow';
import {getExperimentPage,pastedBlock,pageSchema,MATERIAL_CHUNK_BYTES,type PageView,type PageBlockInput} from '../shared/page';
import type {ForestState} from '../shared/model';

async function fixture(t:TestContext) {
  const root=await realpath(await mkdtemp(join(tmpdir(),'forest-adaptive-')));
  const ctx=new Context();await ctx.plugin(LocalAttachments,{dshHome:join(root,'harness')});
  await ctx.plugin(SystemPrompt);await ctx.plugin(Tools);await ctx.plugin(NativeExecutor);
  let state:ForestState|null=null;let registry:Awaited<ReturnType<MaterialRegistryPort['read']>>={entries:[]};
  const port:MaterialRegistryPort={read:async()=>structuredClone(registry),write:async next=>{registry=structuredClone(next);}};
  const repo=new ForestRepository({read:async()=>structuredClone(state),write:async next=>{state=structuredClone(next);}});
  const pages=new PageRepository(repo),materials=new MaterialRepository(pages,ctx.attachments,port);
  registerForestTools(ctx,repo,pages,materials);
  const view=await pages.createPage({requestId:randomUUID(),title:'软件验收：混合实验记录'});
  const vault=join(root,'vault');await mkdir(join(vault,'.obsidian'),{recursive:true});
  const mirror=new ObsidianMirrorSync({vaultPath:vault,folderName:'Experiment Forest-aabbccdd',readMaterial:(id,m)=>materials.original(id,m)});
  t.after(async()=>{await materials.close();await repo.close();await mirror.close();await ctx.fiber.dispose();await rm(root,{recursive:true,force:true});});
  async function tool(name:string,args:unknown,agent?:Agent) {
    const result=await ctx.tools.execute({calls:[{type:'tool-call',id:randomUUID() as ToolCallId,name,arguments:JSON.stringify(args)}],signal:new AbortController().signal,...(agent?{agent}:{})});
    return result.results[0]!.result;
  }
  return {root,ctx,repo,pages,materials,port,view,vault,mirror,tool};
}
async function save(pages:PageRepository,view:PageView,blocks:PageBlockInput[],title=view.entity.title) {
  return pages.savePage({id:view.entity.id,expectedRevision:view.entity.revision,requestId:randomUUID(),title,experimentDate:null,blocks});
}
async function upload(materials:MaterialRepository,id:string,data:Buffer,name='raw.csv',mime='text/csv') {
  const begin=await materials.beginMaterial({id,requestId:randomUUID(),name,mime,bytes:data.length});
  for(let offset=0;offset<data.length;offset+=MATERIAL_CHUNK_BYTES)await materials.appendMaterial({uploadId:begin.uploadId,offset,data:data.subarray(offset,offset+MATERIAL_CHUNK_BYTES).toString('base64')});
  return {begin,view:await materials.finishMaterial(begin)};
}
const textBlock=(text:string,id='observation'):PageBlockInput=>({id,type:'text',text});

test('free mixed pages preserve literal TSV, blank date, revisions and immutable first input',async t=>{
  const {pages,repo,view}=await fixture(t);
  assert.equal(view.entity.data.date,undefined);
  const pasted=pastedBlock('样本\t数值\nA\t0\nB\t\nC\tND\n',()=>randomUUID());
  assert.equal(pasted.type,'table');
  let saved=await save(pages,view,[textBlock('未预设实验结构'),pasted]);
  const first=structuredClone(saved.page.snapshots);
  saved=await save(pages,saved,[textBlock('后来补写的观测'),pasted]);
  assert.deepEqual(saved.page.snapshots.slice(0,2),first);
  assert.equal(saved.page.blocks[0]!.version,2);assert.equal(pageSchema.safeParse(saved.page).success,true);
  const mirror=createObsidianMirror(await repo.snapshot());
  const note=mirror.files.find(f=>f.path.startsWith('entities/'))!.content;
  assert.match(note,/\| A \| 0 \|/);assert.match(note,/\| B \|  \|/);assert.match(note,/\| C \| ND \|/);
  assert.equal(pastedBlock('a\tb\nc',()=>randomUUID()).type,'text');
  await assert.rejects(pages.savePage({id:saved.entity.id,expectedRevision:1,requestId:randomUUID(),title:'stale',experimentDate:null,blocks:[]}),/已更新/);
  assert.throws(()=>pages.savePage({id:saved.entity.id,expectedRevision:saved.entity.revision,requestId:randomUUID(),title:'invalid',experimentDate:'2026-02-30',blocks:[]}),/日期/);
});

test('idempotent create/save retries and generic CRUD cannot bypass the page transaction',async t=>{
  const {pages,repo,view}=await fixture(t);
  const request={requestId:'duplicate-create',title:'once'};
  const results=await Promise.all([pages.createPage(request),pages.createPage(request)]);assert.equal(results[0]!.entity.id,results[1]!.entity.id);
  await assert.rejects(pages.createPage({...request,title:'different'}),/标识/);
  const input={id:view.entity.id,expectedRevision:view.entity.revision,requestId:'save-once',title:'once',experimentDate:null,blocks:[textBlock('literal')]};
  const a=await pages.savePage(input),b=await pages.savePage(input);assert.deepEqual(a,b);
  await assert.rejects(pages.savePage({...input,blocks:[]}),/标识/);
  await assert.rejects(repo.update({id:a.entity.id,expectedRevision:a.entity.revision,patch:{content:'bypass'}}),/实验页/);
  await assert.rejects(repo.create({kind:'record',title:'forged',data:{forestPage:a.entity.data.forestPage!}}),/实验页/);
});

test('native model pipeline reads real sources, proposes, then human partially edits and accepts',async t=>{
  const {pages,view,tool}=await fixture(t);
  const saved=await save(pages,view,[textBlock('样本 A：0.48；时间待核对')]);
  const read=await tool('forest_page_read',{id:saved.entity.id});if(read.isError)assert.fail(read.error.message);
  const r=read.value as {readId:string;blocks:{id:string}[]};
  const operations=[{id:'layout',action:'replace',targetBlockId:'observation',block:textBlock('样本 A：0.48\n时间：待核对'),sources:[{snapshotId:r.blocks[0]!.id,quote:'0.48'}],kind:'layout'},
    {id:'inference',action:'append',block:textBlock('可能需要补充重复次数','hypothesis'),sources:[{snapshotId:r.blocks[0]!.id}],kind:'infer'}];
  const proposed=await tool('forest_page_propose',{id:saved.entity.id,requestId:'native-proposal',readIds:[r.readId],summary:'只整理已提供的观测',operationsJson:JSON.stringify(operations)});
  if(proposed.isError)assert.fail(proposed.error.message);
  assert.equal((await pages.getPage(saved.entity.id)).entity.content,saved.entity.content);
  const proposalId=(proposed.value as {proposalId:string}).proposalId;
  const accepted=await pages.decideProposal({id:saved.entity.id,proposalId,requestId:'accept-one',operationIds:['layout'],decision:'accept',replacements:[{operationId:'layout',block:textBlock('样本 A：0.48\n时间待核对（人工调整排版）')}]});
  assert.equal(accepted.page.blocks[0]!.author,'ai-user-edited');assert.equal(accepted.page.blocks[0]!.pendingReview,true);
  assert.equal(accepted.page.proposals[0]!.operations[1]!.status,'pending');assert.equal(accepted.page.snapshots[0]!.block.type,'text');
  const rejected=await pages.decideProposal({id:saved.entity.id,proposalId,requestId:'reject-two',operationIds:['inference'],decision:'reject'});
  assert.equal(rejected.entity.revision,accepted.entity.revision);
  assert.equal(rejected.page.blocks.length,1);
  const confirmed=await pages.confirmPageBlock({id:saved.entity.id,expectedRevision:rejected.entity.revision,blockId:'observation'});
  assert.equal(confirmed.page.blocks[0]!.pendingReview,false);assert.ok(confirmed.page.blocks[0]!.confirmedAt);
});

test('AI read races cannot overwrite later observations or cite fabricated/unread sources',async t=>{
  const {pages,view}=await fixture(t);let current=await save(pages,view,[textBlock('first')]);
  const read=await pages.readForModel(view.entity.id);
  const p={id:view.entity.id,requestId:'p1',readIds:[read.readId],summary:'layout',operations:[{id:'op1',action:'replace' as const,targetBlockId:'observation',block:textBlock('layout'),sources:[{snapshotId:read.blocks[0]!.id}],kind:'layout' as const}]};
  await assert.rejects(pages.propose({...p,operations:[{...p.operations[0]!,sources:[{snapshotId:'invented'}]}]}),/未读取/);
  await assert.rejects(pages.propose({...p,operations:[{...p.operations[0]!,sources:[{snapshotId:read.blocks[0]!.id,quote:'invented fact'}]}]}),/引用文字/);
  const proposal=await pages.propose(p);
  current=await save(pages,current,[textBlock('later actual observation')]);
  await assert.rejects(pages.decideProposal({id:view.entity.id,proposalId:proposal.proposalId,requestId:'accept-stale',operationIds:['op1'],decision:'accept'}),/已被修改/);
  assert.equal((await pages.getPage(view.entity.id)).entity.content,'later actual observation');
  const abort=new AbortController();abort.abort();await assert.rejects(pages.propose({...p,requestId:'cancelled'},abort.signal));
});

test('chunk retries, durable finish and concurrent body save keep one byte-exact material',async t=>{
  const {materials,pages,view}=await fixture(t),data=Buffer.from('sample,reading\nA,0.48\nB,\nC,ND\n');
  const args={id:view.entity.id,requestId:'upload-once',name:'raw.csv',mime:'text/csv',bytes:data.length};
  const begin=await materials.beginMaterial(args),chunk={uploadId:begin.uploadId,offset:0,data:data.toString('base64')};
  await materials.appendMaterial(chunk);await materials.appendMaterial(chunk);
  await assert.rejects(materials.appendMaterial({...chunk,data:Buffer.from('changed').toString('base64')}),/不一致/);
  await save(pages,view,[textBlock('typing during upload')]);
  const saved=await materials.finishMaterial(begin),retried=await materials.finishMaterial(begin);
  assert.equal(saved.page.materials.length,1);assert.deepEqual(retried,saved);assert.match(saved.entity.content,/typing during upload/);
  assert.deepEqual(await materials.original(view.entity.id,saved.page.materials[0]!.id),data);
  assert.equal((await materials.beginMaterial(args)).received,data.length);
  const receipt=await materials.modelText(view.entity.id,saved.page.materials[0]!.id);assert.equal(receipt.text,data.toString());
});

test('profile-bound registry rejects forged/imported attachment references and unsupported AI formats',async t=>{
  const {materials,pages,repo,port,ctx,view}=await fixture(t);
  const uploaded=await upload(materials,view.entity.id,Buffer.from([0,255,1,2,3]),'recording.mp4','video/mp4');
  const id=uploaded.view.page.materials[0]!.id;
  await assert.rejects(materials.modelText(view.entity.id,id),/当前不解析/);
  const other=await pages.createPage({requestId:'other-record'});
  await assert.rejects(materials.original(other.entity.id,id),/未在当前配置登记/);
  const emptyRegistry=new MaterialRepository(pages,ctx.attachments,{read:async()=>({entries:[]}),write:async()=>{}});
  await assert.rejects(emptyRegistry.original(view.entity.id,id),/JSON 备份/);await emptyRegistry.close();
  const freshRepo=new ForestRepository({read:async()=>null,write:async()=>{}});
  await freshRepo.import({data:await repo.export(),expectedRevision:0});
  assert.equal(getExperimentPage((await freshRepo.get(view.entity.id))!)!.materials.length,1);await freshRepo.close();
  assert.equal((await port.read()).entries.length,1);
});

test('model cannot propose from filenames; actual material reads enable pending extracted blocks',async t=>{
  const {materials,pages,view}=await fixture(t);
  const uploaded=await upload(materials,view.entity.id,Buffer.from('sample,reading\nA,0.48\n'));
  const material=uploaded.view.page.materials[0]!,read=await pages.readForModel(view.entity.id);
  const op={id:'extracted',action:'append' as const,block:textBlock('A 0.48','extracted'),sources:[{materialId:material.id}],kind:'extract' as const};
  const p={id:view.entity.id,requestId:'extract-proposal',readIds:[read.readId],summary:'read a file',operations:[op]};
  await assert.rejects(pages.propose(p),/仅查看文件名/);
  const actual=await materials.modelText(view.entity.id,material.id);
  const proposal=await pages.propose({...p,readIds:[actual.readId]});
  const accepted=await pages.decideProposal({id:view.entity.id,proposalId:proposal.proposalId,requestId:'accept-extraction',operationIds:[op.id],decision:'accept'});
  assert.equal(accepted.page.blocks.at(-1)!.pendingReview,true);
});

test('actual image normalization preserves original bytes and no vision route gives no fake receipt',async t=>{
  const {materials,view,pages,tool}=await fixture(t);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWNgZGIGAAAOAAeCcsnOAAAAAElFTkSuQmCC','base64');
  const uploaded=await upload(materials,view.entity.id,png,'photo.png','image/png'),m=uploaded.view.page.materials[0]!;
  assert.ok(m.preview, m.previewError);assert.deepEqual(await materials.original(view.entity.id,m.id),png);
  const failed=await tool('forest_page_material_image',{id:view.entity.id,materialId:m.id});assert.equal(failed.isError,true);
  assert.equal((await pages.getPage(view.entity.id)).page.receipts.length,0);
  const delivered=await materials.modelImage(view.entity.id,m.id);assert.equal(delivered.image.width,1);
  assert.equal((await pages.getPage(view.entity.id)).page.receipts[0]!.materials[0]!.mode,'preview-image');
});

test('Obsidian mirrors body, real bytes, sources and pending labels; preserves edited/deleted materials',async t=>{
  const {materials,pages,view,repo,mirror,vault}=await fixture(t);
  await save(pages,view,[textBlock('自由正文 <script>not executable</script>')]);
  const data=Buffer.from([0,255,127,254,13,10]);
  const uploaded=await upload(materials,view.entity.id,data,'a video.mp4','video/mp4'),m=uploaded.view.page.materials[0]!;
  const result=await mirror.sync(await repo.snapshot());assert.equal(result.status,'synced');assert.deepEqual(result.materials,{total:1,mirrored:1,issues:[]});
  const root=join(vault,'Experiment Forest-aabbccdd'),material=join(root,materialMirrorPath(m));
  assert.deepEqual(await readFile(material),data);
  const noteFile=(await readdir(join(root,'entities')))[0]!;
  let note=await readFile(join(root,'entities',noteFile),'utf8');assert.match(note,/!\[\[Experiment Forest-aabbccdd\/materials\//);assert.match(note,/&lt;script&gt;/);assert.doesNotMatch(note,/\/Users\//);
  assert.equal((await mirror.sync(await repo.snapshot())).written,0);
  await writeFile(material,Buffer.from('user edit'));const conflict=await mirror.sync(await repo.snapshot());
  assert.equal(conflict.status,'conflict');assert.equal(conflict.materials!.issues[0]!.state,'conflict');assert.equal(await readFile(material,'utf8'),'user edit');
  note=await readFile(join(root,'entities',noteFile),'utf8');assert.match(note,/未覆盖/);assert.doesNotMatch(note,/!\[\[.*materials/);
  await unlink(material);const missing=await mirror.sync(await repo.snapshot());assert.equal(missing.status,'conflict');await assert.rejects(readFile(material));
});

test('interrupted binary mirror transaction recovers asset ownership before retry',async t=>{
  const {materials,view,repo,mirror,vault}=await fixture(t);
  const uploaded=await upload(materials,view.entity.id,Buffer.from([128,255,0,253]),'raw.bin','application/octet-stream');
  const actual=mirror as unknown as {atomicWrite:(path:string,content:string|Buffer,expected:string|Buffer|null)=>Promise<void>};
  const write=actual.atomicWrite.bind(mirror);let once=true;
  actual.atomicWrite=async(filename,content,expected)=>{if(once&&filename.endsWith('/Index.md')){once=false;throw new Error('simulated interruption after binary publication');}return write(filename,content,expected);};
  await assert.rejects(mirror.sync(await repo.snapshot()),/write failed/);
  assert.deepEqual(await readFile(join(vault,'Experiment Forest-aabbccdd',materialMirrorPath(uploaded.view.page.materials[0]!))),Buffer.from([128,255,0,253]));
  const recovered=await mirror.sync(await repo.snapshot());assert.equal(recovered.status,'synced');assert.equal(recovered.materials!.mirrored,1);
  assert.equal((await mirror.sync(await repo.snapshot())).written,0);
});

test('missing Host material becomes an explicit mirror issue instead of a successful broken embed',async t=>{
  const {materials,view,repo,vault}=await fixture(t);
  await upload(materials,view.entity.id,Buffer.from('saved'),'raw.txt','text/plain');
  const missing=new ObsidianMirrorSync({vaultPath:vault,folderName:'Experiment Forest-deadbeef',readMaterial:async()=>{throw new Error('原始材料缺失');}});t.after(()=>missing.close());
  const result=await missing.sync(await repo.snapshot());assert.equal(result.status,'conflict');assert.equal(result.materials!.mirrored,0);
  const dir=join(vault,'Experiment Forest-deadbeef','entities');const note=await readFile(join(dir,(await readdir(dir))[0]!),'utf8');
  assert.match(note,/原始材料缺失/);assert.doesNotMatch(note,/!\[\[.*materials/);
});

test('confirmed AI content becomes pending again after editing and cannot complete without review',async t=>{
  const {pages,view,repo}=await fixture(t);const saved=await save(pages,view,[textBlock('a')]);
  const read=await pages.readForModel(saved.entity.id);
  const proposal=await pages.propose({id:saved.entity.id,requestId:'pending-p',readIds:[read.readId],summary:'layout',operations:[{id:'op',action:'replace',targetBlockId:'observation',block:textBlock('a\n'),sources:[{snapshotId:read.blocks[0]!.id}],kind:'layout'}]});
  let current=await pages.decideProposal({id:saved.entity.id,proposalId:proposal.proposalId,requestId:'pending-a',operationIds:['op'],decision:'accept'});
  await assert.rejects(repo.update({id:current.entity.id,expectedRevision:current.entity.revision,patch:{status:'completed'}}),/尚待人工核对/);
  assert.equal(buildAgenda([current.entity],{today:'2026-11-08'}).review[0]!.id,current.entity.id);
  current=await pages.confirmPageBlock({id:current.entity.id,expectedRevision:current.entity.revision,blockId:'observation'});
  current=await save(pages,current,[textBlock('edited after checking')]);assert.equal(current.page.blocks[0]!.pendingReview,true);assert.equal(current.page.blocks[0]!.confirmedAt,undefined);
});


test('native vision pipeline returns actual image blocks only for the resolved capable route',async t=>{
  const {ctx,materials,view,pages,tool}=await fixture(t);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWNgZGIGAAAOAAeCcsnOAAAAAElFTkSuQmCC','base64');
  const uploaded=await upload(materials,view.entity.id,png,'native.png','image/png'),m=uploaded.view.page.materials[0]!;
  const routes:string[]=[];
  ctx.provide('llm',{resolveModelInfo:async(provider:string,model:string)=>{routes.push(`${provider}/${model}`);return {inputModalities:model==='vision'?['text','image']:['text']};}} as unknown as Context['llm']);
  const agent=(model:string)=>({session:{requestHeader:()=>({config:{provider:'synthetic-provider',model}})},options:{provider:'wrong-default',model:'wrong-default'}} as unknown as Agent);
  const refused=await tool('forest_page_material_image',{id:view.entity.id,materialId:m.id},agent('text-only'));
  assert.equal(refused.isError,true);assert.equal((await pages.getPage(view.entity.id)).page.receipts.length,0);
  const delivered=await tool('forest_page_material_image',{id:view.entity.id,materialId:m.id},agent('vision'));
  if(delivered.isError)assert.fail(delivered.error.message);
  assert.deepEqual(routes,['synthetic-provider/text-only','synthetic-provider/vision']);
  assert.equal(delivered.content[1]!.type,'image');
  const image=delivered.content[1];if(image?.type!=='image')assert.fail('image block missing');
  assert.equal(image.attachment.attachmentId,m.preview!.attachmentId);
  assert.equal((await pages.getPage(view.entity.id)).page.receipts.length,1);
});
