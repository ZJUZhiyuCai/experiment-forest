import { useId, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { EntityKind, ForestApi, ForestEntity, ImportPreview, ImportResult } from '../shared/model';
import { ENTITY_KINDS } from '../shared/model';
import { Icon, KIND_ICON } from './icons';
import { Notice, Spinner } from './bits';
import type { Notify } from './EntityDetail';
import { KIND, classifyError, localDate } from './forest-model';

type ImportState =
  | { step: 'idle' }
  | { step: 'reading'; name: string }
  | { step: 'previewing'; name: string }
  | { step: 'preview'; name: string; data: unknown; preview: ImportPreview }
  | { step: 'importing'; name: string; data: unknown; preview: ImportPreview }
  | { step: 'done'; name: string; result: ImportResult }
  | { step: 'error'; name: string; message: string; data?: unknown; stale?: boolean };

/** 后端导入上限（Codex 已核验）：20 MiB */
const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function DataPanel({
  api,
  entities,
  headingRef,
  refresh,
  notify,
  onClose,
}: {
  api: ForestApi;
  entities: ForestEntity[];
  headingRef: RefObject<HTMLHeadingElement>;
  refresh: () => Promise<boolean>;
  notify: Notify;
  onClose: () => void;
}) {
  const uid = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  const [imp, setImp] = useState<ImportState>({ step: 'idle' });

  const counts = ENTITY_KINDS.map((k) => ({
    k,
    total: entities.filter((e) => e.kind === k).length,
    archived: entities.filter((e) => e.kind === k && e.status === 'archived').length,
  }));

  const doExport = async () => {
    setExporting(true);
    setExportMsg(null);
    try {
      const exp = await api.export();
      const text = JSON.stringify(exp, null, 2);
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `experiment-forest-${localDate()}.json`;
      a.rel = 'noopener';
      a.style.display = 'none';
      (headingRef.current?.closest('.forest-app') ?? document.body).appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setExportMsg({
        tone: 'ok',
        text: `已生成导出文件（${exp.entities.length} 条条目，${formatBytes(blob.size)}，修订 r${exp.revision}）。如果浏览器没有开始下载，请检查宿主是否拦截了下载。`,
      });
    } catch (err) {
      setExportMsg({ tone: 'danger', text: `导出失败：${classifyError(err).message}` });
    } finally {
      setExporting(false);
    }
  };

  const readFile = async (file: File) => {
    // 后端实际导入上限 20 MiB：超出时直接拒绝，不调用 file.text() / JSON.parse，避免先占满浏览器内存再被 RPC 拒绝
    if (file.size > MAX_IMPORT_BYTES) {
      setImp({
        step: 'error',
        name: file.name,
        message: `文件大小 ${formatBytes(file.size)}，超过导入上限 ${formatBytes(MAX_IMPORT_BYTES)}（20 MiB），未读取。请拆分文件或先清理旧导出中的无关内容后再试。现有数据未受影响。`,
      });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setImp({ step: 'reading', name: file.name });
    let data: unknown;
    try {
      const text = await file.text();
      data = JSON.parse(text);
    } catch {
      setImp({ step: 'error', name: file.name, message: '无法读取文件或不是有效的 JSON。现有数据未受影响。' });
      return;
    }
    await preview(file.name, data);
  };

  const preview = async (name: string, data: unknown) => {
    setImp({ step: 'previewing', name });
    try {
      const p = await api.previewImport({ data });
      setImp({ step: 'preview', name, data, preview: p });
    } catch (err) {
      setImp({ step: 'error', name, data, message: `预览失败：${classifyError(err).message}。现有数据未受影响。` });
    }
  };

  const confirmImport = async () => {
    if (imp.step !== 'preview') return;
    const { name, data, preview: p } = imp;
    setImp({ step: 'importing', name, data, preview: p });
    try {
      const result = await api.import({ data, expectedRevision: p.revision });
      setImp({ step: 'done', name, result });
      notify(`导入完成：新增 ${result.imported} 条，未变化 ${result.unchanged} 条`, 'ok');
      void refresh();
    } catch (err) {
      const c = classifyError(err);
      setImp({
        step: 'error',
        name,
        data,
        stale: c.kind === 'conflict',
        message:
          c.kind === 'conflict'
            ? '预览之后数据已发生变化（例如面板或 DeepSeek 会话里有新的保存），导入未执行。请重新预览。'
            : c.kind === 'network' || c.kind === 'unknown'
              ? `导入结果不确定（${c.message}）。请先刷新核对数据，再重新预览——服务端会识别已导入的内容。`
              : `导入失败：${c.message}`,
      });
    }
  };

  const reset = () => {
    setImp({ step: 'idle' });
    if (fileRef.current) fileRef.current.value = '';
  };

  const busy = imp.step === 'reading' || imp.step === 'previewing' || imp.step === 'importing';

  return (
    <section className="fa-pane fa-data" aria-labelledby={`${uid}-h`}>
      <header className="fa-pane__head">
        <button type="button" className="fa-icon-btn" onClick={onClose} aria-label="关闭数据面板" title="关闭（Esc）">
          <Icon name="back" />
        </button>
        <nav className="fa-crumbs" aria-label="位置">
          <span className="fa-crumbs__here">
            <Icon name="data" size={14} />
            导入与导出
          </span>
        </nav>
      </header>
      <div className="fa-pane__body">
        <header className="fa-page-head">
          <div className="fa-page-head__text">
            <h2 id={`${uid}-h`} ref={headingRef} tabIndex={-1} className="fa-page-title">
              导入与导出
            </h2>
            <p className="fa-page-sub">备份全部数据，或从旧版实验小森林迁移。</p>
          </div>
        </header>

        <section className="fa-section">
          <h3 className="fa-h3">当前数据</h3>
          <ul className="fa-ledger">
            {counts.map(({ k, total, archived }) => (
              <li key={k}>
                <span className="fa-ledger__n">{total}</span>
                <span className="fa-ledger__label">
                  <Icon name={KIND_ICON[k]} size={13} />
                  {KIND[k].label}
                </span>
                {archived > 0 && <span className="fa-ledger__sub">含归档 {archived}</span>}
              </li>
            ))}
          </ul>
        </section>

        <section className="fa-card fa-block">
          <div className="fa-block__text">
            <h3 className="fa-block__title">导出</h3>
            <p className="fa-help">从服务端导出完整数据（包括已归档条目与导入记录），保存为 JSON 文件。</p>
          </div>
          <button type="button" className="fa-btn" onClick={() => void doExport()} disabled={exporting}>
            {exporting ? <Spinner label="正在导出…" /> : (<><Icon name="download" />导出 JSON</>)}
          </button>
          {exportMsg && (
            <div className="fa-block__full">
              <Notice tone={exportMsg.tone} live>
                <p>{exportMsg.text}</p>
              </Notice>
            </div>
          )}
        </section>

        <section className="fa-card fa-block">
          <div className="fa-block__text">
            <h3 className="fa-block__title">导入</h3>
            <p className="fa-help">
              支持旧版“实验小森林”导出的 JSON 和本插件导出的文件。先预览、再确认；服务端会去重、保留原有字段，并且不会导入旧版的 API 密钥或聊天记录。单个文件不超过 20 MiB。
            </p>
          </div>
          <div className="fa-block__full">
          <div className="fa-drop">
            <input
              ref={fileRef}
              id={`${uid}-file`}
              className="fa-file"
              type="file"
              accept="application/json,.json"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void readFile(f);
              }}
            />
            <label htmlFor={`${uid}-file`} className={`fa-btn${busy ? ' is-disabled' : ''}`}>
              <Icon name="upload" />
              选择 JSON 文件…
            </label>
            {imp.step !== 'idle' && <span className="fa-muted fa-drop__name">{imp.name}</span>}
          </div>

          {(imp.step === 'reading' || imp.step === 'previewing') && <Spinner label={imp.step === 'reading' ? '正在读取文件…' : '正在生成预览…'} />}

          {(imp.step === 'preview' || imp.step === 'importing') && (
            <ImportPreviewCard
              preview={imp.preview}
              busy={imp.step === 'importing'}
              onConfirm={() => void confirmImport()}
              onCancel={reset}
            />
          )}

          {imp.step === 'done' && (
            <Notice tone="ok" live title="导入完成" actions={<button type="button" className="fa-btn fa-btn--sm" onClick={reset}>完成</button>}>
              <p>
                新增 {imp.result.imported} 条，未变化 {imp.result.unchanged} 条{imp.result.alreadyImported ? '（该文件此前已导入过）' : ''}，当前修订 r{imp.result.revision}。
              </p>
              {imp.result.warnings.length > 0 && (
                <ul className="fa-warnlist">
                  {imp.result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </Notice>
          )}

          {imp.step === 'error' && (
            <Notice
              tone="danger"
              live
              title="导入未完成"
              actions={
                <>
                  {imp.data !== undefined && (
                    <button type="button" className="fa-btn fa-btn--sm" onClick={() => void refresh().then(() => preview(imp.name, imp.data))}>
                      <Icon name="refresh" />
                      {imp.stale ? '重新预览' : '刷新并重新预览'}
                    </button>
                  )}
                  <button type="button" className="fa-btn fa-btn--ghost fa-btn--sm" onClick={reset}>
                    取消
                  </button>
                </>
              }
            >
              <p>{imp.message}</p>
            </Notice>
          )}
          </div>
        </section>
      </div>
    </section>
  );
}

function ImportPreviewCard({
  preview,
  busy,
  onConfirm,
  onCancel,
}: {
  preview: ImportPreview;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const blocked = preview.conflicts.length > 0;
  const nothing = preview.createCount === 0;
  return (
    <div className="fa-preview" role="region" aria-label="导入预览">
      <div className="fa-preview__head">
        <span className="fa-chip">{preview.source === 'legacy' ? '旧版实验小森林' : '实验小森林 v1'}</span>
        <span className="fa-muted is-mono">指纹 {preview.fingerprint.slice(0, 12)}</span>
        <span className="fa-muted is-mono">基于 r{preview.revision}</span>
      </div>
      <dl className="fa-preview__totals">
        <div>
          <dt>文件内条目</dt>
          <dd className="is-mono">{preview.total}</dd>
        </div>
        <div>
          <dt>将新增</dt>
          <dd className="is-mono">{preview.createCount}</dd>
        </div>
        <div>
          <dt>已存在且未变化</dt>
          <dd className="is-mono">{preview.unchangedCount}</dd>
        </div>
        <div>
          <dt>冲突</dt>
          <dd className={`is-mono${blocked ? ' fa-text-danger' : ''}`}>{preview.conflicts.length}</dd>
        </div>
      </dl>
      <ul className="fa-ledger fa-ledger--inline" aria-label="按类型统计">
        {(Object.keys(preview.byKind) as EntityKind[])
          .filter((k) => preview.byKind[k] > 0)
          .map((k) => (
            <li key={k}>
              <Icon name={KIND_ICON[k] ?? 'note'} size={13} />
              {KIND[k]?.label ?? k} <span className="is-mono">{preview.byKind[k]}</span>
            </li>
          ))}
      </ul>
      {preview.alreadyImported && (
        <Notice tone="info">
          <p>这个文件之前已经导入过。再次导入只会补充新增的部分。</p>
        </Notice>
      )}
      {preview.warnings.length > 0 && (
        <Notice tone="warn" title={`提示 ${preview.warnings.length} 条`}>
          <ul className="fa-warnlist">
            {preview.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Notice>
      )}
      {blocked && (
        <Notice tone="danger" title="存在冲突，不能导入">
          <p>以下条目与现有数据冲突，导入不会覆盖现有记录。请先备份，再从待导入文件中移除冲突条目或核对两份内容，调整文件后重新预览。归档现有条目不会消除同 ID 冲突。</p>
          <ul className="fa-warnlist">
            {preview.conflicts.map((c) => (
              <li key={c.id}>
                <strong>{c.title || c.id}</strong>
                <span className="fa-muted is-mono"> {c.id}</span>：{c.reason}
              </li>
            ))}
          </ul>
        </Notice>
      )}
      <div className="fa-preview__actions">
        <button type="button" className="fa-btn fa-btn--primary" disabled={blocked || busy || nothing} onClick={onConfirm}>
          {busy ? <Spinner label="正在导入…" /> : nothing ? '没有需要导入的新内容' : (<><Icon name="check" />确认导入 {preview.createCount} 条</>)}
        </button>
        <button type="button" className="fa-btn fa-btn--ghost" onClick={onCancel} disabled={busy}>
          取消
        </button>
      </div>
    </div>
  );
}
