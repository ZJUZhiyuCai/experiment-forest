import { useEffect, useId, useRef, useState } from 'react';
import type { OrganizePage } from './material-transfer';
import { Icon } from './icons';
import { classifyError } from './forest-model';
import type { PageController, PageState } from './pageStore';
import { organizationPrompt } from './organize-bridge';

const SUGGESTIONS = ['按组分节，每组一张表', '把速记里的数据整理成表', '给图片和视频写说明', '只改错字和排版，不动内容'];
const WAIT_LIMIT_MS = 15 * 60 * 1000;

/**
 * 发给宿主会话的整理指令：只含目标页 ID 与用户这次的整理要求（外加固定的工具用法与不补造约束），
 * 不附带页面正文或其他草稿。模型自己用 forest_page_read 读取，Host 会记下实际交给它的内容。
 */
export function buildOrganizeInstruction(id: string, requirement: string): string {
  return organizationPrompt(id, requirement);
}

async function copyToClipboard(text: string, fallback: HTMLTextAreaElement | null): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 尝试回退 */
  }
  if (fallback) {
    fallback.focus();
    fallback.select();
    try {
      if (document.execCommand('copy')) return true;
    } catch {
      /* 交给用户手动复制 */
    }
  }
  return false;
}

type Phase = { kind: 'idle' } | { kind: 'saving' } | { kind: 'sending' } | { kind: 'error'; message: string } | { kind: 'manual' };

export function OrganizePanel({
  state,
  ctrl,
  organizePage,
  onClose,
}: {
  state: PageState;
  ctrl: PageController;
  organizePage?: OrganizePage;
  onClose: () => void;
}) {
  const uid = useId();
  const [need, setNeed] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const copyRef = useRef<HTMLTextAreaElement>(null);
  const instruction = buildOrganizeInstruction(state.id, need);
  const title = state.local.title.trim() || '未命名实验';
  const busy = phase.kind === 'saving' || phase.kind === 'sending';

  useEffect(() => {
    areaRef.current?.focus();
  }, []);

  const go = async () => {
    setPhase({ kind: 'saving' });
    // 调用前先把本页保存好：模型读到的是 Host 上已确认的版本
    const saved = await ctrl.flush();
    if (!saved) {
      setPhase({ kind: 'error', message: '本页还有没保存成功的修改，先处理页面顶部的保存状态，再来理一理。这样模型读到的才是你现在看到的内容。' });
      return;
    }
    setPhase({ kind: 'sending' });
    if (organizePage) {
      try {
        const via = await organizePage(state.id, need);
        ctrl.markAwaiting(via);
        onClose();
        return;
      } catch (err) {
        setPhase({kind:'error',message:`发送结果未知（${classifyError(err).message}）。请先查看当前 Harness 会话是否已有这条指令，再决定是否重新发送。你的整理要求仍保留。`});
        return;
      }
    }
    const ok = await copyToClipboard(instruction, copyRef.current);
    if (ok) {
      ctrl.markAwaiting('copied');
      onClose();
    } else setPhase({ kind: 'manual' });
  };

  return (
    <div
      className="fa-organize"
      role="dialog"
      aria-labelledby={`${uid}-h`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="fa-organize__head">
        <h3 id={`${uid}-h`} className="fa-organize__title">
          <Icon name="spark" size={15} />
          理一理
        </h3>
        <button type="button" className="fa-icon-btn fa-icon-btn--sm" aria-label="关闭" onClick={onClose}>
          <Icon name="close" size={12} />
        </button>
      </div>
      <p className="fa-organize__target">
        {organizePage ? '将发到当前会话' : '将复制指令，粘贴到对话里发送'} · 整理「{title}」
      </p>
      <label className="fa-sr" htmlFor={`${uid}-need`}>
        整理要求（可选）
      </label>
      <textarea
        id={`${uid}-need`}
        ref={areaRef}
        className="fa-input fa-organize__need"
        rows={2}
        maxLength={2000}
        value={need}
        disabled={busy}
        placeholder="这次想怎么整理？可以不写。例如：按样品分组，视频观察单列一节"
        onChange={(e) => setNeed(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !busy) {
            e.preventDefault();
            void go();
          }
        }}
      />
      <div className="fa-organize__chips" role="group" aria-label="常用要求">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="fa-organize__chip" disabled={busy} onClick={() => setNeed((v) => (v.trim() ? `${v.trim()}；${s}` : s))}>
            {s}
          </button>
        ))}
      </div>
      <details className="fa-organize__peek">
        <summary>查看将{organizePage ? '发送' : '复制'}的指令</summary>
        <pre>{instruction}</pre>
      </details>
      <p className="fa-help">
        模型只会提交提案，不会直接改页面；接受哪一处由你决定。它会读取本页内容与素材信息，图片预览可能发给你所用的模型服务商。
      </p>
      {phase.kind === 'error' && (
        <p className="fa-help fa-help--error" role="alert">
          {phase.message}
        </p>
      )}
      {phase.kind === 'manual' && (
        <div className="fa-organize__manual">
          <p className="fa-help fa-text-warn">宿主没有允许写入剪贴板。下面的指令已选中，请按 Ctrl/⌘ + C 复制，再粘贴到对话里。</p>
          <textarea ref={copyRef} className="fa-input fa-textarea--mono" readOnly rows={5} value={instruction} onFocus={(e) => e.currentTarget.select()} autoFocus />
          <button
            type="button"
            className="fa-btn fa-btn--sm"
            onClick={() => {
              ctrl.markAwaiting('copied');
              onClose();
            }}
          >
            我已复制，开始等待提案
          </button>
        </div>
      )}
      {phase.kind !== 'manual' && <textarea ref={copyRef} className="fa-sr" readOnly tabIndex={-1} aria-hidden="true" value={instruction} />}
      <div className="fa-organize__actions">
        <button type="button" className="fa-btn fa-btn--ghost fa-btn--sm" onClick={onClose} disabled={busy}>
          取消
        </button>
        <button type="button" className="fa-btn fa-btn--sm fa-organize__go" onClick={() => void go()} disabled={busy}>
          {phase.kind === 'saving' ? '先保存本页…' : phase.kind === 'sending' ? (organizePage ? '正在发送…' : '正在复制…') : organizePage ? '发送' : '复制指令'}
        </button>
      </div>
    </div>
  );
}

function elapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 发出（或复制）指令之后：如实显示“在等”，直到真实提案出现；从不声称 AI 已经完成 */
export function AwaitingBanner({ state, ctrl }: { state: PageState; ctrl: PageController }) {
  const [now, setNow] = useState(() => Date.now());
  const a = state.awaiting;
  useEffect(() => {
    if (!a) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [a]);
  if (!a) return null;
  const fresh = (state.view?.page.proposals ?? []).filter((p) => !a.known.includes(p.id));
  const waited = now - a.since;
  if (fresh.length) {
    return (
      <div className="fa-await is-arrived" role="status">
        <Icon name="spark" size={14} />
        <span>
          收到 {fresh.length} 份新提案，就在下方。逐处看过再决定接受哪些。
        </span>
        <button type="button" className="fa-link" onClick={() => ctrl.stopAwaiting()}>
          知道了
        </button>
      </div>
    );
  }
  return (
    <div className="fa-await" role="status">
      <span className="fa-await__pulse" aria-hidden="true" />
      <span>
        {a.via === 'sent' ? '指令已发到会话。' : '指令已复制，请粘贴到对话并发送。'}
        {waited < WAIT_LIMIT_MS
          ? `模型提交提案后会出现在这里 · 已等 ${elapsed(waited)}`
          : '等了 15 分钟还没有收到提案：模型可能没有调用 forest_page_propose，可以回到对话看看。'}
      </span>
      <button type="button" className="fa-link" onClick={() => ctrl.stopAwaiting()}>
        不再等待
      </button>
    </div>
  );
}
