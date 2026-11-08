# Experiment Forest · 实验森林

**先把实验记下来，再让 AI 帮你整理。**

面向生物、化学、环境与材料研究的 DeepSeek Harness 插件。每次实验的数据都不同：一段观察、几行表格、现场照片、视频和仪器文件，可以放进同一张自由实验页。无需先设计字段，也不用先选实验模板。

在 Harness 管理实验，在 Obsidian 阅读、关联和整理资料。

[下载 v0.3.0](https://github.com/ZJUZhiyuCai/experiment-forest/releases/tag/v0.3.0) · [安装指南](部署指南.md) · [上手使用](👋给朋友的使用说明.md) · [Obsidian 联动](docs/OBSIDIAN.md) · [验证记录](docs/VERIFICATION.md)

![自由实验页：文字、表格、原件与同步状态](docs/images/adaptive-page.png)

*运行中的 0.3.0 界面；截图内为明确标注的软件验收样本。*

## 一条完整的记录流程

### 1. 自由记录

打开一张实验页，直接写。文字、标题、可编辑表格和材料说明可以混排，照片、视频与其他文件保留原件。粘贴规则的制表符表格时可转为表格；原始粘贴文本仍保留，空格、空值、`0` 和 `ND` 不替你改成“标准答案”。无法可靠拆分的内容保持原文。

停笔后自动保存，界面显示 Host 是否已经确认。实验日期由你填写，默认留空，与创建时间分开。课题、方法和其他属性按需要补充。

### 2. 让 AI「理一理」

先保存当前输入，再把整理要求发送到当前 Harness 会话。模型通过插件工具读取正文快照，按需读取文本文件或图片预览，提出适合这一页的组织方式。

提案不会自动覆盖正文。可以逐项查看来源、修改建议、接受或拒绝；接受后的 AI 内容保留待核对标记。你在模型整理期间补写的观察，会参与版本检查，过期提案不能静默覆盖它。

原始输入快照和文件原件继续保留。来源引用是追溯入口，不是科学正确性的证明；图片中的数值、单位、时间和样本归属尤其需要人工核对。

### 3. Obsidian 自动出现

选择一次本机 Obsidian 资料库，之后保存的正文、表格、材料与关联链接会在后台更新。**无需导出、解压或逐次同步。** 图片和支持的视频使用本地附件嵌入，其他材料提供真实文件链接。

在自己的 Obsidian 文献笔记里链接实验页，整理心得与课题脉络。实验主数据继续在 Harness 编辑；镜像采用稳定 ID 文件名，改标题不会断链。

## 能处理什么

| 内容 | 保存与阅读 | AI 整理 |
| --- | --- | --- |
| 文字、标题、表格 | 自由混排、自动保存、原始快照 | 基于读取快照提出排版、摘录或推断建议 |
| TXT / Markdown / CSV / TSV / JSON | 原文件保存、下载、同步 | UTF-8 文本读取，超出范围明确标记截断 |
| PNG / JPEG / WebP / GIF | 保留原件，另建标准化预览 | 当前会话模型明确支持图片时，返回真实图片内容 |
| 视频、PDF、工作簿、仪器文件等 | 原件保存、下载、同步；浏览器支持的视频可播放 | 本版不解析视频、PDF、XLSX 或仪器专有格式 |

插件使用 Harness 的模型和工具权限，不保存另一套 API Key。没有视觉能力的模型不会因为拿到了文件名就被当作“读过图片”。格式不支持或读取失败时，原文件仍在。

## 已有的研究工作区

课题、笔记、SOP、样本与计划继续可用。从 SOP 创建实验时，会固定当时的方法正文、修订与步骤；记录实际观察、完成或跳过原因，后续修改 SOP 不改写历史依据。“今天”汇总已保存的计划与待办，搜索和关联链接帮助找回上下文。

自由实验页不要求从 SOP 开始。清单完成不生成实验结论，本版也不会自动设置或发送提醒。

## 安装

当前版本 **0.3.0**，兼容已核验的 **DeepSeek Harness 0.2.2-rc.1**。CLI 和源码构建需要 **Node.js ≥ 24.9**。Harness 插件 API 仍在变化，暂不声明其他版本兼容。

从 [Release](https://github.com/ZJUZhiyuCai/experiment-forest/releases/tag/v0.3.0) 下载 `dsh-experiment-forest-0.3.0.tgz`。在已初始化的 web profile 中，退出 Host 后安装并重启：

```sh
dsh plugin --profile web add /absolute/path/dsh-experiment-forest-0.3.0.tgz
dsh web
```

在会话右侧栏选择 **实验森林**，可展开工作台。首次使用 Harness、Desktop 安装入口和升级步骤见 [安装指南](部署指南.md)。Desktop 使用其内置 CLI 管理 `desktop` profile。

从源码安装：

```sh
git clone https://github.com/ZJUZhiyuCai/experiment-forest.git
cd experiment-forest
npm ci --ignore-scripts
npm run build
dsh plugin --profile web add "$PWD"
dsh web
```

## Obsidian：连接一次，保存即同步

1. 在 **Harness Host 所在电脑、同一个操作系统用户**下，用 Obsidian 打开目标资料库。
2. 在插件的 Obsidian 面板选择该库并连接。
3. 在 Obsidian 打开 `Experiment Forest-…/Index.md` 或 `Forest.base`。以后继续在 Harness 记录即可。

这是 Harness → Obsidian 的单向同步。可以自由定制 `Forest.base` 的筛选、排序和列，在其他笔记里整理资料；直接修改、移动或删除受管理的页面或附件，会保留现状并提示冲突。附件缺失或未同步会明确显示，不报告“全部成功”。断开连接不会删除已有文件。

Host 重启后继续同步，Obsidian 窗口可以关闭。远程 Host 只能写服务器可访问的资料库，不能直接写浏览器所在电脑。详见 [同步范围与故障处理](docs/OBSIDIAN.md)。

## 给模型的工具

| 工具 | 用途 |
| --- | --- |
| `forest_page_read` | 读取自由实验页及正文来源快照，返回读取凭据 |
| `forest_page_material_text` | 读取该页已保存的文本材料 |
| `forest_page_material_image` | 通过当前视觉模型路由返回真实图片预览 |
| `forest_page_propose` | 保存有来源的整理提案，等待人选择和确认 |
| `forest_search` / `forest_read` | 查找和读取研究资料 |
| `forest_context` | 读取目标及关联资料的有界上下文 |
| `forest_create_draft` | 按用户要求另存带 AI 来源的新草稿 |

模型不能通过这些工具接受提案或确认实验结果。读取凭据记录 Host 提供的范围，不证明模型理解；文本、图片与推断都可能出现错误。

## 保存、原件与备份

- 正文属于当前 Harness profile，保存在 Host Storage 中。文件本体进入 Harness 的不可变附件存储；插件另存配置内的登记信息，不能仅凭 JSON 中的附件 ID 读取其他 profile 的材料。
- 编辑使用版本检查。切换页面时保留尚未确认的输入；关闭或刷新浏览器会丢失纯内存草稿，请先确认保存。
- **JSON 备份包含记录和附件引用，不包含附件字节。** 完整恢复需要同时备份 Harness 数据、插件材料登记域与 `DSH_HOME/attachments`；仅导入 JSON 到新设备会显示材料未登记，不能把引用当作原文件。
- Obsidian 是可阅读副本。隐藏的 `.recovery` 保留同步前的文件，不自动清理，也不能替代独立备份。

旧版浏览器数据可按 [迁移说明](docs/MIGRATION.md) 导入；不会主动清除旧站数据。

## 当前边界

每个文件最多 **64 MiB**，每页最多 100 份材料、200 个内容块；同一 profile 的材料登记总量最多 512 MiB，同时最多两个上传。未完成上传在 Host 重启或空闲 20 分钟后需重选文件；已经登记的原件保留。单页扩展数据最多 2 MiB，数据库最多 20 MiB；达到上限明确报错，不自动删除资料。

面向个人研究工作区，同一 profile 使用一个 Host 进程。当前没有多人权限、电子签名、完整审计系统、仪器采集、库存扣减、自动提醒或独立的跨设备同步服务。保留的原始/最近快照与被引用快照用于追溯，不是每次按键的永久版本历史。每页最多保留 100 次模型读取凭据与 30 份提案。

## 开发与验证

```sh
npm ci --ignore-scripts
npm run dev        # 独立开发 profile；模型供应商禁用
npm run typecheck
npm test
npm run build
npm run test:host  # 官方 Host / Gateway / 附件存储验证
npm pack
```

验证范围、浏览器实测及未验证项见 [验证记录](docs/VERIFICATION.md)。前端由远端官方 Claude Code 实现，后端、原生接入和集成检查由 Codex 完成；原稿与集成改动见 [适配说明](docs/LOCAL_ADAPTATIONS.md)。

`client/` 是工作台，`plugin/` 是 Host 服务、模型工具与同步，`shared/` 是契约，`tests/` 是回归验证。`src/` 和旧静态启动入口仅保留作历史迁移参考。

[反馈问题](https://github.com/ZJUZhiyuCai/experiment-forest/issues) · [全部文档](docs/INDEX.md) · [MIT License](LICENSE)
