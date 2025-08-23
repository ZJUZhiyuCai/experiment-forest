import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  date: string;
  type: 'created' | 'updated' | 'completed' | 'approved' | 'rejected' | 'archived' | 'custom';
  icon?: string;
  color?: 'emerald' | 'blue' | 'purple' | 'orange' | 'pink' | 'red' | 'gray';
  metadata?: Record<string, any>;
  onClick?: () => void;
}

interface TimelineProps {
  items: TimelineItem[];
  className?: string;
  variant?: 'default' | 'compact' | 'detailed';
  showMetadata?: boolean;
}

export const Timeline: React.FC<TimelineProps> = ({
  items,
  className,
  variant = 'default',
  showMetadata = false
}) => {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const typeConfigs = {
    created: { icon: 'fa-plus-circle', defaultColor: 'emerald' },
    updated: { icon: 'fa-edit', defaultColor: 'blue' },
    completed: { icon: 'fa-check-circle', defaultColor: 'emerald' },
    approved: { icon: 'fa-check-double', defaultColor: 'emerald' },
    rejected: { icon: 'fa-times-circle', defaultColor: 'red' },
    archived: { icon: 'fa-archive', defaultColor: 'gray' },
    custom: { icon: 'fa-circle', defaultColor: 'blue' }
  };

  const colorClasses = {
    emerald: {
      bg: 'bg-emerald-500',
      border: 'border-emerald-500',
      text: 'text-emerald-600',
      light: 'bg-emerald-50'
    },
    blue: {
      bg: 'bg-blue-500',
      border: 'border-blue-500',
      text: 'text-blue-600',
      light: 'bg-blue-50'
    },
    purple: {
      bg: 'bg-purple-500',
      border: 'border-purple-500',
      text: 'text-purple-600',
      light: 'bg-purple-50'
    },
    orange: {
      bg: 'bg-orange-500',
      border: 'border-orange-500',
      text: 'text-orange-600',
      light: 'bg-orange-50'
    },
    pink: {
      bg: 'bg-pink-500',
      border: 'border-pink-500',
      text: 'text-pink-600',
      light: 'bg-pink-50'
    },
    red: {
      bg: 'bg-red-500',
      border: 'border-red-500',
      text: 'text-red-600',
      light: 'bg-red-50'
    },
    gray: {
      bg: 'bg-gray-500',
      border: 'border-gray-500',
      text: 'text-gray-600',
      light: 'bg-gray-50'
    }
  };

  return (
    <motion.div
      className={cn('relative', className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* 时间轴主线 */}
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
      
      <div className="space-y-6">
        {items.map((item, index) => (
          <TimelineItemComponent
            key={item.id}
            item={item}
            index={index}
            variant={variant}
            showMetadata={showMetadata}
            typeConfig={typeConfigs[item.type]}
            colorClasses={colorClasses[item.color || typeConfigs[item.type].defaultColor as keyof typeof colorClasses] || colorClasses.gray}
            isExpanded={expandedItem === item.id}
            onToggleExpand={() => 
              setExpandedItem(expandedItem === item.id ? null : item.id)
            }
          />
        ))}
      </div>
    </motion.div>
  );
};

interface TimelineItemComponentProps {
  item: TimelineItem;
  index: number;
  variant: 'default' | 'compact' | 'detailed';
  showMetadata: boolean;
  typeConfig: { icon: string; defaultColor: string };
  colorClasses: Record<string, string>;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const TimelineItemComponent: React.FC<TimelineItemComponentProps> = ({
  item,
  index,
  variant,
  showMetadata,
  typeConfig,
  colorClasses,
  isExpanded,
  onToggleExpand
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString('zh-CN'),
      time: date.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };
  };

  const { date, time } = formatDate(item.date);

  return (
    <motion.div
      className="relative flex items-start space-x-4"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 时间轴节点 */}
      <motion.div
        className={cn(
          'relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-4 border-white shadow-lg',
          colorClasses.bg
        )}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={item.onClick}
      >
        <motion.i
          className={`fa-solid ${item.icon || typeConfig.icon} text-white`}
          animate={{ 
            rotate: isHovered ? 360 : 0,
            scale: isHovered ? 1.1 : 1
          }}
          transition={{ duration: 0.3 }}
        />
        
        {/* 脉冲效果 */}
        <motion.div
          className={cn('absolute inset-0 rounded-full border-2', colorClasses.border)}
          animate={{
            scale: [1, 1.5, 1],
            opacity: [1, 0, 1]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </motion.div>

      {/* 内容区域 */}
      <motion.div
        className={cn(
          'flex-1 bg-white rounded-lg shadow-md border border-gray-200 p-4',
          item.onClick && 'cursor-pointer hover:shadow-lg'
        )}
        whileHover={item.onClick ? { y: -2 } : {}}
        transition={{ duration: 0.2 }}
        onClick={item.onClick}
      >
        {/* 悬停装饰 */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              className={cn('absolute inset-0 rounded-lg opacity-5', colorClasses.light)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.05 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            />
          )}
        </AnimatePresence>

        {/* 头部信息 */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {item.title}
            </h3>
            
            {variant !== 'compact' && item.description && (
              <p className="text-gray-600 text-sm mb-2">
                {item.description}
              </p>
            )}
          </div>

          {/* 时间信息 */}
          <div className="text-right text-sm text-gray-500 ml-4">
            <div className="font-medium">{date}</div>
            <div className="text-xs">{time}</div>
          </div>
        </div>

        {/* 元数据展示 */}
        {showMetadata && item.metadata && Object.keys(item.metadata).length > 0 && (
          <motion.div
            className="mt-3 pt-3 border-t border-gray-100"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">详细信息</span>
              <motion.button
                className="text-xs text-gray-400 hover:text-gray-600"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand();
                }}
                whileHover={{ scale: 1.1 }}
              >
                <motion.i
                  className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`}
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                />
              </motion.button>
            </div>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  className="mt-2 space-y-1"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {Object.entries(item.metadata).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-gray-500 capitalize">{key}:</span>
                      <span className="text-gray-700 font-medium">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* 状态标签 */}
        <div className="flex items-center justify-between mt-3">
          <motion.span
            className={cn(
              'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
              colorClasses.light,
              colorClasses.text
            )}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 + index * 0.05 }}
          >
            <i className={`fa-solid ${typeConfig.icon} mr-1`} />
            {item.type}
          </motion.span>

          {/* 操作指示器 */}
          {item.onClick && (
            <motion.div
              className="text-gray-400"
              animate={{ x: isHovered ? 5 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <i className="fa-solid fa-chevron-right text-xs" />
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// 垂直时间轴组件
interface VerticalTimelineProps extends Omit<TimelineProps, 'variant'> {
  height?: string;
}

export const VerticalTimeline: React.FC<VerticalTimelineProps> = ({
  items,
  className,
  showMetadata,
  height = '400px'
}) => {
  return (
    <div className={cn('overflow-y-auto', className)} style={{ height }}>
      <Timeline
        items={items}
        variant="compact"
        showMetadata={showMetadata}
      />
    </div>
  );
};