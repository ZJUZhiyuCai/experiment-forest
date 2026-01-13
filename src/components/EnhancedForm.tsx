import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { FullscreenEditor } from './FullscreenEditor';
import { WysiwygTextarea } from './WysiwygTextarea';

interface EnhancedInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'password' | 'textarea' | 'wysiwyg' | 'select' | 'date';
  placeholder?: string;
  error?: string;
  icon?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  className?: string;
  wysiwygMode?: 'inline' | 'fullscreen' | 'both'; // 所见即所得模式选项
}

export const EnhancedInput: React.FC<EnhancedInputProps> = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  error,
  icon,
  options,
  required,
  className,
  wysiwygMode = 'both'
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);

  const hasValue = value.length > 0;
  const showFloatingLabel = isFocused || hasValue;

  const baseInputClasses = `
    w-full px-4 py-3 border-2 rounded-lg transition-all duration-300 
    bg-white text-gray-900 placeholder-transparent
    focus:outline-none focus:ring-0
    ${error 
      ? 'border-red-400 focus:border-red-500' 
      : 'border-gray-200 focus:border-emerald-500 hover:border-emerald-300'
    }
  `;

  const renderInput = () => {
    const commonProps = {
      value,
      onChange: (e: any) => {
        onChange(e.target.value);
        if (!hasInteracted) setHasInteracted(true);
      },
      onFocus: () => setIsFocused(true),
      onBlur: () => setIsFocused(false),
      placeholder: showFloatingLabel ? '' : placeholder,
      className: baseInputClasses,
      required
    };

    switch (type) {
      case 'textarea':
        return (
          <div className="relative">
            <textarea
              {...commonProps}
              rows={8}
              className={cn(baseInputClasses, 'resize-y min-h-[200px] pr-12')}
            />
            {/* 全屏编辑按钮 */}
            <motion.button
              type="button"
              onClick={() => setIsFullscreenOpen(true)}
              className="absolute top-3 right-3 p-2 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all duration-200 group"
              title="全屏编辑"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <i className="fa-solid fa-expand text-sm group-hover:rotate-12 transition-transform duration-200"></i>
            </motion.button>
          </div>
        );
      
      case 'wysiwyg':
        return (
          <WysiwygTextarea
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={cn(baseInputClasses, 'min-h-[200px]')}
            title={label}
            mode={wysiwygMode}
            required={required}
          />
        );
      
      case 'select':
        return (
          <select {...commonProps} className={baseInputClasses}>
            {!required && <option value="">请选择</option>}
            {options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      
      default:
        return <input {...commonProps} type={type} />;
    }
  };

  return (
    <motion.div 
      className={cn('relative', className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* 背景光晕效果 */}
      <motion.div
        className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-400/10 to-teal-400/10"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ 
          opacity: isFocused ? 1 : 0,
          scale: isFocused ? 1 : 0.8
        }}
        transition={{ duration: 0.3 }}
      />

      <div className="relative">
        {/* 图标 */}
        {icon && (
          <motion.div 
            className={cn(
              'absolute left-3 top-1/2 transform -translate-y-1/2 z-10 transition-colors duration-300',
              isFocused || hasValue ? 'text-emerald-500' : 'text-gray-400'
            )}
            animate={{ scale: isFocused ? 1.1 : 1 }}
            transition={{ duration: 0.2 }}
          >
            <i className={`fa-solid ${icon} text-sm`}></i>
          </motion.div>
        )}

        {/* 输入框 */}
        <div className={icon ? 'pl-10' : ''}>
          {renderInput()}
        </div>

        {/* 浮动标签 */}
        <motion.label
          className={cn(
            'absolute left-4 pointer-events-none transition-all duration-300 origin-left',
            icon && 'left-12',
            showFloatingLabel
              ? 'top-2 text-xs text-emerald-600 scale-90'
              : 'top-1/2 transform -translate-y-1/2 text-gray-500',
            isFocused && 'text-emerald-600'
          )}
          animate={{
            y: showFloatingLabel ? -8 : 0,
            scale: showFloatingLabel ? 0.85 : 1,
            color: isFocused ? '#059669' : showFloatingLabel ? '#4b5563' : '#9ca3af'
          }}
          transition={{ duration: 0.2 }}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </motion.label>

        {/* 底部装饰线 */}
        <motion.div
          className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-emerald-400 to-teal-500"
          initial={{ width: 0 }}
          animate={{ width: isFocused ? '100%' : 0 }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* 错误提示 */}
      <AnimatePresence>
        {error && hasInteracted && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-2 flex items-center text-red-500 text-sm"
          >
            <motion.i 
              className="fa-solid fa-exclamation-circle mr-2"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 0.5 }}
            />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 成功状态指示 */}
      <AnimatePresence>
        {hasValue && !error && hasInteracted && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2"
          >
            <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
              <i className="fa-solid fa-check text-white text-xs"></i>
            </div>
          </motion.div>
        )}      </AnimatePresence>

      {/* 全屏编辑器 */}
      {type === 'textarea' && (
        <FullscreenEditor
          isOpen={isFullscreenOpen}
          onClose={() => setIsFullscreenOpen(false)}
          value={value}
          onChange={onChange}
          title={label}
          placeholder={placeholder}
        />
      )}
    </motion.div>
  );
};

// 增强的表单容器
interface EnhancedFormContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
  submitText?: string;
  cancelText?: string;
  onCancel?: () => void;
  progress?: number; // 0-100
}

export const EnhancedFormContainer: React.FC<EnhancedFormContainerProps> = ({
  title,
  subtitle,
  children,
  onSubmit,
  isSubmitting,
  submitText = '保存',
  cancelText = '取消',
  onCancel,
  progress
}) => {
  return (
    <motion.div
      className="max-w-4xl mx-auto"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* 表单头部 */}
      <motion.div 
        className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-t-xl p-6 border-l-4 border-emerald-500"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#4A7C59] flex items-center">
              <motion.i 
                className="fa-solid fa-seedling mr-3 text-emerald-500"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              {title}
            </h2>
            {subtitle && (
              <p className="text-gray-600 mt-2">{subtitle}</p>
            )}
          </div>
          
          {/* 进度指示器 */}
          {typeof progress === 'number' && (
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600">完成度</span>
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald-400 to-teal-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8 }}
                />
              </div>
              <span className="text-sm font-medium text-emerald-600">{progress}%</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* 表单主体 */}
      <motion.div 
        className="bg-white rounded-b-xl shadow-lg border border-gray-100"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <form onSubmit={onSubmit} className="p-6 space-y-6">
          {children}
          
          {/* 表单按钮 */}
          <motion.div 
            className="flex justify-end space-x-4 pt-6 border-t border-gray-200"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            {onCancel && (
              <motion.button
                type="button"
                onClick={onCancel}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg 
                         hover:bg-gray-50 hover:border-gray-400 transition-all duration-300
                         focus:outline-none focus:ring-2 focus:ring-gray-500"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {cancelText}
              </motion.button>
            )}
            
            <motion.button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg 
                       hover:from-emerald-600 hover:to-teal-700 transition-all duration-300
                       focus:outline-none focus:ring-2 focus:ring-emerald-500 
                       disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              whileHover={{ scale: isSubmitting ? 1 : 1.05 }}
              whileTap={{ scale: isSubmitting ? 1 : 0.95 }}
            >
              <div className="flex items-center">
                {isSubmitting ? (
                  <>
                    <motion.i 
                      className="fa-solid fa-spinner mr-2"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    保存中...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-save mr-2"></i>
                    {submitText}
                  </>
                )}
              </div>
            </motion.button>
          </motion.div>
        </form>
      </motion.div>
    </motion.div>
  );
};