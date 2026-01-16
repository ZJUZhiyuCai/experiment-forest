import { motion } from 'framer-motion';
import { memo } from 'react';
import { SOP } from '@/types';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { topicService } from '@/lib/cachedStorage';

interface SOPCardProps {
  sop: SOP;
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
 * 🌳 有机 SOP 卡片 (Organic SOP Card)
 * 侘寂风格 - 苔藓色调 + 不对称圆角
 */
export const SOPCard = memo(function SOPCard({
  sop,
  onEdit,
  onDelete,
  radiusVariant = 0
}: SOPCardProps) {
  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(dateObj);
  };

  const truncateText = (text: string, maxLength = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const getTopicName = (projectId: string) => {
    const topic = topicService.getById(projectId);
    return topic ? topic.title : '未知课题';
  };

  const getCategoryInfo = (categoryId: string) => {
    const categories: Record<string, { name: string; color: string }> = {
      'chemical': { name: '化学实验', color: 'terracotta' },
      'biological': { name: '生物实验', color: 'moss' },
      'equipment': { name: '设备操作', color: 'moss' },
      'safety': { name: '安全规范', color: 'terracotta' },
      'other': { name: '其他', color: 'grass' }
    };
    return categories[categoryId] || { name: '未分类', color: 'grass' };
  };

  const getApprovalStatusInfo = (status: string) => {
    const statuses: Record<string, { text: string; color: string }> = {
      'approved': { text: '已批准', color: 'status-success' },
      'pending': { text: '待审批', color: 'terracotta' },
      'rejected': { text: '已拒绝', color: 'status-error' },
      'draft': { text: '草稿', color: 'grass' }
    };
    return statuses[status] || { text: status, color: 'grass' };
  };

  const categoryInfo = getCategoryInfo(sop.category);
  const statusInfo = getApprovalStatusInfo(sop.approvalStatus);

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
      {/* 标题和版本 */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-heading font-bold text-loam line-clamp-1 group-hover:text-moss transition-colors">
              <Link to={`/sops/${sop.id}`} className="hover:underline decoration-moss/30">
                {sop.title}
              </Link>
            </h3>
            <span className="px-2 py-0.5 text-xs rounded-md bg-organic-stone text-grass font-medium">
              v{sop.version}
            </span>
          </div>

          <p className="text-sm text-grass flex items-center gap-2">
            <i className="fa-solid fa-user"></i>
            {sop.author}
            {sop.department && <span>| {sop.department}</span>}
          </p>

          {sop.projectId && (
            <span className="inline-block mt-2 px-2.5 py-1 text-xs rounded-full bg-terracotta-light text-terracotta font-medium">
              {getTopicName(sop.projectId)}
            </span>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-1 ml-2">
          <button
            onClick={() => onEdit?.(sop.id)}
            className="p-2 rounded-lg text-grass hover:text-moss hover:bg-moss-soft transition-colors"
            aria-label="编辑"
          >
            <i className="fa-solid fa-pencil text-sm"></i>
          </button>
          <button
            onClick={() => onDelete?.(sop.id)}
            className="p-2 rounded-lg text-grass hover:text-status-error hover:bg-status-error/10 transition-colors"
            aria-label="删除"
          >
            <i className="fa-solid fa-trash text-sm"></i>
          </button>
        </div>
      </div>

      {/* 内容预览 */}
      <p className="text-bark text-sm mb-4 line-clamp-2 leading-relaxed">
        {truncateText(sop.content)}
      </p>

      {/* 标签区域 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {sop.category && (
          <span className={cn(
            'px-2.5 py-1 text-xs rounded-full font-medium',
            categoryInfo.color === 'moss' ? 'bg-moss-soft text-moss' :
              categoryInfo.color === 'terracotta' ? 'bg-terracotta-light text-terracotta' :
                'bg-organic-stone text-grass'
          )}>
            {categoryInfo.name}
          </span>
        )}
        <span className={cn(
          'px-2.5 py-1 text-xs rounded-full font-medium',
          statusInfo.color === 'status-success' ? 'bg-status-success/15 text-status-success' :
            statusInfo.color === 'terracotta' ? 'bg-terracotta-light text-terracotta' :
              statusInfo.color === 'status-error' ? 'bg-status-error/15 text-status-error' :
                'bg-organic-stone text-grass'
        )}>
          {statusInfo.text}
        </span>
      </div>

      {/* 目的描述 */}
      {sop.purpose && (
        <div className="mb-4">
          <p className="text-xs text-grass font-medium mb-1">目的:</p>
          <p className="text-xs text-bark line-clamp-1">{truncateText(sop.purpose, 80)}</p>
        </div>
      )}

      {/* 底部信息 */}
      <div className="flex justify-between items-center pt-4 border-t border-timber-soft">
        <span className="text-xs text-grass flex items-center gap-1.5">
          <i className="fa-solid fa-calendar-alt"></i>
          更新: {formatDate(sop.lastUpdated)}
        </span>
        <Link
          to={`/sops/${sop.id}`}
          className="px-4 py-1.5 rounded-full bg-moss-soft text-moss text-xs font-medium hover:bg-moss hover:text-moss-light transition-all"
        >
          查看详情
        </Link>
      </div>
    </motion.div>
  );
});

SOPCard.displayName = 'SOPCard';