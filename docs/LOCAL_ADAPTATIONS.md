# Claude 原稿与本机适配

远端官方 Claude Code 使用 Opus 5.5 / high 完成前端审查、设计、实现和修复。最终稿包含 13 个客户端源文件；原始版本和 SHA-256 清单另外保存在本次任务交付目录，未用本机修改覆盖。

Codex 编写了 `client/index.ts` 和 `client/host-api.ts`，负责官方 Harness 侧栏注册、模块加载、原生 RPC 结果解包和错误码转换。Host 服务、数据模型、工具、迁移、构建脚本与测试也由 Codex 实现。

在 Claude 第一版功能稿上，Codex 做了以下正确性修正：

1. `drafts.ts`：保存结果核对使用严格递归 JSON 值比较，仅忽略对象键的排列顺序。显式 `null`、缺失字段、空数组、字符串首尾空白均不可混同。例如 `{ location: null }` 用于清除旧字段回退值，不能视为“没有 location 字段”。对应 `ForestApp.tsx` 的注释同步修正。
2. `DataPanel.tsx`：修正导入冲突提示。归档仍保留记录 ID，因此不能靠归档消除同 ID 内容冲突；提示先备份并核对、调整待导入文件。

这些修正有独立回归验证，并已作为同一任务的参考基线交回 Claude。Claude 随后按用户要求完成 Apple / Notion 视觉重做，改变 7 个展示文件，并保留上述修正。集成后的 13 个最终客户端源文件与远端视觉原稿的 SHA-256 完全一致；Codex 没有另行修改最终视觉代码。

`FRONTEND_VISUAL_NOTES.md` 是 Claude 最终视觉说明。`FRONTEND_DESIGN.md` 是较早的设计过程原稿，风格已被最终视觉替代，也包含未实施的远期能力；当前功能边界以 README 和 VERIFICATION 为准。

## 0.2.0 产品迭代

Claude 本轮最终原稿含 20 个客户端文件以及 PRODUCT_SCOPE / PRODUCT_NOTES，22 文件逐一核对远端 SHA-256 后保存。`FRONTEND_PRODUCT_NOTES.md` 原样保留其实现说明和未验证假设；实际交付以下列修正及 VERIFICATION 为准。

Codex 在原稿基础上做了这些正确性修正：

- `runActions.ts`、`StartRun.tsx`：结果不确定时重试完整冻结请求，保留原 SOP 修订和 requestId；修改表单不能静默新建另一次请求。读取或保存的延迟返回只处理仍然存活的原草稿，防止复活已放弃内容或删除后续输入。
- `drafts.ts`：最新 SOP 含未知步骤格式且本地有步骤修改时，保留全部输入和冲突状态，不能靠合并静默丢弃。
- `draftMemory.ts`、`ForestApp.tsx`：尚未提交的创建表单也参与刷新保护；普通编辑器同样防止过期异步回包恢复或覆盖草稿，并区分未提交、创建中和待处理的提示。
- `RunChecklist.tsx`、`TodayView.tsx`：AI 未核对时保留输入、先引导人工核对并禁用步骤保存；核对后恢复执行。
- `forest.css`：实测修正窄屏工作台卡片布局，避免“继续”按钮挤压标题和进度。
- `ObsidianSync.tsx`：连接或断开返回状态后，较早发起的轮询不能覆盖新状态；读取失败时显示状态过期。

平台适配、共享工作流、阅读报告、单向 Obsidian 同步与相关测试由 Codex 实现。原稿保存在本轮交付的 Claude 原稿包中，本机修正没有冒充原稿，也没有覆盖远端文件。
