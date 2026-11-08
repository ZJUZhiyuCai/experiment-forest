/** Profile-bound admission of immutable materials. RPC never accepts an attachment ID or path. */
import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { AttachmentId, type AttachmentStore, type ImageAttachmentRef, type ImageMediaType } from '@deepseek-ai/dsh-attachment';
import { beginMaterialSchema, materialChunkSchema, materialReadSchema, materialSchema, MATERIAL_CHUNK_BYTES, MAX_MATERIAL_BYTES, type PageMaterial, type PageView } from '../shared/page';
import { ForestError, canonical, json } from './migration';
import { PageRepository } from './pages';

export const materialRegistrySchema=z.object({ entries:z.array(z.object({recordId:z.string(),uploadId:z.string(),requestHash:z.string().regex(/^[a-f0-9]{64}$/),material:materialSchema}).strict()).max(10000) }).strict();
type Registry=z.infer<typeof materialRegistrySchema>;
export interface MaterialRegistryPort { read():Promise<Registry>; write(state:Registry):Promise<void> }
interface Upload { input:z.infer<typeof beginMaterialSchema>; chunks:Buffer[]; received:number; touched:number }
function fail(message:string,code:ForestError['code']='invalid'):never{throw new ForestError(code,message);}
function parse<T>(schema:z.ZodType<T>,input:unknown):T {const r=schema.safeParse(input);return r.success?r.data:fail(r.error.issues[0]?.message??'材料请求无效');}
const same=(a:unknown,b:unknown)=>canonical(json(a))===canonical(json(b));
const digest=(data:Buffer)=>createHash('sha256').update(data).digest('hex');
const requestHash=(input:unknown)=>digest(Buffer.from(canonical(json(input))));
function imageType(data:Buffer):ImageMediaType|undefined {
  if(data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(data.subarray(0,3).equals(Buffer.from([255,216,255])))return 'image/jpeg';
  if(/^GIF8[79]a$/.test(data.subarray(0,6).toString('ascii')))return 'image/gif';
  if(data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP')return 'image/webp';
}
export class MaterialRepository {
  private uploads=new Map<string,Upload>();
  private tail:Promise<unknown>=Promise.resolve();
  private closed=false;
  private cache:{key:string;data:Buffer}|undefined;
  constructor(readonly pages:PageRepository,readonly attachments:AttachmentStore,private port:MaterialRegistryPort) {}
  private queue<T>(work:()=>Promise<T>):Promise<T> {
    if(this.closed)return Promise.reject(new ForestError('closed','材料服务已关闭'));
    const r=this.tail.then(work);this.tail=r.catch(()=>undefined);return r;
  }
  private async registry():Promise<Registry> {return parse(materialRegistrySchema,await this.port.read());}
  private reap() {for(const [id,u]of this.uploads)if(Date.now()-u.touched>20*60_000)this.uploads.delete(id);}
  private upload(id:string):Upload {this.reap();return this.uploads.get(id)??fail('上传已过期或服务已重启，请重新选择文件','not-found');}
  beginMaterial(input:z.infer<typeof beginMaterialSchema>) {return this.queue(async()=>{
    const r=parse(beginMaterialSchema,input),view=await this.pages.getPage(r.id);
    if(view.entity.status==='archived')fail('归档实验不能添加材料');
    this.reap();
    for(const [uploadId,u]of this.uploads)if(u.input.id===r.id&&u.input.requestId===r.requestId) {
      if(!same(u.input,r))fail('同一上传标识不能换用其他文件','conflict');
      return {uploadId,received:u.received,chunkBytes:MATERIAL_CHUNK_BYTES};
    }
    const registry=await this.registry();
    const old=registry.entries.find(e=>e.recordId===r.id&&e.material.requestId===r.requestId);
    if(old) {
      if(old.requestHash!==requestHash(r))fail('上传标识已使用','conflict');
      return {uploadId:old.uploadId,received:old.material.bytes,chunkBytes:MATERIAL_CHUNK_BYTES};
    }
    if(this.uploads.size>=2)fail('已有两个文件正在上传，请稍后继续');
    const reserved=[...this.uploads.values()].reduce((n,u)=>n+u.input.bytes,0);
    if(registry.entries.reduce((n,e)=>n+e.material.bytes,0)+reserved+r.bytes>512*1024*1024)fail('此配置的材料总量已达 512 MiB 上限');
    if(view.page.materials.length>=100||view.page.blocks.length>=200)fail('此页材料或块数量已达上限');
    const uploadId=randomUUID();this.uploads.set(uploadId,{input:r,chunks:[],received:0,touched:Date.now()});
    return {uploadId,received:0,chunkBytes:MATERIAL_CHUNK_BYTES};
  });}
  appendMaterial(input:z.infer<typeof materialChunkSchema>) {return this.queue(async()=>{
    const r=parse(materialChunkSchema,input),u=this.upload(r.uploadId),data=Buffer.from(r.data,'base64');
    if(!data.length||data.length>MATERIAL_CHUNK_BYTES||data.toString('base64')!==r.data)fail('文件分块编码无效');
    if(r.offset<u.received) {
      // Lost acknowledgement is safe to retry, but differing bytes are never accepted.
      const prior=Buffer.concat(u.chunks).subarray(r.offset,r.offset+data.length);
      if(r.offset+data.length>u.received||!prior.equals(data))fail('重试分块内容不一致','conflict');
    } else {
      if(r.offset!==u.received||u.received+data.length>u.input.bytes)fail('文件分块位置或大小不一致','conflict');
      u.chunks.push(data);u.received+=data.length;
    }
    u.touched=Date.now();return {received:u.received};
  });}
  finishMaterial({uploadId}:{uploadId:string}):Promise<PageView> {return this.queue(async()=>{
    const registry=await this.registry();
    const old=registry.entries.find(e=>e.uploadId===uploadId);
    if(old) {const v=await this.pages.registerMaterial(old.recordId,old.material);this.uploads.delete(uploadId);return v;}
    const u=this.upload(uploadId);if(u.received!==u.input.bytes)fail('文件尚未上传完整');
    const bytes=Buffer.concat(u.chunks),sha256=digest(bytes);
    const ref=await this.attachments.saveFile({data:bytes,name:u.input.name});
    if(ref.attachmentId!==`sha256:${sha256}`||ref.bytes!==bytes.length)fail('原始材料的存储校验失败');
    const material:PageMaterial={id:randomUUID(),requestId:u.input.requestId,name:u.input.name,mime:u.input.mime||'application/octet-stream',bytes:bytes.length,sha256,
      file:{attachmentId:ref.attachmentId,name:ref.name,bytes:ref.bytes},addedAt:new Date().toISOString()};
    const mediaType=imageType(bytes);
    if(mediaType) {
      try {const p=await this.attachments.saveImage({data:bytes,mediaType,name:u.input.name});
        material.preview={attachmentId:p.attachmentId,mediaType:p.mediaType,bytes:p.bytes,width:p.width,height:p.height};
        material.mime=mediaType;
      } catch { material.previewError='图片预览未生成；原始文件完整保存，可下载核对。'; }
    }
    registry.entries.push({recordId:u.input.id,uploadId,requestHash:requestHash(u.input),material});
    // Admission is durable before the page references it. Retrying after a page-write failure rejoins it.
    await this.port.write(registry);
    const view=await this.pages.registerMaterial(u.input.id,material);
    this.uploads.delete(uploadId);return view;
  });}
  cancelMaterial({uploadId}:{uploadId:string}):Promise<void> {return this.queue(async()=>{this.uploads.delete(uploadId);});}
  async bound(id:string,materialId:string):Promise<PageMaterial> {
    const {page}=await this.pages.getPage(id),listed=page.materials.find(m=>m.id===materialId);
    const admitted=(await this.registry()).entries.find(e=>e.recordId===id&&e.material.id===materialId);
    if(!listed||!admitted||!same(listed,admitted.material))fail('此材料未在当前配置登记；JSON 备份不包含文件本体，请从原设备恢复','not-found');
    return admitted.material;
  }
  async original(id:string,materialId:string,signal?:AbortSignal,useCache=false):Promise<Buffer> {
    const m=await this.bound(id,materialId),key=`${id}/${materialId}/${m.sha256}`;
    signal?.throwIfAborted();
    if(useCache&&this.cache?.key===key)return Buffer.from(this.cache.data);
    let count=0;const chunks:Buffer[]=[];
    for await(const part of this.attachments.readFileStream({...m.file,attachmentId:AttachmentId(m.file.attachmentId)},signal)) {
      count+=part.length;if(count>MAX_MATERIAL_BYTES||count>m.bytes)fail('原始材料长度不符');chunks.push(Buffer.from(part));
    }
    const data=Buffer.concat(chunks);
    if(data.length!==m.bytes||digest(data)!==m.sha256)fail('原始材料完整性校验失败');
    this.cache={key,data};return Buffer.from(data);
  }
  async readMaterial(input:z.infer<typeof materialReadSchema>) {
    const r=parse(materialReadSchema,input),m=await this.bound(r.id,r.materialId),data=await this.original(r.id,r.materialId,undefined,r.offset>0);
    if(r.offset>data.length)fail('读取位置超出文件');
    const end=Math.min(r.offset+MATERIAL_CHUNK_BYTES,data.length);
    return {data:data.subarray(r.offset,end).toString('base64'),nextOffset:end,total:data.length,name:m.name,mime:m.mime};
  }
  async modelText(id:string,materialId:string,signal?:AbortSignal) {
    const m=await this.bound(id,materialId);
    if(!/^(text\/(plain|csv|tab-separated-values|markdown)|application\/json)(;|$)/i.test(m.mime)&&!(/\.(txt|md|csv|tsv|json)$/i.test(m.name)))fail('此文件已保存，但当前不解析 PDF、表格工作簿、视频或仪器专有格式；请补充文本或选择支持的材料');
    const data=await this.original(id,materialId,signal);let text:string;
    try {text=new TextDecoder('utf-8',{fatal:true}).decode(data);}catch{ return fail('材料不是有效 UTF-8 文本；原文件仍可下载'); }
    if(text.includes('\0'))fail('材料包含二进制内容，不能作为文本读取');
    const truncated=text.length>40_000; text=text.slice(0,40_000);
    const readId=await this.pages.recordMaterialRead(id,materialId,'text',`返回 UTF-8 文本 ${text.length} 字符${truncated?'（已截断）':''}`,truncated);
    return {readId,materialId,name:m.name,text,truncated};
  }
  async modelImage(id:string,materialId:string,signal?:AbortSignal) {
    const m=await this.bound(id,materialId);if(!m.preview)fail('此材料没有可供模型读取的图片预览');
    const ref:ImageAttachmentRef={...m.preview,attachmentId:AttachmentId(m.preview.attachmentId)};
    await this.attachments.readImage(ref,signal);
    const readId=await this.pages.recordMaterialRead(id,materialId,'preview-image',`返回标准化预览 ${ref.width}×${ref.height}；图片中的数值仍须人工核对`);
    return {readId,materialId,name:m.name,image:ref};
  }
  async close(){this.closed=true;await this.tail;this.uploads.clear();this.cache=undefined;}
}
