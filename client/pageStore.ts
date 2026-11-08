import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { ForestApi } from '../shared/model';
import type { PageBlockInput, PageView } from '../shared/page';
import { pastedBlock } from '../shared/page';
import { stageMaterial } from './material-transfer';
import { classifyError } from './forest-model';
import {
  EMPTY_CONTENT,
  PAGE_LIMITS,
  blockInput,
  cloneContent,
  contentOf,
  merge3,
  looksTabular,
  newText,
  sameBlock,
  sameContent,
  titleForSave,
  uid,
  validateContent,
  withinUploadLimit,
} from './pageModel';
import type { Content, MergeResult } from './pageModel';

/**
 * 单页控制器：一页一个，放在模块作用域，按页面 ID（而不是聊天会话）索引。
 *
 * - 持久化只靠服务器：正文停笔约 0.9 秒后 savePage；本内存只是“尚未被 Host 确认”的缓冲，面板卸载后请求照常完成。
 * - 所有写操作（保存、登记素材、接受/拒绝提案、确认核对、改课题）串行执行；每个操作开始前先 flush 最新编辑。
 * - 服务器响应一律经三方合并（base / 本地 / 服务器）写回：只覆盖本地未改动的块，期间新敲的输入不会被响应冲掉。
 * - 结果不确定时先 getPage 核对，不盲目重发；冲突且有重叠时停下来，由用户明确选择。
 */

export type SaveKind = 'clean' | 'pending' | 'saving' | 'saved' | 'failed' | 'checking' | 'uncertain' | 'conflict';

export interface UploadItem {
  key: string;
  name: string;
  bytes: number;
  mime: string;
  stage: 'queued' | 'uploading' | 'registering' | 'done' | 'failed' | 'cancelled';
  progress: number;
  failedAt?: 'precheck' | 'upload' | 'register';
  message?: string;
  uploadId?: string;
  materialId?: string;
}

export interface Awaiting {
  since: number;
  /** 发出指令时已存在的提案 */
  known: string[];
  via: 'sent' | 'copied';
}

export interface PageNotice {
  tone: 'ok' | 'warn' | 'danger';
  text: string;
  at: number;
}

export interface PageState {
  id: string;
  load: 'loading' | 'ready' | 'error' | 'unsupported';
  loadError: string | null;
  /** 最近一次读取失败（已有数据时不打断编辑） */
  pollError: string | null;
  view: PageView | null;
  local: Content;
  /** 还未记入正文的输入；随页面控制器保留，不把它误报为 Host 已保存。 */
  composer: string;
  baseRevision: number | null;
  /** 本地工作版与 Host 已确认版本不同 */
  dirty: boolean;
  save: { kind: SaveKind; message?: string; at?: string };
  conflict: { merge: MergeResult; latest: PageView } | null;
  uploads: UploadItem[];
  busy: string | null;
  notice: PageNotice | null;
  /** 提案预览里用户改过、尚未提交的块（按 operationId） */
  reviewEdits: Record<string, PageBlockInput>;
  awaiting: Awaiting | null;
  lastConfirmedAt: string | null;
}

const PAUSED: SaveKind[] = ['conflict', 'uncertain', 'checking'];
const AUTOSAVE_MS = 900;
const MAX_PARALLEL_UPLOADS = 2;

export function supportsPages(api: ForestApi): boolean {
  const a = api as Partial<ForestApi>;
  return ['createPage', 'getPage', 'savePage', 'decideProposal', 'confirmPageBlock', 'finishMaterial', 'readMaterial', 'beginMaterial'].every(
    (k) => typeof a[k as keyof ForestApi] === 'function',
  );
}

export const reviewEditKey=(proposalId:string,operationId:string)=>JSON.stringify([proposalId,operationId]);

export class PageController {
  api: ForestApi;
  readonly id: string;
  private state: PageState;
  private base: Content = EMPTY_CONTENT;
  private listeners = new Set<() => void>();
  private chain: Promise<unknown> = Promise.resolve();
  private running = 0;
  private epoch = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private saveQueued = false;
  private autoResaves = 0;
  private files = new Map<string, { file: File; abort: AbortController }>();
  private uploadQueue: string[] = [];
  private activeUploads = 0;
  private loading: Promise<void> | null = null;

  constructor(api: ForestApi, id: string, seed?: PageView) {
    this.api = api;
    this.id = id;
    this.state = {
      id,
      load: supportsPages(api) ? 'loading' : 'unsupported',
      loadError: null,
      pollError: null,
      view: null,
      local: EMPTY_CONTENT,
      composer: '',
      baseRevision: null,
      dirty: false,
      save: { kind: 'clean' },
      conflict: null,
      uploads: [],
      busy: null,
      notice: null,
      reviewEdits: {},
      awaiting: null,
      lastConfirmedAt: null,
    };
    if (seed) this.receive(seed);
  }

  /* ── 订阅 ── */

  getState = (): PageState => this.state;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    // 释放计时恰好在挂载前触发时，重新登记，保证同一页始终只有一个控制器
    if (!registry.has(this.id)) registry.set(this.id, this);
    return () => {
      this.listeners.delete(fn);
      maybeRelease(this);
    };
  };

  get idle(): boolean {
    return this.running === 0 && this.listeners.size === 0;
  }

  hasUnsaved(): boolean {
    const s = this.state;
    return (
      s.dirty ||
      s.composer.length > 0 ||
      s.uploads.some((u) => u.stage === 'queued' || u.stage === 'uploading' || u.stage === 'registering' || (u.stage === 'failed' && u.failedAt === 'register')) ||
      Object.keys(s.reviewEdits).length > 0
    );
  }

  /** 未保存摘要，供顶栏“N 份未保存”与 beforeunload 使用 */
  unsavedLabel(): { label: string; attention: boolean } | null {
    const s = this.state;
    const parts: string[] = [];
    if (s.composer.length > 0) parts.push('输入待记下');
    const alert = s.save.kind === 'conflict' || s.save.kind === 'uncertain' || (s.save.kind === 'failed' && s.dirty);
    if (s.save.kind === 'conflict') parts.push('保存冲突待处理');
    else if (alert) parts.push('正文未能保存');
    else if (s.dirty) parts.push(s.save.kind === 'saving' ? '正文保存中' : '正文未保存');
    const moving = s.uploads.filter((u) => u.stage === 'queued' || u.stage === 'uploading').length;
    const registering = s.uploads.filter((u) => u.stage === 'registering').length;
    const stuck = s.uploads.filter((u) => u.stage === 'failed' && u.failedAt === 'register').length;
    if (moving) parts.push(`${moving} 个文件上传中`);
    if (registering) parts.push(`${registering} 个待登记`);
    if (stuck) parts.push(`${stuck} 个登记失败`);
    const attention = alert || stuck > 0;
    const edits = Object.keys(s.reviewEdits).length;
    if (edits) parts.push(`${edits} 处提案修改未提交`);
    return parts.length ? { label: parts.join(' · '), attention } : null;
  }

  private set(patch: Partial<PageState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
    notifyRegistry();
  }

  private patchUpload(key: string, patch: Partial<UploadItem>): void {
    this.set({ uploads: this.state.uploads.map((u) => (u.key === key ? { ...u, ...patch } : u)) });
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      this.running += 1;
      this.epoch += 1;
      try {
        return await fn();
      } finally {
        this.running -= 1;
        this.epoch += 1;
        maybeRelease(this);
      }
    };
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => undefined);
    return p;
  }

  /* ── 读取与合并 ── */

  /** 读取最新视图（首次载入与轮询）。有写操作在途时跳过，写操作会带回最新视图。 */
  load(): Promise<void> {
    if (this.state.load === 'unsupported') return Promise.resolve();
    if (this.loading) return this.loading;
    if (this.running > 0) return Promise.resolve();
    if (!this.state.view && this.state.load === 'error') this.set({ load: 'loading', loadError: null });
    const epoch = this.epoch;
    this.loading = (async () => {
      try {
        const view = await this.api.getPage(this.id);
        if (this.running > 0 || epoch !== this.epoch) return;
        this.receive(view);
        if (this.state.pollError) this.set({ pollError: null });
      } catch (err) {
        const message = classifyError(err).message;
        if (!this.state.view) this.set({ load: 'error', loadError: message });
        else this.set({ pollError: message });
      } finally {
        this.loading = null;
      }
    })();
    return this.loading;
  }

  /**
   * 写回服务器视图。旧于当前视图的结果丢弃；本地未改动的部分跟随服务器，改动过的部分保留。
   * 只有两边都改了同一块时才停下，进入冲突。
   */
  private receive(view: PageView, opts: { force?: boolean } = {}): void {
    const cur = this.state.view;
    if (cur && !opts.force) {
      const a = view.entity;
      const b = cur.entity;
      if (a.revision < b.revision || (a.revision === b.revision && a.updatedAt < b.updatedAt)) return;
    }
    if (!cur || this.state.load !== 'ready') {
      const c = contentOf(view);
      this.base = c;
      this.set({ view, local: cloneContent(c), baseRevision: view.entity.revision, dirty: false, load: 'ready', loadError: null });
      return;
    }
    const theirs = contentOf(view);
    const merge = merge3(this.base, this.state.local, theirs);
    if (merge.clashes.length === 0) {
      this.base = theirs;
      const dirty = !sameContent(merge.mine, theirs);
      const local = sameContent(merge.mine, this.state.local) ? this.state.local : merge.mine;
      let save: PageState['save'] = this.state.save;
      if (save.kind === 'conflict') save = { kind: dirty ? 'pending' : 'saved' };
      else if (!dirty && save.kind === 'pending') save = this.state.lastConfirmedAt ? { kind: 'saved', at: this.state.lastConfirmedAt } : { kind: 'clean' };
      this.set({ view, local, baseRevision: view.entity.revision, dirty, conflict: null, save });
      if (dirty) this.schedule();
    } else {
      this.set({
        view,
        conflict: { merge, latest: view },
        save: { kind: 'conflict', message: `这页在别处也被修改了，有 ${merge.clashes.length} 处与你的修改重叠。你的输入都还在。` },
      });
    }
  }

  /* ── 编辑 ── */

  setComposer(text: string): void {
    if (this.state.load === 'ready' && text !== this.state.composer) this.set({ composer: text });
  }

  /** 同步提交到本页缓冲；先校验再清空，失败时输入一字不丢。 */
  commitComposer(): boolean {
    const text = this.state.composer;
    if (text.length === 0) return true;
    if (!text.trim()) {
      this.note('warn', '输入只有空白，尚未记下；请补充内容或清空输入。');
      return false;
    }
    if (this.state.load !== 'ready') return false;
    if (this.state.local.blocks.length >= PAGE_LIMITS.blocks) {
      this.note('warn', `本页已达 ${PAGE_LIMITS.blocks} 块，输入已保留。请移到新实验页后再记下。`);
      return false;
    }
    const block = looksTabular(text) ? pastedBlock(text, uid) : newText(text);
    const local = { ...this.state.local, blocks: [...this.state.local.blocks, block] };
    const invalid = validateContent(local);
    if (invalid) {
      this.note('warn', `输入已保留，尚未记下：${invalid}`);
      return false;
    }
    // 单次通知避免订阅者见到“正文已加、输入未清”的中间状态。
    const kind = this.state.save.kind;
    this.set({ local, composer: '', dirty: true, save: ['clean', 'saved', 'failed'].includes(kind) ? { kind: 'pending' } : this.state.save });
    this.schedule();
    return true;
  }

  edit(fn: (c: Content) => Content): void {
    if (this.state.load !== 'ready') return;
    const local = fn(this.state.local);
    if (local === this.state.local) return;
    const dirty = !sameContent(local, this.base);
    const k = this.state.save.kind;
    let save = this.state.save;
    if (dirty && (k === 'clean' || k === 'saved' || k === 'failed')) save = { kind: 'pending' };
    else if (!dirty && k === 'pending') save = this.state.lastConfirmedAt ? { kind: 'saved', at: this.state.lastConfirmedAt } : { kind: 'clean' };
    this.set({ local, dirty, save });
    if (dirty) this.schedule();
  }

  private schedule(): void {
    if (PAUSED.includes(this.state.save.kind)) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.requestSave();
    }, AUTOSAVE_MS);
  }

  private requestSave(): void {
    if (this.saveQueued) return;
    this.saveQueued = true;
    void this.enqueue(async () => {
      this.saveQueued = false;
      await this.saveNow();
    });
  }

  /** 立即保存（用户点击）；返回本地是否已全部被 Host 确认 */
  saveNowFromUser(): Promise<boolean> {
    if (this.state.save.kind === 'failed') this.autoResaves = 0;
    return this.enqueue(async () => this.commitComposer() && await this.saveNow(true) && this.state.composer.length === 0);
  }

  /** 供“理一理”等动作使用：先把最新编辑保存好 */
  flush(): Promise<boolean> {
    return this.enqueue(async () => this.commitComposer() && await this.saveNow() && this.state.composer.length === 0);
  }

  /** AI 不能越过尚未登记的材料，也不能漏掉等待保存期间新敲的输入。 */
  async prepareOrganize(): Promise<boolean> {
    this.clearNotice();
    if (this.state.load !== 'ready') {
      this.note('warn', '尚未读到本页，请等页面加载完成后再整理。');
      return false;
    }
    const materialsReady = (): boolean => {
      const pending = this.state.uploads.filter(u => u.stage !== 'done' && u.stage !== 'cancelled');
      if (!pending.length) return true;
      this.note('warn', pending.some(u => u.stage === 'failed')
        ? `${pending.length} 个文件还没登记成功，请重试或取消这些文件后再整理。`
        : `${pending.length} 个文件仍在上传或登记，请完成后再整理，避免漏掉材料。`);
      return false;
    };
    if (!materialsReady()) return false;
    if (!await this.flush()) {
      if (!this.state.notice) this.note('warn', this.state.composer.length
        ? '保存期间又有新输入，已保留。请再次发送，将它一并交给 AI。'
        : '本页还有没保存成功的修改，请先处理保存状态再整理。');
      return false;
    }
    return materialsReady();
  }

  /** 只能在队列内调用 */
  private async saveNow(fromUser = false): Promise<boolean> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.state.dirty) return true;
    if (this.state.save.kind === 'conflict' || this.state.save.kind === 'uncertain') return false;
    if (this.state.baseRevision === null) return false;
    const sent = cloneContent(this.state.local);
    const invalid = validateContent(sent);
    if (invalid) {
      this.set({ save: { kind: 'failed', message: `没有提交：${invalid}` } });
      return false;
    }
    this.set({ save: { kind: 'saving' } });
    try {
      const view = await this.api.savePage({
        id: this.id,
        expectedRevision: this.state.baseRevision,
        requestId: uid(),
        title: titleForSave(sent.title),
        experimentDate: sent.experimentDate,
        blocks: sent.blocks,
      });
      this.base = sent;
      this.autoResaves = 0;
      this.receive(view, { force: true });
      return this.confirmed();
    } catch (err) {
      const c = classifyError(err);
      if (c.kind === 'validation' || c.kind === 'notfound') {
        this.set({ save: { kind: 'failed', message: `Host 拒绝了这次保存：${c.message}` } });
        return false;
      }
      // 冲突或结果不确定：先读回核对，绝不直接重发
      this.set({
        save: {
          kind: 'checking',
          message: c.kind === 'conflict' ? '这页在别处有新修改，正在读取最新版本…' : `保存结果不确定（${c.message}），正在向 Host 核对…`,
        },
      });
      try {
        const view = await this.api.getPage(this.id);
        this.receive(view, { force: true });
        if (this.state.conflict) return false;
        if (!this.state.dirty) return this.confirmed(c.kind === 'conflict' ? undefined : '核对结果：这次修改已经保存');
        if (this.autoResaves >= 2) {
          this.set({ save: { kind: 'failed', message: '连续遇到并发修改，已暂停自动保存。你的输入都在，点“立即保存”再试。' } });
          return false;
        }
        this.autoResaves += 1;
        // 核对确认尚未保存（或已与别处不重叠的修改合并），基于最新修订重新提交，新的 requestId
        this.set({ save: { kind: 'pending', message: c.kind === 'conflict' ? '已合并另一处不重叠的修改' : '核对结果：尚未保存，重新提交' } });
        return await this.saveNow(fromUser);
      } catch (err2) {
        this.set({
          save: {
            kind: 'uncertain',
            message: `${c.kind === 'conflict' ? '读取最新版本失败' : '保存结果不确定，核对也没有成功'}：${classifyError(err2).message}。输入保留在本页，请先不要关闭；恢复后点“核对”。`,
          },
        });
        return false;
      }
    }
  }

  private confirmed(message?: string): boolean {
    const at = new Date().toISOString();
    if (this.state.conflict) return false;
    this.set({ save: { kind: this.state.dirty ? 'pending' : 'saved', at, message }, lastConfirmedAt: at });
    if (this.state.dirty) this.schedule();
    return !this.state.dirty;
  }

  /** “结果不确定”之后由用户发起的核对 */
  recheck(): Promise<void> {
    return this.enqueue(async () => {
      this.set({ save: { kind: 'checking', message: '正在向 Host 核对…' } });
      try {
        const view = await this.api.getPage(this.id);
        this.set({ save: { kind: 'pending' } });
        this.receive(view, { force: true });
        if (this.state.conflict) return;
        if (this.state.dirty) await this.saveNow(true);
        else this.confirmed('核对完成：Host 上的内容与本页一致');
      } catch (err) {
        this.set({ save: { kind: 'uncertain', message: `核对失败：${classifyError(err).message}。输入仍保留在本页。` } });
      }
    });
  }

  /** 冲突处理：mine = 重叠处保留我的；theirs = 重叠处采用最新版本。都基于最新修订重新合并一次。 */
  resolveConflict(which: 'mine' | 'theirs'): void {
    const c = this.state.conflict;
    if (!c) return;
    const theirs = contentOf(c.latest);
    const merge = merge3(this.base, this.state.local, theirs);
    const local = which === 'mine' ? merge.mine : merge.theirs;
    this.base = theirs;
    this.autoResaves = 0;
    const dirty = !sameContent(local, theirs);
    this.set({ local, baseRevision: c.latest.entity.revision, conflict: null, dirty, save: dirty ? { kind: 'pending' } : { kind: 'saved', at: this.state.lastConfirmedAt ?? undefined } });
    if (dirty) this.requestSave();
  }

  /* ── 素材：上传（可并行、可继续打字）→ 登记（进入串行队列） ── */

  addFiles(list: File[]): void {
    const items: UploadItem[] = [];
    for (const file of list) {
      const key = uid();
      const problem = withinUploadLimit(file);
      items.push({
        key,
        name: file.name || '未命名文件',
        bytes: file.size,
        mime: file.type || 'application/octet-stream',
        stage: problem ? 'failed' : 'queued',
        progress: 0,
        ...(problem ? { failedAt: 'precheck' as const, message: problem } : {}),
      });
      if (!problem) {
        this.files.set(key, { file, abort: new AbortController() });
        this.uploadQueue.push(key);
      }
    }
    if (items.length) this.set({ uploads: [...this.state.uploads, ...items] });
    this.pump();
  }

  private pump(): void {
    while (this.activeUploads < MAX_PARALLEL_UPLOADS && this.uploadQueue.length) {
      const key = this.uploadQueue.shift() as string;
      void this.runUpload(key);
    }
  }

  private async runUpload(key: string): Promise<void> {
    const entry = this.files.get(key);
    if (!entry) return;
    this.activeUploads += 1;
    this.patchUpload(key, { stage: 'uploading', progress: 0, failedAt: undefined, message: undefined });
    let uploadId: string;
    try {
      uploadId = await stageMaterial(this.api, this.id, entry.file, (n) => this.patchUpload(key, { progress: n }), entry.abort.signal);
    } catch (err) {
      this.activeUploads -= 1;
      this.pump();
      if (entry.abort.signal.aborted) this.patchUpload(key, { stage: 'cancelled', message: '已取消，Host 上的未完成上传已请求清理' });
      else this.patchUpload(key, { stage: 'failed', failedAt: 'upload', message: classifyError(err).message });
      return;
    }
    this.patchUpload(key, { stage: 'registering', uploadId, progress: 1 });
    // Host keeps the upload slot until registration completes, not merely until
    // the last chunk arrives. Keep the browser slot for the same lifetime.
    try {
      await this.register(key);
    } finally {
      this.activeUploads -= 1;
      this.pump();
    }
  }

  private register(key: string): Promise<void> {
    return this.enqueue(async () => {
      const item = this.state.uploads.find((u) => u.key === key);
      if (!item?.uploadId) return;
      this.patchUpload(key, { stage: 'registering', failedAt: undefined, message: undefined });
      // 登记前先保存最新编辑；保存失败也继续登记（素材与媒体块由 Host 原子追加，合并时保留本地输入）
      await this.saveNow();
      try {
        const view = await this.api.finishMaterial({ uploadId: item.uploadId });
        this.receive(view, { force: true });
        this.patchUpload(key, { stage: 'done' });
        this.files.delete(key);
        if (!this.state.dirty && this.state.save.kind !== 'conflict') this.confirmed();
      } catch (err) {
        const c = classifyError(err);
        if (c.kind === 'network' || c.kind === 'unknown') {
          try {
            const view = await this.api.getPage(this.id);
            this.receive(view, { force: true });
            this.patchUpload(key, {stage:'failed',failedAt:'register',message:`登记结果未知（${c.message}）。页面已刷新；同名和大小不能证明是本次文件。点“重试登记”会沿用同一个上传凭据核对。`});
          } catch {
            this.patchUpload(key, { stage: 'failed', failedAt: 'register', message: `登记结果不确定（${c.message}），核对也没有成功。请稍后点“重试登记”，Host 会先识别是否已登记。` });
          }
        } else {
          this.patchUpload(key, {
            stage: 'failed',
            failedAt: 'register',
            message: `${c.message}${c.kind === 'notfound' ? '。上传凭证可能已失效，请重新上传原文件' : ''}`,
          });
        }
      }
    });
  }

  retryUpload(key: string): void {
    const item = this.state.uploads.find((u) => u.key === key);
    if (!item) return;
    if (item.failedAt === 'register' && item.uploadId) {
      void this.register(key);
      return;
    }
    const entry = this.files.get(key);
    if (!entry) return;
    this.files.set(key, { file: entry.file, abort: new AbortController() });
    this.patchUpload(key, { stage: 'queued', progress: 0, failedAt: undefined, message: undefined, uploadId: undefined });
    this.uploadQueue.push(key);
    this.pump();
  }

  /** 失败的文件是否还能直接重传（文件对象只在本页内存中） */
  canReupload(key: string): boolean {
    return this.files.has(key);
  }

  cancelUpload(key: string): void {
    const item = this.state.uploads.find((u) => u.key === key);
    if (!item) return;
    if (item.stage === 'queued') {
      this.uploadQueue = this.uploadQueue.filter((k) => k !== key);
      this.patchUpload(key, { stage: 'cancelled', message: '已取消' });
    } else if (item.stage === 'uploading') {
      this.files.get(key)?.abort.abort();
    }
  }

  dismissUpload(key: string): void {
    const item = this.state.uploads.find((u) => u.key === key);
    if (!item || item.stage === 'uploading' || item.stage === 'registering' || item.stage === 'queued') return;
    this.files.delete(key);
    this.set({ uploads: this.state.uploads.filter((u) => u.key !== key) });
  }

  /* ── AI 提案 ── */

  setReviewEdit(proposalId: string, operationId: string, block: PageBlockInput | null): void {
    const next = { ...this.state.reviewEdits };
    const key=reviewEditKey(proposalId,operationId);
    if (block) next[key] = block;
    else delete next[key];
    this.set({ reviewEdits: next });
  }

  decide(proposalId: string, operationIds: string[], decision: 'accept' | 'reject'): Promise<boolean> {
    return this.enqueue(async () => {
      this.set({ busy: decision === 'accept' ? '正在接受…' : '正在拒绝…', notice: null });
      try {
        if (!(await this.saveNow())) {
          this.note('warn', '本页还有没保存成功的修改，先处理页面顶部的保存状态，再接受或拒绝提案。');
          return false;
        }
        const edits = this.state.reviewEdits;
        const replacements =
          decision === 'accept' ? operationIds.filter((id) => edits[reviewEditKey(proposalId,id)]).map((id) => ({ operationId: id, block: blockInput(edits[reviewEditKey(proposalId,id)]) })) : [];
        const dropEdits = () => {
          const next = { ...this.state.reviewEdits };
          operationIds.forEach((id) => delete next[reviewEditKey(proposalId,id)]);
          this.set({ reviewEdits: next });
        };
        const verb = decision === 'accept' ? '接受' : '拒绝';
        try {
          const view = await this.api.decideProposal({
            id: this.id,
            proposalId,
            requestId: uid(),
            operationIds,
            decision,
            ...(replacements.length ? { replacements } : {}),
          });
          this.receive(view, { force: true });
          dropEdits();
          this.note('ok', `已${verb} ${operationIds.length} 处改动${decision === 'accept' && replacements.length ? `（其中 ${replacements.length} 处用了你修改后的版本）` : ''}`);
          return true;
        } catch (err) {
          const c = classifyError(err);
          if (c.kind === 'network' || c.kind === 'unknown') {
            try {
              const view = await this.api.getPage(this.id);
              this.receive(view, { force: true });
              const p = view.page.proposals.find((x) => x.id === proposalId);
              const want = decision === 'accept' ? 'accepted' : 'rejected';
              if (p && operationIds.every((id) => p.operations.find((o) => o.id === id)?.status === want)) {
                dropEdits();
                this.note('ok', `核对结果：${verb}已经生效`);
                return true;
              }
              this.note('danger', `${verb}结果不确定（${c.message}）。已核对：尚未生效，可以再试一次。`);
            } catch {
              this.note('danger', `${verb}结果不确定（${c.message}），核对也没有成功。请稍后刷新查看提案状态，再决定是否重试。`);
            }
          } else if (c.kind === 'conflict') {
            this.note('danger', `没有执行：${c.message}。提案生成后，它依据的内容或要替换的块已经变化。你的编辑都保留着；可以刷新后重试，或再“理一理”一次。`);
            try {
              this.receive(await this.api.getPage(this.id), { force: true });
            } catch {
              /* 保留当前视图 */
            }
          } else {
            this.note('danger', `没有执行：${c.message}`);
          }
          return false;
        }
      } finally {
        this.set({ busy: null });
      }
    });
  }

  /** 用户明确点击“我已核对” */
  confirmBlock(blockId: string): Promise<boolean> {
    return this.enqueue(async () => {
      this.set({ busy: '正在记录核对…', notice: null });
      try {
        await this.saveNow();
        const mine = this.state.local.blocks.find((b) => b.id === blockId);
        const theirs = this.state.view?.page.blocks.find((b) => b.id === blockId);
        if (!theirs) {
          this.note('warn', '这一块还没有保存到 Host，保存后才能记录核对。');
          return false;
        }
        if (!sameBlock(mine, theirs) || this.state.baseRevision === null) {
          this.note('warn', '这一块还有未保存的修改。等“已保存”出现后再点“我已核对”。');
          return false;
        }
        try {
          const view = await this.api.confirmPageBlock({ id: this.id, expectedRevision: this.state.baseRevision, blockId });
          this.receive(view, { force: true });
          this.note('ok', '已记录你核对过这一块（表示你看过，不代表软件证明了内容正确）');
          return true;
        } catch (err) {
          const c = classifyError(err);
          try {
            const view = await this.api.getPage(this.id);
            this.receive(view, { force: true });
            const b = view.page.blocks.find((x) => x.id === blockId);
            if (b && !b.pendingReview && (c.kind === 'network' || c.kind === 'unknown')) {
              this.note('ok', '核对结果：已记录为你核对过');
              return true;
            }
          } catch {
            /* 下面如实报告 */
          }
          this.note(
            'danger',
            c.kind === 'conflict' ? '页面刚刚有了新修改，没有记录核对。请先看一眼最新内容，再点“我已核对”。' : `没有记录核对：${c.message}`,
          );
          return false;
        }
      } finally {
        this.set({ busy: null });
      }
    });
  }

  /** 改课题：走现有 update（只改 projectId），之后重新读取页面 */
  setProject(projectId: string | null): Promise<boolean> {
    return this.enqueue(async () => {
      this.set({ busy: '正在更改课题…', notice: null });
      try {
        const ok = await this.saveNow();
        if (!ok || this.state.baseRevision === null) {
          this.note('warn', '正文还没有保存成功，暂不更改课题。');
          return false;
        }
        try {
          await this.api.update({ id: this.id, expectedRevision: this.state.baseRevision, patch: { projectId } });
        } catch (err) {
          const c = classifyError(err);
          try {
            const view = await this.api.getPage(this.id);
            this.receive(view, { force: true });
            if ((view.entity.projectId ?? null) === projectId && (c.kind === 'network' || c.kind === 'unknown')) return true;
          } catch {
            /* 下面如实报告 */
          }
          this.note('danger', c.kind === 'conflict' ? '页面刚刚有了新修改，课题没有更改。请再试一次。' : `课题没有更改：${c.message}`);
          return false;
        }
        this.receive(await this.api.getPage(this.id), { force: true });
        this.note('ok', projectId ? '已归入课题' : '已移出课题');
        return true;
      } catch (err) {
        this.note('warn', `课题已更改，但刷新页面失败：${classifyError(err).message}`);
        return true;
      } finally {
        this.set({ busy: null });
      }
    });
  }

  /* ── 理一理：只记录“已发出/已复制”，等真实提案出现 ── */

  markAwaiting(via: 'sent' | 'copied'): void {
    this.set({ awaiting: { since: Date.now(), known: (this.state.view?.page.proposals ?? []).map((p) => p.id), via } });
  }

  stopAwaiting(): void {
    this.set({ awaiting: null });
  }

  private note(tone: PageNotice['tone'], text: string): void {
    this.set({ notice: { tone, text, at: Date.now() } });
  }

  clearNotice(): void {
    if (this.state.notice) this.set({ notice: null });
  }
}

/* ───────────────────────── 注册表 ───────────────────────── */

const registry = new Map<string, PageController>();
const regListeners = new Set<() => void>();
let regKey = '';
let regVersion = 0;

function summaryKey(): string {
  const parts: string[] = [];
  registry.forEach((c) => {
    const u = c.unsavedLabel();
    if (u) parts.push(`${c.id}:${u.label}:${u.attention ? 1 : 0}:${c.getState().view?.entity.title ?? ''}`);
  });
  return parts.join('|');
}

function notifyRegistry(): void {
  const key = summaryKey();
  if (key === regKey) return;
  regKey = key;
  regVersion += 1;
  regListeners.forEach((fn) => fn());
  syncGuard();
}

function maybeRelease(c: PageController): void {
  // 无人查看、无在途操作、无未保存输入的控制器释放掉；下次打开重新从 Host 读取
  if (c.idle && !c.hasUnsaved() && registry.get(c.id) === c) {
    setTimeout(() => {
      if (c.idle && !c.hasUnsaved() && registry.get(c.id) === c) registry.delete(c.id);
    }, 30_000);
  }
  notifyRegistry();
}

export function pageController(api: ForestApi, id: string): PageController {
  let c = registry.get(id);
  if (!c) {
    c = new PageController(api, id);
    registry.set(id, c);
  } else {
    c.api = api;
  }
  return c;
}

/** createPage 返回后直接用返回的视图建立控制器，不再多读一次 */
export function seedPage(api: ForestApi, view: PageView): void {
  if (!registry.has(view.entity.id)) registry.set(view.entity.id, new PageController(api, view.entity.id, view));
}

export interface UnsavedPage {
  id: string;
  title: string;
  label: string;
  attention: boolean;
}

export function unsavedPages(): UnsavedPage[] {
  const out: UnsavedPage[] = [];
  registry.forEach((c) => {
    const u = c.unsavedLabel();
    if (u) out.push({ id: c.id, title: c.getState().view?.entity.title || '未命名实验', ...u });
  });
  return out;
}

const subscribeRegistry = (fn: () => void) => {
  regListeners.add(fn);
  return () => regListeners.delete(fn);
};
const getRegVersion = () => regVersion;

/** 所有实验页里尚未被 Host 确认的输入（只在摘要变化时触发重渲染） */
export function useUnsavedPages(): UnsavedPage[] {
  const v = useSyncExternalStore(subscribeRegistry, getRegVersion, getRegVersion);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => unsavedPages(), [v]);
}

/** 打开一页：订阅控制器、首次读取，并在面板可见时轮询（等待提案时更频繁） */
export function usePage(api: ForestApi, id: string): [PageState, PageController] {
  const ctrl = useMemo(() => pageController(api, id), [api, id]);
  const state = useSyncExternalStore(ctrl.subscribe, ctrl.getState, ctrl.getState);
  useEffect(() => {
    void ctrl.load();
  }, [ctrl]);
  const waiting = !!state.awaiting;
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void ctrl.load();
    };
    const t = setInterval(tick, waiting ? 2500 : 6000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [ctrl, waiting]);
  return [state, ctrl];
}

/* ───────────────────────── beforeunload：保护尚未被 Host 确认的输入 ───────────────────────── */

let guard = false;
function onBeforeUnload(e: BeforeUnloadEvent): string {
  e.preventDefault();
  e.returnValue = '';
  return '';
}
function syncGuard(): void {
  if (typeof window === 'undefined') return;
  let need = false;
  registry.forEach((c) => {
    if (c.hasUnsaved()) need = true;
  });
  if (need && !guard) {
    window.addEventListener('beforeunload', onBeforeUnload);
    guard = true;
  } else if (!need && guard) {
    window.removeEventListener('beforeunload', onBeforeUnload);
    guard = false;
  }
}
