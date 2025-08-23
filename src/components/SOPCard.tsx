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
}

export const SOPCard = memo(function SOPCard({ sop, onEdit, onDelete }: SOPCardProps) {
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
  const truncateText = (text: string, maxLength = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };
  
   // 获取课题名称
   const getTopicName = (topicId: string) => {
     const topic = topicService.getById(topicId);
     return topic ? topic.title : '未知课题';
   };
   
   // 获取分类显示名称
  const getCategoryName = (categoryId: string) => {
    const categories = {
      'chemical': '化学实验',
      'biological': '生物实验',
      'equipment': '设备操作',
      'safety': '安全规范',
      'other': '其他'
    };
    return categories[categoryId as keyof typeof categories] || '未分类';
  };
  
  // 获取审批状态样式
  const getApprovalStatusStyle = (status: string) => {
    switch(status) {
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };
  
  // 获取审批状态文本
  const getApprovalStatusText = (status: string) => {
    switch(status) {
      case 'draft':
        return '草稿';
      case 'pending':
        return '待审批';
      case 'approved':
        return '已批准';
      case 'rejected':
        return '已拒绝';
      default:
        return status;
    }
  };
  
  return (
       <motion.div 
        className="bg-white/80 backdrop-blur-md dark:bg-gradient-to-br dark:from-slate-800/90 dark:to-slate-900/90 rounded-xl shadow-md overflow-hidden border border-white/20 dark:border-slate-600/50 hover:shadow-lg dark:hover:shadow-blue-500/10 transition-all duration-300 transform hover:-translate-y-1"
        whileHover={{ y: -5 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="flex items-center mb-1">
             <div className="flex flex-col">
               <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-100 line-clamp-1">
               <Link to={`/sops/${sop.id}`} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  {sop.title}
                </Link>
              </h3>
              <span className="ml-2 text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 px-2 py-0.5 rounded">
                v{sop.version}
              </span>
             </div>
             
             {sop.topicId && (
               <span className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 rounded-full inline-block mt-1 w-fit">
                 {getTopicName(sop.topicId)}
               </span>
             )}
           </div>
             <p className="text-sm text-gray-500 dark:text-slate-400">
              <i className="fa-solid fa-user mr-1"></i>
              {sop.author}
              {sop.department && <span className="ml-2">| {sop.department}</span>}
            </p>
          </div>
          
          <div className="flex space-x-1">
            <button 
              onClick={() => onEdit && onEdit(sop.id)}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
              aria-label="编辑"
              title="编辑"
            >
              <i className="fa-solid fa-pencil"></i>
            </button>
            
            <button 
              onClick={() => onDelete && onDelete(sop.id)}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400"
              aria-label="删除"  
              title="删除"
            >
              <i className="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
        
        <div className="prose prose-sm dark:prose-invert prose-gray max-w-none mb-4">
          <p className="text-gray-600 dark:text-slate-300 line-clamp-2">{truncateText(sop.content)}</p>
        </div>
        
        <div className="flex flex-wrap gap-2 mb-4">
          {sop.category && (
            <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs rounded-full">
              {getCategoryName(sop.category)}
            </span>
          )}
          <span className={`px-2 py-1 text-xs rounded-full ${getApprovalStatusStyle(sop.approvalStatus)}`}>
            {getApprovalStatusText(sop.approvalStatus)}
          </span>
        
          {sop.purpose && (
            <div className="w-full mt-3">
              <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">目的:</p>
              <p className="text-xs text-gray-600 dark:text-slate-300 line-clamp-1">{truncateText(sop.purpose, 120)}</p> 
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-center text-xs text-gray-500 dark:text-slate-400">
          <span>
            <i className="fa-solid fa-calendar-alt mr-1"></i>
            最后更新: {formatDate(sop.lastUpdated)}
          </span>
          <button className="text-blue-600 dark:text-blue-400 hover:underline transition-colors">
            <Link to={`/sops/${sop.id}`}>查看详情</Link>
          </button>
        </div>
      </div>
    </motion.div>
  );
});

// 优化比较函数
SOPCard.displayName = 'SOPCard';