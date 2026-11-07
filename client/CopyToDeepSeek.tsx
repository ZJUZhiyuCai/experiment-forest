import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ForestEntity } from '../shared/model';
import { Icon } from './icons';
import { DRAFT_TOOL_KINDS, KIND, provenanceOf, statusOption } from './forest-model';
import type { DraftToolKind } from './forest-model';

interface Task {
  id: string;
  label: string;
  text: string;
  /**
   * 若任务会让宿主调用 forest_create_draft，必须声明草稿类型。
   * 类型被限定为工具实际支持的 record | note | sop，写成 'plan' 等会在类型检查时报错。
   */
  draftKind?: DraftToolKind;
}

const TOOL_KIND_LIST = DRAFT_TOOL_KINDS.map((k) => `${k}（${KIND[k].label}）`).join(' / ');

function tasksFor(primary: ForestEntity): Task[] {
  const common: Task[] = [
    {
      id: 'review',
      label: '核对完整性',
      text: '请读取上述条目，指出缺失的信息、前后矛盾或需要我补充确认的地方。只列问题，不要替我补写数据。',
    },
  ];
  switch (primary.kind) {
    case 'project':
      return [
        {
          id: 'summary',
          label: '总结课题进展',
          text: '请读取该课题，并用 forest_search 查找同课题下的实验记录、计划、SOP、样本和笔记，只依据已有条目总结目前进展、未完成的计划和明显的缺口。不要推测未记录的结果。',
        },
        {
          id: 'plan',
          label: '起草下一步计划建议（笔记）',
          draftKind: 'note',
          text: '请读取该课题及其已有记录，整理 1–3 条下一步实验计划建议，用 forest_create_draft 以 kind: note（笔记）草稿创建一条，并关联到该课题：标题写“下一步计划建议”，正文逐条写打算做什么、依据哪些已有条目（附 ID）。只写计划，不写预期数据或结论。不要创建 plan 类型——计划条目由我在实验小森林界面里核对后手动新建。',
        },
        ...common,
      ];
    case 'record':
      return [
        {
          id: 'structure',
          label: '整理为结构化记录',
          draftKind: 'record',
          text: '请读取这条实验记录，把正文整理为“目的 / 材料与样本 / 步骤 / 结果 / 结论”的结构，用 forest_create_draft 以 kind: record 新建一条记录草稿（不要修改原记录）。原文没有的部分写“未记录”，不要补写数值或结论。',
        },
        {
          id: 'sop-check',
          label: '对照 SOP 查偏差',
          text: '请读取这条记录及其依据的 SOP（如记录中有 sopId），逐步对照，列出记录中与 SOP 不一致或缺失的步骤与参数。只做对照，不评价实验成败。',
        },
        ...common,
      ];
    case 'sop':
      return [
        {
          id: 'gaps',
          label: '找出缺失参数',
          draftKind: 'sop',
          text: '请读取这份 SOP，列出步骤中缺少的关键参数（温度、时间、浓度、体积等）和安全注意事项。如需改写，用 forest_create_draft 以 kind: sop 创建一份新的 SOP 草稿（不修改原 SOP），状态保持草稿，不要设为已批准。',
        },
        ...common,
      ];
    case 'sample':
      return [
        {
          id: 'usage',
          label: '查找使用过该样本的记录',
          text: '请用 forest_search 查找引用了该样本（ID 或编号）的实验记录，列出记录标题与 ID。找不到就直接说找不到。',
        },
        ...common,
      ];
    case 'plan':
      return [
        {
          id: 'to-record',
          label: '按计划起草记录模板',
          draftKind: 'record',
          text: '请读取该计划，用 forest_create_draft 以 kind: record 创建一条实验记录草稿作为执行模板（关联到同一课题）：只包含目的、拟用材料和步骤占位，结果与结论留空并注明“待实验后填写”。',
        },
        ...common,
      ];
    default:
      return common;
  }
}

function buildText(primary: ForestEntity, related: ForestEntity[], project: ForestEntity | null, task: string, draftKind?: DraftToolKind): string {
  const aiNote = (e: ForestEntity) => {
    const p = provenanceOf(e);
    if (!p.isAi) return '';
    return p.needsReview ? '，AI 草稿·待人工核对' : '，AI 草稿·已人工核对';
  };
  const line = (e: ForestEntity) =>
    `- ${KIND[e.kind].label}「${e.title || '无标题'}」 ID: ${e.id}（修订 r${e.revision}，状态：${statusOption(e.kind, e.status).label}${aiNote(e)}）`;
  const out: string[] = ['【实验小森林 · 上下文】', '目标条目：', line(primary)];
  if (project && project.id !== primary.id) out.push(`所属课题：「${project.title}」 ID: ${project.id}`);
  if (related.length) {
    out.push(`同时参考（${related.length} 条）：`);
    related.slice(0, 20).forEach((e) => out.push(line(e)));
    if (related.length > 20) out.push(`- ……其余 ${related.length - 20} 条请用 forest_search 按课题查找`);
  }
  out.push(
    '',
    '请先调用 forest_read 读取以上条目（需要时用 forest_search 查找相关条目），不要仅凭标题推测内容。',
    `任务：${task.trim()}`,
    ...(draftKind ? [`草稿类型：forest_create_draft 的 kind 使用 ${draftKind}。`] : []),
    '',
    `约束：如需新增内容，只能调用 forest_create_draft 创建草稿，且 kind 只能是 ${TOOL_KIND_LIST}；不要尝试创建课题、计划或样本（这些由我在实验小森林界面中手动新建），需要时把建议写进 note 草稿。新草稿会被标记为待人工核对；不要把 SOP 设为已批准，不要把记录标为已完成；不要编造实验数据、结论、作者或来源。`,
  );
  return out.join('\n');
}

type CopyState = { kind: 'idle' } | { kind: 'ok' } | { kind: 'manual'; reason: string };

async function copyText(text: string, fallbackEl: HTMLTextAreaElement | null): Promise<CopyState> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return { kind: 'ok' };
    }
  } catch {
    // 继续尝试回退方案
  }
  if (fallbackEl) {
    fallbackEl.focus();
    fallbackEl.select();
    try {
      // 已弃用但仍被广泛支持的回退；返回 false 时交给用户手动复制
      if (document.execCommand('copy')) return { kind: 'ok' };
    } catch {
      // ignore
    }
  }
  return { kind: 'manual', reason: '浏览器或宿主未允许写入剪贴板。下方文本已选中，请按 Ctrl/⌘ + C 手动复制。' };
}

/**
 * 生成一段带条目 ID 的上下文指令，由用户粘贴到 DeepSeek Harness 当前会话里执行。
 * 本组件只负责复制：从不声称“已发送”或“已运行”。
 */
export function CopyToDeepSeek({
  primary,
  related = [],
  project,
}: {
  primary: ForestEntity;
  related?: ForestEntity[];
  project: ForestEntity | null;
}) {
  const [open, setOpen] = useState(false);
  // 任务模板只取决于类型；不随轮询刷新的对象引用变化而重置用户选择
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tasks = useMemo(() => tasksFor(primary), [primary.kind]);
  const [taskId, setTaskId] = useState(tasks[0].id);
  const [custom, setCustom] = useState('');
  const [state, setState] = useState<CopyState>({ kind: 'idle' });
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const panelId = useId();
  const groupName = useId();

  useEffect(() => {
    setTaskId(tasks[0].id);
    setState({ kind: 'idle' });
  }, [primary.id, tasks]);

  const chosen = taskId === 'custom' ? undefined : tasks.find((t) => t.id === taskId);
  const taskText = taskId === 'custom' ? custom : chosen?.text ?? '';
  const text = buildText(primary, related, project, taskText || '（请在这里写下你希望 DeepSeek 做什么）', chosen?.draftKind);

  return (
    <div className="fa-handoff">
      <button
        type="button"
        className="fa-btn fa-btn--ghost"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((v) => !v);
          setState({ kind: 'idle' });
        }}
      >
        <Icon name="spark" />
        复制给 DeepSeek
      </button>
      {open && (
        <div className="fa-handoff__panel" id={panelId}>
          <p className="fa-help">
            生成一段包含条目 ID 的指令，复制后粘贴到 DeepSeek 对话里执行。DeepSeek 会用 <code>forest_read</code> 等工具读取；新增内容只能是记录、笔记或 SOP 草稿，并标记为待人工核对。计划、样本、课题请在这里手动新建。
          </p>
          <fieldset className="fa-handoff__tasks">
            <legend>想让 DeepSeek 做什么</legend>
            {tasks.map((t) => (
              <label key={t.id} className="fa-radio">
                <input type="radio" name={groupName} checked={taskId === t.id} onChange={() => setTaskId(t.id)} />
                <span>{t.label}</span>
              </label>
            ))}
            <label className="fa-radio">
              <input type="radio" name={groupName} checked={taskId === 'custom'} onChange={() => setTaskId('custom')} />
              <span>自己写</span>
            </label>
          </fieldset>
          {taskId === 'custom' && (
            <label className="fa-field">
              <span className="fa-label">任务描述</span>
              <textarea className="fa-input fa-textarea fa-textarea--short" value={custom} onChange={(e) => setCustom(e.target.value)} rows={3} />
            </label>
          )}
          <label className="fa-field">
            <span className="fa-label">将复制的内容</span>
            <textarea ref={areaRef} className="fa-input fa-textarea fa-textarea--mono" readOnly value={text} rows={8} />
          </label>
          <div className="fa-handoff__actions">
            <button
              type="button"
              className="fa-btn fa-btn--primary"
              disabled={taskId === 'custom' && !custom.trim()}
              onClick={async () => setState(await copyText(text, areaRef.current))}
            >
              <Icon name="copy" />
              复制指令
            </button>
            <span className="fa-handoff__status" role="status">
              {state.kind === 'ok' && '已复制到剪贴板。请切到 DeepSeek 对话粘贴并发送。'}
              {state.kind === 'manual' && <span className="fa-text-warn">{state.reason}</span>}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
