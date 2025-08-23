import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// 主加载状态组件
interface LoadingStateProps {
  isLoading: boolean;
  children: ReactNode;
  skeleton?: ReactNode;
  loadingText?: string;
  className?: string;
  variant?: 'spinner' | 'dots' | 'pulse' | 'skeleton';
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  isLoading,
  children,
  skeleton,
  loadingText = '加载中...',
  className,
  variant = 'skeleton'
}) => {
  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={className}
        >
          {variant === 'skeleton' && skeleton ? (
            skeleton
          ) : variant !== 'skeleton' ? (
            <LoadingIndicator variant={variant} text={loadingText} />
          ) : (
            <div className="flex items-center justify-center p-8">
              <div className="text-gray-500">{loadingText}</div>
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// 加载指示器
interface LoadingIndicatorProps {
  variant: 'spinner' | 'dots' | 'pulse';
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'emerald' | 'blue' | 'gray';
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  variant,
  text,
  size = 'md',
  color = 'emerald'
}) => {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  const colorClasses = {
    emerald: 'text-emerald-500',
    blue: 'text-blue-500',
    gray: 'text-gray-500'
  };

  const renderIndicator = () => {
    switch (variant) {
      case 'spinner':
        return (
          <motion.div
            className={cn('inline-block w-8 h-8 border-4 border-gray-200 rounded-full', colorClasses[color])}
            style={{ borderTopColor: 'currentColor' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        );

      case 'dots':
        return (
          <div className="flex space-x-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className={cn('w-3 h-3 rounded-full', colorClasses[color].replace('text-', 'bg-'))}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2
                }}
              />
            ))}
          </div>
        );

      case 'pulse':
        return (
          <motion.div
            className={cn('w-12 h-12 rounded-full', colorClasses[color].replace('text-', 'bg-'))}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.7, 1, 0.7]
            }}
            transition={{
              duration: 2,
              repeat: Infinity
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      {renderIndicator()}
      {text && (
        <motion.p
          className={cn('text-gray-600', sizeClasses[size])}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );
};

// 骨架屏组件
interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  rounded?: boolean;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  className,
  rounded = false,
  animation = 'pulse'
}) => {
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-wave',
    none: ''
  };

  return (
    <div
      className={cn(
        'bg-gray-200',
        rounded && 'rounded-full',
        !rounded && 'rounded',
        animationClasses[animation],
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height
      }}
    />
  );
};

// 卡片骨架屏
export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <motion.div
          key={i}
          className="bg-white rounded-xl shadow-md border border-gray-100 p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.1 }}
        >
          {/* 头部 */}
          <div className="flex items-center space-x-3 mb-4">
            <Skeleton width={40} height={40} rounded />
            <div className="flex-1 space-y-2">
              <Skeleton width="60%" height={20} />
              <Skeleton width="40%" height={16} />
            </div>
            <Skeleton width={60} height={24} rounded />
          </div>
          
          {/* 内容 */}
          <div className="space-y-3 mb-4">
            <Skeleton width="100%" height={16} />
            <Skeleton width="80%" height={16} />
            <Skeleton width="90%" height={16} />
          </div>
          
          {/* 标签 */}
          <div className="flex space-x-2 mb-4">
            <Skeleton width={60} height={24} rounded />
            <Skeleton width={80} height={24} rounded />
            <Skeleton width={70} height={24} rounded />
          </div>
          
          {/* 底部操作 */}
          <div className="flex justify-end space-x-2 pt-4 border-t border-gray-100">
            <Skeleton width={32} height={32} rounded />
            <Skeleton width={32} height={32} rounded />
          </div>
        </motion.div>
      ))}
    </>
  );
};

// 列表骨架屏
export const ListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, i) => (
        <motion.div
          key={i}
          className="flex items-center space-x-4 p-4 bg-white rounded-lg border border-gray-200"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: i * 0.05 }}
        >
          <Skeleton width={48} height={48} rounded />
          <div className="flex-1 space-y-2">
            <Skeleton width="40%" height={20} />
            <Skeleton width="60%" height={16} />
          </div>
          <div className="space-y-2">
            <Skeleton width={80} height={16} />
            <Skeleton width={60} height={14} />
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// 表格骨架屏
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 4
}) => {
  return (
    <div className="overflow-hidden bg-white rounded-lg border border-gray-200">
      {/* 表头 */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex space-x-4">
          {Array.from({ length: columns }, (_, i) => (
            <Skeleton key={i} width="100px" height={20} />
          ))}
        </div>
      </div>
      
      {/* 表格行 */}
      <div className="divide-y divide-gray-200">
        {Array.from({ length: rows }, (_, i) => (
          <motion.div
            key={i}
            className="px-6 py-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
          >
            <div className="flex space-x-4">
              {Array.from({ length: columns }, (_, j) => (
                <Skeleton key={j} width="100px" height={16} />
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// 统计卡片骨架屏
export const StatsSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }, (_, i) => (
        <motion.div
          key={i}
          className="bg-white rounded-xl shadow-md border border-gray-100 p-6"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: i * 0.1 }}
        >
          <div className="flex items-center justify-between">
            <div className="space-y-3">
              <Skeleton width="80px" height={16} />
              <Skeleton width="60px" height={32} />
              <Skeleton width="100px" height={14} />
            </div>
            <Skeleton width={48} height={48} rounded />
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// 带包装器的加载组件
interface LoadingWrapperProps {
  isLoading: boolean;
  children: ReactNode;
  type: 'card' | 'list' | 'table' | 'stats';
  count?: number;
  className?: string;
}

export const LoadingWrapper: React.FC<LoadingWrapperProps> = ({
  isLoading,
  children,
  type,
  count,
  className
}) => {
  const skeletonComponents = {
    card: <CardSkeleton count={count} />,
    list: <ListSkeleton count={count} />,
    table: <TableSkeleton rows={count} />,
    stats: <StatsSkeleton count={count} />
  };

  return (
    <LoadingState
      isLoading={isLoading}
      skeleton={skeletonComponents[type]}
      className={className}
    >
      {children}
    </LoadingState>
  );
};