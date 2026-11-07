# Claude 原稿与本机适配

远端官方 Claude Code 使用 Opus 5.5 / high 完成前端审查、设计、实现和修复。最终稿包含 13 个客户端源文件；原始版本和 SHA-256 清单另外保存在本次任务交付目录，未用本机修改覆盖。

Codex 编写了 `client/index.ts` 和 `client/host-api.ts`，负责官方 Harness 侧栏注册、模块加载、原生 RPC 结果解包和错误码转换。Host 服务、数据模型、工具、迁移、构建脚本与测试也由 Codex 实现。

在 Claude 第一版功能稿上，Codex 做了以下正确性修正：

1. `drafts.ts`：保存结果核对使用严格递归 JSON 值比较，仅忽略对象键的排列顺序。显式 `null`、缺失字段、空数组、字符串首尾空白均不可混同。例如 `{ location: null }` 用于清除旧字段回退值，不能视为“没有 location 字段”。对应 `ForestApp.tsx` 的注释同步修正。
2. `DataPanel.tsx`：修正导入冲突提示。归档仍保留记录 ID，因此不能靠归档消除同 ID 内容冲突；提示先备份并核对、调整待导入文件。

这些修正有独立回归验证，并已作为同一任务的参考基线交回 Claude。Claude 随后按用户要求完成 Apple / Notion 视觉重做，改变 7 个展示文件，并保留上述修正。集成后的 13 个最终客户端源文件与远端视觉原稿的 SHA-256 完全一致；Codex 没有另行修改最终视觉代码。

`FRONTEND_VISUAL_NOTES.md` 是 Claude 最终视觉说明。`FRONTEND_DESIGN.md` 是较早的设计过程原稿，风格已被最终视觉替代，也包含未实施的远期能力；当前功能边界以 README 和 VERIFICATION 为准。
