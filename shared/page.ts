/** Adaptive experiment page contract. All file bytes stay in Host-owned attachment storage. */
import { z } from 'zod';
import type { ForestEntity } from './model';
export const PAGE_KEY = 'forestPage';
export const PAGE_FORMAT = 'experiment-forest/page';
export const MAX_MATERIAL_BYTES = 64 * 1024 * 1024;
export const MATERIAL_CHUNK_BYTES = 256 * 1024;
const id = z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const text = z.string().max(100_000);
export const blockInputSchema = z.discriminatedUnion('type', [
  z.object({ id, type: z.literal('text'), text }).strict(),
  z.object({ id, type: z.literal('heading'), text: z.string().max(300) }).strict(),
  z.object({ id, type: z.literal('table'), columns: z.array(z.object({ id, label: z.string().max(500) }).strict()).min(1).max(50),
    rows: z.array(z.object({ id, cells: z.record(z.string(), z.string().max(10_000)) }).strict()).max(500),
    note: z.string().max(10_000).optional(), raw: text.optional() }).strict(),
  z.object({ id, type: z.literal('media'), materialId: id, caption: z.string().max(10_000) }).strict(),
]);
export type PageBlockInput = z.infer<typeof blockInputSchema>;
export const sourceSchema = z.object({ snapshotId: id.optional(), materialId: id.optional(), quote: z.string().max(2000).optional(),
  rowId: id.optional(), columnId: id.optional() }).strict().refine(v => !!v.snapshotId !== !!v.materialId, '引用必须指定一项快照或材料');
export type PageSource = z.infer<typeof sourceSchema>;
export type PageBlock = PageBlockInput & { version: number; author: 'user' | 'ai' | 'ai-user-edited';
  sources: PageSource[]; pendingReview: boolean; confirmedAt?: string };
export interface PageSnapshot { id: string; blockId: string; version: number; at: string; block: PageBlockInput }
export interface PageMaterial { id: string; requestId: string; name: string; mime: string; bytes: number; sha256: string;
  file: { attachmentId: string; name: string; bytes: number }; addedAt: string;
  preview?: { attachmentId: string; mediaType: 'image/png'|'image/jpeg'|'image/webp'|'image/gif'; bytes: number; width: number; height: number };
  previewError?: string }
export interface PageReadReceipt { id: string; at: string; snapshots: string[];
  materials: { id: string; mode: 'metadata-only'|'text'|'preview-image'; detail: string }[]; truncated: boolean }
export const proposalOperationSchema = z.object({ id, action: z.enum(['append','replace']), targetBlockId: id.optional(),
  block: blockInputSchema, sources: z.array(sourceSchema).min(1).max(20), kind: z.enum(['layout','extract','infer']) }).strict();
export type ProposalOperationInput = z.infer<typeof proposalOperationSchema>;
export type PageProposalOperation = ProposalOperationInput & { status: 'pending'|'accepted'|'rejected';
  targetVersion?: number; sourceVersions: Record<string, number>; warning: string };
export interface PageProposal { id: string; requestId: string; summary: string; at: string; readIds: string[]; operations: PageProposalOperation[] }
export interface ExperimentPage { format: typeof PAGE_FORMAT; version: 1; creationRequestId?: string;
  blocks: PageBlock[]; materials: PageMaterial[]; snapshots: PageSnapshot[];
  receipts: PageReadReceipt[]; proposals: PageProposal[]; requests: { id: string; hash: string }[] }
export interface PageView { entity: ForestEntity; page: ExperimentPage }
export const createPageSchema = z.object({ requestId: id, title: z.string().max(300).optional(), projectId: id.optional() }).strict();
export const savePageSchema = z.object({ id, expectedRevision: z.number().int().nonnegative(), requestId: id,
  title: z.string().min(1).max(300), experimentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  blocks: z.array(blockInputSchema).max(200) }).strict();
export const proposePageSchema = z.object({ id, requestId: id, readIds: z.array(id).min(1).max(20),
  summary: z.string().min(1).max(4000), operations: z.array(proposalOperationSchema).min(1).max(40) }).strict();
export const decideProposalSchema = z.object({ id, proposalId: id, requestId: id, operationIds: z.array(id).min(1).max(40),
  decision: z.enum(['accept','reject']), replacements: z.array(z.object({ operationId: id, block: blockInputSchema }).strict()).max(40).optional() }).strict();
export const beginMaterialSchema = z.object({ id, requestId: id, name: z.string().min(1).max(240),
  mime: z.string().max(100), bytes: z.number().int().min(1).max(MAX_MATERIAL_BYTES) }).strict();
export const materialChunkSchema = z.object({ uploadId: id, offset: z.number().int().nonnegative(),
  data: z.string().min(1).max(Math.ceil(MATERIAL_CHUNK_BYTES / 3) * 4) }).strict();
export const materialReadSchema = z.object({ id, materialId: id, offset: z.number().int().nonnegative() }).strict();
const version = z.number().int().positive();
const timestamp = z.iso.datetime();
export const materialSchema = z.object({ id, requestId:id, name:z.string().min(1).max(240), mime:z.string().max(100),
  bytes:z.number().int().positive().max(MAX_MATERIAL_BYTES), sha256:z.string().regex(/^[a-f0-9]{64}$/),
  file:z.object({attachmentId:z.string().regex(/^sha256:[a-f0-9]{64}$/),name:z.string().min(1).max(240),bytes:z.number().int().positive().max(MAX_MATERIAL_BYTES)}).strict(),addedAt:timestamp,
  preview:z.object({attachmentId:z.string().regex(/^sha256:[a-f0-9]{64}$/),mediaType:z.enum(['image/png','image/jpeg','image/webp','image/gif']),bytes:z.number().int().positive(),width:version,height:version}).strict().optional(),
  previewError:z.string().max(1000).optional() }).strict();
const blockMetadata={version,author:z.enum(['user','ai','ai-user-edited']),sources:z.array(sourceSchema).max(20),pendingReview:z.boolean(),confirmedAt:timestamp.optional()};
const storedBlockSchema=z.discriminatedUnion('type',[blockInputSchema.options[0].extend(blockMetadata),blockInputSchema.options[1].extend(blockMetadata),blockInputSchema.options[2].extend(blockMetadata),blockInputSchema.options[3].extend(blockMetadata)]);
export const pageSchema:z.ZodType<ExperimentPage> = z.object({format:z.literal(PAGE_FORMAT),version:z.literal(1),creationRequestId:id.optional(),
  blocks:z.array(storedBlockSchema).max(200),
  materials:z.array(materialSchema).max(100),
  snapshots:z.array(z.object({id,blockId:id,version,at:timestamp,block:blockInputSchema}).strict()).max(10000),
  receipts:z.array(z.object({id,at:timestamp,snapshots:z.array(id).max(200),materials:z.array(z.object({id,mode:z.enum(['metadata-only','text','preview-image']),detail:z.string().max(2000)}).strict()).max(100),truncated:z.boolean()}).strict()).max(100),
  proposals:z.array(z.object({id,requestId:id,summary:z.string().max(4000),at:timestamp,readIds:z.array(id).max(20),operations:z.array(proposalOperationSchema.extend({status:z.enum(['pending','accepted','rejected']),targetVersion:version.optional(),sourceVersions:z.record(id,version),warning:z.string().max(1000)})).max(40)}).strict()).max(30),
  requests:z.array(z.object({id,hash:z.string().regex(/^[a-f0-9]{64}$/)}).strict()).max(200)
}).strict().superRefine((page,ctx)=>{
  const invalid=(message:string)=>ctx.addIssue({code:'custom',message});
  for(const items of [page.blocks,page.materials,page.snapshots,page.receipts,page.proposals,page.requests])if(new Set(items.map(x=>x.id)).size!==items.length)invalid('实验页包含重复标识');
  const snapshots=new Set(page.snapshots.map(s=>s.id)),materials=new Set(page.materials.map(m=>m.id)),receipts=new Set(page.receipts.map(r=>r.id));
  for(const material of page.materials)if(material.bytes!==material.file.bytes || material.file.attachmentId!==`sha256:${material.sha256}`)invalid('原件引用与校验元数据不匹配');
  for(const s of page.snapshots)if(s.blockId!==s.block.id)invalid('原始快照块标识不匹配');
  for(const block of [...page.blocks,...page.snapshots.map(s=>s.block)]) {
    if(block.type==='media'&&!materials.has(block.materialId))invalid('材料块引用未登记的原件');
    if(block.type==='table' && (new Set(block.rows.map(r=>r.id)).size!==block.rows.length || new Set(block.columns.map(c=>c.id)).size!==block.columns.length || block.rows.some(r=>Object.keys(r.cells).some(k=>!block.columns.some(c=>c.id===k)))))invalid('表格行列引用无效');
  }
  for(const block of page.blocks)if(!page.snapshots.some(s=>s.blockId===block.id&&s.version===block.version))invalid('工作版缺少来源快照');
  for(const r of page.receipts)if(r.snapshots.some(id=>!snapshots.has(id))||r.materials.some(m=>!materials.has(m.id)))invalid('读取凭据指向不存在的来源');
  for(const p of page.proposals)if(p.readIds.some(id=>!receipts.has(id)))invalid('提案读取凭据缺失');
  for(const source of [...page.blocks.flatMap(b=>b.sources),...page.proposals.flatMap(p=>p.operations.flatMap(o=>o.sources))])if(source.snapshotId?!snapshots.has(source.snapshotId):!materials.has(source.materialId!))invalid('正文或提案的来源缺失');
});
export interface PageApi {
  createPage(input: z.infer<typeof createPageSchema>): Promise<PageView>;
  getPage(id: string): Promise<PageView>;
  savePage(input: z.infer<typeof savePageSchema>): Promise<PageView>;
  decideProposal(input: z.infer<typeof decideProposalSchema>): Promise<PageView>;
  confirmPageBlock(input: { id: string; expectedRevision: number; blockId: string }): Promise<PageView>;
  beginMaterial(input: z.infer<typeof beginMaterialSchema>): Promise<{ uploadId: string; received: number; chunkBytes: number }>;
  appendMaterial(input: z.infer<typeof materialChunkSchema>): Promise<{ received: number }>;
  finishMaterial(input: { uploadId: string }): Promise<PageView>;
  cancelMaterial(input: { uploadId: string }): Promise<void>;
  readMaterial(input: z.infer<typeof materialReadSchema>): Promise<{ data: string; nextOffset: number; total: number; name: string; mime: string }>;
}
export function getExperimentPage(entity: Pick<ForestEntity,'data'>): ExperimentPage | null {
  const parsed=pageSchema.safeParse(entity.data[PAGE_KEY]);
  return parsed.success ? parsed.data : null;
}
/** Plain projection for search and old clients. No proposals or guessed metadata. */
export function pageText(blocks: PageBlockInput[]): string {
  return blocks.map(b => b.type === 'table' ? [b.columns.map(c=>c.label).join('\t'), ...b.rows.map(r=>b.columns.map(c=>r.cells[c.id] ?? '').join('\t')), b.note ?? ''].join('\n')
    : b.type === 'media' ? b.caption : b.text).join('\n\n');
}
/** TSV only. Unbalanced rows stay verbatim text; raw input always survives conversion. */
export function pastedBlock(value: string, newId: () => string): PageBlockInput {
  const lines = value.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
  const cells = lines.map(line => line.split('\t'));
  if (cells.length < 2 || cells.length > 501 || cells[0]!.length < 2 || cells[0]!.length > 50 || cells.some(r=>r.length!==cells[0]!.length) || value.includes('"'))
    return { id: newId(), type: 'text', text: value };
  const columns = cells[0]!.map(label=>({id:newId(),label}));
  return { id:newId(),type:'table',columns,rows:cells.slice(1).map(row=>({id:newId(),cells:Object.fromEntries(columns.map((c,i)=>[c.id,row[i]!]))})),raw:value };
}
