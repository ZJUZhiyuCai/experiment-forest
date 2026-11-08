import { ENTITY_KINDS, type EntityKind, type ForestEntity, type ForestSnapshot, type Json } from './model';
import { getRunWorkflow, getSopWorkflow } from './workflow';

export interface ObsidianMirrorFile { path: string; content: string }
export interface ObsidianMirror { files: ObsidianMirrorFile[]; fileCount: number; entityCount: number }
const LABEL: Record<EntityKind, string> = { project: '课题', record: '实验记录', note: '研究笔记', sop: 'SOP', sample: '样本', plan: '实验计划' };
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

/** Reversible lowercase base32 keeps even 128-character IDs below filesystem name limits.
 * Unlike slugs or lowercased IDs it cannot merge punctuation, case, or duplicate titles. */
function basename(id: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(id)) throw new Error('Obsidian mirror: invalid entity ID');
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = 0, accumulator = 0, out = '';
  for (const byte of new TextEncoder().encode(id)) {
    accumulator = (accumulator << 8) | byte; bits += 8;
    while (bits >= 5) { bits -= 5; out += alphabet[(accumulator >>> bits) & 31]; }
    accumulator &= (1 << bits) - 1;
  }
  if (bits) out += alphabet[(accumulator << (5 - bits)) & 31];
  return `ef-${out}`;
}
function text(value: string): string {
  return value.replace(/[\r\n\t\u0000-\u001f]+/g, ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\\`*_[\]{}()#+.!|~^-]/g, '\\$&');
}
function fence(value: string, language = 'text'): string {
  let longest = 2;
  for (const run of value.matchAll(/`+/g)) longest = Math.max(longest, run[0].length);
  const delimiter = '`'.repeat(longest + 1);
  return `${delimiter}${language}\n${value}\n${delimiter}`;
}
function wiki(relative: string, label: string, rootFolder?: string): string {
  return `[[${rootFolder ? `${rootFolder}/${relative}` : relative.replace(/^entities\//, '')}|${label}]]`;
}
function link(entity: ForestEntity, rootFolder?: string): string {
  // User titles are separate escaped text: never part of wikilink syntax or a path.
  return `${wiki(`entities/${basename(entity.id)}`, LABEL[entity.kind], rootFolder)} ${text(entity.title)}${entity.status === 'archived' ? '（已归档）' : ''}`;
}
const reading = (value: string): string => value.split('\n').map(line => text(line)).join('  \n');
interface Relation { id: string; label: string }
function relations(entity: ForestEntity): Relation[] {
  const refs: Relation[] = [];
  const add = (id: unknown, label: string) => { if (typeof id === 'string' && id && !refs.some(r => r.id === id && r.label === label)) refs.push({ id, label }); };
  add(entity.projectId, '所属课题');
  if (entity.kind === 'record') {
    add(entity.data.sopId, 'SOP 当前条目');
    if (Array.isArray(entity.data.relatedSamples)) entity.data.relatedSamples.forEach(id => add(id, '样本'));
    const workflow = object(entity.data.forestWorkflow);
    if (workflow?.format === 'experiment-forest/workflow' && workflow.version === 1 && workflow.type === 'run') {
      add(object(workflow.source)?.sopId, '历史方法来源（快照见结构化字段）');
    }
  }
  if (entity.kind === 'note' || entity.kind === 'plan') add(entity.data.relatedRecordId, '实验记录');
  return refs;
}
function jsonValue(value: unknown, ancestors = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return;
  if (!value || typeof value !== 'object' || ancestors.has(value)) throw new Error('Obsidian mirror: finite acyclic JSON required');
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new Error('Obsidian mirror: plain JSON required');
  ancestors.add(value);
  for (const item of Object.values(value)) jsonValue(item, ancestors);
  ancestors.delete(value);
}
function metadata(entity: ForestEntity, byId: Map<string, ForestEntity>, rootFolder?: string): Record<string, Json> {
  const provenance = object(entity.data.provenance);
  const source = typeof provenance?.source === 'string' ? provenance.source : null;
  const review = typeof provenance?.reviewStatus === 'string' ? provenance.reviewStatus : null;
  const project = entity.projectId ? byId.get(entity.projectId) : undefined;
  return {
    forest_mirror: true, id: entity.id, type: entity.kind, title: entity.title, aliases: [entity.title],
    status: entity.status, revision: entity.revision,
    project: project ? wiki(`entities/${basename(project.id)}`, '课题', rootFolder) : null, project_id: entity.projectId ?? null,
    project_title: project?.title ?? null,
    project_path: project ? `${rootFolder ? `${rootFolder}/` : ''}entities/${basename(project.id)}.md` : null,
    // Obsidian tags have a narrower alphabet than Forest tags. Never change original labels.
    tags: ['experiment-forest', ...entity.tags.filter(tag => /^[\p{L}\p{M}\p{N}_/-]+$/u.test(tag) && /[^\d/]/u.test(tag) && !tag.startsWith('/') && !tag.endsWith('/') && !tag.includes('//'))],
    forest_tags: entity.tags, created: entity.createdAt, updated: entity.updatedAt,
    source, review_status: review, needs_review: source === 'deepseek-harness' && review !== 'reviewed',
  };
}
function entityNote(entity: ForestEntity, refs: Relation[], backlinks: ForestEntity[], byId: Map<string, ForestEntity>, rootFolder?: string): string {
  // JSON frontmatter is explicitly supported by Obsidian; it prevents YAML injection.
  const lines = ['---', JSON.stringify(metadata(entity, byId, rootFolder), null, 2), '---', '', `# ${text(entity.title)}`, '',
    'Harness 已保存资料的单向阅读镜像。请在 Harness 修改实验；在其他笔记中链接此页并整理心得。', '',
    `- 类型：${LABEL[entity.kind]} · 状态：${text(entity.status)} · 修订：r${entity.revision}`,
    `- ID：${text(entity.id)}`, ''];
  if (object(entity.data.provenance)?.source === 'deepseek-harness') {
    lines.push(object(entity.data.provenance)?.reviewStatus === 'reviewed'
      ? '> AI 生成，已记录人工核对；来源不改变，核对不等于科学验证。'
      : '> AI 生成，待人工核对；不得将草稿视为已经发生的实验事实。', '');
  }
  lines.push('## 关联', '');
  for (const ref of refs) {
    const target = byId.get(ref.id);
    lines.push(target ? `- ${ref.label}：${link(target, rootFolder)}` : `- ${ref.label}：${text(ref.id)}（本次镜像缺失，未创建占位事实）`);
  }
  if (!refs.length) lines.push('无已声明的关联。');
  lines.push('', '## 被引用 / 课题条目', '');
  lines.push(...(backlinks.length ? backlinks.map(other => `- ${link(other, rootFolder)}`) : ['无已声明的反向关联。']));
  const run = getRunWorkflow(entity), sop = getSopWorkflow(entity);
  if (run) {
    lines.push('', '## 本次固定方法与执行进度', '',
      `${text(run.source.sopTitle)} · 固定修订 r${run.source.sopRevision} · 当时状态：${text(run.source.sopStatus)}`, '',
      `已完成 ${run.steps.filter(step => step.status === 'done').length} / ${run.steps.length}；跳过 ${run.steps.filter(step => step.status === 'skipped').length}。步骤标记不等于实验结果已经验证。`, '',
      '### 当时的方法正文', '', reading(run.source.sopContent), '');
    for (const [index, step] of run.source.steps.entries()) {
      const actual = run.steps[index]!;
      lines.push(`### ${index + 1}. ${text(step.title)}`, '',
        `状态：${({ pending: '未完成', done: '已记录完成', skipped: '已跳过' })[actual.status]}${step.required ? ' · 必需步骤' : ''}`, '',
        reading(step.instruction), '', '实际观测 / 跳过原因：', '', actual.observation ? reading(actual.observation) : '未记录', '',
        `记录时间：${actual.updatedAt ?? '未记录'}`, '');
    }
  } else if (sop) {
    lines.push('', '## 方法步骤', '');
    sop.steps.forEach((step, index) => lines.push(`### ${index + 1}. ${text(step.title)}${step.required ? '（必需）' : ''}`, '', reading(step.instruction), ''));
  }
  lines.push('', '## 正文', '', entity.content ? reading(entity.content) : '（正文为空）', '',
    '<details><summary>查看完整原文（字面文本）</summary>', '', fence(entity.content), '', '</details>', '',
    '## 结构化资料（完整原值）', '',
    '包括原始科学字段、来源、执行步骤及历史 SOP 快照；当前 SOP 链接不替代历史快照。未提供的字段不补写。', '',
    fence(JSON.stringify(entity.data, null, 2), 'json'), '',
    '## 原始记录元数据', '',
    fence(JSON.stringify({ ...entity, content: undefined, data: undefined }, null, 2), 'json'), '');
  return lines.join('\n');
}
/** Official syntax checked 2026-11-08:
 * https://help.obsidian.md/bases/syntax (JSON is valid YAML; note.*, this.file.folder)
 * https://help.obsidian.md/properties (JSON frontmatter, quoted internal links)
 * https://help.obsidian.md/links (basename wikilinks, independent of vault root location).
 * This function has no clock, filesystem, network or HTML execution. Workflow parsing reuses
 * the project's schema; no extra runtime dependency is introduced.
 */
export function createObsidianMirror(snapshot: ForestSnapshot, mirroredAt?: string, rootFolder?: string): ObsidianMirror {
  if (rootFolder !== undefined && !/^[A-Za-z0-9][A-Za-z0-9 _-]{0,120}$/.test(rootFolder)) throw new Error('Obsidian mirror: invalid root folder');
  if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0) throw new Error('Obsidian mirror: invalid snapshot revision');
  if (mirroredAt !== undefined && (!/^\d{4}-\d{2}-\d{2}T/.test(mirroredAt) || !Number.isFinite(Date.parse(mirroredAt)))) throw new Error('Obsidian mirror: invalid mirror time');
  const entities = [...snapshot.entities].sort((a, b) => compare(a.id, b.id));
  const byId = new Map<string, ForestEntity>();
  const outgoing = new Map<string, Relation[]>(), incoming = new Map<string, ForestEntity[]>();
  for (const entity of entities) {
    basename(entity.id);
    if (byId.has(entity.id)) throw new Error('Obsidian mirror: duplicate entity ID');
    if (!ENTITY_KINDS.includes(entity.kind)) throw new Error('Obsidian mirror: invalid entity kind');
    jsonValue(entity);
    byId.set(entity.id, entity);
    const refs = relations(entity); outgoing.set(entity.id, refs);
    for (const id of new Set(refs.map(ref => ref.id))) {
      if (id === entity.id) continue;
      const backlinks = incoming.get(id) ?? []; backlinks.push(entity); incoming.set(id, backlinks);
    }
  }
  const files: ObsidianMirrorFile[] = [{ path: 'README.md', content: [
    '# 实验森林 · Obsidian 自动镜像', '',
    'Harness 管理实验主数据；此专用目录是自动更新的单向阅读副本，不是双向同步。Obsidian 中的修改不会回写 Harness。', '',
    '请在其他笔记里引用这些稳定 ID 页面，整理资料、文献和心得。不要直接修改或移动受管理页面：本插件发现人工改动、删除或移动后会保留现状并报告冲突，不静默覆盖或重新创建。未管理文件与旧文件不会自动删除。', '',
    '更新前的文件保存在专用目录的隐藏 .recovery 文件夹中，用于恢复同步时的并发编辑；不会自动清理，长期使用会占用额外空间。', '',
    '本镜像包含当前已保存条目（包括归档），不含未保存输入或迁移原始归档集合；不能替代 Harness 的完整 JSON 备份，也不是电子签名或不可篡改审计。', '',
    '正文及 JSON 作为完整字面文本显示，不执行其中的 HTML、脚本、嵌入或指令。实验日期、结果、完成状态和来源均以原记录为准。', '',
    `打开 ${wiki('Index', '目录', rootFolder)} 或 ${wiki('Forest.base', '资料视图', rootFolder)}。Bases 需要 Obsidian 内置 Bases 功能；未启用时 Markdown 目录仍可用。`, '',
    '`Forest.base` 仅首次创建，之后可以在 Obsidian 中调整筛选、排序和列；自动格式整理与视图设置会保留，后续同步或插件升级不会覆盖已有视图。移动或删除后不会自动重建。Markdown 资料页面仍自动更新。', '',
    '文件名来自稳定 ID，与标题无关。链接使用专用目录下的位置，不会因不同 Harness profile 的同 ID 资料而串链。请勿移动受管理目录。', '',
    ...(mirroredAt ? [`生成时间：${mirroredAt}`, ''] : []),
    '语法依据：[Bases](https://help.obsidian.md/bases/syntax)、[属性](https://help.obsidian.md/properties)、[内部链接](https://help.obsidian.md/links)（核验于 2026-11-08）。', '',
  ].join('\n') }];
  const index = ['# 实验森林目录', '', `快照修订：${snapshot.revision} · 已保存条目：${entities.length}（含归档）`, '', wiki('Forest.base', '打开资料视图', rootFolder), ''];
  for (const kind of ENTITY_KINDS) {
    const members = entities.filter(entity => entity.kind === kind);
    const name = `index-${kind}`;
    index.push(`- ${wiki(name, LABEL[kind], rootFolder)}：${members.length}`);
    files.push({ path: `${name}.md`, content: [`# ${LABEL[kind]}`, '', wiki('Index', '返回目录', rootFolder), '',
      ...(members.length ? members.map(entity => `- ${link(entity, rootFolder)} · r${entity.revision} · ${text(entity.status)}`) : ['暂无已保存条目。']), ''].join('\n') });
  }
  files.push({ path: 'Index.md', content: `${index.join('\n')}\n` });
  const view = (name: string, filters?: string) => ({ type: 'table', name, ...(filters ? { filters } : {}),
    order: ['formula.entry', 'note.type', 'note.status', 'formula.project_entry', 'note.revision', 'note.updated'] });
  files.push({ path: 'Forest.base', content: `${JSON.stringify({
    filters: { and: ['file.ext == "md"', 'note.forest_mirror == true', 'file.folder == if(this.file.folder, this.file.folder + "/entities", "entities")'] },
    formulas: { entry: 'file.asLink(note.title)', project_entry: 'if(note.project_path, link(note.project_path, note.project_title), if(note.project_id, "未找到课题", "未归入课题"))' },
    properties: { 'formula.entry': { displayName: '资料' }, 'note.type': { displayName: '类型' }, 'note.status': { displayName: '状态' }, 'formula.project_entry': { displayName: '课题' }, 'note.updated': { displayName: '更新时间' } },
    views: [view('全部资料'), view('未归档', 'note.status != "archived"'), view('待核对', 'note.needs_review == true && note.status != "archived"'),
      ...ENTITY_KINDS.map(kind => view(LABEL[kind], `note.type == "${kind}"`))],
  }, null, 2)}\n` });
  for (const entity of entities) files.push({ path: `entities/${basename(entity.id)}.md`, content: entityNote(entity, outgoing.get(entity.id)!, incoming.get(entity.id) ?? [], byId, rootFolder) });
  return { files, fileCount: files.length, entityCount: entities.length };
}
