> **旧版历史快照，不是当前使用指南。** 以下保留重构前 README 的原文，功能陈述、命令和外部服务信息可能过时。新版请看 [项目首页](../README.md)、[安装指南](../部署指南.md) 和 [使用说明](../👋给朋友的使用说明.md)。
>
> 当前仓库仅保留旧前端用于迁移参考，对应命令为 `npm run dev:legacy` / `npm run build:legacy`；不要把下文的 `npm run dev` / `npm run build` 当作旧版命令执行。迁移前先读 [旧版数据迁移](MIGRATION.md)。

# 🌲 实验小森林 (Experiment Forest)

<div align="center">

**让科研记录变得简单有趣**

![GitHub stars](https://img.shields.io/github/stars/caizhiyu/experiment-forest?style=social)
![GitHub forks](https://img.shields.io/github/forks/caizhiyu/experiment-forest?style=social)
![License](https://img.shields.io/github/license/caizhiyu/experiment-forest)

[在线演示](https://experiment-forest.vercel.app) • [快速开始](#-快速开始) • [功能介绍](#-核心功能) • [部署指南](#-部署)

</div>

---

## 📖 项目简介

**实验小森林**是一款专为生物医学科研工作者设计的轻量级实验室管理系统。采用现代化的前端技术栈，提供简洁直观的实验记录和管理功能，帮助科研人员更好地组织实验数据、记录研究过程。

### ✨ 特色亮点

- 🚀 **开箱即用** - 无需复杂配置，安装即用
- 💾 **本地优先** - 数据存储在浏览器，保护隐私
- 🤖 **AI助手** - 内置小森博士，提供实验指导
- 🧠 **思维导图** - 可视化实验流程和知识结构
- 📱 **响应式设计** - 支持桌面和移动设备
- 🎨 **美观界面** - 清新的森林主题设计

---

## 🎯 核心功能

### 🧪 实验记录管理
- ✅ 支持多种实验类型（细胞培养、PCR、Western Blot等）
- ✅ Markdown 格式编写，支持公式和代码高亮
- ✅ 实验分类和标签管理
- ✅ 全文搜索和筛选功能
- ✅ 实验状态跟踪（草稿/完成/归档）

### 🤖 AI智能助手 - 小森博士
- 💬 24小时在线对话助手
- 🧠 实验相关问题解答
- 📝 实验建议和指导
- ⚙️ 自定义API配置
- 💬 多轮对话和会话管理

### 🧠 思维导图
- 🎨 可视化实验流程
- 🔗 节点拖拽和连接
- 📊 多种节点类型
- 💾 导图保存和管理

### 📋 其他功能
- **SOP文档管理** - 标准操作程序创建和版本管理
- **样本管理** - 样本信息录入、存储条件、到期提醒
- **项目管理** - 课题组织、进度跟踪、成员管理
- **数据导出** - 支持JSON格式备份
- **主题切换** - 明暗主题自由选择

---

## 🛠️ 技术栈

### 前端框架
- **React 18.3** - 用户界面库
- **TypeScript 5.7** - 类型安全的JavaScript
- **Vite 6.2** - 快速的构建工具

### UI和样式
- **Tailwind CSS 3.4** - 实用优先的CSS框架
- **Framer Motion 12.9** - 动画库
- **Font Awesome** - 图标库

### 核心库
- **React Router 7.3** - 路由管理
- **React Flow 11.11** - 专业级思维导图引擎
- **Dagre 0.8** - 自动层级布局
- **Marked 16.2** - Markdown解析
- **KaTeX 0.16** - 数学公式渲染
- **Highlight.js 11.11** - 代码高亮
- **DOMPurify 3.2** - HTML清理
- **Sonner 2.0** - Toast通知

---

## 🚀 快速开始

### 环境要求
- **Node.js**: 16.0 或更高版本
- **包管理器**: npm、pnpm 或 yarn
- **浏览器**: Chrome、Firefox、Safari、Edge（最新版本）

### 安装步骤

#### 方法一：使用脚本（Windows推荐）
```bash
# 双击运行
Start-LabForest.ps1
# 或备用脚本
start-lab.bat
```

#### 方法二：手动安装
```bash
# 1. 克隆仓库
git clone https://github.com/caizhiyu/experiment-forest.git
cd experiment-forest

# 2. 安装依赖
npm install
# 或使用 pnpm
pnpm install

# 3. 启动开发服务器
npm run dev

# 4. 在浏览器访问
# http://localhost:3000
```

### 构建生产版本
```bash
# 构建
npm run build

# 预览构建结果
npm run preview
```

---

## 📸 界面预览

### 主界面
- 清新的森林主题设计
- 左侧导航栏，右侧内容区
- 快速访问所有功能模块

### 实验记录
- 卡片式布局展示
- 支持富文本编辑
- 实时预览和保存

### AI助手
- 流畅的对话界面
- 智能实验建议
- 会话历史管理

---

## 🔧 配置说明

### AI助手配置

1. 进入"设置"页面
2. 在"AI智能助手"部分配置：
   ```
   API端点: https://api.siliconflow.cn/v1/chat/completions
   API密钥: 你的API密钥
   模型名称: qwen2.5-72b-instruct
   ```
3. 点击"测试连接"验证配置
4. 保存设置

### 数据备份

由于数据存储在浏览器 localStorage，建议定期备份：

1. 进入"设置" → "数据管理"
2. 点击"导出数据"下载备份文件
3. 需要时通过"导入数据"恢复

---

## 🌐 部署

本项目是纯前端应用，可以部署到任何静态网站托管服务：

### 推荐方案

| 平台 | 难度 | 费用 | 推荐度 |
|------|------|------|--------|
| [Vercel](#vercel-部署) | ⭐ | 免费 | ⭐⭐⭐⭐⭐ |
| [Netlify](#netlify-部署) | ⭐ | 免费 | ⭐⭐⭐⭐⭐ |
| [GitHub Pages](#github-pages-部署) | ⭐⭐ | 免费 | ⭐⭐⭐⭐ |
| 阿里云OSS | ⭐⭐⭐ | 按量付费 | ⭐⭐⭐ |

### Vercel 部署（推荐）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/caizhiyu/experiment-forest)

1. 点击上方按钮
2. 使用 GitHub 账号登录
3. 点击 "Deploy"
4. 等待1-2分钟，部署完成！

详细部署指南请查看 [部署指南.md](./部署指南.md)

---

## 📁 项目结构

```
experiment-forest/
├── src/
│   ├── components/         # 可复用组件
│   │   ├── AIChatComponent.tsx
│   │   ├── MarkdownRenderer.tsx
│   │   ├── MindMapEditor.tsx
│   │   └── ...
│   ├── pages/             # 页面组件
│   │   ├── Dashboard.tsx
│   │   ├── ExperimentRecords.tsx
│   │   ├── AIChat.tsx
│   │   └── ...
│   ├── lib/               # 工具库
│   │   ├── cachedStorage.ts
│   │   ├── aiChatService.ts
│   │   └── ...
│   ├── types/             # TypeScript类型定义
│   ├── hooks/             # 自定义Hooks
│   └── utils/             # 工具函数
├── public/                # 静态资源
├── docs/                  # 文档
├── index.html
├── vite.config.ts
├── package.json
└── README.md
```

---

## 🤝 参与贡献

欢迎贡献代码、提出建议或报告问题！

### 如何贡献

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 开发规范

- 遵循现有代码风格
- 添加必要的注释
- 更新相关文档
- 确保代码通过TypeScript类型检查

---

## 📝 更新日志

### v1.1.0 (2025-01-16)
- 🎨 **UI 全面升级** - 采用莫兰迪色系（Morandi Design）与森林主题完全融合
- 🧠 **思维导图重构** - 从 D3.js 迁移至 React Flow，支持更流畅的交互和自动布局
- ⚡ **性能优化** - 移除冗余代码，优化构建体积
- 🛠️ **组件标准化** - 统一的 Button、Input 和 Card 组件设计
- 🐛 **修复** - 修复了多个类型定义错误和未使用的代码引用

### 主要更新
- ✅ 优化Settings.tsx自动保存逻辑
- ✅ MarkdownRenderer动态导入，减少首屏加载体积99.3%
- ✅ Dashboard日历使用真实数据
- ✅ **全新改版**：实验笔记、SOP文档、样本管理、新建记录页面的视觉优化

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 👨‍💻 作者

**蔡志宇 (Zhiyu Cai)**
- 📧 邮箱: 22519085@zju.edu.cn
- 🏫 学校: 浙江大学
- 🔗 GitHub: [@caizhiyu](https://github.com/caizhiyu)

---

## 🙏 致谢

感谢所有为本项目做出贡献的开发者！

本项目使用了以下优秀的开源库：
- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [D3.js](https://d3js.org/)
- [Marked](https://marked.js.org/)
- [KaTeX](https://katex.org/)
- [Framer Motion](https://www.framer.com/motion/)

---

## 📞 联系方式

- 📧 **技术支持**: 22519085@zju.edu.cn
- 🐛 **问题反馈**: [GitHub Issues](https://github.com/caizhiyu/experiment-forest/issues)
- 💬 **讨论交流**: [GitHub Discussions](https://github.com/caizhiyu/experiment-forest/discussions)

---

## ⭐ Star History

如果这个项目对你有帮助，请给我们一个 ⭐

[![Star History Chart](https://api.star-history.com/svg?repos=caizhiyu/experiment-forest&type=Date)](https://star-history.com/#caizhiyu/experiment-forest&Date)

---

<div align="center">

**实验小森林** - 让科研记录变得简单有趣 🌲

Made with ❤️ by Zhiyu Cai

</div>
