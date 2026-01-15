import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { projectService } from '@/lib/storage';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/Button';
import { Project } from '@/types';

export default function CreateTopic() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const location = useLocation();

  // 获取项目ID，支持不同的路由格式
  // /projects/:id/edit 或 /projects/edit/:id 或 /topics/:id/edit 或 /topics/edit/:id
  const getProjectId = (): string | undefined => {
    if (params.id) {
      return params.id;
    }

    // 从路径中解析ID
    const pathParts = location.pathname.split('/');
    if (pathParts.includes('edit')) {
      const editIndex = pathParts.indexOf('edit');
      // 如果edit后面有ID
      if (editIndex < pathParts.length - 1) {
        return pathParts[editIndex + 1];
      }
      // 如果edit前面有ID
      if (editIndex > 0) {
        return pathParts[editIndex - 1];
      }
    }

    return undefined;
  };

  const projectId = getProjectId();

  // 检测是否为编辑模式
  const isEditMode = Boolean(projectId) && location.pathname.includes('edit');

  // 调试信息
  console.log('CreateTopic Debug:', {
    pathname: location.pathname,
    params,
    projectId,
    isEditMode,
    allProjects: projectService.getAll().map(p => ({ id: p.id, title: p.title }))
  });

  // 表单状态
  const [formData, setFormData] = useState({
    title: '',
    description: ''
  });

  // 错误状态
  const [errors, setErrors] = useState({
    title: ''
  });

  // 加载现有项目（如果是编辑模式）
  useEffect(() => {
    console.log('useEffect triggered:', { isEditMode, projectId });

    if (isEditMode && projectId) {
      setLoading(true);
      try {
        console.log('Attempting to load project with ID:', projectId);
        const foundProject = projectService.getById(projectId);
        console.log('Found project:', foundProject);

        if (foundProject) {
          setProject(foundProject);
          setFormData({
            title: foundProject.title,
            description: foundProject.description || ''
          });
          console.log('Project loaded successfully');
        } else {
          console.error('Project not found for ID:', projectId);
          toast.error('未找到该课题，ID: ' + projectId);
          // 不要立即跳转，给用户时间看到错误信息
          setTimeout(() => {
            navigate('/projects');
          }, 2000);
        }
      } catch (err) {
        console.error('Error loading project:', err);
        toast.error('加载课题失败: ' + (err instanceof Error ? err.message : String(err)));
        // 不要立即跳转，给用户时间看到错误信息
        setTimeout(() => {
          navigate('/projects');
        }, 2000);
      } finally {
        setLoading(false);
      }
    }
  }, [projectId, isEditMode, navigate]);

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

      if (isEditMode && project) {
        // 更新现有课题
        projectService.update(project.id, {
          title: formData.title,
          description: formData.description
        });

        toast.success('课题更新成功');
      } else {
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
      }

      // 延迟导航以确保用户看到成功提示
      setTimeout(() => {
        navigate('/projects');
      }, 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `${isEditMode ? '更新' : '创建'}课题失败，请重试`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-earth-beige text-text-main">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header
          title={isEditMode ? '编辑课题' : '创建课题'}
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <Button onClick={() => navigate('/projects')}>
              <i className="fa-solid fa-arrow-left mr-2"></i>
              <span className="hidden sm:inline">返回列表</span>
            </Button>
          }
        />

        <main className="container mx-auto px-4 py-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">加载中...</p>
            </div>
          ) : (
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
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${errors.title
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
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 min-h-[200px]"
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
                        {isEditMode ? '更新中...' : '创建中...'}
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-save mr-2"></i>
                        {isEditMode ? '更新课题' : '创建课题'}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}