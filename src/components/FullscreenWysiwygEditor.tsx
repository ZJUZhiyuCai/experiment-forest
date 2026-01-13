import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WysiwygEditor } from './WysiwygEditor';

interface FullscreenWysiwygEditorProps {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  title: string;
  placeholder?: string;
}

export const FullscreenWysiwygEditor: React.FC<FullscreenWysiwygEditorProps> = ({
  isOpen,
  onClose,
  value,
  onChange,
  title,
  placeholder = '开始输入内容...'
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 快捷键支持
  React.useEffect(() => {
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
      
      // F11 切换全屏
      if (e.key === 'F11') {
        e.preventDefault();
        setIsFullscreen(!isFullscreen);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isFullscreen]);

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
          className="fixed inset-4 bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col"
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
                <i className="fa-solid fa-magic mr-2 text-emerald-500"></i>
                {title}
              </h2>
              <span className="text-sm text-gray-500">所见即所得编辑模式</span>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* 快捷键提示 */}
              <div className="text-xs text-gray-500 hidden md:block">
                <span>Ctrl+S 保存</span> <span className="mx-2">•</span>
                <span>/ 命令面板</span> <span className="mx-2">•</span>
                <span>F11 全屏</span> <span className="mx-2">•</span>
                <span>Esc 退出</span>
              </div>
              
              {/* 全屏切换按钮 */}
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="px-3 py-2 rounded-lg bg-white text-gray-600 hover:bg-gray-50 transition-all duration-200"
                title={isFullscreen ? '退出全屏 (F11)' : '进入全屏 (F11)'}
              >
                <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'} mr-1`}></i>
                {isFullscreen ? '退出全屏' : '全屏'}
              </button>
              
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

          {/* 编辑器区域 */}
          <div className="flex-1 overflow-hidden">
            <WysiwygEditor
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              showToolbar={true}
              fullscreen={isFullscreen}
              onFullscreenToggle={() => setIsFullscreen(!isFullscreen)}
              className="h-full"
            />
          </div>

          {/* 底部状态栏 */}
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center space-x-4">
              <span>字符数: {value.length}</span>
              <span>行数: {value.split('\n').length}</span>
              <span>块数: {value.split('\n').filter(line => line.trim()).length}</span>
            </div>
            <div className="flex items-center space-x-2">
              <i className="fa-solid fa-lightbulb text-yellow-500"></i>
              <span>支持 Markdown、块级编辑、拖拽排序</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};