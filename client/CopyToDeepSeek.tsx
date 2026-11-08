import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ForestApi, ForestEntity } from '../shared/model';
import { getRunWorkflow, runProgress } from '../shared/workflow';
import type { ForestContext } from '../shared/workflow';
import { Icon } from './icons';
import { DRAFT_TOOL_KINDS, KIND, classifyError, provenanceOf, statusOption } from './forest-model';
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
          text: '请用 forest_context 读取该课题（会附带同课题下的条目）；若结果有省略（omittedIds）再用 forest_search / forest_read 补齐。只依据已有条目总结目前进展、未完成的计划、执行清单中尚待完成的步骤和明显的缺口。不要推测未记录的结果。',
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
          text: getRunWorkflow(primary)
            ? '这条记录是从 SOP 创建的实验，记录里保存了创建时冻结的 SOP 快照（data.forestWorkflow.source：修订号、正文与步骤；forest_context 的 workflowSource 也会标明该修订）。请以这份冻结快照为准逐步对照，而不是当前 SOP——当前 SOP 可能已经修改，如修订不同请单独说明差异。结合每一步的执行状态（done / pending / skipped）与观察，列出与快照不一致、被跳过或缺失的步骤与参数。只做对照，不评价实验成败，不推断结果。'
            : '请读取这条记录及其依据的 SOP（如记录中有 sopId），逐步对照，列出记录中与 SOP 不一致或缺失的步骤与参数。注意：这条记录没有冻结的 SOP 快照，sopId 指向的是 SOP 的当前版本，不一定是当时实际使用的版本，请在结论中注明。只做对照，不评价实验成败。',
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
  const runNote = (e: ForestEntity) => {
    const run = getRunWorkflow(e);
    if (!run) return '';
    const pr = runProgress(e);
    return `，从 SOP「${run.source.sopTitle}」r${run.source.sopRevision} 创建并冻结快照${pr.total ? `，步骤 ${pr.done} 完成 / ${pr.skipped} 跳过 / ${pr.pending} 待做` : '，无步骤清单'}`;
  };
  const line = (e: ForestEntity) =>
    `- ${KIND[e.kind].label}「${e.title || '无标题'}」 ID: ${e.id}（修订 r${e.revision}，状态：${statusOption(e.kind, e.status).label}${aiNote(e)}${runNote(e)}）`;
  const out: string[] = ['【实验小森林 · 上下文】', '目标条目：', line(primary)];
  if (project && project.id !== primary.id) out.push(`所属课题：「${project.title}」 ID: ${project.id}`);
  if (related.length) {
    out.push(`同时参考（${related.length} 条）：`);
    related.slice(0, 20).forEach((e) => out.push(line(e)));
    if (related.length > 20) out.push(`- ……其余 ${related.length - 20} 条请用 forest_search 按课题查找`);
  }
  out.push(
    '',
    `请先调用一次 forest_context（id: ${primary.id}），它会同时返回目标条目、一跳关联资料、各自的修订号和截断说明。只有当结果标明截断（truncated）、有省略的条目，或你需要某条的完整原文时，再用 forest_read 读取对应 ID；需要更多相关条目时用 forest_search。不要仅凭标题推测内容。`,
    `任务：${task.trim()}`,
    ...(draftKind ? [`草稿类型：forest_create_draft 的 kind 使用 ${draftKind}。`] : []),
    '',
    `约束：如需新增内容，只能调用 forest_create_draft 创建草稿，且 kind 只能是 ${TOOL_KIND_LIST}；不要尝试创建课题、计划或样本（这些由我在实验小森林界面中手动新建），需要时把建议写进 note 草稿。新草稿会被标记为待人工核对；不要把 SOP 设为已批准，不要把记录标为已完成；不要编造实验数据、结论、作者或来源。`,
  );
  return out.join('\n');
}

type CopyState = { kind: 'idle' } | { kind: 'ok' } | { kind: 'manual'; reason: string };

const RELATION_LABEL: Record<string, string> = { primary: '目标', project: '课题', child: '下属', reference: '引用', backlink: '被引用' };

/**
 * 按需预览 forest_context 会提供的范围：使用同一个服务端接口，显示真实的条目数、省略与截断。
 * 只是预览，DeepSeek 调用时以其当时读取的结果为准。
 */
function ContextPreview({ api, id, revision }: { api: ForestApi; id: string; revision: number }) {
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'loading' } | { kind: 'ok'; ctx: ForestContext; revision: number } | { kind: 'error'; message: string }>({ kind: 'idle' });
  useEffect(() => setState({ kind: 'idle' }), [id]);
  const load = async () => {
    setState({ kind: 'loading' });
    try {
      const ctx = await api.context({ id });
      setState({ kind: 'ok', ctx, revision });
    } catch (err) {
      setState({ kind: 'error', message: classifyError(err).message });
    }
  };
  if (state.kind === 'idle' || state.kind === 'loading') {
    return (
      <button type="button" className="fa-link fa-ctxprev__btn" disabled={state.kind === 'loading'} onClick={() => void load()}>
        {state.kind === 'loading' ? '正在读取…' : '预览 forest_context 会提供哪些资料'}
      </button>
    );
  }
  if (state.kind === 'error') {
    return (
      <p className="fa-help fa-help--error">
        预览失败：{state.message}{' '}
        <button type="button" className="fa-link" onClick={() => void load()}>
          重试
        </button>
      </p>
    );
  }
  const { ctx } = state;
  const counts = new Map<string, number>();
  for (const e of ctx.entries) counts.set(e.relation, (counts.get(e.relation) ?? 0) + 1);
  const clipped = ctx.entries.filter((e) => e.content.truncated || e.data.truncated);
  return (
    <div className="fa-ctxprev" role="region" aria-label="forest_context 预览">
      <p className="fa-ctxprev__line">
        <b>{ctx.entries.length}</b> 条资料
        {Array.from(counts.entries()).map(([k, n]) => (
          <span key={k} className="fa-ctxprev__tag">
            {RELATION_LABEL[k] ?? k} {n}
          </span>
        ))}
        <span className="fa-muted">数据修订 r{ctx.snapshotRevision}</span>
      </p>
      {ctx.truncated ? (
        <p className="fa-ctxprev__warn">
          有截断：{ctx.omittedIds.length ? `省略 ${ctx.omittedIds.length} 条关联条目；` : ''}
          {clipped.length ? `${clipped.length} 条只提供了部分正文或字段；` : ''}
          指令已要求 DeepSeek 在需要时用 forest_read 补读完整原文。
        </p>
      ) : (
        <p className="fa-help">未截断：目标与一跳关联资料完整提供。</p>
      )}
      {ctx.missingIds.length > 0 && <p className="fa-help">有 {ctx.missingIds.length} 个引用的 ID 在数据中不存在，会如实告知 DeepSeek。</p>}
      {ctx.entries.some((e) => e.workflowSource) && <p className="fa-help">包含冻结的 SOP 来源修订（workflowSource），对照时以它为准。</p>}
      {state.revision !== revision && <p className="fa-help">条目已更新，预览可能过时。</p>}
    </div>
  );
}

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
  api,
}: {
  primary: ForestEntity;
  related?: ForestEntity[];
  project: ForestEntity | null;
  /** 提供时可预览 forest_context 实际会返回的范围（同一服务端实现） */
  api?: ForestApi;
}) {
  const [open, setOpen] = useState(false);
  const isRun = getRunWorkflow(primary) !== null;
  // 任务模板只取决于类型（以及是否为 SOP 执行记录）；不随轮询刷新的对象引用变化而重置用户选择
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tasks = useMemo(() => tasksFor(primary), [primary.kind, isRun]);
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
            生成一段包含条目 ID 的指令，复制后粘贴到 DeepSeek 对话里执行。DeepSeek 会先用 <code>forest_context</code> 一次取得目标与一跳关联资料，需要完整原文时再用 <code>forest_read</code>；新增内容只能是记录、笔记或 SOP 草稿，并标记为待人工核对。计划、样本、课题请在这里手动新建。
          </p>
          {api && <ContextPreview api={api} id={primary.id} revision={primary.revision} />}
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
