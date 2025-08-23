import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { projectService } from '@/lib/storage';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/Button';

export default function CreateTopic() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  
  // 表单状态
  const [formData, setFormData] = useState({
    title: '',
    description: ''
  });
  
  // 错误状态
  const [errors, setErrors] = useState({
    title: ''
  });
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // 清除对应字段的错误提示
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };
  
   // 表单验证
   const validateForm = (): boolean => {
    const newErrors: typeof errors = { title: '' };
    let isValid = true;
    
    if (!formData.title.trim()) {
      newErrors.title = '课题标题不能为空';
      isValid = false;  
    }
    
    setErrors(newErrors);
    return isValid;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 表单验证
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // 创建新课题
      projectService.create({
        title: formData.title,
        description: formData.description,
        status: 'planning',
        priority: 'medium',
        progress: 0,
        tags: [],
        leader: '系统管理员',
        members: [],
        objectives: [],
        milestones: [],
        startDate: new Date().toISOString().split('T')[0]
      });
      
      toast.success('课题创建成功');
      
      // 延迟导航以确保用户看到成功提示
      setTimeout(() => {
        navigate('/projects');
      }, 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建课题失败，请重试');
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-[#F9F6F2] text-[#555555]">  
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header 
          title="创建课题" 
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <Button onClick={() => navigate('/projects')}>
              <i className="fa-solid fa-arrow-left mr-2"></i>
              <span className="hidden sm:inline">返回列表</span>
            </Button>
          }
        />
        
        <main className="container mx-auto px-4 py-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 max-w-2xl mx-auto transition-all duration-300 hover:shadow-md">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  课题标题 <span className="text-red-500">*</span>
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
                  placeholder="输入课题标题"
                  aria-invalid={!!errors.title}
                  disabled={isSubmitting}
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center">
                    <i className="fa-solid fa-exclamation-circle mr-1"></i> {errors.title}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  课题描述
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 min-h-[150px]"
                  placeholder="输入课题描述（可选）"
                  disabled={isSubmitting}
                ></textarea>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => navigate('/projects')}
                  disabled={isSubmitting}
                >
                  取消
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                      创建中...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-save mr-2"></i>
                      创建课题
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}