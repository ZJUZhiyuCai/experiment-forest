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
}

export const RecordCard = memo(function RecordCard({ record, onEdit, onDelete }: RecordCardProps) {
  // 性能监控
  usePerformanceMonitor('RecordCard', [record.id, record.updatedAt]);
  
  const [showMenu, setShowMenu] = useState(false);
  
  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
   // 获取课题名称
   const getProjectName = (projectId: string) => {
     const project = projectService.getById(projectId);
     return project ? project.title : '未知课题';
   };
   
   // 截断长文本
  const truncateText = (text: string, maxLength = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };
  
  return (
      <motion.div 
        className="bg-white/80 backdrop-blur-md rounded-xl shadow-md overflow-hidden border border-white/20 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
        whileHover={{ y: -5 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <div>
           <h3 className="text-lg font-semibold text-gray-800 dark:text-white line-clamp-1">
              <Link to={`/records/${record.id}`} className="hover:text-emerald-600 dark:hover:text-emerald-400">
                {record.title}
              </Link>
            </h3>
            
             <div className="mt-2 flex flex-wrap gap-2">
               {record.projectId && (
                 <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                   {getProjectName(record.projectId)}
                 </span>
               )}
               <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                record.category === 'cell_culture' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                record.category === 'animal_dosing' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                record.category === 'compound_synthesis' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                record.category === 'bacterial_culture' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {record.category === 'cell_culture' ? '细胞培养' :
                 record.category === 'animal_dosing' ? '动物给药' :
                 record.category === 'compound_synthesis' ? '化合物合成' :
                 record.category === 'bacterial_culture' ? '细菌培养' : '其他实验'}
              </span>
            </div>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="操作菜单"
            >
              <i className="fa-solid fa-ellipsis-v text-gray-500 dark:text-gray-400"></i>
            </button>
            
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                <button
                  onClick={() => {
                    onEdit && onEdit(record.id);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <i className="fa-solid fa-pencil mr-2"></i>编辑
                </button>
                <button
                  onClick={() => {
                    onDelete && onDelete(record.id);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <i className="fa-solid fa-trash mr-2"></i>删除
                </button>
              </div>
            )}
          </div>
        </div>
        
        <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">
          {truncateText(record.content)}
        </p>
        
        <div className="flex flex-wrap gap-2 mb-4">
          {record.tags.map((tag, index) => (
            <span 
              key={index}
              className="px-2 py-1 bg-[#E6F0FA] text-[#555555] text-xs rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
        
        <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">  
          <span>
            <i className="fa-solid fa-calendar mr-1"></i>
            {formatDate(record.date)}
          </span>
          <span className={
            cn(
              "px-2 py-0.5 rounded-full text-xs font-medium",
              record.status === 'draft' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
              record.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
            )
          }>
            {record.status === 'draft' ? '草稿' : record.status === 'completed' ? '已完成' : '已归档'}
          </span>
        </div>
      </div>
    </motion.div>
  );
});

// 优化比较函数
RecordCard.displayName = 'RecordCard';