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
  gradient?: 'moss' | 'terracotta' | 'sand' | 'stone';
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  children?: ReactNode;
  className?: string;
  hoverable?: boolean;
  expandable?: boolean;
  radiusVariant?: number;
}

// 不对称圆角变体
const radiusVariants = [
  'rounded-[2rem_1rem_2.5rem_1.5rem]',
  'rounded-[1.5rem_2.5rem_1rem_2rem]',
  'rounded-[2.5rem_1.5rem_2rem_1rem]',
  'rounded-[1rem_2rem_1.5rem_2.5rem]',
];

/**
 * 🌿 有机增强卡片组件 (Organic Enhanced Card)
 * 侘寂风格 - 不对称圆角 + 柔和渐变 + 自然动效
 */
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
  gradient = 'moss',
  onClick,
  onEdit,
  onDelete,
  children,
  className,
  hoverable = true,
  expandable = false,
  radiusVariant = 0
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // 有机渐变/背景样式
  const gradientClasses = {
    moss: 'bg-moss',
    terracotta: 'bg-terracotta',
    sand: 'bg-organic-sand',
    stone: 'bg-organic-stone',
  };

  const gradientShadows = {
    moss: 'shadow-moss',
    terracotta: 'shadow-clay',
    sand: 'shadow-moss',
    stone: 'shadow-minimal',
  };

  // 状态样式
  const statusColors = {
    draft: 'bg-terracotta/15 text-terracotta',
    completed: 'bg-status-success/15 text-status-success',
    archived: 'bg-organic-stone text-grass',
    pending: 'bg-terracotta-light text-terracotta',
    approved: 'bg-moss-soft text-moss',
    rejected: 'bg-status-error/15 text-status-error'
  };

  const statusIcons = {
    draft: 'fa-edit',
    completed: 'fa-check-circle',
    archived: 'fa-archive',
    pending: 'fa-clock',
    approved: 'fa-check-double',
    rejected: 'fa-times-circle'
  };

  const statusTexts = {
    draft: '草稿',
    completed: '已完成',
    archived: '已归档',
    pending: '待审批',
    approved: '已批准',
    rejected: '已拒绝'
  };

  return (
    <motion.div
      className={cn(
        'organic-card relative overflow-hidden',
        radiusVariants[radiusVariant % radiusVariants.length],
        hoverable && 'cursor-pointer hover:-translate-y-2 hover:shadow-float',
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={hoverable ? { y: -8 } : {}}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 顶部渐变装饰条 */}
      <div className={cn('h-1 w-full', gradientClasses[gradient])} />

      {/* 悬停光晕效果 */}
      <AnimatePresence>
        {isHovered && hoverable && (
          <motion.div
            className={cn('absolute inset-0 opacity-5', gradientClasses[gradient])}
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
          <div className="flex items-start gap-3 flex-1">
            {/* 图标容器 */}
            <motion.div
              className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center text-white',
                gradientClasses[gradient],
                gradientShadows[gradient]
              )}
              whileHover={{ scale: 1.1, rotate: 3 }}
              transition={{ duration: 0.2 }}
            >
              <i className={cn('fa-solid text-sm', icon)}></i>
            </motion.div>

            {/* 标题和副标题 */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-heading font-bold text-loam line-clamp-1">
                {title}
              </h3>
              {subtitle && (
                <p className="text-sm text-bark mt-1">{subtitle}</p>
              )}

              {/* 分类和日期 */}
              <div className="flex items-center gap-4 mt-2 text-xs text-grass">
                {category && (
                  <span className="flex items-center gap-1">
                    <i className="fa-solid fa-folder"></i>
                    {category}
                  </span>
                )}
                {date && (
                  <span className="flex items-center gap-1">
                    <i className="fa-solid fa-calendar"></i>
                    {date}
                  </span>
                )}
                {author && (
                  <span className="flex items-center gap-1">
                    <i className="fa-solid fa-user"></i>
                    {author}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 状态标签 */}
          {status && (
            <motion.div
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1',
                statusColors[status]
              )}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <i className={cn('fa-solid text-xs', statusIcons[status])}></i>
              <span>{statusTexts[status]}</span>
            </motion.div>
          )}
        </div>

        {/* 内容 */}
        {content && (
          <div className="mb-4">
            <motion.p
              className={cn(
                'text-bark leading-relaxed text-sm',
                expandable && !isExpanded ? 'line-clamp-2' : ''
              )}
              layout
            >
              {content}
            </motion.p>

            {expandable && content.length > 100 && (
              <motion.button
                className="text-moss text-sm mt-2 hover:text-terracotta flex items-center gap-1 transition-colors"
                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                whileHover={{ scale: 1.02 }}
              >
                <span>{isExpanded ? '收起' : '展开'}</span>
                <motion.i
                  className={cn('fa-solid text-xs', isExpanded ? 'fa-chevron-up' : 'fa-chevron-down')}
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                />
              </motion.button>
            )}
          </div>
        )}

        {/* 自定义内容 */}
        {children && <div className="mb-4">{children}</div>}

        {/* 标签 */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map((tag, index) => (
              <motion.span
                key={tag}
                className="px-2.5 py-1 bg-organic-stone text-bark text-xs rounded-md hover:bg-moss-soft hover:text-moss transition-colors"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 * index }}
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
            className="flex justify-end gap-2 pt-4 border-t border-timber-soft"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {onEdit && (
              <motion.button
                className="p-2 text-grass hover:text-moss hover:bg-moss-soft rounded-lg transition-all"
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <i className="fa-solid fa-edit"></i>
              </motion.button>
            )}

            {onDelete && (
              <motion.button
                className="p-2 text-grass hover:text-status-error hover:bg-status-error/10 rounded-lg transition-all"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <i className="fa-solid fa-trash"></i>
              </motion.button>
            )}
          </motion.div>
        )}
      </div>

      {/* 悬停指示器 */}
      <AnimatePresence>
        {isHovered && hoverable && (
          <motion.div
            className="absolute top-4 right-4"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className={cn('w-2 h-2 rounded-full', gradientClasses[gradient])} />
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
      className={cn('grid', gridCols[columns], `gap-${gap}`, className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, staggerChildren: 0.1 }}
    >
      {children}
    </motion.div>
  );
};