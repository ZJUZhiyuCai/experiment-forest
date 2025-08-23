import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface StatCard {
  title: string;
  value: number | string;
  icon: string;
  color: 'emerald' | 'blue' | 'purple' | 'orange' | 'pink' | 'red';
  change?: {
    value: number;
    type: 'increase' | 'decrease';
    period: string;
  };
  trend?: number[]; // 7个数据点用于迷你图表
}

interface StatsGridProps {
  stats: StatCard[];
  columns?: 2 | 3 | 4;
  className?: string;
}

export const StatsGrid: React.FC<StatsGridProps> = ({
  stats,
  columns = 4,
  className
}) => {
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  };

  return (
    <motion.div
      className={cn('grid gap-6', gridCols[columns], className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, staggerChildren: 0.1 }}
    >
      {stats.map((stat, index) => (
        <StatCardComponent key={index} stat={stat} index={index} />
      ))}
    </motion.div>
  );
};

const StatCardComponent: React.FC<{ stat: StatCard; index: number }> = ({ stat, index }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [animatedValue, setAnimatedValue] = useState(0);

  const colorClasses = {
    emerald: {
      gradient: 'from-emerald-400 to-teal-500',
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      border: 'border-emerald-200'
    },
    blue: {
      gradient: 'from-blue-400 to-indigo-500',
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      border: 'border-blue-200'
    },
    purple: {
      gradient: 'from-purple-400 to-pink-500',
      bg: 'bg-purple-50',
      text: 'text-purple-600',
      border: 'border-purple-200'
    },
    orange: {
      gradient: 'from-orange-400 to-red-500',
      bg: 'bg-orange-50',
      text: 'text-orange-600',
      border: 'border-orange-200'
    },
    pink: {
      gradient: 'from-pink-400 to-rose-500',
      bg: 'bg-pink-50',
      text: 'text-pink-600',
      border: 'border-pink-200'
    },
    red: {
      gradient: 'from-red-400 to-pink-500',
      bg: 'bg-red-50',
      text: 'text-red-600',
      border: 'border-red-200'
    }
  };

  const colors = colorClasses[stat.color];

  // 数字动画效果
  useEffect(() => {
    if (typeof stat.value === 'number') {
      const timer = setTimeout(() => {
        let start = 0;
        const end = stat.value as number;
        const duration = 1000;
        const increment = end / (duration / 16);

        const animate = () => {
          start += increment;
          if (start < end) {
            setAnimatedValue(Math.floor(start));
            requestAnimationFrame(animate);
          } else {
            setAnimatedValue(end);
          }
        };

        animate();
      }, index * 100);

      return () => clearTimeout(timer);
    } else {
      // 如果不是数字，直接设置为0
      setAnimatedValue(0);
    }
  }, [stat.value, index]);

  return (
    <motion.div
      className="bg-white rounded-xl shadow-md border border-gray-100 p-6 relative overflow-hidden"
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -5, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 背景装饰 */}
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${colors.gradient}`} />
      
      {/* 悬停光晕 */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            className={`absolute inset-0 bg-gradient-to-r ${colors.gradient} opacity-5`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.05 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <div className="flex-1">
          {/* 标题 */}
          <p className="text-sm font-medium text-gray-600 mb-2">{stat.title}</p>
          
          {/* 数值 */}
          <div className="flex items-baseline space-x-2">
            <motion.p 
              className="text-3xl font-bold text-gray-900"
              key={animatedValue}
            >
              {typeof stat.value === 'number' ? animatedValue : stat.value}
            </motion.p>
            
            {/* 变化指示器 */}
            {stat.change && (
              <motion.div
                className={cn(
                  'flex items-center space-x-1 text-xs px-2 py-1 rounded-full',
                  stat.change.type === 'increase' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                )}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
              >
                <i className={`fa-solid fa-arrow-${stat.change.type === 'increase' ? 'up' : 'down'}`} />
                <span>{Math.abs(stat.change.value)}%</span>
              </motion.div>
            )}
          </div>
          
          {/* 时间段 */}
          {stat.change && (
            <p className="text-xs text-gray-500 mt-1">{stat.change.period}</p>
          )}
        </div>

        {/* 图标 */}
        <motion.div
          className={`w-12 h-12 rounded-lg bg-gradient-to-r ${colors.gradient} 
                     flex items-center justify-center text-white shadow-lg`}
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ duration: 0.2 }}
        >
          <i className={`fa-solid ${stat.icon} text-lg`} />
        </motion.div>
      </div>

      {/* 迷你趋势图 */}
      {stat.trend && stat.trend.length > 0 && (
        <motion.div
          className="mt-4 pt-4 border-t border-gray-100"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <MiniTrendChart data={stat.trend} color={stat.color} />
        </motion.div>
      )}
    </motion.div>
  );
};

// 迷你趋势图组件
interface MiniTrendChartProps {
  data: number[];
  color: StatCard['color'];
}

const MiniTrendChart: React.FC<MiniTrendChartProps> = ({ data, color }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  const colorClasses = {
    emerald: 'stroke-emerald-500',
    blue: 'stroke-blue-500',
    purple: 'stroke-purple-500',
    orange: 'stroke-orange-500',
    pink: 'stroke-pink-500',
    red: 'stroke-red-500'
  };

  return (
    <div className="h-8 w-full">
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <motion.polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          points={points}
          className={colorClasses[color]}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />
      </svg>
    </div>
  );
};

// 进度环组件
interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: StatCard['color'];
  children?: React.ReactNode;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  percentage,
  size = 120,
  strokeWidth = 8,
  color = 'emerald',
  children
}) => {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (animatedPercentage / 100) * circumference;

  const colorClasses = {
    emerald: 'stroke-emerald-500',
    blue: 'stroke-blue-500',
    purple: 'stroke-purple-500',
    orange: 'stroke-orange-500',
    pink: 'stroke-pink-500',
    red: 'stroke-red-500'
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-gray-200"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={colorClasses[color]}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />
      </svg>
      
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            className="text-2xl font-bold text-gray-900"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            {Math.round(animatedPercentage)}%
          </motion.div>
          {children}
        </div>
      </div>
    </div>
  );
};