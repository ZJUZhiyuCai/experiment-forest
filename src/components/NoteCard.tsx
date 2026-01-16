import { motion } from 'framer-motion';
import { memo } from 'react';
import { ExperimentNote } from '@/types';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface NoteCardProps {
  note: ExperimentNote;
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
 * 🍃 有机笔记卡片 (Organic Note Card)
 * 侘寂风格 - 陶土色调 + 柔和悬停
 */
export const NoteCard = memo(function NoteCard({
  note,
  onEdit,
  onDelete,
  radiusVariant = 0
}: NoteCardProps) {
  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(dateObj);
  };

  const truncateText = (text: string, maxLength = 120) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

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
      {/* 标题和操作 */}
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-heading font-bold text-loam line-clamp-1 group-hover:text-terracotta transition-colors flex-1">
          <Link to={`/notes/${note.id}`} className="hover:underline decoration-terracotta/30">
            {note.title}
          </Link>
        </h3>

        <div className="flex gap-1 ml-2">
          <button
            onClick={() => onEdit?.(note.id)}
            className="p-2 rounded-lg text-grass hover:text-terracotta hover:bg-terracotta-light transition-colors"
            aria-label="编辑"
          >
            <i className="fa-solid fa-pencil text-sm"></i>
          </button>
          <button
            onClick={() => onDelete?.(note.id)}
            className="p-2 rounded-lg text-grass hover:text-status-error hover:bg-status-error/10 transition-colors"
            aria-label="删除"
          >
            <i className="fa-solid fa-trash text-sm"></i>
          </button>
        </div>
      </div>

      {/* 内容预览 */}
      <p className="text-bark text-sm mb-4 line-clamp-3 leading-relaxed">
        {truncateText(note.content)}
      </p>

      {/* 底部信息 */}
      <div className="flex justify-between items-center pt-4 border-t border-timber-soft">
        <span className="text-xs text-grass flex items-center gap-1.5">
          <i className="fa-solid fa-calendar"></i>
          {formatDate(note.createdAt)}
        </span>
        {note.relatedRecordId && (
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-moss-soft text-moss">
            <i className="fa-solid fa-link mr-1"></i>已关联
          </span>
        )}
      </div>
    </motion.div>
  );
});

NoteCard.displayName = 'NoteCard';
