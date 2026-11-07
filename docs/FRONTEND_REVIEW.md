# 实验小森林 · 前端审查报告

> 对象：`reference/`（仓库 a9903eb 的前端必要文件）
> 方法：**仅静态阅读源码**（文件工具），**未安装依赖、未运行、未构建、未在浏览器中验证**。下文凡标注「推断」的，是按代码执行路径推出的运行时行为，需在实现阶段用实际运行确认。
> 引用格式：`文件:行号`，路径相对 `reference/src/`。
> 目标视角：① 科研工作者日常使用 ② 数据真实性 ③ 成为 DeepSeek Harness 插件。

---

## 0. 结论摘要

当前前端更像一个**视觉原型**，还不是能放心存放实验数据的工具。最严重的问题不在于界面风格，而在于以下三点：

1. **它会“说谎”。** 界面里有写死的统计数字、假的系统状态、未保存却提示成功，以及悄悄填进记录的实验参数。AI 不可用时会静默改用模板回复，模板里甚至有伪造的文献引用。对科研数据来说，这类问题必须彻底清除。
2. **数据可能丢失或被“冻”住。** localStorage 解析失败时会**直接删除整类数据**；sessionStorage 缓存与真实数据源不同步，“清除/导入/删除”后可能还会显示旧数据；导入导出只覆盖 7 类实体中的 3 类。
3. **结构上无法直接成为插件。** 应用自行收集 API Key 并直连第三方模型，每个页面各自渲染外壳，依赖境外 CDN 字体和图标，用 `BrowserRouter` 搭配 `base: './'`，也没有任何宿主或服务端的接缝。

**判断：** 旧 `src/` 不适合原地修补，应按任务要求另起 `client/` 入口重做，旧代码只作为迁移和领域知识的参照（见 §7 可保留资产）。

### 优先级总表

| # | 级别 | 问题 | 证据 |
|---|---|---|---|
| 1 | P0 数据真实性 | AI 静默降级为模板/随机回复，含伪造文献 | `lib/mockAI.ts:351-356, 407-412, 472`；`lib/aiChatService.ts:191-201, 324-340`；`lib/mindMapAIService.ts:262-282` |
| 2 | P0 数据真实性 | 记录表单把用户看不到的字段写入记录（重复 3 次、已随机化、已验证） | `components/ExperimentRecordForm.tsx:62-63, 201-211, 264-267` |
| 3 | P0 假成功 | 从样本详情进入编辑，保存后提示“成功”，但从未写入 | `pages/SampleManagement.tsx:21-24` + `components/SampleForm.tsx:147-148` |
| 4 | P0 数据丢失 | JSON 解析失败即 `removeItem` 整个集合 | `lib/storage.ts:36, 146, 250, 340, 492, 613, 868` |
| 5 | P0 假数据 | 仪表盘写死 “SOP 12 / 成功率 94% / 3 个草稿待处理” | `pages/Dashboard.tsx:31-32, 183` |
| 6 | P0 插件化 | 应用内收集 API Key、浏览器直连模型端点 | `pages/Settings.tsx:37-45, 81-95`；4 处重复 `fetch` |
| 7 | P1 交互断裂 | SOP“编辑”跳到未注册路由（404） | `pages/SOPDetail.tsx:42`；`App.tsx:119-121` 无 `/sops/edit` |
| 8 | P1 缓存一致性 | 部分页面绕过缓存直写，列表最长 5 分钟显示旧数据（推断） | `pages/CreateTopic.tsx:4`、`pages/TopicDetail.tsx:4`；`lib/cachedStorage.ts:17-21` |
| 9 | P1 备份不完整 | 导出/导入/清除只处理记录、笔记、SOP 三类 | `pages/Settings.tsx:98, 110-112, 313-315` |
| 10 | P1 信息架构 | 首页与仪表盘重复、课题有两套页面、创建入口各有两套 | `App.tsx:96-121` |

---

## 1. 信息架构（IA）

### 1.1 路由与页面重复
`App.tsx:96-127` 注册了 27 条路由，同一件事往往有多个入口，而且行为不一致：

| 对象 | 重复入口 | 问题 |
|---|---|---|
| 首页 | `/` → `Home`，`/dashboard` → `Dashboard` | 侧栏“控制台”指向 `/`（`components/Sidebar.tsx:47`），`Dashboard` 没有导航入口；两者的统计口径不同（见 §2.1） |
| 课题 | `/projects/:id` → `ProjectDetail`，`/topics/:id` → `TopicDetail` | 两个详情页的字段、操作、数据源都不同：`TopicDetail` 直接读 `@/lib/storage`，`ProjectDetail` 读缓存层 |
| 课题编辑 | `/projects/:id/edit`、`/projects/edit/:id`、`/topics/:id/edit` | `CreateTopic.getProjectId()` 靠解析路径猜 ID（`pages/CreateTopic.tsx:21-41`）；在 `Projects` 内联表单里也能编辑，两边能编辑的字段集不同 |
| 新建课题 | `Projects` 内联表单（`pages/Projects.tsx:527-707`），以及 `/topics/new` | 前者必须填负责人和描述，后者把负责人硬编码为 `'系统管理员'`（`pages/CreateTopic.tsx:159`） |
| 新建记录 | `ExperimentRecords` 内联表单，以及 `/records/new` | 后者保存后**无论从哪里进入都在 3 秒后跳到 `/projects`**（`pages/CreateRecord.tsx:48-53`） |
| 新建 SOP | `SOPs` 内联简表（`pages/SOPs.tsx:73-96`），以及 `/sops/new` 三步向导 | 简表会编造部门、分类、目的、范围（见 §2.3） |

**未注册的页面（死代码）：** `pages/Todo.tsx`、`pages/Schedule.tsx`、`pages/TopicSOPs.tsx`。`pages/MyForest.tsx` 有路由（`App.tsx:98`），但侧栏没有入口。

### 1.2 实体关系只有“单向外键”，主工作流没有串起来
科研的日常链路是：**课题 → 实验（按 SOP 执行、消耗样本）→ 结果 → 下一次实验**。现状是：

- 记录与课题只靠 `projectId` 单向关联。从课题页“新建记录”跳到的是**列表页** `/records?project=…`，不是表单（`pages/ProjectDetail.tsx:312, 336`）。`TopicDetail` 的“添加记录”则是 `/records/new`，**不带课题 ID**（`pages/TopicDetail.tsx:181, 201`），用户得在表单里重新选。
- **记录与 SOP 没有任何关联字段**（`types/index.ts:38-73`），无法回答“这次实验按哪个版本的 SOP 做的”。
- **记录与样本：** 类型里有 `relatedSamples`（`types/index.ts:51`），但表单 UI 不提供选择，新建时还会把它从 `createData` 中丢掉（`components/ExperimentRecordForm.tsx:249-270`）。`sampleService.useSample()`（`lib/storage.ts:789`）在 UI 中从未被调用，样本余量永远不会因实验减少。
- **实验计划：** 有完整的 `ExperimentPlan` 类型和服务（`types/index.ts:141`，`lib/storage.ts:478`），但 pages/components 里**没有任何引用**。日历用的是另一份独立的 `calendarEvents`（`pages/Calendar.tsx:195-220`），和课题、记录都不相连，还混入了与科研无关的“每日心情”（`pages/Calendar.tsx:76-82, 223-232`）。
- **笔记 vs 记录：** 笔记是独立实体，只能可选地挂到一条记录上（`types/index.ts:76-84`），两者的界限对用户不清楚。

### 1.3 导航与外壳
- **每个页面都各自渲染 `<Sidebar>` 和 `<Header>`，并持有自己的 `sidebarCollapsed` 状态**（所有 pages 的第一个 `useState`），没有统一 AppShell。推断：每次切换页面，折叠状态都会被重置。`Dashboard` 的布局写法还和其他页面不一致（`pages/Dashboard.tsx:49-57`：`ml-*` 加在内层而不是外层）。
- 侧栏“活跃课题”其实显示的是前 5 个**任意状态**的课题（`components/Sidebar.tsx:208`）。它监听的 `projects-updated` 事件在整个代码库里**从未被派发**（`components/Sidebar.tsx:40`，全局搜索无 `dispatchEvent`），所以新建或删除课题后侧栏不会更新。
- 侧栏底部显示写死的“版本 v2.0.0 / 状态 正常运行”（`components/Sidebar.tsx:240-249`），与 `package.json:4` 的 `0.0.1` 矛盾，也没有任何真实的健康检查。

---

## 2. 数据真实性（最高优先级）

### 2.1 写死或编造的指标
| 位置 | 内容 |
|---|---|
| `pages/Dashboard.tsx:31` | `{ label: 'SOP文档', value: 12 }`：写死的常量 |
| `pages/Dashboard.tsx:32` | `{ label: '成功率', value: '94%' }`：写死的常量，而且系统里根本没有“成功”的定义 |
| `pages/Dashboard.tsx:183` | “您有 3 个待处理的实验记录草稿”：写死的文案 |
| `pages/Dashboard.tsx:137` | 课题卡“更新: `new Date()`”：永远显示今天，而不是课题的 `updatedAt` |
| `pages/Dashboard.tsx:25` | “最近记录” = `getAll().slice(0, 5)`，存储按插入顺序，所以拿到的是**最早**的 5 条 |
| `pages/Dashboard.tsx:29` | “活跃课题” = `projects.length`（包括已归档、已完成的） |
| `pages/Home.tsx:175` | “森林覆盖率” = `(记录+笔记+SOP) × 3.33%` |
| `pages/MyForest.tsx:68` | 同名指标 = `总数 × 2.5%`，两处口径互相矛盾，而且都没有实际含义 |
| `pages/ProjectDetail.tsx:169` vs `lib/storage.ts:460-462` | 页面显示手填的 `project.progress`，`getStats` 却按完成记录比例计算 `progressPercentage`，同一课题有两个“进度” |

### 2.2 AI：静默降级、模板冒充、伪造引用
用户无法分辨回答是模型生成的还是模板拼的：

- `lib/mockAI.ts:351-356`：`chatWithAPI` 在未配置时，sleep 1–2 秒**模拟网络延迟**后返回模板。`407-412`：API 报错时同样如此。
- `lib/mockAI.ts:472`：`generateLiteratureResponse` 返回“近期《Nature》发表的研究表明…”“近 3 年论文数量增长了 40%”“Smith et al., 2023, Science / Zhang et al., 2022, Cell / Johnson et al., 2021, Nature”。这是**编造的文献与统计**，在科研工具里是最不可接受的一类输出。
- `lib/mockAI.ts:268-274`：`analyzeTopicWithAPI` 先在 `:29-31` 对配置不全抛错，再被自己的 `catch` 吞掉，返回 `analyzeTopicWithMock`。`:287` 的注释写的却是“不使用模拟数据回退”，与实际行为相反。
- `lib/aiChatService.ts:191-201`：API 失败时 `generateMockResponse`；`:324-340` 是从 5 句客套话里**随机挑一句**作为“AI 回复”，并配合 1–2.5 秒延迟（`:316-319`）。
- `lib/mindMapAIService.ts:262-282`：自定义 API 失败会降级为模板；未配置时调用 `chatWithAPI`，而它返回的是不含 JSON 的模板文本。解析失败后再降级到 `generateDefaultMindMap`（`:501-506`）。最终 `pages/TopicMindMap.tsx:180` 照样弹出 `AI 生成成功: N 个节点`。
- `lib/topicAgentService.ts:144-146`：未配置时也走 `chatWithAPI` 的模板（该服务目前无引用，见 §4.6）。
- `components/AIAnalysisModal.tsx:84-90`：`setAnalysisResult(result)` 之后**同一轮**就调用 `handleInsert()`，后者读到的 `analysisResult` 仍是 `null`，直接 `return`（`:106`）。但 `:90` 照样提示“AI分析完成，内容已自动填充”。这是闭包陈旧值导致的假成功（该组件目前无引用，但不应迁移）。

### 2.3 用户没填、系统替用户“填”了
- **实验记录**（`components/ExperimentRecordForm.tsx`）
  - 表单状态默认 `replicates: '3'`、`randomization: true`（`:62-63`）。这两个字段**在 UI 中没有对应输入控件**（`:357-458` 只渲染了标题、日期、状态、分类、样本类型、方法、课题、标签、内容），却经 `buildRecordData()` 写入 `qualityControl`（`:180-184`）。结果是每条记录都声称“3 次重复、已随机化”。
  - 选择分类时，用模板预填温度、湿度、pH（`:200-211`），同样不可见、不可改，直接入库。
  - 新建时无条件写入 `dataValidation: { isValidated: true, validationDate: new Date() }`（`:264-267`），而实际的“校验”只检查标题和日期（`utils/dataStandardization.ts:9, 23…`）。
  - `calculateProgress()` 把隐藏的 `equipment`、`reagents` 也计入完成度（`:67-77`），进度条最多只能到约 71%。
- **样本**（`components/SampleForm.tsx`）
  - `qualityControl.sterility` 默认 `false`（`:49`），`components/SampleDetail.tsx:455-459` 把 `false` 显示为红色“**不合格**”。用户没做过无菌检验，系统却记录为“不合格”。正确做法是三态：未检 / 合格 / 不合格。
  - `storage.condition` 默认 `'room_temperature'`（`:36`）。用户若没注意，-80 °C 的样本就会被登记为室温。
- **SOP**
  - `pages/SOPs.tsx:91`：内联新建时编造 `department: '实验室'`、`category: '通用'`、`purpose: '标准操作流程'`、`scope: '实验室操作'`。
  - `pages/CreateSOP.tsx:86-92`：作者和部门默认填 `'实验管理员'` / `'研发部'`。套用模板时作者会被覆盖为 `'实验室管理员'`（`:154-163`，`utils/sopTemplates.ts:13` 等）。
  - `pages/CreateSOP.tsx:553-563`：作者可以直接把自己的 SOP 选成“**已批准**”，“审批状态”没有任何审批语义。
  - 版本号是自由文本；`pages/SOPs.tsx:88` 编辑时原地覆盖，**没有版本历史**。
- **操作者身份**：样本历史一律写 `userId: '系统'`（`lib/storage.ts:697, 745, 777, 815`）；删除样本被记为 `actionType: 'moved'`（`lib/storage.ts:775`），审计语义是错的。`App.tsx:62` 的 `isAuthenticated` 恒为 `true`，`pages/Settings.tsx:27-31` 的默认身份是 `admin@example.com`。

### 2.4 显示错误（数据对，但展示错了）
- **分类名称映射**散落在至少 6 处，彼此不一致：
  - `pages/RecordDetail.tsx:143-152` 和 `components/RecordCard.tsx:51-58` 只认 4 个分类，PCR、Western Blot、ELISA 等 23 类一律显示为“其他实验”。
  - `pages/SOPDetail.tsx:50-59` 认的是旧枚举 `chemical/biological/equipment/safety`，而 `CreateSOP` 写入的是实验分类（`pages/CreateSOP.tsx:77-83`），所以**所有新建 SOP 都显示“未分类”**。
  - 正确的映射已存在于 `utils/dataStandardization.ts:264-296`，但没被复用。另外 `components/AIChatComponent.tsx:8-43`、`lib/topicAgentService.ts:91-119`、`lib/mindMapAIService.ts:941-949`（只有 5 类）也各有一份。
- **日期**
  - 多处用 `new Date().toISOString().split('T')[0]` 当作“今天”：`components/ExperimentRecordForm.tsx:42`、`pages/CreateRecord.tsx:45`、`pages/Projects.tsx:45`、`pages/CreateTopic.tsx:163`、`pages/Calendar.tsx:106, 174`。这得到的是 **UTC 日期**。在 UTC+8，每天 00:00–08:00 新建的记录默认日期是**前一天**，日历的“今天”高亮也会错位（推断）。
  - `pages/RecordDetail.tsx:78-90, 131` 用带时分的格式显示只有日期的 `record.date`。`new Date('YYYY-MM-DD')` 按 UTC 0 点解析，在 UTC+8 会显示成“08:00”，像是记录了实验开始时间，其实是解析副作用（推断）。
- `components/SampleDetail.tsx:211-215` 直接显示原始“项目ID”，而不是课题名称或链接。

### 2.5 庆祝动效与数据无关、打断工作
`components/TreePlantingCelebration.tsx:13-22`：保存后弹出全屏动效，3 秒后自动关闭。`pages/CreateSOP.tsx:236-238` 等待 3.5 秒才跳转。成就文案（“蓝色智慧守护者”，`:51`）与 `pages/Home.tsx:262-266`、`pages/MyForest.tsx:57-61` 的成就规则互不一致。对一天要记很多条的研究者来说，这是阻塞性的干扰。

---

## 3. 关键交互缺陷

### 3.1 走不通的路径
| 操作 | 结果 | 证据 |
|---|---|---|
| SOP 详情 → 编辑 | 跳 `/sops/edit/:id`，没有该路由，落到“页面未找到” | `pages/SOPDetail.tsx:42`；`App.tsx:119-127` |
| 样本详情 → 编辑 → 保存 | 提示“样本更新成功”，但没有任何持久化调用 | `pages/SampleManagement.tsx:21-24, 56-60`；`components/SampleForm.tsx:147-148` |
| `/records/new` 保存或取消 | 无论从哪里进入，都回到 `/projects`（保存时延迟 3 秒） | `pages/CreateRecord.tsx:48-57, 103` |
| 课题详情（`TopicDetail`）里的记录卡菜单 | “编辑/删除”按钮没有传入回调，点击无效 | `pages/TopicDetail.tsx:189`；`components/RecordCard.tsx:117, 123` |
| 顶栏搜索框 | 只有样式，没有 `onChange` 和提交逻辑 | `components/Header.tsx:84-95` |
| 顶栏通知铃 | 没有 `onClick` | `components/Header.tsx:115-123` |
| AI 聊天的“文件上传”“推荐回复” | `onClick={() => {}}` 或注释掉的空实现 | `components/AIChatComponent.tsx:640, 700-702` |
| 记录表单的表格编辑器、图片插入 | 组件已挂载，但 `showTableEditor` / `showImageUpload` 从未被置为 `true` | `components/ExperimentRecordForm.tsx:35-36, 463-473` |
| Markdown 代码块的“复制”按钮 | 推断无效：内联 `onclick` 在 `processMarkdown` 阶段生成（`components/MarkdownRenderer.tsx:146-157`），随后才经 `DOMPurify.sanitize`（`:229`），默认配置会剥离事件属性 | 同左 |
| 思维导图中由 AI 生成的节点 | 点击后用模型返回的 `id`（如 `research-objectives`）拼成 `/records/research-objectives`，指向不存在的资源 | `pages/TopicMindMap.tsx:135-136, 155-156`；`lib/mindMapAIService.ts:543` |
| 思维导图 | 没有保存功能，“重置”后 AI 结果丢失 | `pages/TopicMindMap.tsx:217-223` |

### 3.2 破坏性操作
- 删除课题不检查关联记录，不级联，也不提示具体影响（`pages/Projects.tsx:292-307`）。删除后，记录上的 `projectId` 变成孤儿：`components/RecordCard.tsx:48` 显示“未知课题”，`pages/ExperimentRecords.tsx:410-418` 则静默不显示。
- 全站用 `window.confirm` 做删除确认（`pages/ExperimentRecords.tsx:119, 132`，`pages/SOPs.tsx:99`，`components/SampleList.tsx:123, 160` 等），**没有撤销、回收站和审计**。
- `pages/Settings.tsx:109-115`：“清除所有数据”只删除 3 个 localStorage 键。课题、样本、计划、日历、聊天、API Key 都还留着，确认文案（`:352`）却写“永久删除所有本地存储的实验记录和笔记”。另外 sessionStorage 缓存没有清，`window.location.reload()` 不会清空 sessionStorage，所以推断刷新后 5 分钟内仍可能看到“已清除”的记录。
- `components/AIAnalysisModal.tsx:145-163`：点击遮罩会调用 `forceClose`，1 秒后检查闭包里的 `visible`（恒为 `true`），然后执行 `window.location.href = '/records'` **整页跳转**，正在编辑的内容会丢失。页面上还常驻一个红色的“Emergency close”按钮（`:169-175`）。该组件当前未被引用，**绝不能迁移**。

### 3.3 人为等待与无效 loading
`pages/Projects.tsx:76-77`（“模拟加载时间以展示 skeleton”，800 ms）、`pages/Notes.tsx:52`（400 ms）、`pages/SOPs.tsx:50`（400 ms）。数据是同步读取的本地数据，这些延迟纯属浪费时间。

### 3.4 AI 聊天本身的问题
- `lib/aiChatService.ts:211-214`：每次只发送 `system + 当前这一条 user`，**不带历史**，多轮对话实际上不成立。传入的 `context`（课题、实验类型）没有被使用（`:182-187`，参数带下划线）。
- 推断：`lib/aiChatService.ts:354-355` 用 `b.updatedAt.getTime()` 排序，而会话从 localStorage 反序列化后 `updatedAt` 是字符串（`:42-47`，没有还原为 `Date`）。在存在 ≥2 个会话时刷新页面，可能抛出 TypeError，被 ErrorBoundary 接住。
- 系统提示词预设里有“💻 代码助手”和“📝 学术写作”（`components/AIChatComponent.tsx:319-323`），与实验助手的定位无关。用户自定义的提示词会**覆盖**课题上下文提示词（`lib/topicAgentService.ts:163-165`）。
- 会话历史面板的标题叫“🌲 实验记录”（`components/AIChatComponent.tsx:264, 375, 447`），与真正的实验记录实体同名，容易误导用户。

---

## 4. 实现缺陷

### 4.1 存储层（`lib/storage.ts`）
- **解析失败即删除整类数据**（`:36, 146, 250, 340, 492, 613, 868`）。一次写入被截断（例如配额满了），就会让该用户的全部记录永久消失。这是最危险的一行代码模式。
- 每次增删改都是“读全部 → 改 → 全量 `setItem`”，没有配额处理，也没有 schema 版本号，无法迁移。
- `generateId()` 基于 `Date.now()` 加 5 位随机数（`:4-6`），实体之间、导入数据之间可能冲突。
- 类型不一致：`Sample` / `SampleHistory` 的日期是字符串（`types/index.ts:304-305`），其他实体是 `Date`，序列化逻辑因此各写一套。

### 4.2 缓存层（`lib/cacheService.ts` + `lib/cachedStorage.ts`）
- 缓存放在 sessionStorage 并做 JSON 序列化（`lib/cacheService.ts:59, 82`）。**命中缓存时 `Date` 字段会变成字符串**，但类型声明仍是 `Date`。`components/GlobalSearch.tsx:112, 142, 173` 正是对缓存数据调用 `.toISOString()`。（该组件目前未挂载，但说明类型与运行时数据已经不一致。）
- **绕过缓存直接写底层存储：** `pages/CreateTopic.tsx:4`、`pages/TopicDetail.tsx:4` 引入的是 `@/lib/storage`。推断：在 `/topics/new` 新建，或在 `TopicDetail` 删除课题后，`Projects` 列表最长 5 分钟（`lib/cachedStorage.ts:19`）仍显示旧结果。
- 失效不完整：
  - `lib/storage.ts:693, 741, 773, 810` 写样本历史时调用的是**未包装**的 `sampleHistoryService`，`cachedSampleHistoryService` 的 `sample_history_${id}` 不会失效，推断详情页“操作历史”会滞后。
  - `sample_stats`（`lib/cachedStorage.ts:629-640`）在样本增删改时都不失效。
  - 导入（`pages/Settings.tsx:313-317`）直接写 localStorage，不清缓存。
- 缓存的收益接近零：底层本来就是同步的 localStorage，缓存反而多一次 JSON 序列化，还引入一致性问题。`enableLogging: true` 在生产环境也被强制打开（`lib/cacheService.ts:288`，覆盖了 `:25` 的 `import.meta.env.DEV`）。全仓库约 60 处 `console.log`，其中 `pages/CreateTopic.tsx:49-55` 每次渲染都会把全部课题打印出来。

### 4.3 AI 接入（与插件目标直接冲突）
- API Key 明文存在 `localStorage['aiSettings']`（`pages/Settings.tsx:37-66`），所有页面脚本都可读。
- **4 份重复的 `fetch` 实现**：`lib/mockAI.ts:61, 384`、`lib/aiChatService.ts:264`、`lib/topicAgentService.ts:216`、`lib/mindMapAIService.ts:346`。端点“猜测补全”逻辑各写一套（如 `lib/aiChatService.ts:242-255`）。默认模型名有 `'gpt-3.5-turbo'`、`'qwen2.5-72b-instruct'`、`'gwen2.5-72b-instruct'`（拼写错误，`lib/mindMapAIService.ts:476`）三种。
- 浏览器直连第三方模型端点，受 CORS、密钥泄露、费用不可控等问题影响。按任务约束，新前端**必须完全删除**这一套：模型只能由宿主提供。

### 4.4 外壳、路由与构建
- `vite.config.ts:22` 配置 `base: './'`，同时 `main.tsx:10` 使用 `BrowserRouter`。推断：在 `/projects/abc` 这类深层路径刷新时，相对资源路径会解析到 `/projects/assets/...`，除非服务端做重写。插件常见的 iframe 或子路径挂载方式下，这一点必须重新设计（Hash/Memory 路由，或由宿主下发 base）。
- `index.html:8-12` 加载 jsdelivr 上的霞鹜文楷和 cdnjs 上的 Font Awesome，`index.css:4` 加载 Google Fonts。在国内网络、离线或插件 CSP 下都可能失败。`index.html:2` 的 `lang="en"` 也与中文界面不符。
- Font Awesome 图标以 `<i className="fa-solid …">` 形式散布在全站，图标库是全局 CDN 依赖。

### 4.5 样式系统
- 两套令牌并存且互为别名：`styles/tokens.css` 的 organic 体系与 legacy 的 `forest-* / earth-* / text-*`（`tailwind.config.js:39-70`）。页面混用三种写法：organic 类名、legacy 类名和 Tailwind 原生灰阶。例如 `pages/ProjectDetail.tsx:133-213` 同一页里同时有 `text-forest-primary`、`bg-white`、`text-gray-500`、`bg-emerald-500`、`bg-blue-500`、`bg-orange-500`。
- **暗色模式是半成品：** `contexts/themeContext.tsx:26-30` 只切换 `.dark` 类，`tokens.css` 没有任何 `.dark` 覆盖。推断：切换后有机色板保持浅色，只有少数写了 `dark:` 的组件变暗，界面会花屏。
- 引用了未定义的类：`organic-blob--terracotta`（`pages/ProjectDetail.tsx:99` 等；`index.css` 只定义了 moss/clay/sand，见 `:232-242`）、`organic-btn--danger`（`pages/TopicDetail.tsx:121`）、`animate-fadeIn`（`pages/CreateSOP.tsx:288`）。
- **对比度**（按 WCAG 相对亮度公式手算，实现阶段需用工具复核）：
  - 陶土色 `#C18C5D` 在 `#FEFEFA` 上约 **2.9:1**，被用作正文和小号标签色（如 `text-terracotta text-xs`，`pages/ExperimentRecords.tsx:413`），低于 AA 要求的 4.5:1。
  - 辅助文字 `#78786C` 约 **4.4:1**，用于 `text-xs` 标签时略低于 AA。
  - 苔藓绿 `#5D7052` 约 5.3:1，合格。
- 随机的不对称圆角（如 `rounded-[2rem_1rem_2.5rem_1.5rem]`，在至少 8 个文件里各自复制了一份 `cardRadiusVariants`）和满屏的 blob 装饰牺牲了信息密度与可扫读性。科研列表需要的是对齐和密度。

### 4.6 死代码与重复组件
- **未被任何页面引用的组件：** `GlobalSearch`、`AIAnalysisModal`、`ExcelTableNew`、`StatsVisualization`、`Timeline`、`NoteCard`、`SearchAndFilter`、`EnhancedCard`；服务 `topicAgentService`；工具 `utils/initData.ts`（`initSampleData` 无调用方）。另有前面提到的 3 个未注册页面。
- **编辑器有 6 个变体：** `FullscreenEditor`、`FullscreenTextarea`、`FullscreenWysiwygEditor`、`WysiwygEditor`、`WysiwygTextarea`、`EnhancedForm` 中的 wysiwyg 分支。
- `src/test-storage.html` 是放在源码目录里的手工测试页，会直接 `localStorage.clear()`（`:259`）。
- `hooks/usePerformance.ts` 在列表页和每张 `RecordCard` 上运行渲染、内存、尺寸监控（`components/RecordCard.tsx:34`），会持续产生 `console.warn`。

### 4.7 MarkdownRenderer
- `components/MarkdownRenderer.tsx:50, 61`：对同一内容调用了两次 `marked.parse`，第二次的输入已经是 HTML，可能产生二次转义或结构错乱（推断）。
- `:239`：异常分支把**未消毒**的原文拼成 `<pre>${safeContent}</pre>`，再经 `:374` 的 `dangerouslySetInnerHTML` 输出，绕过了 DOMPurify。这是 XSS 缺口。
- KaTeX 在 HTML 字符串上用正则替换 `$…$`（`:90`），会误伤价格、温度等普通文本中的 `$`（推断）。

---

## 5. 科研日常使用视角的缺口（功能层面）

| 场景 | 现状 |
|---|---|
| 实验台边快速记一笔 | 没有快捷记录入口；新建记录要先打开大表单、选分类，表单必填“实验内容” |
| 按 SOP 执行并记录偏差 | SOP 只能阅读，不能“以此 SOP 开始实验”，没有步骤勾选、时间戳和偏差记录 |
| 实验完成后锁定、修订留痕 | 状态只是一个下拉框，可以随时改回草稿；没有锁定、修订原因和历史 |
| 样本出入库与余量 | 没有出库或使用流水入口；`useSample` 未接入；没有“即将过期/低存量”提醒（只有 `lib/storage.ts:644-664` 的服务函数，UI 未使用） |
| 冻存位置 | `storage.location` 是自由文本，没有冰箱→架→盒→孔位结构 |
| 原始数据与附件 | 没有附件实体；图片只能以 Markdown 链接写进正文（插入入口还不可达，见 §3.1） |
| 跨课题检索 | 全局搜索组件未挂载，顶栏搜索是空壳；各列表只能对当前页内存做 `includes` 过滤 |
| 单位 | 体积和浓度单位是自由字段；`useSample` 把用量硬写成 `mL`（`lib/storage.ts:813`），不做单位换算 |
| 备份与迁移 | 只能导出 3 类实体，而且导出时不带 schema 版本 |

---

## 6. 成为 Harness 插件的结构性障碍（清单）

| 障碍 | 现状证据 | 新前端要求 |
|---|---|---|
| 自管模型与密钥 | `pages/Settings.tsx` 的 AI 区块；4 处 `fetch` | 完全删除；模型调用只经宿主适配层 |
| 无服务端 | 所有数据在 localStorage | 统一走服务端 API（持久化、搜索、导入导出由服务端提供） |
| 无宿主接缝 | 没有任何 host / context 抽象 | 设立 `host/` 适配层；接口等官方契约核验后再落地，**本阶段不猜 SDK** |
| 全局外部依赖 | Google Fonts、jsdelivr、cdnjs | 字体和图标全部本地打包；不依赖外网 |
| 路由假设 | `BrowserRouter` 加 `base: './'` | 由宿主的嵌入方式决定（Hash/Memory 路由加深链同步） |
| 视口假设 | 固定 `ml-64` 侧栏，最小宽度未考虑 | 适配插件侧栏面板（约 360–480px）与整页两种形态 |
| 主题 | 暗色模式未完成 | 令牌化的明暗主题，可接收宿主主题信号（若契约提供） |
| 身份 | `isAuthenticated` 恒为真，作者和操作者写死 | 作者和操作者来自宿主或服务端身份，不能由前端编造 |

---

## 7. 可保留的资产（迁移参照）

- **领域分类体系：** `utils/dataStandardization.ts:301-344` 中按 7 组划分的 27 种实验类型，以及 `types/index.ts` 中样本类型、状态、存储条件的枚举。这些可作为新前端的单一标签源（需与服务端契约对齐）。
- **SOP 模板正文**（`utils/sopTemplates.ts`，5 份）：可作为“模板库”内容保留，但必须**标注为模板/参考**，去掉写死的作者和部门，不能作为已批准的 SOP 直接生效。内容的专业性需要用户或课题组审阅。
- **Markdown + KaTeX + highlight 的渲染能力：** 保留能力，重写管线（单次解析、先渲染后统一消毒、不使用内联事件）。
- **“实验小森林”的品牌意象：** 苔藓、陶土、宣纸色调与“播种→生长”的隐喻值得保留。但要从“装饰与虚构成就”转向**由真实数据驱动的可视化**（见设计文档）。
- **旧数据：** localStorage 键 `experiment_records / experiment_notes / sops / projects / experiment_plans / samples / sample_history / calendarEvents / todoItems / scheduleEvents / aiChatSessions / userProfile`。迁移映射见设计文档 §9。**`aiSettings` 中的 `apiKey` 绝不导入。**

## 8. 明确不迁移

`lib/mockAI.ts`、`lib/aiChatService.ts`、`lib/topicAgentService.ts`、`lib/mindMapAIService.ts`、`lib/cacheService.ts`、`lib/cachedStorage.ts`、`components/AIAnalysisModal.tsx`、`components/TreePlantingCelebration.tsx`（阻塞式庆祝）、`hooks/usePerformance.ts`、`utils/initData.ts`、`src/test-storage.html`、日历的“每日心情”、Settings 的 AI 配置区块，以及所有写死的统计和状态文案。
