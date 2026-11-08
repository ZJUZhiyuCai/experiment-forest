# PRODUCT_NOTES：本轮产品迭代（前端）

> **状态说明**：本轮按 TASK.md 只使用 Read/Write/Edit/Grep/Glob，没有执行类型检查、构建、测试或浏览器验收。下文写的是实现意图和需要 Codex 核对的地方，不代表任何检查已经通过。

范围与 `PRODUCT_SCOPE.md` 一致。只改动了 `output/client/` 与本文件。没有修改 `shared/`、`reference/platform/`、Host、依赖、构建和测试，没有新增网络接口、远程资源或 endpoint。

## 文件变更

| 文件 | 类型 | 内容 |
|---|---|---|
| `client/draftMemory.ts` | 重写 | 会话内存从只存 drafts 扩展为 drafts、**steps**（步骤输入）、**runs**（创建实验请求）三类。新增 `useSessionSteps` / `useSessionRuns`。三类都计入 beforeunload，都参与 `recoverSession` 的“保存中→结果不确定”恢复。 |
| `client/drafts.ts` | 修改 | SOP 草稿新增 `steps`、`initialSteps`、`stepsLocked`。步骤参与 isDirty、validate、buildData（只在改动时写整份 `data.forestWorkflow`）、compareRows（“步骤”对照行）和 rebase。`draftMatchesEntity` 与严格的 `semanticEqual` 没有改动，步骤通过 buildData 自然纳入严格比较。 |
| `client/forest-model.ts` | 修改 | 记录字段改为“实验日期 / 计划日期 / 关联 SOP / 使用的样本”，并加了说明。新增 `downloadText`、`friendlyDay`、`dayDiff`。 |
| `client/icons.tsx` | 修改 | 新增 today、play、up、down、trash、vault、file、lock、list、skip 图标。 |
| `client/runActions.ts` | 新增 | 写操作层：`editStep` / `saveStep` / `loadStepLatest` / `rebaseStep` / `rebaseAndSaveStep` / `checkStep` / `syncStepBases` / `stepConflictFrom`，以及 `submitRun` / `checkRun`。结果一律写回**发起时的会话**。 |
| `client/SopSteps.tsx` | 新增 | `SopStepsEditor`（编辑器内的步骤表）和 `SopStepsView`（只读步骤路径）。 |
| `client/RunChecklist.tsx` | 新增 | `RunChecklist`（执行清单）和 `RunSourceCard`（冻结的 SOP 来源）。 |
| `client/StartRun.tsx` | 新增 | `SopRunPanel`：SOP 详情中的步骤展示、“创建实验草稿”表单，以及由此 SOP 创建的实验列表。 |
| `client/TodayView.tsx` | 新增 | `useLocalDay`、`useAgenda`、`TodayView`（今天工作台）、`TodayCard`（林地顶部摘要）。 |
| `client/ObsidianSync.tsx` | 新增 | `useObsidianStatus`（轮询）、`obsidianSummary`、`ObsidianSection`。 |
| `client/EntityEditor.tsx` | 修改 | SOP 显示步骤编辑器。从 SOP 创建的记录显示执行说明；状态改为已完成但仍有待做步骤时给出提示。 |
| `client/EntityDetail.tsx` | 修改 | 详情页接入执行清单和来源卡、SOP 执行面板、旧记录的“未记录所用版本”提示、无法识别工作流的提示，以及 Markdown 报告按钮。导出 `downloadReport`。 |
| `client/views.tsx` | 修改 | 导航新增“今天”（显示今天与逾期的数量，有逾期时为红色）和 Obsidian 状态点；“导入与导出”改名为“同步与导出”。林地新增今天卡片，并列出未保存的步骤和创建请求。课题页新增“本课题的安排”入口和报告按钮。 |
| `client/ForestApp.tsx` | 修改 | 新增 `today` 视图、`Nav.agendaProject` / `Nav.focusNext`、ActionCtx、Obsidian 状态、本地日和全局安排。未保存数量包含 steps 和 runs。窄屏顶栏新增“今天”按钮（带数量），数据按钮带 Obsidian 状态点。 |
| `client/DataPanel.tsx` | 修改 | 页面改名“同步与导出”，顶部加入 Obsidian 区块，导出说明中区分“备份”和“日常同步”。20 MiB 检查没有改动。 |
| `client/CopyToDeepSeek.tsx` | 修改 | 指令改为先调用 `forest_context`（带目标 ID），截断、省略或需要原文时再用 `forest_read`。对照 SOP 时，运行记录以冻结快照为准，旧记录注明“不一定是当时版本”。实验行附带冻结来源和步骤进度。可选“预览 forest_context”。 |
| `client/forest.css` | 追加 | 全部新类，都限定在 `.forest-app` 下，沿用 `--fa-*` 变量，含浅色/深色、窄栏和 reduced-motion 适配。新增动画名 `forest-blink`，避免覆盖已有的 `forest-pulse`。 |

## 1. SOP → 实验草稿

- **步骤编辑**（`SopStepsEditor`）
  - 每步有标题、说明和“必需”勾选，可以插入、删除（有内容的步骤需二次确认）、上移、下移。最多 100 步，达到上限时禁用添加。
  - 步骤 ID 只在添加时生成一次（`step-<uuid>`，符合 `idSchema`），改名和排序都不会重新生成。
  - 在最后一步的标题里按回车会追加下一步（输入法组字中不触发）。移动、删除后焦点会跟随，并有读屏播报。
- **保存规则**
  - 步骤与原值相同时，不写 `forestWorkflow`，原样保留服务端子树。
  - 步骤有改动时，写整份 `{format, version:1, type:'sop', steps}`。标题不做 trim，与严格比较保持一致。
  - 基线中已有 `forestWorkflow`、但不是可识别的 SOP 工作流时，`stepsLocked=true`：只显示说明，不可编辑，保存时原样保留。
- **草稿流程**：步骤和其它字段一样走草稿流程，包括 dirty 判定、校验（标题非空且 ≤300、说明 ≤4000、ID 唯一、数量 ≤100）、保存、冲突对照、以最新为基准（用户改过就保留自己的整组步骤，否则采用最新），以及结果不确定时按完整 data 严格比较。“收起编辑”不会丢失步骤，因为步骤在会话内存中。
- **创建实验草稿**（SOP 详情 → `SopRunPanel`）
  - 表单
    - 标题默认为“SOP 标题 · 本地日期”，可修改。
    - 课题默认是 SOP 所在课题（课题已归档则为“不归入课题”）。总是显式传 `projectId`，传 `null` 表示明确不归入课题。
    - 计划日期可选，不填时不传。
  - 表单上方写明“将冻结 rN · vX · N 步 · 正文 N 字”，并如实列出提示：SOP 未批准、AI 草稿未人工核对、没有结构化步骤（将生成仅含正文快照的草稿，不猜测步骤）、这条 SOP 有未保存的修改（创建使用服务端已保存的修订）。
  - `requestId` 规则（`submitRun`）
    - 每次新动作生成新 ID。
    - 只有上一次结果不确定、且所有参数（SOP 修订、标题、课题、计划日期）完全相同时，才复用原 ID。
    - 参数有变化时，按钮文案改为“作为新的创建提交”，并说明会使用新的请求编号。
  - 请求结果
    - 修订冲突：明确提示 SOP 已被修改、没有创建。
    - 传输失败：标记为结果不确定。用户可以“核对是否已创建”（`checkRun` 用 `getRunWorkflow(e).requestId` 精确查找，不按标题猜测），也可以原样再次提交。
    - 成功：`applyEntity` 并打开服务端返回的记录。面板已卸载时，导航和提示写入该会话，下次挂载时显示。
  - 已归档的 SOP 禁止创建（见“决定与假设”）。
- **由此创建的实验**：列出 `source.sopId` 等于本 SOP 的记录，显示冻结修订、是否为旧版、已记录步骤数和状态。

## 2. 执行清单

- **入口**：只有 `getRunWorkflow(entity)` 通过校验的记录，才显示 `RunChecklist` 和 `RunSourceCard`。
- **进度与下一步**
  - 显示完成、跳过、待做的计数，以及进度条（跳过部分用斜纹，不只靠颜色区分）。
  - “下一步”卡片可以一键定位到该步。全部记录完后提示“实验状态不会自动改变”。
- **步骤内容**
  - 每步显示序号或状态标记、标题、必需/可选标签和已保存状态。展开后显示说明、三态分段控件（待做/完成/跳过）和观察输入框（跳过时标签变为“跳过原因 *”），以及上次记录时间。
  - 默认展开下一步，以及有未保存输入的步骤。
- **保存**
  - 每一步单独调用 `updateRunStep({id, expectedRevision: baseRevision, stepId, status, observation})`。按钮文案写明“只保存这一步，不会改变记录状态”，Ctrl/⌘+Enter 也可保存。
  - 本地校验：跳过时 `observation.trim()` 不能为空，观察 ≤10000 字。
  - 切换状态不会改动观察内容，也不会生成任何结果。
- **冲突处理**
  - 载入最新值后，并排显示“最新 rN / 我的输入”。
  - 用户可以选“按最新修订保存我的输入”（明确选择后以最新修订为基线保存）、“以最新为基准继续编辑”，或“放弃我的输入”。
- **结果不确定**：“刷新并核对”会比较这一步的真实 status 和 observation。
  - 与草稿相同：确认已保存，清理草稿。
  - 修订未变：确认尚未保存。
  - 其它情况：进入冲突对照。
- **与轮询、编辑草稿的并发**
  - 新修订到达时（`syncStepBases`），如果这一步在服务端仍是用户开始输入时的值，自动把基线修订前移；记录其它部分的修改不会造成无谓冲突。
  - 如果这一步本身被别处改过，保留原基线，并显示“这一步已在别处更新”和“对照最新值”。
  - 本地保存成功后，同一记录其它步骤的草稿按同样规则前移基线。
  - 主编辑草稿和步骤写入互相独立：步骤保存会提升记录修订，之后保存编辑草稿会走原有的冲突、合并流程。合并时 `rebase` 以最新实体为基线，整个运行子树取自最新版本，不会被旧草稿覆盖。
- **只读规则**
  - 记录状态不是 `draft`（已完成或已归档）时，步骤只读，并提示“先把记录状态改回草稿”。
  - 已有的未保存输入仍然显示并保留，可以撤销，但不能保存。
- **普通编辑**
  - 编辑器里不暴露运行子树。`buildData` 复制整份基线 data，未改动的键原样保留，包括 `forestWorkflow`。
  - 正文、样本引用、实验日期和计划日期照常可编辑，两个日期分别有说明。
- **冻结来源卡**
  - 显示 SOP 标题、rN、vX、创建时状态、步骤数和正文字数。
  - 如实标记未批准、AI 未核对（或已核对）、没有结构化步骤（说明不会猜测步骤）。
  - 与当前 SOP 对比：修订相同、已更新到 rN、已归档或未找到。
  - 可折叠查看冻结的正文和步骤。
- **旧记录**：只有 `data.sopId`、没有快照的记录，提示“未记录所用版本”。

## 3. 今天（日常工作台）

- **分组与计数**
  - `useAgenda` 直接调用 `buildAgenda(entities, {today, projectId?})`，分逾期、今天、未来七天、未排期、AI 待核对五组。
  - 计数和进度都由真实数据计算，没有其它统计。
  - 没有任何条目时显示说明，告诉用户怎样让条目出现在这里。
- **本地日**：`useLocalDay` 用本机日期，在下一个本地零点后 1 秒切换。另外每分钟、面板重新可见、窗口获得焦点时各复核一次，应对休眠后计时器被推迟。
- **每行显示**
  - 相对日期（逾期 N 天、今天、明天、N 天后）、类型和课题。
  - 运行记录额外显示进度条和下一步。
  - 有未保存的步骤输入时显示“未保存”。
- **操作**：点行打开原条目；草稿状态且有下一步的运行记录另有“继续”按钮，打开后自动滚到下一步并聚焦（`Nav.focusNext`，一次性）。
- **课题筛选**：按课题筛选保存在导航状态中。课题页的“本课题的安排”会带着筛选进入。
- **入口**
  - 标准/宽屏：导航中“林地”下方新增“今天”。
  - 窄屏：顶栏新增一个图标按钮。
  - 林地顶部：有安排时显示摘要卡（最多 3 项）。
  - 原有课题页和搜索保持不变。

## 4. Obsidian 自动同步

- **接口**：只用 `api.obsidianStatus / configureObsidian / syncObsidian` 和 `shared/obsidian-contract.ts` 的类型，界面不接触本机路径、Node 或 fs。
- **轮询**（`useObsidianStatus`）：面板可见时约每 15 秒一次，同步中约每 3 秒一次，隐藏时暂停，重新可见时立即刷新。请求不会重叠。
- **未连接时**
  - 说明连接只需一次、之后在保存或重启时自动更新专用文件夹（显示 `status.folder`），不需要导出，也不生成压缩包。
  - 用单选列出注册的仓库（名称、已打开标记、仅用于辨认的路径），然后“连接并开始自动同步”。
  - 只有唯一仓库、或只有一个已打开仓库时会预选，但仍需用户点击确认。
  - 没有仓库时提示先在 Obsidian 中打开或创建，然后“重新查找”。
- **已连接时**
  - 显示仓库、专用文件夹、上次同步时间和修订号，以及状态说明：已连接等待、同步中、已同步到 rN、有冲突（保留你的版本）、失败（附 `lastError`，并说明实验记录不受影响）。
  - 冲突文件逐条列出路径和原因，标题写明“已原样保留，没有覆盖”。
  - `stale` 折叠显示为“宿主标记为过期的文件 N 个”（契约没有更多语义，见下文）。
- **操作**：立即同步（错误或冲突时文案为“重试同步”）、更换仓库、断开（二次确认：“断开后不再自动更新 Obsidian 中的专用文件夹”）。
- **单向说明**：始终显示原文“**Obsidian 整理不会回写实验记录。**”，并说明不会改写用户原有笔记。
- **状态点**：导航和窄屏数据按钮上的点颜色为：已同步绿、同步中蓝（闪烁）、冲突黄、失败红；未连接时不显示。

## 5. 上下文与报告

- CopyToDeepSeek 的通用指令改为：先调用一次 `forest_context（id: 目标）`；结果标明 truncated、有省略的条目或需要完整原文时，再用 `forest_read`；需要更多条目时用 `forest_search`。
- **“对照 SOP 查偏差”**
  - 运行记录：明确要求以 `data.forestWorkflow.source` 和 `workflowSource` 的冻结快照为准，当前 SOP 只用来说明差异，并结合每步的状态与观察。
  - 旧记录：说明 sopId 指向当前版本，不一定是当时使用的版本。
- 实验行附带“从 SOP「X」rN 创建并冻结快照，步骤 a 完成 / b 跳过 / c 待做”。
- **预览 forest_context**：可选按钮，调用同一个 `api.context({id})`，显示条目数、按关系分类的数量、数据修订、截断与省略、缺失 ID、是否包含 workflowSource。只是预览，不替代 DeepSeek 的读取。
- **Markdown 报告**
  - 条目详情页和课题页的页脚都有“Markdown 报告”按钮，调用 `createMarkdownReport(primary, entities)`，再用普通 Blob 下载（锚点挂在插件根节点内）。
  - 提示文件名、条目数和大小。按钮说明中写明与 Obsidian 同步是不同用途。

## 保留的正确性

- 原样保留：严格 JSON 比较（null 与缺失有别、不 trim）、编辑时显式写 null 清空、AI 人工核对门槛、完整保留未知字段、20 MiB 导入预检、冲突对照与以最新为基准、同会话草稿恢复、beforeunload。
- 新输入（SOP 步骤、步骤观察、创建请求）都保存在会话内存中，不受导航、轮询、卸载和会话切换影响。刷新或关闭宿主时，beforeunload 会提示（步骤输入有改动或不在 editing 阶段；创建请求不在 editing 阶段）。
- 工作流可以识别时，`forestWorkflow` 不再出现在“保留的其他字段”里，以免重复；带 v1 标记但校验不通过时，照常显示原始值并给出提示。

## 决定与假设（请 Codex 确认）

1. **已归档的 SOP 不能创建实验**：界面禁用了按钮。服务端如果允许，可以删掉 `StartRun.tsx` 中的 `disabled={archivedSop}`。
2. **创建表单只填写还没提交时不计入未保存**：`runHasUnsaved` 只看 creating、uncertain、error 阶段。表单内容仍保存在会话内存中，切换页面不会丢失，但刷新时不会触发 beforeunload。
3. **`stale` 的语义**：契约中只有 `stale: string[]`，界面只如实列出“宿主标记为过期的文件”，不解释成删除或待更新。
4. **步骤冲突时的“按最新修订保存我的输入”**：用户在看过并排对照后点击，就以最新修订为基线立即保存。“以最新为基准继续编辑”只合并、不保存。
5. **自动前移步骤基线**：只有这一步在服务端的值与基线完全相同时才前移。这依赖于 `updateRunStep` 只修改指定步骤，请确认服务端语义一致。
6. 新建 SOP 时步骤可以为空，空步骤不会写 `forestWorkflow`。已有步骤全部删除后会写 `steps: []`。

## 请 Codex 核对的事项（未执行）

- `tsc --noEmit`（strict、noUnusedLocals/Parameters）。重点看以下位置：
  - `memory.StepDraft` 这种命名空间类型引用。
  - `entity.data.sopId` / `sop.data.version` 的属性访问收窄。
  - `ObsidianStatus` 的导入路径（`../shared/obsidian-contract`）。
  - `EntityDetail` 中 `WORKFLOW_KEY` 索引 `JsonObject`。
- 构建与浏览器验收：
  1. SOP 步骤：增删、排序、上限、收起后恢复；冲突合并；结果不确定时的核对。
  2. 创建实验：成功后打开返回的记录；模拟传输失败后原样重试复用同一个 requestId，修改参数后使用新 ID；“核对是否已创建”。
  3. 执行清单：逐步保存、跳过需要原因、修订冲突的两种处理、已完成或已归档时只读、轮询期间输入不丢、与编辑草稿并发。
  4. 今天：分组与数量、课题筛选、继续下一步的定位、跨午夜（可以调整系统时间）。
  5. Obsidian：未连接、同步中、已同步、冲突、失败五种状态；连接、断开、重试、更换仓库；RPC 失败时的显示。
  6. CopyToDeepSeek 文案与 context 预览；两处 Markdown 报告下载。
  7. 窄、中、宽三种布局，浅色和深色，reduced-motion。
