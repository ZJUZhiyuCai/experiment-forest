import type { EntityKind, ForestEntity } from './model';
import { getRunWorkflow, getSopWorkflow, runProgress } from './workflow';

const LABEL: Record<EntityKind, string> = {
  project: '课题', record: '实验记录', note: '研究笔记', sop: 'SOP', sample: '样本', plan: '实验计划',
};

export interface MarkdownReport {
  filename: string;
  mimeType: 'text/markdown;charset=utf-8';
  text: string;
  entityCount: number;
}

/** Metadata is text, never executable Markdown/HTML supplied by an entity title. */
function inline(value: string): string {
  return value.replace(/[\r\n\t]+/g, ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\\`*_[\]{}()#+.!|~-]/g, '\\$&');
}

/** An adaptive fence retains complete plain text, including Markdown and HTML literals. */
function literal(value: string, language = 'text'): string {
  const runs = value.match(/`+/g) ?? [];
  const fence = '`'.repeat(Math.max(3, ...runs.map(run => run.length + 1)));
  return `${fence}${language}\n${value}\n${fence}`;
}

function relations(entity: ForestEntity): { id: string; label: string }[] {
  const result: { id: string; label: string }[] = [];
  const add = (id: unknown, label: string) => {
    if (typeof id === 'string' && id) result.push({ id, label });
  };
  add(entity.projectId, '所属课题');
  if (entity.kind === 'record') {
    add(entity.data.sopId, '关联 SOP（当前修订）');
    if (Array.isArray(entity.data.relatedSamples)) {
      for (const id of entity.data.relatedSamples) add(id, '关联样本');
    }
  }
  if (entity.kind === 'note' || entity.kind === 'plan') add(entity.data.relatedRecordId, '关联实验记录');
  return result;
}

/**
 * A portable reading copy, not a restorable backup or a signed research audit trail.
 * Project reports include that project's direct entries, including archived entries.
 * Other reports include one full entry. Related entities are indexed, never recursively copied.
 */
export function createMarkdownReport(
  primary: ForestEntity,
  entities: readonly ForestEntity[],
  generatedAt = new Date().toISOString(),
): MarkdownReport {
  const time = new Date(generatedAt);
  if (!Number.isFinite(time.getTime())) throw new Error('报告生成时间无效');
  const byId = new Map(entities.map(entity => [entity.id, entity]));
  byId.set(primary.id, primary);
  const members = primary.kind === 'project'
    ? [...byId.values()].filter(entity => entity.id !== primary.id && entity.projectId === primary.id)
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    : [];
  const included = [primary, ...members];
  const lines = [
    `# ${inline(primary.title)}`, '',
    '实验小森林 · 科研资料报告', '',
    `生成时间（UTC）：${time.toISOString()}`, '',
    `范围：${primary.kind === 'project' ? '课题及其直接条目（含已归档资料）' : '当前条目'}，共 ${included.length} 条完整资料。关联对象仅列索引，不递归复制正文。`, '',
    '此文件是已保存资料的阅读副本，不包含未保存输入，不替代完整 JSON 备份。步骤勾选、状态和人工核对标记均不代表结果已被科学验证。', '',
    '历史 SOP 快照以结构化字段中的保存内容为准；关联索引显示导出时的当前修订，两者可能不同。', '',
  ];

  for (const [index, entity] of included.entries()) {
    lines.push(`## ${index + 1}. ${LABEL[entity.kind]} · ${inline(entity.title)}`, '',
      `- ID：${inline(entity.id)}`,
      `- 修订：r${entity.revision}`,
      `- 状态（原值）：${inline(entity.status)}`,
      `- 创建：${inline(entity.createdAt)}`,
      `- 更新：${inline(entity.updatedAt)}`,
      `- 标签：${entity.tags.length ? entity.tags.map(inline).join('、') : '无'}`, '');

    const refs = relations(entity);
    if (refs.length) {
      lines.push('### 关联索引', '');
      for (const ref of refs) {
        const target = byId.get(ref.id);
        lines.push(target
          ? `- ${ref.label}：${inline(target.title)} · ${inline(target.id)} · r${target.revision} · ${inline(target.status)}`
          : `- ${ref.label}：${inline(ref.id)} · 当前快照中缺失，未推测其内容`);
      }
      lines.push('');
    }

    const run = getRunWorkflow(entity);
    const sop = getSopWorkflow(entity);
    if (run) {
      const progress = runProgress(entity);
      lines.push('### 本次方法依据（冻结快照）', '',
        `- SOP：${inline(run.source.sopTitle)} · ${inline(run.source.sopId)} · r${run.source.sopRevision}`,
        `- 保存时状态：${inline(run.source.sopStatus)}`,
        `- 方法版本：${run.source.sopVersion ? inline(run.source.sopVersion) : '未记录'}`, '',
        literal(run.source.sopContent), '', '### 执行记录', '',
        `已做 ${progress.done} / ${progress.total}，跳过 ${progress.skipped}，待处理 ${progress.pending}。`, '');
      for (const [stepIndex, definition] of run.source.steps.entries()) {
        const result = run.steps.find(step => step.stepId === definition.id)!;
        const status = { pending: '待处理', done: '已做', skipped: '已跳过' }[result.status];
        lines.push(`#### ${stepIndex + 1}. ${inline(definition.title)} · ${status}${definition.required ? ' · 必需' : ''}`, '',
          '方法说明：', '', literal(definition.instruction), '', '实际观察 / 偏差 / 跳过原因：', '', literal(result.observation), '',
          `记录时间：${result.updatedAt ?? '未记录'}`, '');
      }
    } else if (sop) {
      lines.push('### 方法步骤', '');
      for (const [stepIndex, step] of sop.steps.entries()) {
        lines.push(`#### ${stepIndex + 1}. ${inline(step.title)}${step.required ? ' · 必需' : ''}`, '', literal(step.instruction), '');
      }
    }

    lines.push('### 正文（完整原文）', '', literal(entity.content), '',
      '### 结构化字段（完整原值）', '', literal(JSON.stringify(entity.data, null, 2), 'json'), '', '---', '');
  }

  const safeTitle = primary.title.normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '-')
    .replace(/^\.+|[. ]+$/g, '').trim().slice(0, 70).replace(/[. ]+$/g, '') || LABEL[primary.kind];
  return {
    filename: `${safeTitle}-${time.toISOString().slice(0, 10)}.md`,
    mimeType: 'text/markdown;charset=utf-8',
    text: `${lines.join('\n')}\n`,
    entityCount: included.length,
  };
}
