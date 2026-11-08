import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ClipboardEvent, DragEvent, KeyboardEvent, ReactNode, RefObject } from 'react';
import type { ForestApi, ForestEntity } from '../shared/model';
import type { PageBlockInput, PageSource } from '../shared/page';
import { getExperimentPage, pastedBlock } from '../shared/page';
import { getRunWorkflow } from '../shared/workflow';
import type { OrganizePage } from './material-transfer';
import { Icon } from './icons';
import { Notice, Spinner } from './bits';
import type { Notify } from './EntityDetail';
import type { ObsidianState } from './ObsidianSync';
import { obsidianNoteTarget } from './obsidian-note';
import { AutoTextarea, PageBlockView } from './PageBlocks';
import type { BlockActions, BlockCtx } from './PageBlocks';
import { InlineOps, ProposalTray, usePlacement, useReviewSelection } from './ProposalReview';
import { OriginalView } from './OriginalView';
import type { SourceTarget } from './OriginalView';
import { AwaitingBanner, OrganizePanel, copyToClipboard } from './OrganizePage';
import { usePage } from './pageStore';
import type { PageController, PageState, UploadItem } from './pageStore';
import { PAGE_LIMITS, UNTITLED, formatBytes, hhmm, looksTabular, newHeading, newTable, newText, uid } from './pageModel';
import { formatDateTime, friendlyDay, isArchived, localDate } from './forest-model';

export interface ExperimentPageProps {
  api: ForestApi;
  entityId: string;
  entities: ForestEntity[];
  headingRef: RefObject<HTMLHeadingElement>;
  obsidian: ObsidianState;
  organizePage?: OrganizePage;
  notify: Notify;
  applyEntity: (e: ForestEntity) => void;
  onClose: () => void;
  onOpenProject: (id: string) => void;
  /** 打开原详情（状态、归档、关联、复制给 DeepSeek 等原有功能） */
  onClassic: () => void;
  onOpenData: () => void;
  /** 宽工作台：隐藏左侧列表，让这一页占满 */
  focus?: { on: boolean; toggle: () => void };
}

/* ───────────────────────── 小弹层（点外面或 Esc 关闭；不抢焦点，不遮正文） ───────────────────────── */

function Pop({
  label,
  align = 'end',
  trigger,
  children,
}: {
  label: string;
  align?: 'start' | 'end';
  trigger: (p: { open: boolean; toggle: () => void; panelId: string }) => ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const panelId = useId();
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return;
    // composedPath：插件若渲染在 shadow root 里，事件目标会被重定向，contains 判断不可靠
    const onDown = (e: PointerEvent) => {
      if (ref.current && !e.composedPath().includes(ref.current)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);
  return (
    <span
      ref={ref}
      className="fa-pop"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
          ref.current?.querySelector<HTMLElement>('[aria-controls]')?.focus();
        }
      }}
    >
      {trigger({ open, toggle: () => setOpen((v) => !v), panelId })}
      {open && (
        <div id={panelId} className={`fa-pop__panel is-${align}`} role="dialog" aria-label={label}>
          {children(close)}
        </div>
      )}
    </span>
  );
}

/* ───────────────────────── 这页到了哪一步：输入框 → 本页正文 → Host → Obsidian ───────────────────────── */

type StepTone = 'done' | 'wait' | 'busy' | 'bad' | 'off';
interface Step {
  key: string;
  name: string;
  tone: StepTone;
  text: string;
  detail?: string;
  action?: { label: string; run: () => void };
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** 本页在 Obsidian 的真实状态（来自宿主 obsidianStatus 与 obsidianNoteTarget）；不做任何推断性的“已同步” */
interface NoteInfo {
  connected: boolean;
  target: ReturnType<typeof obsidianNoteTarget>;
  chip: string;
  chipTone: 'is-quiet' | 'is-warn' | 'is-bad';
  step: Step;
  issues: { name: string; message: string }[];
}

function noteInfo(obsidian: ObsidianState, state: PageState): NoteInfo | null {
  const st = obsidian.status;
  const entity = state.view?.entity;
  if (!st || !entity) return null;
  const connected = st.enabled && !!st.vaultId && st.state !== 'disabled';
  if (obsidian.error) return {
    connected, target: null, chip: 'Obsidian 状态过期', chipTone: 'is-warn', issues: [],
    step: { key: 'obsidian', name: 'Obsidian', tone: 'bad', text: '尚未确认同步状态', detail: `读取失败：${obsidian.error}。请到同步设置刷新后再确认。` },
  };
  if (!connected) {
    return {
      connected,
      target: null,
      chip: 'Obsidian 未连接',
      chipTone: 'is-quiet',
      step: { key: 'obsidian', name: 'Obsidian', tone: 'off', text: '未连接', detail: '连接后，Host 保存的内容会自动单向同步到你的仓库。' },
      issues: [],
    };
  }
  const target = obsidianNoteTarget(st, entity);
  const issues = st.materials?.issues.filter((i) => i.recordId === entity.id) ?? [];
  const mats = state.view?.page.materials.length ?? 0;
  const at = st.lastSyncedAt ? hhmm(st.lastSyncedAt) : '';
  const draft = state.composer.length > 0;
  // 本页还有尚未进入 Obsidian 的内容：输入框未记下，或正文未保存
  const newer = draft ? '输入框里有未记下的文字' : state.dirty ? '正文有修改还没保存' : '';
  let chip: string;
  let step: Step;
  if (st.state === 'syncing') {
    chip = 'Obsidian 同步中';
    step = { key: 'obsidian', name: 'Obsidian', tone: 'busy', text: '正在写入专用文件夹' };
  } else if (st.state === 'error') {
    chip = 'Obsidian 同步失败';
    step = { key: 'obsidian', name: 'Obsidian', tone: 'bad', text: '同步失败', detail: `${st.lastError || '宿主没有给出原因'}。实验记录不受影响。` };
  } else if (target?.state === 'synced') {
    chip = newer ? 'Obsidian 是上次保存的版本' : `Obsidian 已同步${at ? ` ${at}` : ''}`;
    step = newer
      ? { key: 'obsidian', name: 'Obsidian', tone: 'wait', text: '笔记是上次保存的版本', detail: `${newer}；记下并保存后，宿主会自动更新这篇笔记。` }
      : { key: 'obsidian', name: 'Obsidian', tone: 'done', text: `这篇笔记已同步${at ? ` · 上次同步 ${at}` : ''}` };
  } else if (target?.state === 'pending') {
    chip = 'Obsidian 等待同步';
    step = { key: 'obsidian', name: 'Obsidian', tone: 'wait', text: '等待同步', detail: 'Host 保存后，宿主会自动写入这篇笔记；同步完成前不提供打开入口。' };
  } else if (target?.state === 'conflict') {
    chip = 'Obsidian 笔记有冲突';
    step = {
      key: 'obsidian',
      name: 'Obsidian',
      tone: 'bad',
      text: '笔记在 Obsidian 里被改动或移动过',
      detail: '宿主保留了你在 Obsidian 里的版本，没有覆盖，所以这篇笔记暂时不会更新。实验记录以这里为准。',
    };
  } else {
    // 缺少已登记仓库或本页路径时，不以历史全库时间猜测本页成功。
    chip = 'Obsidian 笔记位置未确认';
    step = {
      key: 'obsidian',
      name: 'Obsidian',
      tone: 'wait',
      text: '笔记位置未确认',
      detail: '暂未取得已登记仓库中的本页位置，请到同步设置重新核对。',
    };
  }
  let chipTone: NoteInfo['chipTone'] = st.state === 'error' ? 'is-bad' : target?.state === 'conflict' ? 'is-warn' : 'is-quiet';
  if (issues.length) {
    chip += ` · ${issues.length} 个素材未镜像`;
    chipTone = chipTone === 'is-bad' ? chipTone : 'is-warn';
  } else if (mats && !st.materials) chip += ' · 素材镜像状态未知';
  return { connected, target, chip, chipTone, step, issues };
}

function PageTrail({ state, ctrl, obsidianStep, onCommitDraft }: { state: PageState; ctrl: PageController; obsidianStep: Step | null; onCommitDraft: () => void }) {
  const s = state.save;
  const draft = state.composer;
  const moving = state.uploads.filter((u) => u.stage === 'queued' || u.stage === 'uploading').length;
  const registering = state.uploads.filter((u) => u.stage === 'registering').length;
  const rev = state.baseRevision !== null ? `r${state.baseRevision}` : '';
  const save = () => void ctrl.saveNowFromUser();
  const look: Record<PageState['save']['kind'], { label: string; tone: 'ok' | 'idle' | 'busy' | 'warn' | 'bad' | 'hold'; title: string }> = {
    clean: { label: '已在 Host', tone: 'ok', title: `这一版由 Host 保存${rev ? ` · ${rev}` : ''}` },
    pending: { label: '未保存', tone: 'idle', title: '停笔后会自动保存；关闭页面前请等“已保存”出现' },
    saving: { label: '保存中…', tone: 'busy', title: '已发往 Host，等待确认' },
    checking: { label: '核对中…', tone: 'busy', title: s.message ?? '正在向 Host 核对' },
    saved: { label: `已保存 ${s.at ? hhmm(s.at) : ''}`.trim(), tone: 'ok', title: `Host 已确认${rev ? ` · ${rev}` : ''}。刷新或换会话后可以恢复。` },
    failed: { label: '未能保存', tone: 'bad', title: s.message ?? '' },
    uncertain: { label: '结果不确定', tone: 'bad', title: s.message ?? '' },
    conflict: { label: '有冲突', tone: 'warn', title: s.message ?? '' },
  };
  let { label, tone, title } = look[s.kind];
  const blocking = s.kind === 'failed' || s.kind === 'uncertain' || s.kind === 'conflict';
  let draftExtra = false;
  // 正文已保存、输入框里却还有字：徽章不再只说“已保存”，而是显示最靠前、仍需处理的那一层
  if (draft && !blocking) {
    if (s.kind === 'clean' || s.kind === 'saved') {
      label = '输入框未记下';
      tone = 'hold';
      title = `正文${s.kind === 'saved' ? '已保存' : '在 Host'}${rev ? ` · ${rev}` : ''}；底部输入框里的文字还没记下，AI 和 Obsidian 都看不到。`;
    } else draftExtra = true;
  }
  const extra = [draftExtra ? '输入框未记下' : '', moving ? `${moving} 个上传中` : '', registering ? `${registering} 个待登记` : ''].filter(Boolean).join(' · ');

  /* 四层逐行如实写出 */
  const steps: Step[] = [];
  steps.push(
    draft
      ? {
          key: 'draft',
          name: '输入框',
          tone: 'wait',
          text: `「${clip(draft, 22)}」还没记下`,
          detail: '只在这个 Harness 窗口里：切换页面会保留，关闭或刷新会丢失。AI 和 Obsidian 都看不到它。',
          action: { label: '记下', run: onCommitDraft },
        }
      : { key: 'draft', name: '输入框', tone: 'done', text: '没有未记下的输入' },
  );
  const upDetail = [moving ? `${moving} 个文件上传中` : '', registering ? `${registering} 个已到 Host、正在登记到本页` : ''].filter(Boolean).join(' · ') || undefined;
  if (s.kind === 'conflict') steps.push({ key: 'page', name: '本页正文', tone: 'bad', text: '和别处的修改有重叠', detail: '在页面上方选择保留哪一边；选择之前不会保存，你的输入都还在。' });
  else if (s.kind === 'uncertain') steps.push({ key: 'page', name: '本页正文', tone: 'bad', text: '保存结果不确定', detail: s.message, action: { label: '核对', run: () => void ctrl.recheck() } });
  else if (s.kind === 'failed' && state.dirty) steps.push({ key: 'page', name: '本页正文', tone: 'bad', text: '这次没有保存', detail: s.message, action: { label: '立即保存', run: save } });
  else if (s.kind === 'checking') steps.push({ key: 'page', name: '本页正文', tone: 'busy', text: '正在向 Host 核对', detail: s.message });
  else if (state.dirty && s.kind === 'saving') steps.push({ key: 'page', name: '本页正文', tone: 'busy', text: '正在发往 Host', detail: upDetail });
  else if (state.dirty) steps.push({ key: 'page', name: '本页正文', tone: 'wait', text: '有修改还没保存', detail: upDetail ?? '停笔约 1 秒后自动保存。', action: { label: '立即保存', run: save } });
  else steps.push({ key: 'page', name: '本页正文', tone: moving || registering ? 'busy' : 'done', text: `${state.local.blocks.length} 块，与 Host 一致`, detail: upDetail });

  const unconfirmed = s.kind === 'uncertain' || s.kind === 'conflict' || (s.kind === 'failed' && state.dirty);
  if (state.dirty || unconfirmed || s.kind === 'saving' || s.kind === 'checking') {
    steps.push({ key: 'host', name: 'Host', tone: unconfirmed ? 'bad' : 'wait', text: `当前修改尚未确认${rev ? ` · 最近确认 ${rev}` : ''}`, detail: unconfirmed ? '以核对后的 Host 结果为准。' : undefined });
  } else {
    steps.push({
      key: 'host',
      name: 'Host',
      tone: 'done',
      text: s.kind === 'saved' ? `已保存${rev ? ` · ${rev}` : ''}${s.at ? ` · ${hhmm(s.at)}` : ''}` : `这一版由 Host 保存${rev ? ` · ${rev}` : ''}`,
      detail: '刷新或换会话后可以恢复。',
    });
  }
  if (obsidianStep) steps.push(obsidianStep);

  return (
    <Pop
      label="这页到了哪一步"
      trigger={({ open, toggle, panelId }) => (
        <>
          <button
            type="button"
            className={`fa-savebadge is-${tone}`}
            title={title}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`保存状态：${label}${extra ? `，${extra}` : ''}。${title} 点击查看这页到了哪一步`}
            onClick={toggle}
          >
            <span className="fa-savebadge__dot" aria-hidden="true" />
            <span className="fa-savebadge__text">{label}</span>
            {extra && <span className="fa-savebadge__extra">· {extra}</span>}
          </button>
          <span className="fa-sr" role="status">
            {label}
          </span>
        </>
      )}
    >
      {() => (
        <div className="fa-trail">
          <p className="fa-trail__h">这页到了哪一步</p>
          <ol className="fa-trail__steps">
            {steps.map((st) => (
              <li key={st.key} className={`fa-trail__step is-${st.tone}`}>
                <span className="fa-trail__dot" aria-hidden="true" />
                <div className="fa-trail__main">
                  <p className="fa-trail__row">
                    <span className="fa-trail__name">{st.name}</span>
                    <span className="fa-trail__text">{st.text}</span>
                  </p>
                  {st.detail && <p className="fa-trail__detail">{st.detail}</p>}
                </div>
                {st.action && (
                  <button type="button" className="fa-btn fa-btn--sm" onClick={st.action.run}>
                    {st.action.label}
                  </button>
                )}
              </li>
            ))}
          </ol>
          <p className="fa-trail__foot">“理一理”读取的是 Host 上保存好的版本；发送前会先记下输入框、保存本页，并等文件登记完成。</p>
        </div>
      )}
    </Pop>
  );
}

/* ───────────────────────── 本页在 Obsidian：状态标签 + 笔记小卡 ───────────────────────── */

function NoteCard({ info, onOpenData, close }: { info: NoteInfo; onOpenData: () => void; close: () => void }) {
  const t = info.target;
  const [copied, setCopied] = useState<'ok' | 'manual' | null>(null);
  const manualRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (copied === 'manual') manualRef.current?.select();
    if (copied !== 'ok') return;
    const tm = setTimeout(() => setCopied(null), 2200);
    return () => clearTimeout(tm);
  }, [copied]);
  const copy = async () => {
    if (!t) return;
    setCopied((await copyToClipboard(t.wikilink, null)) ? 'ok' : 'manual');
  };
  const synced = t?.state === 'synced';
  return (
    <div className="fa-note">
      <p className="fa-note__h">
        <Icon name="vault" size={14} />
        <span>Obsidian 笔记</span>
        <span className={`fa-note__state is-${info.step.tone}`}>{info.step.text}</span>
      </p>
      {t && (
        <p className="fa-note__path" title={t.relativePath}>
          {t.relativePath}
        </p>
      )}
      {info.step.detail && <p className="fa-help">{info.step.detail}</p>}
      {synced && t && (
        <>
          <div className="fa-note__acts">
            {/* 真实的 obsidian:// 链接，由用户点击打开；不自动唤起原生应用 */}
            <a className="fa-btn fa-btn--sm fa-btn--primary" href={t.uri}>
              <Icon name="external" size={13} />
              在 Obsidian 中打开
            </a>
            <button type="button" className="fa-btn fa-btn--sm" onClick={() => void copy()} aria-live="polite">
              <Icon name={copied === 'ok' ? 'check' : 'copy'} size={13} />
              {copied === 'ok' ? '已复制' : '复制笔记链接'}
            </button>
          </div>
          {copied === 'manual' ? (
            <div className="fa-note__manual">
              <p className="fa-help fa-text-warn">宿主没有允许写入剪贴板，链接已选中，请按 Ctrl/⌘ + C。</p>
              <input ref={manualRef} className="fa-input fa-note__wikilink" readOnly value={t.wikilink} onFocus={(e) => e.currentTarget.select()} aria-label="笔记链接" />
            </div>
          ) : (
            <p className="fa-note__link" title="粘贴到你的研究笔记、周报里，即可链接到这一页">
              {t.wikilink}
            </p>
          )}
        </>
      )}
      {info.issues.length > 0 && (
        <ul className="fa-note__issues">
          {info.issues.map((i) => (
            <li key={`${i.name}:${i.message}`}>
              <span className="fa-note__issue-name">{i.name}</span>
              <span className="fa-muted">{i.message}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="fa-note__foot">
        <span>单向同步：在 Obsidian 里的改动不会回写这里。</span>
        <button
          type="button"
          className="fa-link"
          onClick={() => {
            close();
            onOpenData();
          }}
        >
          同步设置与详情
        </button>
      </p>
    </div>
  );
}

function PageObsidian({ info, onOpenData }: { info: NoteInfo | null; onOpenData: () => void }) {
  if (!info) return null;
  if (!info.connected) {
    return (
      <button type="button" className={`fa-pagechip ${info.chipTone}`} onClick={onOpenData} title={info.step.detail}>
        <Icon name="vault" size={12} />
        {info.chip}
      </button>
    );
  }
  return (
    <Pop
      label="Obsidian 笔记"
      align="start"
      trigger={({ open, toggle, panelId }) => (
        <button
          type="button"
          className={`fa-pagechip ${info.chipTone}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
          title={info.target?.state === 'synced' ? '打开这篇笔记或复制它的链接' : '查看这篇笔记的同步状态'}
        >
          <Icon name="vault" size={12} />
          {info.chip}
        </button>
      )}
    >
      {(close) => <NoteCard info={info} onOpenData={onOpenData} close={close} />}
    </Pop>
  );
}

/* ───────────────────────── 实验日期：默认不填，用户点了才写 ───────────────────────── */

function DateField({ value, onChange, disabled }: { value: string | null; onChange: (v: string | null) => void; disabled?: boolean }) {
  const [picking, setPicking] = useState(false);
  const yesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return localDate(d);
  };
  if (picking) {
    return (
      <span className="fa-datefield">
        <input
          type="date"
          className="fa-datefield__input"
          defaultValue={value ?? ''}
          autoFocus
          aria-label="实验日期"
          onChange={(e) => {
            if (e.target.value) {
              onChange(e.target.value);
              setPicking(false);
            }
          }}
          onBlur={() => setPicking(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setPicking(false);
            }
          }}
        />
      </span>
    );
  }
  if (!value) {
    return (
      <span className="fa-datefield">
        <span className="fa-datefield__empty">未填</span>
        <button type="button" className="fa-datefield__q" disabled={disabled} onClick={() => onChange(localDate())}>
          今天
        </button>
        <button type="button" className="fa-datefield__q" disabled={disabled} onClick={() => onChange(yesterday())}>
          昨天
        </button>
        <button type="button" className="fa-datefield__q" disabled={disabled} onClick={() => setPicking(true)}>
          选日期
        </button>
      </span>
    );
  }
  return (
    <span className="fa-datefield">
      <button type="button" className="fa-datefield__val" disabled={disabled} onClick={() => setPicking(true)} title="更改实验日期">
        {friendlyDay(value)}
        <span className="fa-muted is-mono">{value}</span>
      </button>
      <button type="button" className="fa-icon-btn fa-icon-btn--sm" aria-label="清除实验日期" title="清除" disabled={disabled} onClick={() => onChange(null)}>
        <Icon name="close" size={11} />
      </button>
    </span>
  );
}

/* ───────────────────────── 上传流水线（每个文件单独显示阶段） ───────────────────────── */

const STAGE_TEXT: Record<UploadItem['stage'], string> = {
  queued: '排队中',
  uploading: '上传中',
  registering: '已到 Host，正在登记到本页',
  done: '已登记到本页',
  failed: '失败',
  cancelled: '已取消',
};
const FAILED_AT: Record<NonNullable<UploadItem['failedAt']>, string> = { precheck: '检查', upload: '上传阶段', register: '登记阶段' };

function UploadRow({ item, ctrl }: { item: UploadItem; ctrl: PageController }) {
  const pct = Math.round(item.progress * 100);
  const canRetry = item.stage === 'failed' && (item.failedAt === 'register' || (item.failedAt === 'upload' && ctrl.canReupload(item.key)));
  return (
    <li className={`fa-up is-${item.stage}`}>
      <Icon name={item.stage === 'done' ? 'check' : item.stage === 'failed' ? 'alert' : 'file'} size={14} />
      <span className="fa-up__name" title={item.name}>
        {item.name}
      </span>
      <span className="fa-up__size">{formatBytes(item.bytes)}</span>
      <span className="fa-up__stage">
        {item.stage === 'uploading' ? `${STAGE_TEXT.uploading} ${pct}%` : item.stage === 'failed' && item.failedAt ? `${FAILED_AT[item.failedAt]}失败` : STAGE_TEXT[item.stage]}
      </span>
      {item.stage === 'uploading' && (
        <span className="fa-up__bar" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </span>
      )}
      <span className="fa-up__acts">
        {(item.stage === 'uploading' || item.stage === 'queued') && (
          <button type="button" className="fa-link" onClick={() => ctrl.cancelUpload(item.key)}>
            取消
          </button>
        )}
        {canRetry && (
          <button type="button" className="fa-link" onClick={() => ctrl.retryUpload(item.key)}>
            {item.failedAt === 'register' ? '重试登记' : '重新上传'}
          </button>
        )}
        {(item.stage === 'done' || item.stage === 'failed' || item.stage === 'cancelled') && (
          <button type="button" className="fa-icon-btn fa-icon-btn--sm" aria-label={`移除 ${item.name} 这一行`} onClick={() => ctrl.dismissUpload(item.key)}>
            <Icon name="close" size={11} />
          </button>
        )}
      </span>
      {item.message && <span className="fa-up__msg">{item.message}</span>}
    </li>
  );
}

/* ───────────────────────── 主体 ───────────────────────── */

export function ExperimentPageView(props: ExperimentPageProps) {
  const { api, entityId, entities, headingRef, obsidian, organizePage, applyEntity, onClose, onOpenProject, onClassic, onOpenData, focus } = props;
  const uidp = useId();
  const [state, ctrl] = usePage(api, entityId);
  const [face, setFace] = useState<'page' | 'original'>('page');
  const [target, setTarget] = useState<SourceTarget | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [organizing, setOrganizing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [undo, setUndo] = useState<{ block: PageBlockInput; index: number } | null>(null);
  // 输入框内容放在页面控制器里（state.composer）：切页保留、计入未保存摘要；不再是组件内的临时状态
  const draft = state.composer;
  const selection = useReviewSelection();
  const placement = usePlacement(state);
  const [opFlash, setOpFlash] = useState<{ id: string; n: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const dragDepth = useRef(0);

  const view = state.view;
  const entity = view?.entity ?? null;
  const page = view?.page ?? null;

  // 服务器确认的实体写回列表（搜索、时间线、林地计数）
  useEffect(() => {
    if (entity) applyEntity(entity);
  }, [entity, applyEntity]);

  // 新建的空白页：焦点落在标题（推迟一拍，排在外层导航把焦点移到页面标题之后）
  const focusedOnce = useRef(false);
  useEffect(() => {
    if (focusedOnce.current || state.load !== 'ready') return;
    focusedOnce.current = true;
    if (state.local.title || state.local.blocks.length) return;
    const t = setTimeout(() => titleRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [state.load, state.local]);

  // 成功类提示几秒后自动收起
  useEffect(() => {
    if (state.notice?.tone !== 'ok') return;
    const t = setTimeout(() => ctrl.clearNotice(), 5000);
    return () => clearTimeout(t);
  }, [state.notice, ctrl]);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 8000);
    return () => clearTimeout(t);
  }, [undo]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1800);
    return () => clearTimeout(t);
  }, [flash]);

  // 逐处看：滚到那一处改动并轻闪一下
  useEffect(() => {
    if (!opFlash) return;
    document.getElementById(opFlash.id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const t = setTimeout(() => setOpFlash(null), 1800);
    return () => clearTimeout(t);
  }, [opFlash]);
  const goOp = useCallback((id: string) => {
    setFace('page');
    setOpFlash((f) => ({ id, n: (f?.n ?? 0) + 1 }));
  }, []);
  const nextOp = useCallback(
    (from: string) => {
      const order = placement.order;
      if (!order.length) return;
      const next = order[(order.indexOf(from) + 1) % order.length];
      if (next && next !== from) goOp(next);
    },
    [placement.order, goOp],
  );

  const metaById = useMemo(() => new Map((page?.blocks ?? []).map((b) => [b.id, b])), [page]);
  const projects = useMemo(() => entities.filter((e) => e.kind === 'project' && (!isArchived(e) || e.id === entity?.projectId)), [entities, entity?.projectId]);
  const project = entity?.projectId ? entities.find((e) => e.id === entity.projectId) ?? null : null;

  /* ── 编辑动作（引用稳定，执行时读取控制器里的最新正文） ── */
  const full = state.local.blocks.length >= PAGE_LIMITS.blocks;
  const notifyRef = useRef(props.notify);
  notifyRef.current = props.notify;
  const tooMany = useCallback(() => notifyRef.current(`一页最多 ${PAGE_LIMITS.blocks} 块。可以把后续内容放到新的一页。`, 'warn'), []);

  const addBlocks = useCallback(
    (blocks: PageBlockInput[], focusIt = true) => {
      if (ctrl.getState().local.blocks.length + blocks.length > PAGE_LIMITS.blocks) return tooMany();
      ctrl.edit((c) => ({ ...c, blocks: [...c.blocks, ...blocks] }));
      if (focusIt && blocks.length) setFocusId(blocks[blocks.length - 1].id);
    },
    [ctrl, tooMany],
  );

  const blockActions = useMemo<BlockActions>(
    () => ({
      change: (id, next) => ctrl.edit((c) => ({ ...c, blocks: c.blocks.map((x) => (x.id === id ? next : x)) })),
      remove: (id, focusPrev) => {
        const blocks = ctrl.getState().local.blocks;
        const index = blocks.findIndex((x) => x.id === id);
        if (index === -1) return;
        const b = blocks[index];
        const prev = blocks[index - 1];
        ctrl.edit((c) => ({ ...c, blocks: c.blocks.filter((x) => x.id !== id) }));
        const empty = (b.type === 'text' || b.type === 'heading') && !b.text.trim();
        if (!empty) setUndo({ block: b, index });
        if (focusPrev && prev) setFocusId(prev.id);
      },
      move: (id, delta) =>
        ctrl.edit((c) => {
          const i = c.blocks.findIndex((x) => x.id === id);
          const j = i + delta;
          if (i === -1 || j < 0 || j >= c.blocks.length) return c;
          const blocks = c.blocks.slice();
          const [m] = blocks.splice(i, 1);
          blocks.splice(j, 0, m);
          return { ...c, blocks };
        }),
      insertAfter: (id, nb) => {
        if (ctrl.getState().local.blocks.length >= PAGE_LIMITS.blocks) return tooMany();
        ctrl.edit((c) => {
          const i = c.blocks.findIndex((x) => x.id === id);
          const blocks = c.blocks.slice();
          blocks.splice(i === -1 ? blocks.length : i + 1, 0, nb);
          return { ...c, blocks };
        });
        setFocusId(nb.id);
      },
      replaceWith: (id, nb) => {
        ctrl.edit((c) => ({ ...c, blocks: c.blocks.map((x) => (x.id === id ? nb : x)) }));
        setFocusId(nb.id);
      },
      confirm: (id) => void ctrl.confirmBlock(id),
    }),
    [ctrl, tooMany],
  );

  const restore = () => {
    if (!undo) return;
    if (full) return tooMany();
    ctrl.edit((c) => {
      if (c.blocks.some((x) => x.id === undo.block.id)) return c;
      const blocks = c.blocks.slice();
      blocks.splice(Math.min(undo.index, blocks.length), 0, undo.block);
      return { ...c, blocks };
    });
    setUndo(null);
  };

  const onSource = useCallback((s: PageSource) => {
    setFace('original');
    setTarget({ kind: s.snapshotId ? 'snapshot' : 'material', id: (s.snapshotId ?? s.materialId) as string, nonce: Date.now() });
  }, []);
  const jumpBlock = useCallback((id: string) => {
    setFace('page');
    setFlash(id);
  }, []);
  const onFocused = useCallback(() => setFocusId(null), []);

  const ctx: BlockCtx = useMemo(
    () => ({ api, pageId: entityId, materials: page?.materials ?? [], snapshots: page?.snapshots ?? [], busy: !!state.busy, onSource }),
    [api, entityId, page, state.busy, onSource],
  );

  /* ── 托盘输入 ── */
  // 记下：由控制器原子地把输入转成文字 / 表格块并清空；失败（如块数上限）时保留原输入并给出提示
  const commitDraft = () => {
    if (!ctrl.getState().composer.length) return;
    ctrl.commitComposer();
  };

  const onComposerPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files);
    if (files.length) {
      e.preventDefault();
      ctrl.addFiles(files);
      return;
    }
    const text = e.clipboardData.getData('text/plain');
    if (!looksTabular(text)) return;
    const pb = pastedBlock(text, uid);
    if (pb.type !== 'table') return; // 不规则：原文粘进输入框，按文字记下
    if (ctrl.getState().local.blocks.length >= PAGE_LIMITS.blocks) {
      tooMany();
      return; // 不拦截原生粘贴：满页时仍将完整原文留在输入框。
    }
    e.preventDefault();
    addBlocks([pb], false);
    setFlash(pb.id);
    props.notify(`已按制表符转成 ${pb.columns.length} 列 × ${pb.rows.length} 行的表格，原始粘贴另存一份`, 'ok');
  };

  const onPanePaste = (e: ClipboardEvent<HTMLElement>) => {
    if (e.defaultPrevented) return;
    const files = Array.from(e.clipboardData.files);
    if (!files.length) return;
    e.preventDefault();
    ctrl.addFiles(files);
  };

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');
  const dnd = {
    onDragEnter: (e: DragEvent<HTMLElement>) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    },
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => {
      if (!hasFiles(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (!dragDepth.current) setDragging(false);
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) ctrl.addFiles(files);
    },
  };

  const onPaneKey = (e: KeyboardEvent<HTMLElement>) => {
    const t = e.target as HTMLElement;
    // Esc 在输入框里只退出输入，不关闭这一页
    if (e.key === 'Escape' && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) {
      e.preventDefault();
      t.blur();
    }
  };

  const note = noteInfo(obsidian, state);

  /* ── 非就绪状态 ── */
  const head = (
    <header className="fa-pane__head fa-xp__head">
      <button type="button" className="fa-icon-btn" onClick={onClose} aria-label="返回" title="返回（Esc）">
        <Icon name="back" />
      </button>
      <nav className="fa-crumbs" aria-label="位置">
        {project && (
          <>
            <button type="button" className="fa-crumbs__link" onClick={() => onOpenProject(project.id)}>
              {project.title}
            </button>
            <span className="fa-crumbs__sep" aria-hidden="true">
              /
            </span>
          </>
        )}
        <span className="fa-crumbs__here">实验页</span>
      </nav>
      <span className="fa-spacer" />
      {state.load === 'ready' && (
        <>
          <PageTrail
            state={state}
            ctrl={ctrl}
            obsidianStep={note?.step ?? null}
            onCommitDraft={() => {
              commitDraft();
              composerRef.current?.focus();
            }}
          />
          <div className="fa-xseg" role="group" aria-label="页面视图">
            <button type="button" className={`fa-xseg__btn${face === 'page' ? ' is-on' : ''}`} aria-pressed={face === 'page'} onClick={() => setFace('page')}>
              成页
            </button>
            <button type="button" className={`fa-xseg__btn${face === 'original' ? ' is-on' : ''}`} aria-pressed={face === 'original'} onClick={() => setFace('original')}>
              原样
            </button>
          </div>
        </>
      )}
      {focus && (
        <button type="button" className={`fa-icon-btn${focus.on ? ' is-on' : ''}`} onClick={focus.toggle} aria-pressed={focus.on} aria-label={focus.on ? '还原列表' : '展开为整页'} title={focus.on ? '还原列表' : '展开为整页'}>
          <Icon name={focus.on ? 'list' : 'record'} />
        </button>
      )}
      <button type="button" className="fa-icon-btn" onClick={onClassic} aria-label="属性、状态与归档" title="属性、状态与归档（原详情）">
        <Icon name="data" />
      </button>
    </header>
  );

  if (state.load !== 'ready' || !view || !entity || !page) {
    return (
      <section className="fa-pane fa-xp" aria-labelledby={`${uidp}-h`}>
        {head}
        <div className="fa-pane__body fa-pane__body--center">
          <h2 id={`${uidp}-h`} ref={headingRef} tabIndex={-1} className="fa-sr">
            实验页
          </h2>
          {state.load === 'unsupported' ? (
            <Notice
              tone="warn"
              title="宿主还没有提供实验页接口"
              actions={
                <button type="button" className="fa-btn fa-btn--sm" onClick={onClassic}>
                  打开原详情
                </button>
              }
            >
              <p>当前连接没有 getPage / savePage 等页面方法，无法打开或保存实验页。没有使用任何示例数据；这条记录可以先在原详情里查看。</p>
            </Notice>
          ) : state.load === 'error' ? (
            <Notice
              tone="danger"
              title="读取实验页失败"
              actions={
                <>
                  <button type="button" className="fa-btn fa-btn--sm" onClick={() => void ctrl.load()}>
                    <Icon name="refresh" />
                    重试
                  </button>
                  <button type="button" className="fa-btn fa-btn--ghost fa-btn--sm" onClick={onClassic}>
                    打开原详情
                  </button>
                </>
              }
            >
              <p>{state.loadError}</p>
            </Notice>
          ) : (
            <Spinner label="正在从 Host 读取这一页…" />
          )}
        </div>
      </section>
    );
  }

  /* ── 衍生计数（只来自真实数据） ── */
  const pendingBlocks = page.blocks.filter((b) => b.pendingReview && state.local.blocks.some((x) => x.id === b.id));
  const pendingOps = page.proposals.reduce((n, p) => n + p.operations.filter((o) => o.status === 'pending').length, 0);
  const noCaption = state.local.blocks.filter((b) => b.type === 'media' && !b.caption.trim());
  const converted = !!getExperimentPage(entity);
  const legacyRun = !converted && !!getRunWorkflow(entity);
  const visibleUploads = state.uploads.filter((u) => u.stage !== 'done' || u.message);
  const doneUploads = state.uploads.filter((u) => u.stage === 'done' && !u.message);
  const title = state.local.title;

  return (
    <section
      className={`fa-pane fa-xp${dragging ? ' is-dragging' : ''}`}
      aria-labelledby={`${uidp}-h`}
      onPaste={onPanePaste}
      onKeyDown={onPaneKey}
      {...dnd}
    >
      {head}
      <div className="fa-pane__body fa-xp__body">
        <h2 id={`${uidp}-h`} ref={headingRef} tabIndex={-1} className="fa-sr">
          实验页：{title || UNTITLED}
        </h2>

        {state.conflict && (
          <Notice
            tone="warn"
            live
            title="这一页在别处也被修改了"
            actions={
              <>
                <button type="button" className="fa-btn fa-btn--sm fa-btn--primary" onClick={() => ctrl.resolveConflict('mine')}>
                  合并，重叠处保留我的
                </button>
                <button type="button" className="fa-btn fa-btn--sm" onClick={() => ctrl.resolveConflict('theirs')}>
                  重叠处采用最新版本
                </button>
              </>
            }
          >
            <p>
              不重叠的修改两边都会保留。重叠的地方：
              {state.conflict.merge.clashes.map((c) => (
                <span key={c.key} className="fa-clash">
                  {c.label}
                  <span className="fa-muted">{c.kind === 'both-edited' ? '（两边都改了）' : c.kind === 'they-deleted' ? '（对方删了、你改了）' : '（你删了、对方改了，会保留对方的）'}</span>
                </span>
              ))}
            </p>
            <p className="fa-help">选择之前不会保存；你的输入一直留在本页。</p>
          </Notice>
        )}

        {(state.save.kind === 'uncertain' || state.save.kind === 'failed') && (
          <Notice
            tone="danger"
            live
            title={state.save.kind === 'uncertain' ? '保存结果不确定' : '这次没有保存'}
            actions={
              state.save.kind === 'uncertain' ? (
                <button type="button" className="fa-btn fa-btn--sm" onClick={() => void ctrl.recheck()}>
                  <Icon name="refresh" />
                  核对
                </button>
              ) : (
                <button type="button" className="fa-btn fa-btn--sm" onClick={() => void ctrl.saveNowFromUser()}>
                  立即保存
                </button>
              )
            }
          >
            <p>{state.save.message}</p>
          </Notice>
        )}

        {state.notice && (
          <div className={`fa-xp__notice is-${state.notice.tone}`} role={state.notice.tone === 'danger' ? 'alert' : 'status'}>
            <Icon name={state.notice.tone === 'ok' ? 'check' : 'alert'} size={14} />
            <span>{state.notice.text}</span>
            <button type="button" className="fa-icon-btn fa-icon-btn--sm" aria-label="关闭提示" onClick={() => ctrl.clearNotice()}>
              <Icon name="close" size={11} />
            </button>
          </div>
        )}

        {!converted && (
          <p className="fa-xp__legacy">
            <Icon name="sprout" size={13} />
            <span>
              这是旧记录的实验页视图：第一次保存后才会把块结构存下来，原有字段保留。
              {legacyRun ? ' 执行清单仍在原详情里。' : ''}
            </span>
          </p>
        )}

        <AwaitingBanner state={state} ctrl={ctrl} onReview={placement.order.length ? () => goOp(placement.order[0]) : undefined} />

        <article className="fa-xp__doc">
          <input
            ref={titleRef}
            className="fa-xp__title"
            value={title}
            maxLength={PAGE_LIMITS.title}
            placeholder={UNTITLED}
            aria-label="实验标题"
            onChange={(e) => {
              const v = e.target.value;
              ctrl.edit((c) => ({ ...c, title: v }));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                const first = state.local.blocks[0];
                if (first) setFocusId(first.id);
                else composerRef.current?.focus();
              }
            }}
          />

          <dl className="fa-xp__props">
            <div>
              <dt>实验日期</dt>
              <dd>
                <DateField value={state.local.experimentDate} onChange={(v) => ctrl.edit((c) => ({ ...c, experimentDate: v }))} />
              </dd>
            </div>
            <div>
              <dt>课题</dt>
              <dd>
                <label className="fa-select-quiet fa-xp__project">
                  <span className="fa-sr">课题</span>
                  <select
                    value={entity.projectId ?? ''}
                    disabled={!!state.busy}
                    onChange={(e) => void ctrl.setProject(e.target.value || null)}
                  >
                    <option value="">未归入课题</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                        {isArchived(p) ? '（已归档）' : ''}
                      </option>
                    ))}
                  </select>
                  <span className="fa-xp__project-val">{project ? project.title : '＋ 归入课题'}</span>
                </label>
              </dd>
            </div>
            <div className="is-quiet">
              <dt>创建</dt>
              <dd>
                <span className="is-mono">{formatDateTime(entity.createdAt)}</span>
                <span className="fa-muted">（自动记录，不等于实验日期）</span>
              </dd>
            </div>
          </dl>

          <div className="fa-xp__strip">
            {pendingBlocks.length > 0 && (
              <button type="button" className="fa-pagechip is-ai" onClick={() => jumpBlock(pendingBlocks[0].id)}>
                <Icon name="spark" size={12} />
                {pendingBlocks.length} 块待核
              </button>
            )}
            {pendingOps > 0 && face === 'original' && (
              <button type="button" className="fa-pagechip is-ai" onClick={() => setFace('page')}>
                {pendingOps} 处提案待定
              </button>
            )}
            {noCaption.length > 0 && (
              <button type="button" className="fa-pagechip is-quiet" onClick={() => jumpBlock(noCaption[0].id)}>
                {noCaption.length} 个素材没写说明
              </button>
            )}
            <span className="fa-pagechip is-quiet" title="素材原件按原始字节保存在 Host；JSON 导出只含引用">
              <Icon name="file" size={12} />
              素材 {page.materials.length}
            </span>
            <PageObsidian info={note} onOpenData={onOpenData} />
            {state.pollError && (
              <span className="fa-pagechip is-warn" title={state.pollError}>
                刷新失败，显示的是上次读取的内容
              </span>
            )}
          </div>

          {face === 'page' ? (
            <>
              <ProposalTray state={state} ctrl={ctrl} ctx={ctx} selection={selection} placement={placement} onGo={goOp} onJumpBlock={jumpBlock} />
              {state.local.blocks.length === 0 ? (
                <div className="fa-xp__empty">
                  <svg className="fa-xp__empty-art" viewBox="0 0 64 64" aria-hidden="true">
                    <rect x="14" y="10" width="36" height="44" rx="5" />
                    <path d="M22 22h20M22 30h14M22 38h18" />
                    <circle cx="46" cy="46" r="9" />
                    <path d="M46 42v8M42 46h8" />
                  </svg>
                  <p className="fa-xp__empty-title">先放进来，再长成一页</p>
                  <p className="fa-help">在下方随手记；从 Excel 粘贴的表格会直接成表；照片、视频、仪器文件拖进来就行。结构可以以后再理。</p>
                  <div className="fa-xp__empty-acts">
                    <button type="button" className="fa-btn fa-btn--sm" onClick={() => addBlocks([newText()])}>
                      <Icon name="edit" size={13} />
                      写文字
                    </button>
                    <button type="button" className="fa-btn fa-btn--sm" onClick={() => addBlocks([newTable()])}>
                      <Icon name="list" size={13} />
                      空表格
                    </button>
                    <button type="button" className="fa-btn fa-btn--sm" onClick={() => fileRef.current?.click()}>
                      <Icon name="upload" size={13} />
                      放入文件
                    </button>
                  </div>
                </div>
              ) : (
                <div className="fa-xp__blocks">
                  {state.local.blocks.map((b, i) => {
                    const ops = placement.byBlock.get(b.id);
                    return (
                      <Fragment key={b.id}>
                        <PageBlockView
                          block={b}
                          meta={metaById.get(b.id)}
                          index={i}
                          total={state.local.blocks.length}
                          ctx={ctx}
                          actions={blockActions}
                          focus={focusId === b.id}
                          onFocused={onFocused}
                          highlight={flash === b.id}
                        />
                        {ops && (
                          <InlineOps items={ops} state={state} ctrl={ctrl} ctx={ctx} selection={selection} onJumpBlock={jumpBlock} flashId={opFlash?.id ?? null} onNext={nextOp} />
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              )}
              <InlineOps items={placement.tail} tail state={state} ctrl={ctrl} ctx={ctx} selection={selection} onJumpBlock={jumpBlock} flashId={opFlash?.id ?? null} onNext={nextOp} />
              {undo && (
                <div className="fa-xp__undo" role="status">
                  已删除一块（{undo.block.type === 'media' ? '素材原件仍保留' : '保存后原样里仍有它的快照'}）
                  <button type="button" className="fa-link" onClick={restore}>
                    撤销
                  </button>
                </div>
              )}
            </>
          ) : (
            <OriginalView state={state} ctx={ctx} target={target} onJumpBlock={jumpBlock} />
          )}
        </article>
      </div>

      <footer className="fa-xp__tray">
        {organizing && <OrganizePanel state={state} ctrl={ctrl} organizePage={organizePage} onClose={() => setOrganizing(false)} />}
        {(visibleUploads.length > 0 || doneUploads.length > 0) && (
          <div className="fa-ups">
            <p className="fa-ups__target">
              将记到：<strong>{title || UNTITLED}</strong>
              {doneUploads.length > 0 && <span className="fa-muted"> · 已登记 {doneUploads.length} 个</span>}
            </p>
            {visibleUploads.length > 0 && (
              <ul className="fa-ups__list">
                {visibleUploads.map((u) => (
                  <UploadRow key={u.key} item={u} ctrl={ctrl} />
                ))}
              </ul>
            )}
          </div>
        )}
        <div className={`fa-composer${draft.length ? ' has-draft' : ''}`}>
          <AutoTextarea
            ref={composerRef}
            className="fa-composer__input"
            value={draft}
            maxLength={PAGE_LIMITS.text}
            placeholder="放点什么…  回车记下，粘贴表格或拖入文件"
            aria-label={`记到「${title || UNTITLED}」${draft.trim() ? '（还没记下）' : ''}`}
            onChange={(e) => ctrl.setComposer(e.target.value)}
            onPaste={onComposerPaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                commitDraft();
              }
            }}
          />
          <div className="fa-composer__bar">
            <button type="button" className="fa-composer__tool" onClick={() => addBlocks([newHeading()])} disabled={full} title="小节标题">
              <span className="fa-composer__glyph" aria-hidden="true">
                H
              </span>
              <span className="fa-composer__lbl">标题</span>
            </button>
            <button type="button" className="fa-composer__tool" onClick={() => addBlocks([newText()])} disabled={full} title="文字">
              <Icon name="edit" size={14} />
              <span className="fa-composer__lbl">文字</span>
            </button>
            <button type="button" className="fa-composer__tool" onClick={() => addBlocks([newTable()])} disabled={full} title="空表格">
              <Icon name="list" size={14} />
              <span className="fa-composer__lbl">表格</span>
            </button>
            <button type="button" className="fa-composer__tool" onClick={() => fileRef.current?.click()} title="放入照片、视频或文件（单个 ≤ 64 MiB）">
              <Icon name="upload" size={14} />
              <span className="fa-composer__lbl">文件</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="fa-file"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) ctrl.addFiles(files);
                e.target.value = '';
              }}
            />
            <span className="fa-spacer" />
            {draft.length > 0 && (
              <span className="fa-composer__hold" title="还没记下：只在这个 Harness 窗口里，AI 和 Obsidian 都看不到。回车记下，Shift + 回车换行。">
                <span className="fa-composer__hold-dot" aria-hidden="true" />
                <span className="fa-composer__lbl">未记下</span>
              </span>
            )}
            {draft.length > 0 && (
              <button type="button" className="fa-composer__tool is-commit" onClick={commitDraft} title="记下（回车）">
                <Icon name="check" size={14} />
                <span className="fa-composer__lbl">记下</span>
              </button>
            )}
            <button
              type="button"
              className={`fa-organize-btn${organizing ? ' is-on' : ''}`}
              aria-expanded={organizing}
              onClick={() => setOrganizing((v) => !v)}
              disabled={state.local.blocks.length === 0 && page.materials.length === 0 && !draft.trim()}
              title={
                state.local.blocks.length === 0 && page.materials.length === 0 && !draft.trim()
                  ? '先放点内容进来'
                  : draft.trim()
                    ? '请模型提议怎么整理这一页（发送前会先记下输入框里的文字）'
                    : '请模型提议怎么整理这一页'
              }
            >
              <Icon name="spark" size={14} />
              理一理
            </button>
          </div>
        </div>
      </footer>

      {dragging && (
        <div className="fa-xp__drop" aria-hidden="true">
          <div className="fa-xp__drop-card">
            <Icon name="upload" size={22} />
            <p>
              松手放入「{title || UNTITLED}」
            </p>
            <span>原件按原始字节保存 · 单个文件不超过 64 MiB</span>
          </div>
        </div>
      )}
    </section>
  );
}
