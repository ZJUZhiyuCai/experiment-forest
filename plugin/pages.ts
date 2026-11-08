import { randomUUID, createHash } from 'node:crypto';
import type { z } from 'zod';
import type { ForestEntity, Json } from '../shared/model';
import { PAGE_FORMAT, PAGE_KEY, blockInputSchema, createPageSchema, savePageSchema, proposePageSchema, decideProposalSchema,
  pageText, getExperimentPage, type ExperimentPage, type PageBlock, type PageBlockInput, type PageView, type PageMaterial,
  type PageSource, type PageReadReceipt } from '../shared/page';
import { ForestRepository } from './domain';
import { ForestError, canonical, json, date } from './migration';

const copy = <T>(v:T):T => structuredClone(v);
const now = () => new Date().toISOString();
function fail(message:string, code:ForestError['code']='invalid'):never { throw new ForestError(code,message); }
function parse<T>(schema:z.ZodType<T>, value:unknown):T {
  const result=schema.safeParse(value); return result.success ? result.data : fail(result.error.issues[0]?.message ?? '实验页请求无效');
}
const hash = (v:unknown) => createHash('sha256').update(canonical(json(v))).digest('hex');
export function plainBlock(b:PageBlockInput):PageBlockInput {
  const {id,type}=b;
  if(type==='text'||type==='heading')return {id,type,text:b.text};
  if(type==='media')return {id,type,materialId:b.materialId,caption:b.caption};
  return {id,type,columns:copy(b.columns),rows:copy(b.rows),...(b.note!==undefined?{note:b.note}:{}),...(b.raw!==undefined?{raw:b.raw}:{})};
}
function emptyPage():ExperimentPage {
  return {format:PAGE_FORMAT,version:1,blocks:[],materials:[],snapshots:[],receipts:[],proposals:[],requests:[]};
}
function snapshot(page:ExperimentPage, block:PageBlock) {
  if (!page.snapshots.some(s=>s.blockId===block.id && s.version===block.version)) {
    page.snapshots.push({id:randomUUID(),blockId:block.id,version:block.version,at:now(),block:plainBlock(block)});
  }
}
function load(entity:ForestEntity):ExperimentPage {
  const existing=getExperimentPage(entity);
  if(existing) {
    if(!Array.isArray(existing.blocks)||!Array.isArray(existing.materials)||!Array.isArray(existing.snapshots)||!Array.isArray(existing.receipts)||!Array.isArray(existing.proposals)||!Array.isArray(existing.requests)) fail('实验页结构无效，请保留备份');
    return copy(existing);
  }
  if(entity.data[PAGE_KEY]!==undefined)fail('无法识别此版本的实验页，原数据未修改');
  const p=emptyPage();
  if(entity.content) {
    const ai=(entity.data.provenance as Record<string,Json> | undefined)?.source==='deepseek-harness';
    p.blocks.push({id:'legacy-body',type:'text',text:entity.content,version:1,author:ai?'ai':'user',sources:[],pendingReview:!!ai});
    snapshot(p,p.blocks[0]!);
  }
  return p;
}
function view(entity:ForestEntity,page:ExperimentPage):PageView { return copy({entity,page}); }
function save(entity:ForestEntity,page:ExperimentPage, body:boolean):ForestEntity {
  const e={...entity,data:{...entity.data,[PAGE_KEY]:json(page)},...(body?{...(page.blocks.some(b=>b.pendingReview)?{status:'draft'}:{}),content:pageText(page.blocks),revision:entity.revision+1,updatedAt:now()}:{})};
  return e;
}
function requestSeen(page:ExperimentPage,id:string,value:unknown) {
  const previous=page.requests.find(r=>r.id===id);
  if(previous && previous.hash!==hash(value))fail('同一请求标识不能用于不同内容','conflict');
  return !!previous;
}
function remember(page:ExperimentPage,id:string,value:unknown) {
  page.requests.push({id,hash:hash(value)}); if(page.requests.length>200)page.requests.splice(page.requests[0]?.id===page.creationRequestId?1:0,1);
}
function validateBlocks(blocks:PageBlockInput[],page:ExperimentPage) {
  const ids=new Set<string>();
  for(const b of blocks) {
    if(ids.has(b.id))fail('块 ID 重复');ids.add(b.id);
    if(b.type==='media' && !page.materials.some(m=>m.id===b.materialId))fail('材料尚未登记到此实验页');
    if(b.type==='table') {
      if(new Set(b.columns.map(c=>c.id)).size!==b.columns.length || new Set(b.rows.map(r=>r.id)).size!==b.rows.length)fail('表格行列 ID 重复');
      if(b.rows.some(r=>Object.keys(r.cells).some(k=>!b.columns.some(c=>c.id===k))))fail('表格包含未声明的列');
    }
  }
}
/** Immutable first/latest/read snapshots; unreferenced intermediate autosaves are bounded. */
function trim(page:ExperimentPage) {
  const pinned=new Set(page.receipts.flatMap(r=>r.snapshots));
  for(const p of page.proposals)for(const op of p.operations)for(const source of op.sources)if(source.snapshotId)pinned.add(source.snapshotId);
  const byBlock=new Map<string,typeof page.snapshots>();
  for(const s of page.snapshots)byBlock.set(s.blockId,[...(byBlock.get(s.blockId)??[]),s]);
  for(const values of byBlock.values())for(const s of [values[0]!,...values.slice(-10)])pinned.add(s.id);
  page.snapshots=page.snapshots.filter(s=>pinned.has(s.id));
}

/** All mutations share the record transaction queue, including AI tools and UI RPCs. */
export class PageRepository {
  private creations:Promise<unknown>=Promise.resolve();
  constructor(readonly repository:ForestRepository) {}
  async getPage(id:string):Promise<PageView> {
    const entity=await this.repository.get(id);
    if(!entity || entity.kind!=='record')return fail('实验页不存在','not-found');
    return view(entity,load(entity));
  }
  createPage(input:z.infer<typeof createPageSchema>):Promise<PageView> {
    const r=parse(createPageSchema,input);
    const work=this.creations.then(async()=>{
      const previous=(await this.repository.list({kind:'record',includeArchived:true})).find(e=>getExperimentPage(e)?.creationRequestId===r.requestId);
      if(previous){const p=load(previous);requestSeen(p,r.requestId,r);return view(previous,p);}
      const p=emptyPage();p.creationRequestId=r.requestId;remember(p,r.requestId,r);
      const entity=await this.repository.create({kind:'record',title:r.title?.trim()||'未命名实验',...(r.projectId?{projectId:r.projectId}:{}),data:{[PAGE_KEY]:json(p)}},undefined,true);
      return view(entity,p);
    });this.creations=work.catch(()=>undefined);return work;
  }
  savePage(input:z.infer<typeof savePageSchema>):Promise<PageView> {
    const r=parse(savePageSchema,input);
    if(r.experimentDate)date(r.experimentDate,'实验日期');
    return this.repository.mutatePage(r.id,entity=>{
      const p=load(entity);
      if(requestSeen(p,r.requestId,r))return {entity,result:view(entity,p),changed:false};
      if(entity.revision!==r.expectedRevision)fail('实验页已更新；本地输入仍保留，请核对最新内容','conflict');
      validateBlocks(r.blocks,p);
      p.blocks=r.blocks.map(input=>{
        const prior=p.blocks.find(b=>b.id===input.id);
        if(prior && hash(plainBlock(prior))===hash(input))return prior;
        const maxVersion=Math.max(0,...p.snapshots.filter(s=>s.blockId===input.id).map(s=>s.version));
        const b:PageBlock={...copy(input),version:maxVersion+1,author:prior?.author==='ai'||prior?.author==='ai-user-edited'?'ai-user-edited':'user',
          sources:copy(prior?.sources??[]),pendingReview:prior?.author==='ai'||prior?.author==='ai-user-edited'?true:prior?.pendingReview??false};
        snapshot(p,b);return b;
      });
      remember(p,r.requestId,r);trim(p);
      let e=save(entity,p,true);e.title=r.title;
      if(r.experimentDate)e.data.date=r.experimentDate;else delete e.data.date;
      return {entity:e,result:view(e,p)};
    });
  }
  registerMaterial(id:string,material:PageMaterial):Promise<PageView> {
    return this.repository.mutatePage(id,entity=>{
      const p=load(entity);
      if(p.materials.some(m=>m.requestId===material.requestId))return {entity,result:view(entity,p),changed:false};
      if(p.materials.length>=100 || p.blocks.length>=200)fail('此页材料或块数量已达上限');
      p.materials.push(copy(material));
      const b:PageBlock={id:randomUUID(),type:'media',materialId:material.id,caption:'',version:1,author:'user',sources:[],pendingReview:false};
      p.blocks.push(b);snapshot(p,b);const e=save(entity,p,true);return {entity:e,result:view(e,p)};
    });
  }
  confirmPageBlock(input:{id:string;expectedRevision:number;blockId:string}):Promise<PageView> {
    return this.repository.mutatePage(input.id,entity=>{
      if(entity.revision!==input.expectedRevision)fail('记录已更新，请重新核对','conflict');
      const p=load(entity),block=p.blocks.find(b=>b.id===input.blockId);
      if(!block)fail('块不存在','not-found');
      block.pendingReview=false;block.confirmedAt=now();const e=save(entity,p,true);return {entity:e,result:view(e,p)};
    });
  }
  async readForModel(id:string) {
    return this.repository.mutatePage(id,entity=>{
      const p=load(entity);for(const b of p.blocks)snapshot(p,b);
      const included:typeof p.snapshots=[];let chars=0;
      for(const b of p.blocks) {
        const s=p.snapshots.find(s=>s.blockId===b.id&&s.version===b.version)!;
        const size=JSON.stringify(s).length;if(chars+size>40_000)break;included.push(s);chars+=size;
      }
      const receipt:PageReadReceipt={id:randomUUID(),at:now(),snapshots:included.map(s=>s.id),truncated:included.length<p.blocks.length,
        materials:p.materials.map(m=>({id:m.id,mode:'metadata-only',detail:'仅材料名称/类型/大小；未读取内容'}))};
      if(p.receipts.length>=100)fail('此页模型读取记录已达上限，请创建新的实验页');
      p.receipts.push(receipt);const e=save(entity,p,false);
      return {entity:e,result:{id,revision:entity.revision,title:entity.title,readId:receipt.id,truncated:receipt.truncated,
        blocks:included,materials:p.materials.map(({id,name,mime,bytes,preview})=>({id,name,mime,bytes,imageReadable:!!preview})),
        note:'readId 记录 Host 读取与准备提供的范围，不证明模型理解或最终接收。每个提案都引用这里的 snapshotId 或已实际读取的 materialId；不得补造数值、时间、单位或归属。'}};
    });
  }
  recordMaterialRead(id:string,materialId:string,mode:'text'|'preview-image',detail:string,truncated=false):Promise<string> {
    return this.repository.mutatePage(id,entity=>{
      const p=load(entity);if(!p.materials.some(m=>m.id===materialId))fail('材料不存在');
      if(p.receipts.length>=100)fail('此页模型读取记录已达上限');
      const receipt:PageReadReceipt={id:randomUUID(),at:now(),snapshots:[],materials:[{id:materialId,mode,detail}],truncated};
      p.receipts.push(receipt);return {entity:save(entity,p,false),result:receipt.id};
    });
  }
  propose(input:z.infer<typeof proposePageSchema>,signal?:AbortSignal):Promise<{proposalId:string}> {
    const r=parse(proposePageSchema,input);
    return this.repository.mutatePage(r.id,entity=>{
      const p=load(entity);
      if(requestSeen(p,r.requestId,r))return {entity,result:{proposalId:p.proposals.find(p=>p.requestId===r.requestId)!.id},changed:false};
      if(p.proposals.length>=30)fail('此页提案已达上限，请先整理为新的实验页');
      if(new Set(r.operations.map(o=>o.block.id)).size!==r.operations.length)fail('一份提案不能多次修改同一块');
      if(new Set(r.operations.map(o=>o.id)).size!==r.operations.length)fail('提案操作 ID 重复');
      const receipts=r.readIds.map(id=>p.receipts.find(r=>r.id===id)??fail('读取凭据不存在或不属于此页'));
      const allowedSnapshots=new Set(receipts.flatMap(r=>r.snapshots));
      const allowedMaterials=new Set(receipts.flatMap(r=>r.materials.filter(m=>m.mode!=='metadata-only').map(m=>m.id)));
      const operations=r.operations.map(op=>{
        validateBlocks([op.block],p);
        const sourceVersions:Record<string,number>={};
        for(const s of op.sources) {
          if(s.snapshotId) {
            if(!allowedSnapshots.has(s.snapshotId))fail('提案引用了未读取的快照');
            const snap=p.snapshots.find(x=>x.id===s.snapshotId)??fail('引用快照不存在');
            if(s.quote && !JSON.stringify(snap.block).includes(s.quote) && !pageText([snap.block]).includes(s.quote))fail('引用文字不在快照中');
            if((s.rowId||s.columnId) && (snap.block.type!=='table' || s.rowId&&!snap.block.rows.some(r=>r.id===s.rowId) || s.columnId&&!snap.block.columns.some(c=>c.id===s.columnId)))fail('引用的单元格不存在');
            if(sourceVersions[snap.blockId] && sourceVersions[snap.blockId]!==snap.version)fail('不能混用同一块的不同版本');
            sourceVersions[snap.blockId]=snap.version;
          } else {
            if(!allowedMaterials.has(s.materialId!))fail('提案引用了仅查看文件名或未读取的材料');
            if(s.quote||s.rowId||s.columnId)fail('材料来源请引用 materialId；逐字/单元格引用仅适用于正文快照');
          }
        }
        const target=op.targetBlockId?p.blocks.find(b=>b.id===op.targetBlockId):undefined;
        if(op.action==='replace' && (!target || op.block.id!==target.id))fail('替换目标或块 ID 不匹配');
        if(op.action==='append' && (op.targetBlockId || p.blocks.some(b=>b.id===op.block.id)))fail('新增块 ID 已存在');
        if(target && sourceVersions[target.id]!==target.version)fail('替换目标须引用当前目标快照，请先重新读取','conflict');
        return {...copy(op),status:'pending' as const,...(target?{targetVersion:target.version}:{}),sourceVersions,
          warning:op.kind==='infer'?'这是模型推断，请逐项核对。':'引用不代表语义正确；请核对数值、单位、时间和归属。'};
      });
      const proposal={id:randomUUID(),requestId:r.requestId,summary:r.summary,at:now(),readIds:r.readIds,operations};
      p.proposals.push(proposal);remember(p,r.requestId,r);return {entity:save(entity,p,false),result:{proposalId:proposal.id}};
    },signal);
  }
  decideProposal(input:z.infer<typeof decideProposalSchema>):Promise<PageView> {
    const r=parse(decideProposalSchema,input);
    return this.repository.mutatePage(r.id,entity=>{
      const p=load(entity);
      if(requestSeen(p,r.requestId,r))return {entity,result:view(entity,p),changed:false};
      const proposal=p.proposals.find(x=>x.id===r.proposalId)??fail('提案不存在');
      const selected=r.operationIds.map(id=>proposal.operations.find(o=>o.id===id)??fail('提案操作不存在'));
      if(new Set(r.operationIds).size!==r.operationIds.length)fail('选择的操作重复');
      if(r.replacements && new Set(r.replacements.map(x=>x.operationId)).size!==r.replacements.length)fail('修改项重复');
      if(r.replacements?.some(x=>!r.operationIds.includes(x.operationId)))fail('修改了未选择的提案块');
      const changedVersions=new Map<string,{before:number;after:number}>();
      for(const op of selected) {
        if(op.status!=='pending') { if(op.status!==(r.decision==='accept'?'accepted':'rejected'))fail('此操作已处理','conflict');continue; }
        if(r.decision==='reject'){op.status='rejected';continue;}
        for(const [id,v] of Object.entries(op.sourceVersions)) {
          const actual=p.blocks.find(b=>b.id===id)?.version;
          if(actual!==v && !(changedVersions.get(id)?.before===v && changedVersions.get(id)?.after===actual))fail('依据或目标已被修改；请重新整理，当前内容未被覆盖','conflict');
        }
        const replacement=r.replacements?.find(x=>x.operationId===op.id)?.block;
        const b=copy(replacement??op.block);validateBlocks([b],p);
        if(b.id!==op.block.id)fail('不能修改提案块 ID');
        const target=op.action==='replace'?p.blocks.find(x=>x.id===op.targetBlockId):undefined;
        if(op.action==='replace' && (!target || target.version!==op.targetVersion))fail('目标已更新','conflict');
        if(op.action==='append' && p.blocks.some(x=>x.id===b.id))fail('新增块 ID 已存在','conflict');
        const version=Math.max(0,...p.snapshots.filter(s=>s.blockId===b.id).map(s=>s.version))+1;
        const block:PageBlock={...b,version,author:replacement?'ai-user-edited':'ai',sources:copy(op.sources),pendingReview:true};
        if(target){changedVersions.set(target.id,{before:target.version,after:version});p.blocks=p.blocks.map(x=>x.id===target.id?block:x);}
        else p.blocks.push(block);
        snapshot(p,block);op.status='accepted';
      }
      if(p.blocks.length>200)fail('实验页块数量超过上限');
      // Advance only this proposal's known changes; independent source edits remain conflicts.
      for(const op of proposal.operations.filter(o=>o.status==='pending')) for(const [id,v] of changedVersions) {
        if(op.sourceVersions[id]===v.before)op.sourceVersions[id]=v.after;
        if(op.targetBlockId===id && op.targetVersion===v.before)op.targetVersion=v.after;
      }
      remember(p,r.requestId,r);trim(p);const e=save(entity,p,r.decision==='accept');return {entity:e,result:view(e,p)};
    });
  }
}
