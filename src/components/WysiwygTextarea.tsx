import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FullscreenWysiwygEditor } from './FullscreenWysiwygEditor';
import { WysiwygEditor } from './WysiwygEditor';

interface WysiwygTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  name?: string;
  required?: boolean;
  rows?: number;
  title?: string;
  mode?: 'inline' | 'fullscreen' | 'both'; // 显示模式
  children?: React.ReactNode; // 用于自定义textarea的其他属性
}

export const WysiwygTextarea: React.FC<WysiwygTextareaProps> = ({
  value,
  onChange,
  placeholder,
  className,
  name,
  required,
  rows = 8,
  title = '内容编辑',
  mode = 'both',
  children
}) => {
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [isWysiwygMode, setIsWysiwygMode] = useState(false);

  const toggleWysiwygMode = () => {
    setIsWysiwygMode(!isWysiwygMode);
  };

  return (
    <div className="relative">
      {/* 模式切换按钮 */}
      {(mode === 'both' || mode === 'inline') && (
        <div className="absolute top-3 right-12 z-20 flex space-x-1">
          <motion.button
            type="button"
            onClick={toggleWysiwygMode}
            className={`p-2 rounded-lg transition-all duration-200 group ${
              isWysiwygMode
                ? 'bg-emerald-500 text-white shadow-md'
                : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-50'
            }`}
            title={isWysiwygMode ? '切换到Markdown模式' : '切换到所见即所得模式'}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <i className={`fa-solid ${isWysiwygMode ? 'fa-code' : 'fa-magic'} text-sm`}></i>
          </motion.button>
        </div>
      )}

      {/* 全屏编辑按钮 */}
      {(mode === 'both' || mode === 'fullscreen') && (
        <motion.button
          type="button"
          onClick={() => setIsFullscreenOpen(true)}
          className="absolute top-3 right-3 p-2 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all duration-200 group z-20 bg-white shadow-sm border border-gray-200 hover:border-emerald-300"
          title="全屏编辑"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <i className="fa-solid fa-expand text-sm group-hover:rotate-12 transition-transform duration-200"></i>
        </motion.button>
      )}

      {/* 编辑器内容 */}
      {isWysiwygMode && (mode === 'both' || mode === 'inline') ? (
        <div className="border border-gray-300 rounded-lg overflow-hidden min-h-[200px]">
          <WysiwygEditor
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            showToolbar={true}
            className="min-h-[200px]"
          />
        </div>
      ) : (
        <>
          {/* 原有的textarea */}
          {children || (
            <textarea
              name={name}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className={`${className} pr-24`} // 为按钮留出空间
              required={required}
              rows={rows}
            />
          )}
        </>
      )}

      {/* 全屏编辑器 */}
      <FullscreenWysiwygEditor
        isOpen={isFullscreenOpen}
        onClose={() => setIsFullscreenOpen(false)}
        value={value}
        onChange={onChange}
        title={title}
        placeholder={placeholder}
      />

      {/* 模式指示器 */}
      {(mode === 'both' || mode === 'inline') && isWysiwygMode && (
        <div className="absolute bottom-2 left-2 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-md border border-emerald-200">
          <i className="fa-solid fa-magic mr-1"></i>
          所见即所得模式
        </div>
      )}
    </div>
  );
};