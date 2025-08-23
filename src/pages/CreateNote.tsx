import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { experimentNoteService, experimentRecordService } from '@/lib/cachedStorage';
import { ExperimentRecord } from '@/types';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/Button';
import { TreePlantingCelebration } from '@/components/TreePlantingCelebration';





export default function CreateNote() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [records, setRecords] = useState<ExperimentRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTreeCelebration, setShowTreeCelebration] = useState(false);
  const navigate = useNavigate();
  
  // 表单状态和验证错误
  const [formData, setFormData] = useState({
    title: '',
    relatedRecordId: '',
    content: ''
  });
  
  const [errors, setErrors] = useState({
    title: '',
    content: ''
  });
  
  useEffect(() => {
    // 获取所有实验记录（用于关联选择）
    const allRecords = experimentRecordService.getAll();
    setRecords(allRecords);
  }, []);
  
  // 表单验证
  const validateForm = (): boolean => {
    const newErrors: typeof errors = { title: '', content: '' };
    let isValid = true;
    
    if (!formData.title.trim()) {
      newErrors.title = '笔记标题不能为空';
      isValid = false;
    }
    
    if (!formData.content.trim()) {
      newErrors.content = '笔记内容不能为空';
      isValid = false;
    }
    
    setErrors(newErrors);
    return isValid;
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // 清除对应字段的错误提示
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
     // 表单验证
    if (!validateForm()) {
      return;
    }
    
    // 检查内容是否为空（修复潜在的空格提交问题）
    if (!formData.content.trim()) {
      setErrors(prev => ({ ...prev, content: '笔记内容不能为空' }));
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // 创建新实验笔记
      const newNote = experimentNoteService.create({
        title: formData.title,
        relatedRecordId: formData.relatedRecordId || undefined,
        content: formData.content
      });
      
      if (newNote) {
        toast.success('实验笔记创建成功');
        
        // 显示种树庆祝动画
        setShowTreeCelebration(true);
        
        // 延迟导航以确保用户看到成功提示
        setTimeout(() => {
          navigate('/notes');
        }, 3500); // 留出时间观看动画
      } else {
        toast.error('创建实验笔记失败，请重试');
        setIsSubmitting(false);
      }
    } catch (error) {
      toast.error('创建实验笔记失败，请重试');
      console.error('创建实验笔记失败:', error);
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header 
          title="创建实验笔记" 
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <Button onClick={() => navigate('/notes')} variant="outline">
              <i className="fa-solid fa-arrow-left mr-2"></i>
              <span>返回列表</span>
            </Button>
          }
        />
        
        <main className="container mx-auto px-4 py-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 max-w-3xl mx-auto"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  笔记标题 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${
                    errors.title 
                      ? 'border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-900/20' 
                      : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                  } text-gray-800 dark:text-gray-200`}
                  placeholder="输入笔记标题"
                  aria-invalid={!!errors.title}
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center">
                    <i className="fa-solid fa-exclamation-circle mr-1"></i> {errors.title}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  关联实验记录 (可选)
                </label>
                <select
                  name="relatedRecordId"
                  value={formData.relatedRecordId}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                >
                  <option value="">-- 不关联实验记录 --</option>
                  {records.map(record => (
                    <option key={record.id} value={record.id}>{record.title}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  选择此笔记关联的实验记录（可选）
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  笔记内容 <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="content"
                  value={formData.content}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${
                    errors.content 
                      ? 'border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-900/20' 
                      : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                  } text-gray-800 dark:text-gray-200 min-h-[300px] resize-y`}
                  placeholder="记录实验中的观察、想法、问题或其他重要信息..."
                  aria-invalid={!!errors.content}
                ></textarea>
                {errors.content && (
                  <p className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center">
                    <i className="fa-solid fa-exclamation-circle mr-1"></i> {errors.content}
                  </p>
                )}
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => navigate('/notes')}
                  className="transition-all duration-200"
                >
                  取消
                </Button>
                <Button 
                  type="submit"
                  disabled={isSubmitting}
                  className="transition-all duration-200"
                >
                  {isSubmitting ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                      保存中...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-save mr-2"></i>
                      保存笔记
                    </>
                  )}
                </Button>
              </div>
            </form>
          </motion.div>
        </main>
      </div>
      
      {/* 种树庆祝动画 */}
      <TreePlantingCelebration
        isVisible={showTreeCelebration}
        type="note"
        onClose={() => setShowTreeCelebration(false)}
      />
    </div>
  );
}