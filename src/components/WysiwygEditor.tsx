import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Block {
  id: string;
  type: 'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'bullet' | 'numbered' | 'code' | 'quote';
  content: string;
  level?: number;
}

interface WysiwygEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showToolbar?: boolean;
  fullscreen?: boolean;
  onFullscreenToggle?: () => void;
}

export const WysiwygEditor: React.FC<WysiwygEditorProps> = ({
  value,
  onChange,
  placeholder = '输入 / 开始编写...',
  className = '',
  showToolbar = true,
  fullscreen = false,
  onFullscreenToggle
}) => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string>('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandPosition, setCommandPosition] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedBlockId, setDraggedBlockId] = useState<string>('');

  // 初始化编辑器内容
  useEffect(() => {
    if (value && blocks.length === 0) {
      const lines = value.split('\n');
      const initialBlocks: Block[] = lines.map((line, index) => ({
        id: `block-${Date.now()}-${index}`,
        type: detectBlockType(line),
        content: line.replace(/^(#{1,3}\s*|\*\s*|\d+\.\s*|>\s*)/, '').trim()
      }));
      setBlocks(initialBlocks.length > 0 ? initialBlocks : [createNewBlock()]);
    }
  }, [value, blocks.length]);

  // 将blocks转换为markdown字符串
  const blocksToMarkdown = useCallback((blocks: Block[]): string => {
    return blocks.map(block => {
      switch (block.type) {
        case 'heading1':
          return `# ${block.content}`;
        case 'heading2':
          return `## ${block.content}`;
        case 'heading3':
          return `### ${block.content}`;
        case 'bullet':
          return `* ${block.content}`;
        case 'numbered':
          return `1. ${block.content}`;
        case 'code':
          return `\`\`\`\n${block.content}\n\`\`\``;
        case 'quote':
          return `> ${block.content}`;
        default:
          return block.content;
      }
    }).join('\n');
  }, []);

  // 检测块类型
  const detectBlockType = (line: string): Block['type'] => {
    if (line.startsWith('# ')) return 'heading1';
    if (line.startsWith('## ')) return 'heading2';
    if (line.startsWith('### ')) return 'heading3';
    if (line.startsWith('* ')) return 'bullet';
    if (line.match(/^\d+\.\s/)) return 'numbered';
    if (line.startsWith('> ')) return 'quote';
    if (line.startsWith('```')) return 'code';
    return 'paragraph';
  };

  // 创建新块
  const createNewBlock = (type: Block['type'] = 'paragraph'): Block => ({
    id: `block-${Date.now()}-${Math.random()}`,
    type,
    content: ''
  });

  // 更新块内容
  const updateBlock = (id: string, content: string, type?: Block['type']) => {
    const newBlocks = blocks.map(block => 
      block.id === id 
        ? { ...block, content, ...(type && { type }) }
        : block
    );
    setBlocks(newBlocks);
    onChange(blocksToMarkdown(newBlocks));
  };

  // 添加新块
  const addBlock = (afterId: string, type: Block['type'] = 'paragraph') => {
    const index = blocks.findIndex(block => block.id === afterId);
    const newBlock = createNewBlock(type);
    const newBlocks = [
      ...blocks.slice(0, index + 1),
      newBlock,
      ...blocks.slice(index + 1)
    ];
    setBlocks(newBlocks);
    setActiveBlockId(newBlock.id);
    
    // 聚焦新块
    setTimeout(() => {
      const element = document.querySelector(`[data-block-id="${newBlock.id}"]`) as HTMLElement;
      element?.focus();
    }, 0);
  };

  // 删除块
  const deleteBlock = (id: string) => {
    if (blocks.length <= 1) return;
    
    const index = blocks.findIndex(block => block.id === id);
    const newBlocks = blocks.filter(block => block.id !== id);
    setBlocks(newBlocks);
    onChange(blocksToMarkdown(newBlocks));
    
    // 聚焦前一个块
    if (index > 0) {
      const prevBlock = newBlocks[index - 1];
      setActiveBlockId(prevBlock.id);
      setTimeout(() => {
        const element = document.querySelector(`[data-block-id="${prevBlock.id}"]`) as HTMLElement;
        element?.focus();
      }, 0);
    }
  };

  // 处理按键事件
  const handleKeyDown = (e: React.KeyboardEvent, blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    // Enter - 创建新块
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addBlock(blockId);
    }
    
    // Backspace - 删除空块或合并块
    if (e.key === 'Backspace' && block.content === '') {
      e.preventDefault();
      deleteBlock(blockId);
    }
    
    // / - 显示命令面板
    if (e.key === '/' && block.content === '') {
      e.preventDefault();
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setCommandPosition({ x: rect.left, y: rect.bottom + 5 });
      setShowCommandPalette(true);
      setSearchQuery('');
    }
    
    // 方向键导航
    if (e.key === 'ArrowUp') {
      const index = blocks.findIndex(b => b.id === blockId);
      if (index > 0) {
        const prevBlock = blocks[index - 1];
        setActiveBlockId(prevBlock.id);
        setTimeout(() => {
          const element = document.querySelector(`[data-block-id="${prevBlock.id}"]`) as HTMLElement;
          element?.focus();
        }, 0);
      }
    }
    
    if (e.key === 'ArrowDown') {
      const index = blocks.findIndex(b => b.id === blockId);
      if (index < blocks.length - 1) {
        const nextBlock = blocks[index + 1];
        setActiveBlockId(nextBlock.id);
        setTimeout(() => {
          const element = document.querySelector(`[data-block-id="${nextBlock.id}"]`) as HTMLElement;
          element?.focus();
        }, 0);
      }
    }
  };

  // 命令面板选项
  const commandOptions = [
    { icon: 'fa-heading', label: '标题 1', type: 'heading1' as Block['type'], shortcut: '# + 空格' },
    { icon: 'fa-heading', label: '标题 2', type: 'heading2' as Block['type'], shortcut: '## + 空格' },
    { icon: 'fa-heading', label: '标题 3', type: 'heading3' as Block['type'], shortcut: '### + 空格' },
    { icon: 'fa-list-ul', label: '无序列表', type: 'bullet' as Block['type'], shortcut: '* + 空格' },
    { icon: 'fa-list-ol', label: '有序列表', type: 'numbered' as Block['type'], shortcut: '1. + 空格' },
    { icon: 'fa-code', label: '代码块', type: 'code' as Block['type'], shortcut: '``` + 空格' },
    { icon: 'fa-quote-right', label: '引用', type: 'quote' as Block['type'], shortcut: '> + 空格' }
  ].filter(option => 
    option.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 应用命令
  const applyCommand = (type: Block['type']) => {
    if (activeBlockId) {
      updateBlock(activeBlockId, '', type);
      setShowCommandPalette(false);
      setTimeout(() => {
        const element = document.querySelector(`[data-block-id="${activeBlockId}"]`) as HTMLElement;
        element?.focus();
      }, 0);
    }
  };

  // 拖拽处理
  const handleDragStart = (e: React.DragEvent, blockId: string) => {
    setIsDragging(true);
    setDraggedBlockId(blockId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropTargetId: string) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (draggedBlockId === dropTargetId) return;
    
    const draggedIndex = blocks.findIndex(b => b.id === draggedBlockId);
    const targetIndex = blocks.findIndex(b => b.id === dropTargetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    const newBlocks = [...blocks];
    const [draggedBlock] = newBlocks.splice(draggedIndex, 1);
    newBlocks.splice(targetIndex, 0, draggedBlock);
    
    setBlocks(newBlocks);
    onChange(blocksToMarkdown(newBlocks));
    setDraggedBlockId('');
  };

  // 渲染块
  const renderBlock = (block: Block, index: number) => {
    const isActive = activeBlockId === block.id;
    
    const getPlaceholder = () => {
      switch (block.type) {
        case 'heading1': return '标题 1';
        case 'heading2': return '标题 2';
        case 'heading3': return '标题 3';
        case 'bullet': return '列表项';
        case 'numbered': return '编号列表项';
        case 'code': return '输入代码...';
        case 'quote': return '输入引用...';
        default: return index === 0 && blocks.length === 1 ? placeholder : '输入内容或按 / 选择块类型';
      }
    };

    const getBlockStyle = () => {
      switch (block.type) {
        case 'heading1': return 'text-3xl font-bold text-gray-900';
        case 'heading2': return 'text-2xl font-semibold text-gray-800';
        case 'heading3': return 'text-xl font-medium text-gray-700';
        case 'bullet': return 'text-base text-gray-700 pl-6 relative';
        case 'numbered': return 'text-base text-gray-700 pl-6 relative';
        case 'code': return 'text-sm font-mono bg-gray-100 p-3 rounded border text-gray-800';
        case 'quote': return 'text-base text-gray-600 pl-4 border-l-4 border-emerald-300 bg-emerald-50';
        default: return 'text-base text-gray-700';
      }
    };

    return (
      <motion.div
        key={block.id}
        className={`relative group ${isDragging && draggedBlockId === block.id ? 'opacity-50' : ''}`}
        layout
      >
        <div
          draggable
          onDragStart={(e: React.DragEvent<HTMLDivElement>) => handleDragStart(e, block.id)}
          onDragOver={(e: React.DragEvent<HTMLDivElement>) => handleDragOver(e)}
          onDrop={(e: React.DragEvent<HTMLDivElement>) => handleDrop(e, block.id)}
        >
        {/* 拖拽手柄 */}
        <div className="absolute left-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center h-full">
          <button
            className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
            title="拖拽重排"
          >
            <i className="fa-solid fa-grip-vertical text-sm"></i>
          </button>
        </div>

        {/* 块类型图标 */}
        <div className="flex items-start space-x-2 ml-8">
          {(block.type === 'bullet' || block.type === 'numbered') && (
            <div className="absolute left-2 top-2">
              {block.type === 'bullet' ? 
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div> :
                <span className="text-sm text-gray-500 font-medium">{index + 1}.</span>
              }
            </div>
          )}
          
          <div
            contentEditable
            suppressContentEditableWarning
            data-block-id={block.id}
            className={`
              flex-1 outline-none min-h-[1.5rem] w-full
              ${getBlockStyle()}
              ${isActive ? 'ring-2 ring-emerald-300 rounded-md' : ''}
              ${block.content === '' ? 'empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400' : ''}
            `}
            data-placeholder={getPlaceholder()}
            onInput={(e) => {
              const content = (e.target as HTMLElement).textContent || '';
              updateBlock(block.id, content);
            }}
            onFocus={() => setActiveBlockId(block.id)}
            onKeyDown={(e) => handleKeyDown(e, block.id)}
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {block.content}
          </div>
        </div>

        {/* 块操作按钮 */}
        {isActive && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute right-0 top-0 flex items-center space-x-1"
          >
            <button
              onClick={() => addBlock(block.id)}
              className="p-1 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded"
              title="添加块"
            >
              <i className="fa-solid fa-plus text-sm"></i>
            </button>
            {blocks.length > 1 && (
              <button
                onClick={() => deleteBlock(block.id)}
                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                title="删除块"
              >
                <i className="fa-solid fa-trash text-sm"></i>
              </button>
            )}
          </motion.div>
        )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className={`relative ${fullscreen ? 'fixed inset-0 z-50 bg-white' : ''} ${className}`}>
      {/* 工具栏 */}
      {showToolbar && (
        <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-600">
              {blocks.length} 个块 • {blocksToMarkdown(blocks).length} 字符
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className={`px-3 py-1 rounded-md text-sm transition-all ${
                isPreviewMode 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
              title={isPreviewMode ? '切换到编辑模式' : '切换到预览模式'}
            >
              <i className={`fa-solid ${isPreviewMode ? 'fa-edit' : 'fa-eye'} mr-1`}></i>
              {isPreviewMode ? '编辑' : '预览'}
            </button>
            
            {onFullscreenToggle && (
              <button
                onClick={onFullscreenToggle}
                className="p-2 text-gray-600 hover:text-emerald-500 hover:bg-emerald-50 rounded-md transition-all"
                title={fullscreen ? '退出全屏' : '全屏编辑'}
              >
                <i className={`fa-solid ${fullscreen ? 'fa-compress' : 'fa-expand'}`}></i>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 编辑器主体 */}
      <div className={`${fullscreen ? 'h-full' : 'min-h-[400px]'} flex`}>
        {/* 编辑区域 */}
        {!isPreviewMode && (
          <div 
            ref={editorRef}
            className={`${isPreviewMode ? 'w-1/2 border-r border-gray-200' : 'w-full'} p-6 space-y-2 overflow-auto`}
            style={{ maxHeight: fullscreen ? 'calc(100vh - 60px)' : '600px' }}
          >
            {blocks.map((block, index) => renderBlock(block, index))}
          </div>
        )}

        {/* 预览区域 */}
        {isPreviewMode && (
          <div className="w-full p-6 overflow-auto bg-gray-50">
            <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-sm">
              <MarkdownRenderer content={blocksToMarkdown(blocks)} />
            </div>
          </div>
        )}
      </div>

      {/* 命令面板 */}
      <AnimatePresence>
        {showCommandPalette && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-50 min-w-[300px]"
            style={{ 
              left: commandPosition.x, 
              top: commandPosition.y,
              maxHeight: '300px',
              overflowY: 'auto'
            }}
          >
            <div className="p-2 border-b border-gray-100">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索块类型..."
                className="w-full px-3 py-2 text-sm border-none outline-none bg-gray-50 rounded"
                autoFocus
              />
            </div>
            
            <div className="py-1">
              {commandOptions.map((option) => (
                <button
                  key={option.type}
                  onClick={() => applyCommand(option.type)}
                  className="w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-100 rounded text-sm"
                >
                  <i className={`${option.icon} w-4 text-gray-500`}></i>
                  <span className="flex-1">{option.label}</span>
                  <span className="text-xs text-gray-400">{option.shortcut}</span>
                </button>
              ))}
              
              {commandOptions.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-500 text-center">
                  没有找到匹配的块类型
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 点击其他地方关闭命令面板 */}
      {showCommandPalette && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowCommandPalette(false)}
        />
      )}
    </div>
  );
};