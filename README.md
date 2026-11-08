# 实验小森林 · DeepSeek Harness 插件

把课题、实验记录、研究笔记、SOP、样本和计划放在 DeepSeek Harness 的同一工作台里。AI 帮助检索资料和整理草稿，研究记录由你掌握。

这次重构将原来的浏览器单机应用改为 **Harness 原生 Host + Client 插件**：右侧栏工作台、Host 持久化服务和四个模型工具使用同一份数据。模型与密钥沿用 Harness 的配置，无需在网页重复填写，不再提供模拟 AI 回复。

界面由远端 Claude 按现代 Apple / Notion 风格重做：中性底色、宽松留白、清晰的资料层级，以及浅色与深色模式。

![实验森林工作台](docs/images/workspace.png)

上图为真实 Harness 中的插件页面，内容均为软件验收示例。

## 使用

要求 Node.js **24.9 或以上**、DeepSeek Harness **0.2.2-rc.1**。当前只对这个已核验的 Harness 版本声明兼容；它的插件 API 仍在变化。

```sh
# 进入包含 client/、plugin/ 的新版源码目录
cd /absolute/path/experiment-forest
npm ci --ignore-scripts
npm run build

# 用项目的实际绝对路径替换下面的路径；安装到你使用的 profile
dsh plugin --profile desktop add /absolute/path/experiment-forest
```

重新打开该 profile 的 Harness，在会话右侧栏的引导页中选择 **实验森林**。Web 用户改为 `--profile web` 安装，然后运行 `dsh web --no-open`。插件无单独的 HTTP 数据接口、账户体系或模型密钥。

使用预构建安装包时，可直接执行 `dsh plugin --profile desktop add /absolute/path/dsh-experiment-forest-0.2.0.tgz`，无需先构建源码。

开发预览使用 `npm run dev`，在隔离的 `.dsh-dev` 开发 profile 启动本机 Harness。此实例禁用模型供应商，适合不消耗模型额度的操作验收；实际地址以启动输出为准。正式使用的数据属于你安装插件的 Harness profile，不存在浏览器 localStorage。

## 工作流

- 从 SOP 创建实验草稿，保存本次所依据的正文、修订及步骤快照。后来修改 SOP 不会改变已有实验的方法依据。
- 逐步记录执行状态、观察和跳过原因；进度与下一步来自已保存的数据。完成清单不会自动产生实验结果或科学结论。
- 在日常工作台查看今日、逾期、未来七天、未排期和 AI 待核对资料，直接回到对应记录继续工作。
- 新建课题，再关联实验、笔记、SOP、样本或计划；搜索、编辑和归档都作用于真实保存的数据。
- 并发修改通过记录版本号检测；冲突时保留编辑内容，刷新核对后重试。归档不会删除原文或断开历史关联。
- 在 Harness 聊天中让 DeepSeek 使用 `forest_context` 读取目标及关联资料的有界上下文，使用 `forest_search` 查找资料、`forest_read` 补读完整原文，或使用 `forest_create_draft` 保存草稿。AI 创建的记录带来源和未复核标记，不自动批准 SOP 或覆盖正式实验数据。
- 导出 JSON 备份；导入前检查数量、缺失关联和冲突，再确认合并。同一份备份重复导入不会重复创建，也不会覆盖后来编辑的记录。

课题关联不等于权限隔离。当前版本面向同一 Harness profile 的个人科研工作区；同 profile 的会话共享记录，插件 RPC 只允许拥有者连接，不同 profile 分开保存。模型工具沿用 Harness 的会话工具权限。使用默认 JSON 存储时，同一 profile 仅运行一个 Host 进程；多进程同时写入不受本插件的进程内版本检查保护。多人租户、附件文件管理、思维导图、旧版日程编辑暂未实现。

## Obsidian 自动同步

**Harness 管理实验，Obsidian 阅读和整理。** 在插件的 Obsidian 连接面板选择本机已登记的资料库，连接一次；之后在 Harness 保存资料，就会在后台更新 Obsidian 的专用目录。Host 重启后会继续同步，无需手工导出，也无需保持 Obsidian 窗口打开。

Harness Host 与 Obsidian 应运行在**同一台电脑、同一个操作系统用户**下。先用 Obsidian 打开过目标资料库，连接面板才能从它的本机登记信息中找到。远程 Host 无法直接同步浏览器所在电脑的资料库。插件自身只写本机文件，不请求模型。

每个 Harness profile 使用独立目录，包含 Markdown 页面、来源与执行记录、关联链接、目录和 Bases 视图。可以在自己的 Obsidian 笔记中引用这些页面，整理文献和心得。实验内容仍在 Harness 修改；直接编辑或移动镜像页面会保留现状并提示冲突，Obsidian 的修改不会反向导回 Harness。

`Forest.base` 资料视图只在首次连接时创建，之后可在 Obsidian 中自由调整筛选、排序和列；自动格式整理与这些设置都会保留，不会被后续同步或插件升级覆盖。Markdown 实验页面仍按上述规则更新。

连接面板显示同步状态，并提供重试与断开。同步失败不影响已经保存的实验记录；重试不会强制覆盖人工修改，断开也不会删除 Obsidian 文件。目录中的隐藏 `.recovery` 文件夹保留更新前的副本，不会自动清理，会逐渐占用额外空间。完整备份仍使用 JSON 备份功能。

连接步骤、阅读方式与同步范围见 [Obsidian 使用说明](docs/OBSIDIAN.md)。

## 迁移旧数据

旧版“导出所有数据”实际只导出了实验、笔记和 SOP，未包含课题、样本和计划。请先完整备份再迁移，见 [迁移说明](docs/MIGRATION.md)。新版不会主动访问、覆盖或清除旧站的浏览器数据。

旧 `src/` 代码作为迁移参考保留，可用 `npm run dev:legacy` / `npm run build:legacy` 启动。旧版说明存于 [LEGACY_README](docs/LEGACY_README.md)，其中静态部署与 API Key 设置不适用于新插件。

## 开发与验证

```sh
npm run typecheck
npm test
npm run build
npm run test:host
npm pack
```

`test:host` 使用官方 Cordis、Storage、Tool Registry 和 RPC Gateway，验证加载、参数校验、版本冲突、磁盘持久化、重启和卸载，不请求模型。浏览器验收与已知限制见 [验证记录](docs/VERIFICATION.md)。

```text
client/       Claude 重做的工作台与原生 Client 适配
plugin/       Host 服务、工具、领域事务与迁移
shared/       JSON 数据模型与前后端契约
scripts/      构建、开发运行和原生 Host 集成验证
tests/        工具、导出和接入行为检查
src/          旧版前端，仅作为迁移参考
```

[后端审查](docs/BACKEND_REVIEW.md) · [Claude 前端审查](docs/FRONTEND_REVIEW.md) · [Claude 最终视觉说明](docs/FRONTEND_VISUAL_NOTES.md) · [Claude 初步设计（历史稿，含未实施设想）](docs/FRONTEND_DESIGN.md)

[原稿与本机适配说明](docs/LOCAL_ADAPTATIONS.md)

MIT · 蔡志宇（Zhiyu Cai）
