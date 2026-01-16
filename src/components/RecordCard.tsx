import { useState, memo } from 'react';
import { motion } from 'framer-motion';
import { ExperimentRecord } from '@/types';
import { cn } from '@/lib/utils';
import { projectService } from '@/lib/cachedStorage';
import { Link } from 'react-router-dom';
import { usePerformanceMonitor } from '@/hooks/usePerformance';

interface RecordCardProps {
  record: ExperimentRecord;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
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
 * 🌿 有机记录卡片 (Organic Record Card)
 * 侘寂风格 - 不对称圆角 + 苔藓色调
 */
export const RecordCard = memo(function RecordCard({
  record,
  onEdit,
  onDelete,
  radiusVariant = 0
}: RecordCardProps) {
  usePerformanceMonitor('RecordCard', [record.id, record.updatedAt]);
  const [showMenu, setShowMenu] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  };

  const getProjectName = (projectId: string) => {
    const project = projectService.getById(projectId);
    return project ? project.title : '未知课题';
  };

  const getCategoryInfo = (category: string) => {
    const categoryMap: Record<string, { name: string; color: string }> = {
      cell_culture: { name: '细胞培养', color: 'moss' },
      animal_dosing: { name: '动物给药', color: 'terracotta' },
      compound_synthesis: { name: '化合物合成', color: 'terracotta' },
      bacterial_culture: { name: '细菌培养', color: 'moss' },
    };
    return categoryMap[category] || { name: '其他实验', color: 'grass' };
  };

  const categoryInfo = getCategoryInfo(record.category);

  return (
    <motion.div
      className={cn(
        'organic-card p-6 relative group',
        radiusVariants[radiusVariant % radiusVariants.length],
        'hover:-translate-y-2 hover:shadow-float'
      )}
      whileHover={{ y: -8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* 标题区域 */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-heading font-bold text-loam line-clamp-1 group-hover:text-moss transition-colors">
            <Link to={`/records/${record.id}`} className="hover:underline decoration-moss/30">
              {record.title}
            </Link>
          </h3>

          {/* 课题和类型标签 */}
          <div className="mt-2 flex flex-wrap gap-2">
            {record.projectId && (
              <span className="px-2.5 py-1 text-xs rounded-full bg-terracotta-light text-terracotta font-medium">
                {getProjectName(record.projectId)}
              </span>
            )}
            <span className={cn(
              'px-2.5 py-1 text-xs rounded-full font-medium',
              categoryInfo.color === 'moss' ? 'bg-moss-soft text-moss' :
                categoryInfo.color === 'terracotta' ? 'bg-terracotta-light text-terracotta' :
                  'bg-organic-stone text-grass'
            )}>
              {categoryInfo.name}
            </span>
          </div>
        </div>

        {/* 操作菜单 */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-lg text-grass hover:text-moss hover:bg-moss-soft transition-colors"
            aria-label="操作菜单"
          >
            <i className="fa-solid fa-ellipsis-v"></i>
          </button>

          {showMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute right-0 mt-2 w-36 organic-card p-2 z-20 shadow-float"
            >
              <button
                onClick={() => { onEdit?.(record.id); setShowMenu(false); }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-bark hover:text-moss hover:bg-moss-soft transition-colors"
              >
                <i className="fa-solid fa-pencil mr-2"></i>编辑
              </button>
              <button
                onClick={() => { onDelete?.(record.id); setShowMenu(false); }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-bark hover:text-status-error hover:bg-status-error/10 transition-colors"
              >
                <i className="fa-solid fa-trash mr-2"></i>删除
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* 内容预览 */}
      <p className="text-bark text-sm mb-4 line-clamp-2 leading-relaxed">
        {record.content.substring(0, 120)}{record.content.length > 120 ? '...' : ''}
      </p>

      {/* 标签 */}
      {record.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {record.tags.slice(0, 4).map((tag, index) => (
            <span
              key={index}
              className="px-2 py-0.5 bg-organic-stone text-bark text-xs rounded-md"
            >
              #{tag}
            </span>
          ))}
          {record.tags.length > 4 && (
            <span className="text-xs text-grass">+{record.tags.length - 4}</span>
          )}
        </div>
      )}

      {/* 底部信息 */}
      <div className="flex justify-between items-center pt-4 border-t border-timber-soft">
        <span className="text-xs text-grass flex items-center gap-1.5">
          <i className="fa-solid fa-calendar"></i>
          {formatDate(record.date)}
        </span>
        <span className={cn(
          'px-2.5 py-1 rounded-full text-xs font-medium',
          record.status === 'draft' ? 'bg-terracotta/15 text-terracotta' :
            record.status === 'completed' ? 'bg-status-success/15 text-status-success' :
              'bg-grass/15 text-grass'
        )}>
          {record.status === 'draft' ? '草稿' : record.status === 'completed' ? '已完成' : '已归档'}
        </span>
      </div>
    </motion.div>
  );
});

RecordCard.displayName = 'RecordCard';