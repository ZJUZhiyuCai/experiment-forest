# 后端审查与重构依据

审查对象：`ZJUZhiyuCai/experiment-forest`，基线 `a9903eb`。Codex 于 2026-11-07 核查源码。这里的“后端”包括原项目放在浏览器中的业务、持久化与 AI 服务。

## 发现

1. **没有服务端或 Harness 插件入口。** `package.json` 只构建 Vite 静态站，没有插件 manifest、Host 服务、模型工具或 Client 扩展。改主题不能使其成为 Harness 插件。
2. **读取失败会删除用户数据。** `src/lib/storage.ts` 多个 `getAll()` 在解析错误时调用 `localStorage.removeItem`。异常日期或损坏记录可能触发永久清空，随后呈现空列表。新领域层对损坏和未知格式报错，保留介质。
3. **备份范围不完整，导入直接覆盖。** `src/pages/Settings.tsx` 的导出只包含 records/notes/sops，遗漏课题、样本、计划、样本历史；导入无结构和关联校验，直接替换这三个集合。新迁移先预览，提交检查工作区版本；遇冲突拒绝，不覆盖已有记录。
4. **AI 错误被伪成功掩盖。** `src/lib/aiChatService.ts` 的 `generateAIResponse` 与 `src/lib/mockAI.ts` 在失败时返回模拟结果。前者调用模型仅传当前问题，未传完整会话；反序列化后也未恢复 Date，排序的 `getTime()` 会失败。插件复用 Harness 的真实会话与模型设置，删除这条模拟路径与客户端密钥需求。
5. **无并发控制与统一校验。** localStorage 的读取、修改、整表覆盖会丢失并发更新；大多数 update 接受 `Partial<Entity>`，可改 id/时间等受保护字段。缓存与直接写入并存，状态存在失效不一致风险。新领域层串行提交、服务端创建 ID/时间、校验字段并检查 expectedRevision。
6. **认证只是 UI 状态。** `src/App.tsx` 默认 `isAuthenticated=true`，不构成访问控制。新版使用 Harness 的连接与 RPC 边界，不声称提供多用户租户隔离。

## 实施边界

新实现使用 Harness 原生 Host/Client 插件、存储领域与工具注册。数据属于当前 Harness profile；课题是业务关联，不是访问控制边界。AI 工具可检索、读取及新增标记来源的草稿，不自动批准 SOP、覆盖正式实验记录或伪造实测结果。正式状态由用户在工作台中编辑。

旧 `src/` 为迁移参考保留，不作为新插件运行代码。新功能集中于课题、实验、笔记、SOP、样本、计划；旧日程、心情和样本历史只保留归档原文。多人协作、附件文件管理与思维导图不是本轮已实现能力。

官方兼容依据：DeepSeek Harness `0.2.2-rc.1`，commit `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159`；[插件开发](https://github.com/deepseek-ai/deepseek-harness/tree/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/docs/user/develop)、[持久化](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/docs/subsystems/storage.md)。具体构建和验证结果见交付文档。
