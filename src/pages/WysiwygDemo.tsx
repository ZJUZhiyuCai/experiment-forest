import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { WysiwygEditor } from '@/components/WysiwygEditor';
import { WysiwygTextarea } from '@/components/WysiwygTextarea';
import { EnhancedInput } from '@/components/EnhancedForm';

export default function WysiwygDemo() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [demoContent1, setDemoContent1] = useState(`# 所见即所得编辑器演示

## 主要特性

### 1. 块级编辑
- 支持多种块类型：标题、段落、列表、代码块、引用
- 使用 \`/\` 键快速选择块类型
- 拖拽重排功能

### 2. 智能命令
输入 \`/\` 可以打开命令面板：
- 标题 1-3
- 无序列表
- 有序列表  
- 代码块
- 引用

### 3. Markdown支持
支持完整的Markdown语法：

\`\`\`javascript
function hello() {
  console.log("Hello, World!");
}
\`\`\`

> 这是一个引用块，可以用来突出显示重要信息

### 4. 数学公式
支持LaTeX数学公式：
- 行内公式：$E = mc^2$
- 块级公式：$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$

### 5. 快捷操作
- **Enter**: 创建新块
- **Backspace**: 删除空块
- **↑/↓**: 块间导航
- **拖拽**: 重新排序`);

  const [demoContent2, setDemoContent2] = useState('');
  const [demoContent3, setDemoContent3] = useState('');

  return (
    <div className="min-h-screen bg-[#F9F6F2] text-[#555555]">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header 
          title="所见即所得编辑器演示" 
          sidebarCollapsed={sidebarCollapsed}
        />
        
        <main className="container mx-auto px-4 py-6 space-y-8">
          {/* 功能介绍 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-md p-6 border border-gray-200"
          >
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-[#4A7C59] mb-2">
                <i className="fa-solid fa-magic mr-3 text-emerald-500"></i>
                所见即所得编辑器
              </h1>
              <p className="text-gray-600">
                体验类似Notion的块级编辑，支持Markdown、数学公式、代码高亮等丰富功能
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-lg border border-emerald-200">
                <i className="fa-solid fa-cubes text-2xl text-emerald-600 mb-2"></i>
                <h3 className="font-semibold text-[#4A7C59] mb-1">块级编辑</h3>
                <p className="text-sm text-gray-600">
                  每个内容块独立管理，支持拖拽排序
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                <i className="fa-solid fa-terminal text-2xl text-blue-600 mb-2"></i>
                <h3 className="font-semibold text-[#4A7C59] mb-1">命令面板</h3>
                <p className="text-sm text-gray-600">
                  输入 / 快速选择块类型
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
                <i className="fa-solid fa-formula text-2xl text-purple-600 mb-2"></i>
                <h3 className="font-semibold text-[#4A7C59] mb-1">数学公式</h3>
                <p className="text-sm text-gray-600">
                  完整的LaTeX数学公式支持
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 p-4 rounded-lg border border-yellow-200">
                <i className="fa-solid fa-code text-2xl text-yellow-600 mb-2"></i>
                <h3 className="font-semibold text-[#4A7C59] mb-1">代码高亮</h3>
                <p className="text-sm text-gray-600">
                  多语言代码高亮显示
                </p>
              </div>
            </div>
          </motion.div>

          {/* 演示区域1：完整功能 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200"
          >
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-gray-200">
              <h2 className="text-xl font-bold text-[#4A7C59] flex items-center">
                <i className="fa-solid fa-edit mr-2 text-emerald-500"></i>
                完整功能演示
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                支持所有块类型、命令面板、拖拽排序等完整功能
              </p>
            </div>
            
            <div className="p-6">
              <WysiwygEditor
                value={demoContent1}
                onChange={setDemoContent1}
                placeholder="尝试输入 / 来体验命令面板..."
                showToolbar={true}
              />
            </div>
          </motion.div>

          {/* 演示区域2：EnhancedInput集成 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-md p-6 border border-gray-200"
          >
            <h2 className="text-xl font-bold text-[#4A7C59] mb-4 flex items-center">
              <i className="fa-solid fa-layer-group mr-2 text-emerald-500"></i>
              表单集成演示
            </h2>
            <p className="text-gray-600 mb-6">
              在表单中无缝集成所见即所得编辑器，支持浮动标签、验证提示等增强功能
            </p>
            
            <div className="space-y-6">
              <EnhancedInput
                label="文档内容"
                type="wysiwyg"
                value={demoContent2}
                onChange={setDemoContent2}
                icon="fa-file-alt"
                placeholder="开始编写您的文档内容..."
                wysiwygMode="both"
              />
            </div>
          </motion.div>

          {/* 演示区域3：WysiwygTextarea包装器 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl shadow-md p-6 border border-gray-200"
          >
            <h2 className="text-xl font-bold text-[#4A7C59] mb-4 flex items-center">
              <i className="fa-solid fa-magic mr-2 text-emerald-500"></i>
              Textarea升级演示
            </h2>
            <p className="text-gray-600 mb-6">
              为现有的textarea添加所见即所得编辑能力，支持模式切换
            </p>
            
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                实验记录内容
              </label>
              <WysiwygTextarea
                value={demoContent3}
                onChange={setDemoContent3}
                placeholder="记录您的实验观察和发现..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                title="实验记录"
                mode="both"
                rows={8}
              />
            </div>
          </motion.div>

          {/* 使用说明 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl shadow-md p-6 border border-gray-200"
          >
            <h2 className="text-xl font-bold text-[#4A7C59] mb-4 flex items-center">
              <i className="fa-solid fa-question-circle mr-2 text-emerald-500"></i>
              使用说明
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">快捷键</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li><kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Enter</kbd> 创建新块</li>
                  <li><kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Backspace</kbd> 删除空块</li>
                  <li><kbd className="px-2 py-1 bg-gray-100 rounded text-xs">/</kbd> 打开命令面板</li>
                  <li><kbd className="px-2 py-1 bg-gray-100 rounded text-xs">↑</kbd> <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">↓</kbd> 块间导航</li>
                  <li><kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Ctrl+S</kbd> 保存</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">支持的块类型</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li><i className="fa-solid fa-heading text-gray-400 mr-2"></i>标题 (H1, H2, H3)</li>
                  <li><i className="fa-solid fa-paragraph text-gray-400 mr-2"></i>段落</li>
                  <li><i className="fa-solid fa-list-ul text-gray-400 mr-2"></i>无序列表</li>
                  <li><i className="fa-solid fa-list-ol text-gray-400 mr-2"></i>有序列表</li>
                  <li><i className="fa-solid fa-code text-gray-400 mr-2"></i>代码块</li>
                  <li><i className="fa-solid fa-quote-right text-gray-400 mr-2"></i>引用</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}