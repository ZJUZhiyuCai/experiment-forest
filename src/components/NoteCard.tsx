import { motion } from 'framer-motion';
import { memo } from 'react';
import { ExperimentNote } from '@/types';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface NoteCardProps {
  note: ExperimentNote;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const NoteCard = memo(function NoteCard({ note, onEdit, onDelete }: NoteCardProps) {
  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  };
  
  // 截断长文本
  const truncateText = (text: string, maxLength = 120) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };
  
  return (
       <motion.div 
        className="bg-white/80 backdrop-blur-md dark:bg-white/80 rounded-xl shadow-md overflow-hidden border border-white/20 dark:border-white/20 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
        whileHover={{ y: -5 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white line-clamp-1">
            <Link to={`/notes/${note.id}`} className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">
              {note.title}
            </Link>
          </h3>
          
          <div className="flex space-x-1">
            <button 
              onClick={() => onEdit && onEdit(note.id)}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
              aria-label="编辑"
            >
              <i className="fa-solid fa-pencil"></i>
            </button>
            <button 
              onClick={() => onDelete && onDelete(note.id)}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
              aria-label="删除"  
            >
              <i className="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
        
        <div className="prose prose-sm dark:prose-invert prose-gray max-w-none mb-4">
          <p className="text-gray-600 dark:text-gray-300 line-clamp-3">{truncateText(note.content)}</p>
        </div>
        
        <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
          <span>
            <i className="fa-solid fa-calendar mr-1"></i>
            {formatDate(note.createdAt)}
          </span>
          {note.relatedRecordId && (
            <span className="text-blue-600 dark:text-blue-400">
              <i className="fa-solid fa-link mr-1"></i>关联实验
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
});

// 优化比较函数
NoteCard.displayName = 'NoteCard';
