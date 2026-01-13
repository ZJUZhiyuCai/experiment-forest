import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FullscreenEditor } from './FullscreenEditor';

interface FullscreenTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  name?: string;
  required?: boolean;
  rows?: number;
  title?: string;
  children?: React.ReactNode; // 用于自定义textarea的其他属性
}

export const FullscreenTextarea: React.FC<FullscreenTextareaProps> = ({
  value,
  onChange,
  placeholder,
  className,
  name,
  required,
  rows = 8,
  title = '内容编辑',
  children
}) => {
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);

  return (
    <div className="relative">
      {/* 原有的textarea */}
      {children || (
        <textarea
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={className}
          required={required}
          rows={rows}
        />
      )}
      
      {/* 全屏编辑按钮 */}
      <motion.button
        type="button"
        onClick={() => setIsFullscreenOpen(true)}
        className="absolute top-3 right-3 p-2 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all duration-200 group z-10 bg-white shadow-sm border border-gray-200 hover:border-emerald-300"
        title="全屏编辑"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <i className="fa-solid fa-expand text-sm group-hover:rotate-12 transition-transform duration-200"></i>
      </motion.button>

      {/* 全屏编辑器 */}
      <FullscreenEditor
        isOpen={isFullscreenOpen}
        onClose={() => setIsFullscreenOpen(false)}
        value={value}
        onChange={onChange}
        title={title}
        placeholder={placeholder}
      />
    </div>
  );
};