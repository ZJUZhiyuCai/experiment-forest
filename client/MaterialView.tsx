import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ForestApi } from '../shared/model';
import type { PageMaterial } from '../shared/page';
import { loadMaterialBlob } from './material-transfer';
import { Icon } from './icons';
import { classifyError } from './forest-model';
import { MEDIA_KIND_LABEL, formatBytes, mdhm, mediaKind } from './pageModel';
import type { MediaKind } from './pageModel';

/** 自动载入的上限：图片 12 MB、文本 256 KB；更大的素材点一下再载入，避免侧栏一打开就拉几十 MB */
const AUTO_IMAGE_BYTES = 12 * 1024 * 1024;
const AUTO_TEXT_BYTES = 256 * 1024;
const TEXT_PREVIEW_BYTES = 64 * 1024;

type Load =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; url: string; text?: string; truncated?: boolean }
  | { kind: 'error'; message: string };

/**
 * 通过 loadMaterialBlob 读取原件字节 → 对象 URL。组件卸载或换素材时中止读取并回收 URL。
 * 可能含脚本的格式改成 application/octet-stream 再生成 URL，即使被单独打开也只会下载。
 */
function useMaterialBlob(api: ForestApi, pageId: string, material: PageMaterial, kind: MediaKind) {
  const [state, setState] = useState<Load>({ kind: 'idle' });
  const urlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const release = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);

  const start = useCallback(async (): Promise<string | null> => {
    if (urlRef.current) return urlRef.current;
    release();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ kind: 'loading' });
    try {
      const raw = await loadMaterialBlob(api, pageId, material.id, ctrl.signal);
      if (ctrl.signal.aborted) return null;
      const blob = kind === 'blocked' || kind === 'file' ? new Blob([raw], { type: 'application/octet-stream' }) : raw;
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      let text: string | undefined;
      let truncated = false;
      if (kind === 'text') {
        text = await raw.slice(0, TEXT_PREVIEW_BYTES).text();
        truncated = raw.size > TEXT_PREVIEW_BYTES;
      }
      setState({ kind: 'ready', url, text, truncated });
      return url;
    } catch (err) {
      if (!ctrl.signal.aborted) setState({ kind: 'error', message: classifyError(err).message });
      return null;
    }
  }, [api, pageId, material.id, kind, release]);

  useEffect(() => {
    setState({ kind: 'idle' });
    return release;
  }, [material.id, release]);

  return { state, start };
}

function triggerDownload(url: string, name: string, near: Element | null) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  a.style.display = 'none';
  (near?.closest('.forest-app') ?? document.body).appendChild(a);
  a.click();
  a.remove();
}

export function MaterialPreview({
  api,
  pageId,
  material,
  compact = false,
}: {
  api: ForestApi;
  pageId: string;
  material: PageMaterial;
  compact?: boolean;
}) {
  const kind = mediaKind(material.mime, material.name);
  const { state, start } = useMaterialBlob(api, pageId, material, kind);
  const [playError, setPlayError] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  const auto = (kind === 'image' && material.bytes <= AUTO_IMAGE_BYTES) || (kind === 'text' && material.bytes <= AUTO_TEXT_BYTES);
  useEffect(() => {
    if (auto && state.kind === 'idle') void start();
  }, [auto, state.kind, start]);

  useEffect(() => setPlayError(false), [material.id]);

  const download = async () => {
    setDownloading(true);
    const url = state.kind === 'ready' ? state.url : await start();
    setDownloading(false);
    if (url) triggerDownload(url, material.name, rootRef.current);
  };

  const loadBtn = (label: string) => (
    <button type="button" className="fa-media__load" onClick={() => void start()} disabled={state.kind === 'loading'}>
      <Icon name={kind === 'video' || kind === 'audio' ? 'play' : 'download'} size={15} />
      {state.kind === 'loading' ? '正在从 Host 读取原件…' : label}
      <span className="fa-muted">{formatBytes(material.bytes)}</span>
    </button>
  );

  let stage: ReactNode;
  if (state.kind === 'error') {
    stage = (
      <div className="fa-media__fallback is-error" role="alert">
        <Icon name="alert" size={16} />
        <span>读取原件失败：{state.message}</span>
        <button type="button" className="fa-link" onClick={() => void start()}>
          重试
        </button>
      </div>
    );
  } else if (kind === 'image') {
    stage =
      state.kind === 'ready' ? (
        <button type="button" className="fa-media__img-btn" onClick={() => setZoom(true)} aria-label={`放大查看 ${material.name}`}>
          <img className="fa-media__img" src={state.url} alt={material.name} loading="lazy" decoding="async" />
        </button>
      ) : (
        loadBtn('载入图片')
      );
  } else if (kind === 'video') {
    stage =
      state.kind === 'ready' && !playError ? (
        <video className="fa-media__video" src={state.url} controls preload="metadata" playsInline onError={() => setPlayError(true)} />
      ) : state.kind === 'ready' ? (
        <div className="fa-media__fallback">
          <Icon name="alert" size={16} />
          <span>浏览器播放不了这个视频格式（取决于编解码器）。原件完整保存在 Host，可以下载后用系统播放器打开。</span>
        </div>
      ) : (
        loadBtn('载入并播放')
      );
  } else if (kind === 'audio') {
    stage =
      state.kind === 'ready' && !playError ? (
        <audio className="fa-media__audio" src={state.url} controls preload="metadata" onError={() => setPlayError(true)} />
      ) : state.kind === 'ready' ? (
        <div className="fa-media__fallback">
          <Icon name="alert" size={16} />
          <span>浏览器播放不了这个音频格式。原件已保存，可以下载。</span>
        </div>
      ) : (
        loadBtn('载入并播放')
      );
  } else if (kind === 'text') {
    stage =
      state.kind === 'ready' ? (
        <div className="fa-media__text">
          <pre>{state.text}</pre>
          {state.truncated && <p className="fa-help">只显示前 {formatBytes(TEXT_PREVIEW_BYTES)}；完整内容请下载原件。</p>}
        </div>
      ) : (
        loadBtn('载入文本预览')
      );
  } else {
    stage = (
      <div className="fa-media__fallback">
        <Icon name={kind === 'blocked' ? 'lock' : 'file'} size={16} />
        <span>
          {kind === 'blocked'
            ? '网页、SVG 一类文件可能带有脚本，出于安全考虑不在页面里打开，只提供原件下载。'
            : '这个格式第一版不在页面里预览。原件已按原始字节完整保存，可以下载。'}
        </span>
      </div>
    );
  }

  return (
    <figure ref={rootRef} className={`fa-media fa-media--${kind}${compact ? ' is-compact' : ''}`}>
      <div className="fa-media__stage">{stage}</div>
      <figcaption className="fa-media__meta">
        <span className="fa-media__name" title={material.name}>
          {material.name}
        </span>
        <span className="fa-media__facts">
          <span>{MEDIA_KIND_LABEL[kind]}</span>
          <span>{formatBytes(material.bytes)}</span>
          <span title={`放入时间 ${material.addedAt}`}>放入 {mdhm(material.addedAt)}</span>
          <span className="is-mono" title={`原件 SHA-256：${material.sha256}`}>
            #{material.sha256.slice(0, 8)}
          </span>
        </span>
        <button type="button" className="fa-btn fa-btn--ghost fa-btn--sm fa-media__dl" onClick={() => void download()} disabled={downloading}>
          <Icon name="download" size={14} />
          {downloading ? '读取中…' : '下载原件'}
        </button>
      </figcaption>
      {material.previewError && (
        <p className="fa-help fa-media__warn">
          <Icon name="alert" size={12} /> 预览图没有生成：{material.previewError}（只影响交给模型的预览，原件不受影响）
        </p>
      )}
      {zoom && state.kind === 'ready' && kind === 'image' && (
        <div
          className="fa-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={material.name}
          onClick={() => setZoom(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setZoom(false);
            }
          }}
        >
          <img src={state.url} alt={material.name} />
          <button type="button" className="fa-icon-btn fa-lightbox__x" aria-label="关闭" autoFocus onClick={() => setZoom(false)}>
            <Icon name="close" />
          </button>
        </div>
      )}
    </figure>
  );
}

/** 媒体块指向的素材不在本页清单里（例如刚登记、视图尚未刷新） */
export function MissingMaterial({ materialId }: { materialId: string }) {
  return (
    <div className="fa-media__fallback is-error">
      <Icon name="alert" size={16} />
      <span>
        找不到这份素材（<span className="is-mono">{materialId.slice(0, 8)}</span>）。可能尚未同步到本页视图，稍后会自动刷新。
      </span>
    </div>
  );
}
