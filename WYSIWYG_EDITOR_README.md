# 所见即所得编辑器 (WYSIWYG Editor)

## 概述

这是一个功能强大的所见即所得编辑器，提供类似 Notion 的编辑体验。支持块级编辑、命令面板、拖拽排序、Markdown 语法、数学公式和代码高亮等丰富功能。

## 主要特性

### 🎯 块级编辑
- **独立管理**: 每个内容块独立管理，可以单独编辑和操作
- **多种类型**: 支持标题(H1-H3)、段落、列表、代码块、引用等
- **拖拽排序**: 鼠标拖拽即可重新排列块的顺序
- **键盘导航**: 使用方向键在块间快速导航

### ⌨️ 命令面板
- **快捷触发**: 输入 `/` 即可打开命令面板
- **智能搜索**: 支持搜索块类型快速选择
- **快捷方式**: 支持 Markdown 风格的快捷输入方式

### 🎨 富文本支持
- **Markdown**: 完整的 Markdown 语法支持
- **数学公式**: LaTeX 格式的数学公式渲染
- **代码高亮**: 多语言代码语法高亮
- **表格**: 支持表格编辑和显示

### 🔄 实时预览
- **即时渲染**: 编辑内容实时渲染为最终格式
- **预览模式**: 一键切换纯预览模式
- **分屏显示**: 编辑和预览同时显示

## 组件架构

### 核心组件

#### 1. WysiwygEditor
主要的编辑器组件，提供完整的编辑功能。

```typescript
import { WysiwygEditor } from '@/components/WysiwygEditor';

<WysiwygEditor
  value={content}
  onChange={setContent}
  placeholder="开始输入内容..."
  showToolbar={true}
  fullscreen={false}
  onFullscreenToggle={() => setFullscreen(!fullscreen)}
/>
```

**属性说明**:
- `value`: 编辑器内容 (Markdown 字符串)
- `onChange`: 内容变化回调函数
- `placeholder`: 占位符文本
- `showToolbar`: 是否显示工具栏
- `fullscreen`: 是否全屏模式
- `onFullscreenToggle`: 全屏切换回调

#### 2. FullscreenWysiwygEditor
全屏编辑器组件，提供模态框形式的编辑体验。

```typescript
import { FullscreenWysiwygEditor } from '@/components/FullscreenWysiwygEditor';

<FullscreenWysiwygEditor
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  value={content}
  onChange={setContent}
  title="编辑文档"
  placeholder="开始输入内容..."
/>
```

#### 3. WysiwygTextarea
为现有 textarea 提供所见即所得编辑能力的包装组件。

```typescript
import { WysiwygTextarea } from '@/components/WysiwygTextarea';

<WysiwygTextarea
  value={content}
  onChange={setContent}
  placeholder="输入内容..."
  title="内容编辑"
  mode="both" // 'inline' | 'fullscreen' | 'both'
  className="w-full border rounded-lg"
/>
```

**模式说明**:
- `inline`: 仅内联编辑模式
- `fullscreen`: 仅全屏编辑模式  
- `both`: 同时支持内联和全屏编辑

#### 4. EnhancedInput 集成
在 EnhancedInput 组件中新增了 `wysiwyg` 类型支持。

```typescript
import { EnhancedInput } from '@/components/EnhancedForm';

<EnhancedInput
  label="文档内容"
  type="wysiwyg"
  value={content}
  onChange={setContent}
  icon="fa-file-alt"
  placeholder="开始编写..."
  wysiwygMode="both"
  required
/>
```

## 使用方法

### 基础使用

```typescript
import React, { useState } from 'react';
import { WysiwygEditor } from '@/components/WysiwygEditor';

function MyComponent() {
  const [content, setContent] = useState('# 标题\n\n开始编写您的内容...');
  
  return (
    <WysiwygEditor
      value={content}
      onChange={setContent}
      placeholder="输入 / 开始编写..."
      showToolbar={true}
    />
  );
}
```

### 表单集成

```typescript
import { EnhancedInput } from '@/components/EnhancedForm';

<EnhancedInput
  label="实验记录"
  type="wysiwyg"
  value={formData.content}
  onChange={(value) => setFormData({...formData, content: value})}
  error={errors.content}
  icon="fa-flask"
  required
  placeholder="记录实验过程和观察结果..."
  wysiwygMode="both"
/>
```

### 现有 Textarea 升级

```typescript
// 原有的 textarea
<textarea 
  value={content} 
  onChange={(e) => setContent(e.target.value)}
  className="w-full border rounded-lg p-3"
/>

// 升级为所见即所得编辑器
<WysiwygTextarea
  value={content}
  onChange={setContent}
  className="w-full border rounded-lg p-3"
  mode="both"
>
  {/* 可以保留原有的 textarea 作为备选 */}
  <textarea 
    value={content} 
    onChange={(e) => setContent(e.target.value)}
    className="w-full border rounded-lg p-3"
  />
</WysiwygTextarea>
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Enter` | 创建新块 |
| `Backspace` | 删除空块 |
| `/` | 打开命令面板 |
| `↑` `↓` | 块间导航 |
| `Ctrl+S` | 保存并关闭（全屏模式） |
| `Ctrl+P` | 切换预览模式 |
| `Esc` | 退出编辑器（全屏模式） |
| `F11` | 切换全屏 |

## 支持的块类型

### 标题
```
# 一级标题
## 二级标题  
### 三级标题
```

### 列表
```
* 无序列表项
- 无序列表项

1. 有序列表项
2. 有序列表项
```

### 代码块
````
```javascript
function hello() {
  console.log("Hello, World!");
}
```
````

### 引用
```
> 这是一个引用块
> 可以用来突出显示重要信息
```

### 数学公式
```
行内公式：$E = mc^2$

块级公式：
$$\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}$$
```

## 演示页面

访问 `/wysiwyg-demo` 页面可以体验所有功能的完整演示。

## 最佳实践

### 1. 性能优化
- 对于大型文档，建议使用分页或虚拟滚动
- 避免在单个块中放置过多内容
- 合理使用预览模式以减少实时渲染开销

### 2. 用户体验
- 提供清晰的操作提示和快捷键说明
- 合理使用占位符文本引导用户操作
- 在重要操作前提供确认提示

### 3. 数据管理
- 定期保存编辑内容，避免数据丢失
- 实现版本历史功能，方便内容回滚
- 支持导入导出功能，提高内容可移植性

## 技术实现

### 核心技术栈
- **React 18**: 函数式组件和 Hooks
- **TypeScript**: 类型安全
- **Framer Motion**: 动画效果
- **Marked**: Markdown 解析
- **KaTeX**: 数学公式渲染
- **Highlight.js**: 代码高亮
- **DOMPurify**: XSS 防护

### 架构设计
- **块级数据结构**: 每个内容块独立管理
- **事件驱动**: 基于用户交互事件的状态更新
- **组件化设计**: 可复用的编辑器组件
- **渐进增强**: 从普通 textarea 逐步增强功能

## 贡献指南

如需扩展编辑器功能，请遵循以下原则：

1. **保持组件独立性**: 新功能应作为独立组件实现
2. **类型安全**: 所有新增接口都需要 TypeScript 类型定义
3. **向后兼容**: 新功能不应破坏现有 API
4. **性能优先**: 避免不必要的重新渲染和内存泄漏
5. **用户体验**: 保持操作的直观性和一致性

## 未来规划

- [ ] 实时协作编辑
- [ ] 插件系统
- [ ] 移动端优化
- [ ] 离线编辑支持
- [ ] 更多块类型（图片、视频、表格等）
- [ ] 主题定制
- [ ] 导入导出功能增强