import { motion, AnimatePresence } from 'framer-motion';
import { useState, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EnhancedCardProps {
  title: string;
  subtitle?: string;
  content?: string;
  status?: 'draft' | 'completed' | 'archived' | 'pending' | 'approved' | 'rejected';
  category?: string;
  tags?: string[];
  date?: string;
  author?: string;
  icon?: string;
  gradient?: 'emerald' | 'blue' | 'purple' | 'orange' | 'pink';
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  children?: ReactNode;
  className?: string;
  hoverable?: boolean;
  expandable?: boolean;
}

export const EnhancedCard: React.FC<EnhancedCardProps> = ({
  title,
  subtitle,
  content,
  status,
  category,
  tags = [],
  date,
  author,
  icon = 'fa-file-alt',
  gradient = 'emerald',
  onClick,
  onEdit,
  onDelete,
  children,
  className,
  hoverable = true,
  expandable = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const gradientClasses = {
    emerald: 'from-emerald-400 to-teal-500',
    blue: 'from-blue-400 to-indigo-500',
    purple: 'from-purple-400 to-pink-500',
    orange: 'from-orange-400 to-red-500',
    pink: 'from-pink-400 to-rose-500'
  };

  const statusColors = {
    draft: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    completed: 'bg-green-100 text-green-800 border-green-200',
    archived: 'bg-gray-100 text-gray-800 border-gray-200',
    pending: 'bg-blue-100 text-blue-800 border-blue-200',
    approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    rejected: 'bg-red-100 text-red-800 border-red-200'
  };

  const statusIcons = {
    draft: 'fa-edit',
    completed: 'fa-check-circle',
    archived: 'fa-archive',
    pending: 'fa-clock',
    approved: 'fa-check-double',
    rejected: 'fa-times-circle'
  };

  return (
    <motion.div
      className={cn(
        'relative bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden',
        hoverable && 'cursor-pointer',
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={hoverable ? { 
        y: -5, 
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' 
      } : {}}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 渐变装饰条 */}
      <div className={`h-1 w-full bg-gradient-to-r ${gradientClasses[gradient]}`} />
      
      {/* 悬停光晕效果 */}
      <AnimatePresence>
        {isHovered && hoverable && (
          <motion.div
            className={`absolute inset-0 bg-gradient-to-r ${gradientClasses[gradient]} opacity-5`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.05 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>

      <div className="p-6">
        {/* 头部信息 */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start space-x-3 flex-1">
            {/* 图标 */}
            <motion.div 
              className={`w-10 h-10 rounded-lg bg-gradient-to-r ${gradientClasses[gradient]} 
                         flex items-center justify-center text-white shadow-lg`}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ duration: 0.2 }}
            >
              <i className={`fa-solid ${icon} text-sm`}></i>
            </motion.div>

            {/* 标题和副标题 */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {title}
              </h3>
              {subtitle && (
                <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
              )}
              
              {/* 分类和日期 */}
              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                {category && (
                  <span className="flex items-center">
                    <i className="fa-solid fa-folder mr-1"></i>
                    {category}
                  </span>
                )}
                {date && (
                  <span className="flex items-center">
                    <i className="fa-solid fa-calendar mr-1"></i>
                    {date}
                  </span>
                )}
                {author && (
                  <span className="flex items-center">
                    <i className="fa-solid fa-user mr-1"></i>
                    {author}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 状态标签 */}
          {status && (
            <motion.div 
              className={`px-3 py-1 rounded-full text-xs font-medium border 
                         flex items-center space-x-1 ${statusColors[status]}`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <i className={`fa-solid ${statusIcons[status]} text-xs`}></i>
              <span>{status}</span>
            </motion.div>
          )}
        </div>

        {/* 内容 */}
        {content && (
          <div className="mb-4">
            <motion.p 
              className={`text-gray-700 leading-relaxed ${
                expandable && !isExpanded ? 'line-clamp-2' : ''
              }`}
              layout
            >
              {content}
            </motion.p>
            
            {expandable && content.length > 100 && (
              <motion.button
                className="text-emerald-600 text-sm mt-2 hover:text-emerald-700 
                         flex items-center space-x-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                whileHover={{ scale: 1.05 }}
              >
                <span>{isExpanded ? '收起' : '展开'}</span>
                <motion.i 
                  className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-xs`}
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                />
              </motion.button>
            )}
          </div>
        )}

        {/* 自定义内容 */}
        {children && (
          <div className="mb-4">
            {children}
          </div>
        )}

        {/* 标签 */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map((tag, index) => (
              <motion.span
                key={tag}
                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md
                         hover:bg-gray-200 transition-colors duration-200"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 * index }}
                whileHover={{ scale: 1.05 }}
              >
                #{tag}
              </motion.span>
            ))}
          </div>
        )}

        {/* 操作按钮 */}
        {(onEdit || onDelete) && (
          <motion.div 
            className="flex justify-end space-x-2 pt-4 border-t border-gray-100"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {onEdit && (
              <motion.button
                className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 
                         rounded-lg transition-all duration-200"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <i className="fa-solid fa-edit"></i>
              </motion.button>
            )}
            
            {onDelete && (
              <motion.button
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 
                         rounded-lg transition-all duration-200"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <i className="fa-solid fa-trash"></i>
              </motion.button>
            )}
          </motion.div>
        )}
      </div>

      {/* 加载状态指示器 */}
      <AnimatePresence>
        {isHovered && hoverable && (
          <motion.div
            className="absolute top-4 right-4"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${gradientClasses[gradient]}`} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// 卡片网格容器
interface CardGridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: number;
  className?: string;
}

export const CardGrid: React.FC<CardGridProps> = ({
  children,
  columns = 3,
  gap = 6,
  className
}) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
  };

  return (
    <motion.div
      className={cn(
        'grid',
        gridCols[columns],
        `gap-${gap}`,
        className
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, staggerChildren: 0.1 }}
    >
      {children}
    </motion.div>
  );
};