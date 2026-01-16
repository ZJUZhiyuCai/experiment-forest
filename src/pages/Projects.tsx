import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { projectService, cacheManager } from '@/lib/cachedStorage';
import { Project, ProjectStatus, ProjectPriority } from '@/types';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { VirtualGrid } from '@/components/VirtualScroll';
import { usePerformanceProfiler } from '@/hooks/usePerformance';
import { cn } from '@/lib/utils';

// 虚拟滚动阈值 - 当项目数量超过此值时启用虚拟滚动
const VIRTUAL_SCROLL_THRESHOLD = 20;
const PROJECT_CARD_HEIGHT = 280; // 项目卡片预估高度

export default function Projects() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // 删除确认对话框状态
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; projectId: string; projectTitle: string }>({
    isOpen: false,
    projectId: '',
    projectTitle: ''
  });

  // 性能监控
  const { ref: performanceRef } = usePerformanceProfiler('Projects', [projects, loading, searchQuery]);

  // 表单状态
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'planning' as ProjectStatus,
    priority: 'medium' as ProjectPriority,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    estimatedDuration: 0,
    budget: 0,
    leader: '',
    members: [] as string[],
    tags: [] as string[],
    objectives: [] as string[]
  });

  // 错误状态
  const [errors, setErrors] = useState({
    title: '',
    description: '',
    leader: ''
  });

  // 输入状态
  // 未来功能的输入状态，暂不使用
  // const [memberInput, setMemberInput] = useState('');
  // const [tagInput, setTagInput] = useState('');
  // const [objectiveInput, setObjectiveInput] = useState('');

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true);

        // 预热缓存（首次访问时）
        await cacheManager.preloadCache();

        // 模拟加载时间以展示skeleton
        await new Promise(resolve => setTimeout(resolve, 800));

        const allProjects = projectService.getAll();
        setProjects(allProjects);
      } catch (error) {
        console.error('获取课题失败:', error);
        setProjects([]);
        toast.error('获取课题列表失败');
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  // 过滤课题
  const filteredProjects = projects.filter(project => {
    const matchesSearch =
      project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || project.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // 打开创建表单
  const openCreateForm = () => {
    setCurrentProject(null);
    setFormData({
      title: '',
      description: '',
      status: 'planning' as ProjectStatus,
      priority: 'medium' as ProjectPriority,
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      estimatedDuration: 0,
      budget: 0,
      leader: '',
      members: [],
      tags: [],
      objectives: []
    });
    setErrors({ title: '', description: '', leader: '' });
    // setMemberInput('');
    // setTagInput('');
    // setObjectiveInput('');
    setIsFormOpen(true);
  };

  // 打开编辑表单
  const openEditForm = (project: Project) => {
    setCurrentProject(project);
    setFormData({
      title: project.title,
      description: project.description,
      status: project.status,
      priority: project.priority,
      startDate: project.startDate,
      endDate: project.endDate || '',
      estimatedDuration: project.estimatedDuration || 0,
      budget: project.budget || 0,
      leader: project.leader,
      members: [...project.members],
      tags: [...project.tags],
      objectives: [...project.objectives]
    });
    setErrors({ title: '', description: '', leader: '' });
    // setMemberInput('');
    // setTagInput('');
    // setObjectiveInput('');
    setIsFormOpen(true);
  };

  // 关闭表单
  const closeForm = () => {
    setIsFormOpen(false);
    setCurrentProject(null);
    setIsSubmitting(false);
  };

  // 表单验证
  const validateForm = (): boolean => {
    const newErrors = {
      title: !formData.title.trim() ? '请输入课题标题' : '',
      description: !formData.description.trim() ? '请输入课题描述' : '',
      leader: !formData.leader.trim() ? '请输入课题负责人' : ''
    };
    setErrors(newErrors);
    return Object.values(newErrors).every(error => !error);
  };

  // 处理表单变更
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // 清除对应字段的错误
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // 以下函数留作未来功能扩展，目前暂不使用
  // const addMember = () => {
  //   if (newMember.trim()) {
  //     setFormData({
  //       ...formData,
  //       members: [...formData.members, newMember.trim()]
  //     });
  //     setNewMember('');
  //   }
  // };

  // const removeMember = (index: number) => {
  //   const newMembers = formData.members.filter((_, i) => i !== index);
  //   setFormData({
  //     ...formData,
  //     members: newMembers
  //   });
  // };

  // const addTag = () => {
  //   if (newTag.trim()) {
  //     setFormData({
  //       ...formData,
  //       tags: [...formData.tags, newTag.trim()]
  //     });
  //     setNewTag('');
  //   }
  // };

  // const removeTag = (index: number) => {
  //   const newTags = formData.tags.filter((_, i) => i !== index);
  //   setFormData({
  //     ...formData,
  //     tags: newTags
  //   });
  // };

  // const addObjective = () => {
  //   if (newObjective.trim()) {
  //     setFormData({
  //       ...formData,
  //       objectives: [...formData.objectives, newObjective.trim()]
  //     });
  //     setNewObjective('');
  //   }
  // };

  // const removeObjective = (index: number) => {
  //   const newObjectives = formData.objectives.filter((_, i) => i !== index);
  //   setFormData({
  //     ...formData,
  //     objectives: newObjectives
  //   });
  // };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setIsSubmitting(true);

      if (currentProject) {
        // 更新课题
        const updatedProject = projectService.update(currentProject.id, formData);

        if (updatedProject) {
          setProjects(projects.map(project => project.id === currentProject.id ? updatedProject : project));
          toast.success('课题已更新');
        } else {
          toast.error('更新失败');
        }
      } else {
        // 创建新课题
        const newProject = projectService.create({
          ...formData,
          progress: 0,
          milestones: []
        });

        setProjects([...projects, newProject]);
        toast.success('课题创建成功');
      }

      closeForm();
    } catch (error) {
      toast.error(currentProject ? '更新失败，请重试' : '创建失败，请重试');
      console.error('操作失败:', error);
      setIsSubmitting(false);
    }
  };

  // 打开删除确认对话框
  const openDeleteConfirm = (project: Project) => {
    setDeleteConfirm({
      isOpen: true,
      projectId: project.id,
      projectTitle: project.title
    });
  };

  // 关闭删除确认对话框
  const closeDeleteConfirm = () => {
    setDeleteConfirm({ isOpen: false, projectId: '', projectTitle: '' });
  };

  // 确认删除课题
  const confirmDelete = () => {
    try {
      const success = projectService.delete(deleteConfirm.projectId);
      if (success) {
        const updatedProjects = projectService.getAll();
        setProjects(updatedProjects);
        toast.success('课题已删除');
      } else {
        toast.error('删除失败，请重试');
      }
    } catch (error) {
      toast.error('删除失败，请重试');
    } finally {
      closeDeleteConfirm();
    }
  };

  // 获取状态颜色 - 有机自然配色
  const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
      case 'planning': return 'bg-terracotta-light text-terracotta';
      case 'active': return 'bg-moss-soft text-moss';
      case 'paused': return 'bg-terracotta/15 text-terracotta';
      case 'completed': return 'bg-status-success/15 text-status-success';
      case 'archived': return 'bg-organic-stone text-grass';
      default: return 'bg-organic-stone text-grass';
    }
  };

  // 获取优先级颜色 - 有机自然配色
  const getPriorityColor = (priority: ProjectPriority) => {
    switch (priority) {
      case 'low': return 'bg-organic-stone text-grass';
      case 'medium': return 'bg-moss-soft text-moss';
      case 'high': return 'bg-terracotta-light text-terracotta';
      case 'urgent': return 'bg-status-error/15 text-status-error';
      default: return 'bg-organic-stone text-grass';
    }
  };

  // 获取状态文本
  const getStatusText = (status: ProjectStatus) => {
    switch (status) {
      case 'planning': return '规划中';
      case 'active': return '进行中';
      case 'paused': return '已暂停';
      case 'completed': return '已完成';
      case 'archived': return '已归档';
      default: return '未知';
    }
  };

  // 获取优先级文本
  const getPriorityText = (priority: ProjectPriority) => {
    switch (priority) {
      case 'low': return '低';
      case 'medium': return '中';
      case 'high': return '高';
      case 'urgent': return '紧急';
      default: return '未知';
    }
  };

  // 不对称圆角变体
  const cardRadiusVariants = [
    'rounded-[2rem_1rem_2.5rem_1.5rem]',
    'rounded-[1.5rem_2.5rem_1rem_2rem]',
    'rounded-[2.5rem_1.5rem_2rem_1rem]',
    'rounded-[1rem_2rem_1.5rem_2.5rem]',
  ];

  // 项目卡片渲染函数（用于虚拟滚动）
  const renderProjectCard = (project: Project, index: number) => (
    <motion.div
      key={project.id}
      className={cn(
        'organic-card group overflow-hidden hover:shadow-float transition-all duration-300 hover:-translate-y-2 h-full flex flex-col',
        cardRadiusVariants[index % 4]
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      {/* 顶部状态条 */}
      <div className={`h-1.5 ${project.priority === 'urgent' ? 'bg-status-error' : project.priority === 'high' ? 'bg-terracotta' : 'bg-moss'}`} />

      <div className="p-5 flex-1 flex flex-col">
        {/* 头部区域 */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-heading font-bold text-loam mb-1 truncate group-hover:text-moss transition-colors">
              {project.title}
            </h3>
            <div className="flex items-center text-sm text-grass">
              <i className="fa-solid fa-user-circle mr-1.5 text-moss"></i>
              <span className="truncate">{project.leader}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 ml-3">
            <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(project.status)}`}>
              {getStatusText(project.status)}
            </span>
            <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${getPriorityColor(project.priority)}`}>
              {getPriorityText(project.priority)}
            </span>
          </div>
        </div>

        {/* 描述 */}
        <p className="text-bark text-sm mb-4 line-clamp-2 flex-1">
          {project.description.substring(0, 80)}{project.description.length > 80 ? '...' : ''}
        </p>

        {/* 标签区 */}
        {project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {project.tags.slice(0, 3).map((tag, idx) => (
              <span key={idx} className="bg-organic-stone text-bark px-2 py-0.5 text-xs rounded-md">
                #{tag}
              </span>
            ))}
            {project.tags.length > 3 && (
              <span className="text-grass text-xs">+{project.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* 底部操作区 */}
        <div className="flex justify-between items-center pt-3 border-t border-timber-soft">
          <Link
            to={`/projects/${project.id}`}
            className="inline-flex items-center px-4 py-1.5 bg-moss-soft text-moss hover:bg-moss hover:text-moss-light font-medium text-sm rounded-full transition-colors"
          >
            <i className="fa-solid fa-arrow-right mr-1.5"></i>
            查看详情
          </Link>

          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); openEditForm(project); }}
              className="p-2 text-grass hover:text-moss hover:bg-moss-soft rounded-lg transition-colors"
              title="编辑"
            >
              <i className="fa-solid fa-pen-to-square"></i>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); openDeleteConfirm(project); }}
              className="p-2 text-grass hover:text-status-error hover:bg-status-error/10 rounded-lg transition-colors"
              title="删除"
            >
              <i className="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div ref={performanceRef} className="min-h-screen bg-organic-rice-paper text-loam">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={cn('transition-all duration-500', sidebarCollapsed ? 'ml-16' : 'ml-64')}>
        <Header
          title="课题管理"
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <button
              onClick={openCreateForm}
              className="organic-btn organic-btn--primary text-sm px-5 py-2.5"
            >
              <i className="fa-solid fa-plus mr-2"></i>
              新建课题
            </button>
          }
        />

        <main className="container mx-auto px-6 py-8 relative">
          {/* 环境 Blob 背景 */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="organic-blob organic-blob--moss w-[450px] h-[450px] -top-20 -right-20 opacity-20" />
            <div className="organic-blob organic-blob--sand w-[350px] h-[350px] bottom-10 -left-20 opacity-15" />
          </div>

          {/* 删除确认对话框 */}
          <AnimatePresence>
            {deleteConfirm.isOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={closeDeleteConfirm}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
                >
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-status-error/10 rounded-full flex items-center justify-center">
                      <i className="fa-solid fa-trash-can text-status-error text-2xl"></i>
                    </div>
                    <h3 className="text-xl font-bold text-text-main mb-2">确认删除课题</h3>
                    <p className="text-text-soft mb-2">您确定要删除以下课题吗？</p>
                    <p className="text-forest-primary font-medium mb-4 px-4 py-2 bg-forest-accent/20 rounded-lg">
                      「{deleteConfirm.projectTitle}」
                    </p>
                    <p className="text-sm text-status-error mb-6">
                      <i className="fa-solid fa-exclamation-triangle mr-1"></i>
                      此操作不可撤销，相关实验记录、笔记和SOP也可能受影响
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={closeDeleteConfirm}
                        className="flex-1 px-4 py-2.5 border border-forest-accent/30 text-text-main hover:bg-forest-accent/10 rounded-xl transition-colors font-medium"
                      >
                        <i className="fa-solid fa-xmark mr-2"></i>取消
                      </button>
                      <button
                        onClick={confirmDelete}
                        className="flex-1 px-4 py-2.5 bg-status-error hover:bg-red-600 text-white rounded-xl transition-colors font-medium"
                      >
                        <i className="fa-solid fa-trash-can mr-2"></i>确认删除
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 创建/编辑表单 */}
          <AnimatePresence>
            {isFormOpen && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6"
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-800">
                    {currentProject ? '编辑课题' : '创建课题'}
                  </h2>
                  <button
                    onClick={closeForm}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <i className="fa-solid fa-times text-gray-500"></i>
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        课题标题 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-forest-secondary transition-colors ${errors.title
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-300 bg-white'
                          }`}
                        placeholder="输入课题标题"
                        disabled={isSubmitting}
                      />
                      {errors.title && (
                        <p className="mt-1 text-sm text-red-500 flex items-center">
                          <i className="fa-solid fa-exclamation-circle mr-1"></i> {errors.title}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        课题负责人 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="leader"
                        value={formData.leader}
                        onChange={handleChange}
                        className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-forest-secondary transition-colors ${errors.leader
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-300 bg-white'
                          }`}
                        placeholder="输入负责人姓名"
                        disabled={isSubmitting}
                      />
                      {errors.leader && (
                        <p className="mt-1 text-sm text-red-500 flex items-center">
                          <i className="fa-solid fa-exclamation-circle mr-1"></i> {errors.leader}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      课题描述 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-forest-secondary min-h-[200px] resize-y transition-colors ${errors.description
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-300 bg-white'
                        }`}
                      placeholder="详细描述课题的目标、内容和预期成果..."
                      disabled={isSubmitting}
                    ></textarea>
                    {errors.description && (
                      <p className="mt-1 text-sm text-red-500 flex items-center">
                        <i className="fa-solid fa-exclamation-circle mr-1"></i> {errors.description}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleChange}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-forest-secondary"
                        disabled={isSubmitting}
                      >
                        <option value="planning">规划中</option>
                        <option value="active">进行中</option>
                        <option value="paused">已暂停</option>
                        <option value="completed">已完成</option>
                        <option value="archived">已归档</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">优先级</label>
                      <select
                        name="priority"
                        value={formData.priority}
                        onChange={handleChange}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-forest-secondary"
                        disabled={isSubmitting}
                      >
                        <option value="low">低</option>
                        <option value="medium">中</option>
                        <option value="high">高</option>
                        <option value="urgent">紧急</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
                      <input
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleChange}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-forest-secondary"
                        disabled={isSubmitting}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
                      <input
                        type="date"
                        name="endDate"
                        value={formData.endDate}
                        onChange={handleChange}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-forest-secondary"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={closeForm}
                      className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors"
                      disabled={isSubmitting}
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      className="bg-forest-secondary hover:bg-forest-primary text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                          保存中...
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-save mr-2"></i>
                          {currentProject ? '更新课题' : '保存课题'}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 筛选区域 */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-forest-accent/20 p-5 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              {/* 搜索框 */}
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="🔍 搜索课题名称、描述或标签..."
                    className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-forest-accent/30 bg-earth-beige/50 text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-forest-secondary/50 focus:border-forest-secondary transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
                    >
                      <i className="fa-solid fa-times-circle"></i>
                    </button>
                  )}
                </div>
              </div>

              {/* 筛选器组 */}
              <div className="flex items-center gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-forest-accent/30 bg-earth-beige/50 text-text-main focus:outline-none focus:ring-2 focus:ring-forest-secondary/50 cursor-pointer"
                >
                  <option value="all">📋 所有状态</option>
                  <option value="planning">📝 规划中</option>
                  <option value="active">🚀 进行中</option>
                  <option value="paused">⏸️ 已暂停</option>
                  <option value="completed">✅ 已完成</option>
                  <option value="archived">📦 已归档</option>
                </select>

                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-forest-accent/30 bg-earth-beige/50 text-text-main focus:outline-none focus:ring-2 focus:ring-forest-secondary/50 cursor-pointer"
                >
                  <option value="all">⚡ 所有优先级</option>
                  <option value="low">🟢 低</option>
                  <option value="medium">🟡 中</option>
                  <option value="high">🟠 高</option>
                  <option value="urgent">🔴 紧急</option>
                </select>

                {(searchQuery || statusFilter !== 'all' || priorityFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                      setPriorityFilter('all');
                    }}
                    className="px-4 py-2.5 text-text-soft hover:text-forest-primary hover:bg-forest-accent/20 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <i className="fa-solid fa-rotate-left"></i>
                    重置
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 课题列表 */}
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">
              课题列表 ({loading ? '...' : filteredProjects.length})
            </h2>
          </div>

          {loading ? (
            <LoadingSkeleton type="card" count={6} />
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-folder-open text-3xl text-gray-400"></i>
              </div>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' ? '未找到相关课题' : '还没有课题'}
              </h3>
              <p className="text-gray-500 mb-6">
                {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' ? '请尝试修改筛选条件' : '开始您的第一个研究课题吧！'}
              </p>
              {!(searchQuery || statusFilter !== 'all' || priorityFilter !== 'all') && (
                <button
                  onClick={openCreateForm}
                  className="bg-gradient-to-r from-forest-secondary to-forest-primary hover:from-forest-primary hover:to-earth-brown text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 shadow-md hover:shadow-lg"
                >
                  <i className="fa-solid fa-plus mr-2"></i>
                  创建第一个课题
                </button>
              )}
            </div>
          ) : (
            // 判断是否使用虚拟滚动
            filteredProjects.length > VIRTUAL_SCROLL_THRESHOLD ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="mb-4 text-sm text-gray-600 flex items-center">
                  <i className="fa-solid fa-bolt mr-2 text-emerald-500"></i>
                  检测到大量数据，已启用虚拟滚动优化
                </div>
                <VirtualGrid
                  items={filteredProjects}
                  itemWidth={350}
                  itemHeight={PROJECT_CARD_HEIGHT}
                  containerWidth={1200}
                  containerHeight={600}
                  renderItem={renderProjectCard}
                  gap={24}
                  getItemKey={(project) => project.id}
                  className="border border-gray-200 rounded-lg"
                />
              </div>
            ) : (
              <motion.div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {filteredProjects.map((project, index) => (
                  renderProjectCard(project, index)
                ))}
              </motion.div>
            )
          )}
        </main>
      </div>
    </div>
  );
}