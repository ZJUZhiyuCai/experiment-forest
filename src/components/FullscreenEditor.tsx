import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MarkdownRenderer } from './MarkdownRenderer';

interface FullscreenEditorProps {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  title: string;
  placeholder?: string;
}

export const FullscreenEditor: React.FC<FullscreenEditorProps> = ({
  isOpen,
  onClose,
  value,
  onChange,
  title,
  placeholder = '开始输入内容...'
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 当编辑器打开时聚焦
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // 快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      // Ctrl/Cmd + S 保存并关闭
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onClose();
      }
      
      // Escape 键关闭
      if (e.key === 'Escape') {
        onClose();
      }
      
      // Ctrl/Cmd + P 切换预览
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setShowPreview(!showPreview);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, showPreview]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-black bg-opacity-50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="fixed inset-4 bg-white rounded-xl shadow-2xl overflow-hidden"
          initial={{ opacity: 0, scale: 0.9, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 50 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 顶部工具栏 */}
          <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-gray-200">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-bold text-[#4A7C59] flex items-center">
                <i className="fa-solid fa-expand mr-2 text-emerald-500"></i>
                {title}
              </h2>
              <span className="text-sm text-gray-500">全屏编辑模式</span>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* 预览切换按钮 */}
              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`px-3 py-2 rounded-lg transition-all duration-200 ${
                  showPreview 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                title="切换预览 (Ctrl+P)"
              >
                <i className={`fa-solid ${showPreview ? 'fa-edit' : 'fa-eye'} mr-1`}></i>
                {showPreview ? '编辑' : '预览'}
              </button>
              
              {/* 快捷键提示 */}
              <div className="text-xs text-gray-500 hidden md:block">
                <span>Ctrl+S 保存</span> <span className="mx-2">•</span>
                <span>Ctrl+P 预览</span> <span className="mx-2">•</span>
                <span>Esc 退出</span>
              </div>
              
              {/* 关闭按钮 */}
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200"
                title="关闭编辑器 (Esc)"
              >
                <i className="fa-solid fa-times text-lg"></i>
              </button>
            </div>
          </div>

          {/* 主编辑区域 */}
          <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100% - 73px)' }}>
            {/* 编辑区域 */}
            <div className={`${showPreview ? 'w-1/2' : 'w-full'} flex flex-col`}>
              <div className="flex-1 p-6 overflow-hidden">
                <textarea
                  ref={textareaRef}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={placeholder}
                  className="w-full h-full resize-none border-none outline-none text-gray-800 leading-relaxed text-base font-mono bg-transparent"
                  style={{ 
                    fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace',
                    lineHeight: '1.6'
                  }}
                />
              </div>
              
              {/* 底部状态栏 */}
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center space-x-4">
                  <span>字符数: {value.length}</span>
                  <span>行数: {value.split('\n').length}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <i className="fa-solid fa-lightbulb text-yellow-500"></i>
                  <span>支持 Markdown、LaTeX 公式和代码高亮</span>
                </div>
              </div>
            </div>

            {/* 预览区域 */}
            <AnimatePresence>
              {showPreview && (
                <motion.div
                  className="w-1/2 border-l border-gray-200 bg-gray-50"
                  initial={{ opacity: 0, x: 300 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 300 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                >
                  <div className="h-full overflow-auto p-6">
                    <div className="bg-white rounded-lg shadow-sm p-6 min-h-full">
                      {value.trim() ? (
                        <MarkdownRenderer content={value} />
                      ) : (
                        <div className="text-center text-gray-400 mt-20">
                          <i className="fa-solid fa-file-text text-4xl mb-4"></i>
                          <p>开始输入内容以查看预览</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};