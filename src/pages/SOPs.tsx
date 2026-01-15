import { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { sopService, projectService } from '@/lib/cachedStorage';
import { SOP, Project } from '@/types';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { usePerformanceProfiler } from '@/hooks/usePerformance';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { FullscreenTextarea } from '@/components/FullscreenTextarea';

export default function SOPs() {
  const { id: routeProjectId } = useParams<{ id: string }>();
  const location = useLocation();

  // 从URL查询参数或路由参数获取projectId
  const getProjectId = () => {
    const searchParams = new URLSearchParams(location.search);
    const queryProjectId = searchParams.get('project');
    return queryProjectId || routeProjectId;
  };

  const projectId = getProjectId();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sops, setSOPs] = useState<SOP[]>([]);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentSOP, setCurrentSOP] = useState<SOP | null>(null);

  // 性能监控
  const { ref: performanceRef } = usePerformanceProfiler('SOPs', [sops, loading, searchQuery]);

  // 表单状态
  const [formData, setFormData] = useState({
    title: '',
    version: '1.0',
    author: '实验管理员',
    content: ''
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // 模拟加载时间以展示skeleton
        await new Promise(resolve => setTimeout(resolve, 500));

        const allSOPs = sopService.getAll();

        if (projectId) {
          // 如果在课题上下文中，只显示该课题的SOP文档
          const projectSOPs = allSOPs.filter(sop => sop.projectId === projectId);
          setSOPs(projectSOPs);

          // 获取课题信息
          const projectData = projectService.getById(projectId);
          setProject(projectData);
        } else {
          // 显示所有SOP文档
          setSOPs(allSOPs);
        }
      } catch (error) {
        console.error('获取SOP文档失败:', error);
        setSOPs([]);
        toast.error('获取SOP文档列表失败');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId, location.search]);

  // 过滤SOP
  const filteredSOPs = sops.filter(sop =>
    sop.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sop.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 打开创建表单
  const openCreateForm = () => {
    setCurrentSOP(null);
    setFormData({
      title: '',
      version: '1.0',
      author: '实验管理员',
      content: ''
    });
    setIsFormOpen(true);
  };

  // 打开编辑表单
  const openEditForm = (sop: SOP) => {
    setCurrentSOP(sop);
    setFormData({
      title: sop.title,
      version: sop.version,
      author: sop.author,
      content: sop.content
    });
    setIsFormOpen(true);
  };

  // 关闭表单
  const closeForm = () => {
    setIsFormOpen(false);
    setCurrentSOP(null);
  };

  // 处理表单变更
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 提交表单 (创建或更新)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 基本验证
    if (!formData.title.trim()) {
      toast.error('请输入SOP文档标题');
      return;
    }

    if (!formData.author.trim()) {
      toast.error('请输入作者名称');
      return;
    }

    try {
      if (currentSOP) {
        // 更新SOP
        const updatedSOP = sopService.update(currentSOP.id, {
          title: formData.title,
          version: formData.version,
          author: formData.author,
          content: formData.content
        });

        if (updatedSOP) {
          // 更新SOP列表
          setSOPs(sops.map(sop => sop.id === currentSOP.id ? updatedSOP : sop));
          toast.success('SOP文档已更新');
        } else {
          toast.error('更新SOP文档失败');
        }
      } else {
        // 创建新SOP
        const newSOP = sopService.create({
          title: formData.title,
          version: formData.version,
          author: formData.author,
          content: formData.content,
          department: '实验室',
          category: '通用',
          purpose: '标准操作流程',
          scope: '实验室操作',
          approvalStatus: 'draft',
          references: '',
          projectId: projectId // 自动关联到当前课题
        });

        // 添加到SOP列表
        setSOPs([...sops, newSOP]);
        toast.success('SOP文档创建成功');
      }

      // 关闭表单
      closeForm();
    } catch (error) {
      toast.error(currentSOP ? '更新SOP文档失败，请重试' : '创建SOP文档失败，请重试');
      console.error('操作失败:', error);
    }
  };

  // 删除SOP
  const handleDelete = (id: string) => {
    if (window.confirm('确定要删除这份SOP文档吗？此操作不可撤销。')) {
      try {
        const success = sopService.delete(id);
        if (success) {
          // 重新从服务获取最新数据
          const allSOPs = sopService.getAll();
          if (projectId) {
            // 如果在课题上下文中，只显示该课题的SOP文档
            const projectSOPs = allSOPs.filter(sop => sop.projectId === projectId);
            setSOPs(projectSOPs);
          } else {
            setSOPs(allSOPs);
          }
          toast.success('SOP文档已删除');
        } else {
          toast.error('删除失败，请重试');
        }
      } catch (error) {
        toast.error('删除失败，请重试');
      }
    }
  };

  return (
    <div ref={performanceRef} className="min-h-screen bg-earth-beige text-text-main">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header
          title={projectId && project ? `${project.title} - SOP文档` : 'SOP文档'}
          sidebarCollapsed={sidebarCollapsed}
          breadcrumb={projectId && project ? [
            { label: '课题管理', href: '/projects' },
            { label: project.title, href: `/projects/${projectId}` },
            { label: 'SOP文档' }
          ] : undefined}
          actions={
            <button
              onClick={openCreateForm}
              className="bg-forest-secondary hover:bg-forest-primary text-white px-4 py-2 rounded-xl font-semibold transition-all duration-300 shadow-sm hover:shadow-md"
            >
              <i className="fa-solid fa-plus mr-2"></i>
              新建SOP文档
            </button>
          }
        />

        <main className="container mx-auto px-4 py-6">
          {/* 创建/编辑表单 */}
          {isFormOpen && (
            <div className="bg-forest-main/5 rounded-xl shadow-sm border border-forest-accent/20 p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-forest-primary">
                  {currentSOP ? '编辑SOP文档' : '创建SOP文档'}
                </h2>
                <button
                  type="button"
                  onClick={closeForm}
                  className="p-2 text-text-muted hover:text-text-main hover:bg-white/50 rounded-lg transition-colors"
                >
                  <i className="fa-solid fa-times text-lg"></i>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-text-main mb-1">
                    文档标题 <span className="text-status-error">*</span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-forest-accent/30 bg-white focus:outline-none focus:ring-2 focus:ring-forest-secondary/50"
                    placeholder="输入SOP文档标题"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-text-main mb-1">
                      版本号
                    </label>
                    <input
                      type="text"
                      name="version"
                      value={formData.version}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-forest-accent/30 bg-white focus:outline-none focus:ring-2 focus:ring-forest-secondary/50"
                      placeholder="例如: 1.0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-main mb-1">
                      作者 <span className="text-status-error">*</span>
                    </label>
                    <input
                      type="text"
                      name="author"
                      value={formData.author}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-forest-accent/30 bg-white focus:outline-none focus:ring-2 focus:ring-forest-secondary/50"
                      placeholder="输入作者名称"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-main mb-1">
                    SOP内容
                  </label>
                  <FullscreenTextarea
                    value={formData.content}
                    onChange={(value) => setFormData(prev => ({ ...prev, content: value }))}
                    title="SOP内容"
                    placeholder="详细描述标准操作流程，建议包含目的、适用范围、操作步骤、注意事项等..."
                  >
                    <textarea
                      name="content"
                      value={formData.content}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-forest-accent/30 bg-white focus:outline-none focus:ring-2 focus:ring-forest-secondary/50 min-h-[400px] pr-12"
                      placeholder="详细描述标准操作流程，建议包含目的、适用范围、操作步骤、注意事项等..."
                    />
                  </FullscreenTextarea>
                  <p className="text-xs text-text-muted mt-1">
                    提示: 使用编号和项目符号可以使SOP更易读
                  </p>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-forest-accent/20">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="border border-forest-accent/30 text-text-main hover:bg-forest-accent/10 px-4 py-2 rounded-xl transition-colors"
                  >
                    取消
                  </button>
                  <button type="submit" className="bg-forest-secondary hover:bg-forest-primary text-white px-4 py-2 rounded-xl transition-colors shadow-sm">
                    <i className="fa-solid fa-save mr-2"></i>
                    {currentSOP ? '更新文档' : '保存文档'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 搜索 */}
          <div className="bg-white rounded-xl shadow-sm border border-forest-accent/30 p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-text-main mb-1">搜索SOP</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="输入关键词搜索..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-forest-accent/30 bg-earth-beige/50 focus:outline-none focus:ring-2 focus:ring-forest-secondary/50"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <i className="fa-solid fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted"></i>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">按课题筛选</label>
                <select
                  className="w-full px-4 py-2.5 rounded-xl border border-forest-accent/30 bg-earth-beige/50 focus:outline-none focus:ring-2 focus:ring-forest-secondary/50"
                  onChange={(e) => {
                    const value = e.target.value;
                    const allSOPs = sopService.getAll();

                    if (value === "all") {
                      setSOPs(allSOPs);
                    } else {
                      // 简单的筛选，实际项目中可以根据需要扩展
                      setSOPs(allSOPs);
                    }
                  }}
                >
                  <option value="all">所有SOP</option>
                  <option value="general">通用SOP</option>
                </select>
              </div>
            </div>
          </div>

          {/* SOP列表 */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-text-main">
                所有SOP文档
                <span className="ml-2 text-sm font-normal text-text-muted">
                  ({filteredSOPs.length})
                </span>
              </h2>

              <div className="flex space-x-3">
                <button
                  onClick={openCreateForm}
                  className="bg-forest-secondary hover:bg-forest-primary text-white px-4 py-2 rounded-xl transition-all duration-300 shadow-sm"
                >
                  <i className="fa-solid fa-plus mr-2"></i>
                  <span>新建SOP文件</span>
                </button>
                <button className="border border-forest-accent/30 text-text-main hover:bg-forest-accent/10 px-3 py-1 rounded-xl text-sm transition-colors">
                  <i className="fa-solid fa-file-export mr-2"></i>
                  <span>导出</span>
                </button>
              </div>
            </div>

            {loading ? (
              <LoadingSkeleton type="card" count={6} />
            ) : filteredSOPs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSOPs.map(sop => (
                  <motion.div
                    key={sop.id}
                    className="group bg-white rounded-2xl shadow-sm border border-forest-accent/30 p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-text-main mb-2 group-hover:text-forest-primary transition-colors">{sop.title}</h3>
                        <p className="text-sm text-text-soft">版本: {sop.version} | 作者: {sop.author}</p>
                        <p className="text-xs text-text-muted mt-1">{new Date(sop.lastUpdated).toLocaleDateString()}</p>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => openEditForm(sop)}
                          className="p-2 text-text-soft hover:bg-forest-accent/20 hover:text-forest-primary rounded-lg transition-colors"
                          title="编辑"
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(sop.id)}
                          className="p-2 text-text-soft hover:bg-status-error/10 hover:text-status-error rounded-lg transition-colors"
                          title="删除"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </div>
                    <div className="text-sm text-text-main/80 mb-4 line-clamp-3">
                      {sop.content.substring(0, 150)}{sop.content.length > 150 ? '...' : ''}
                    </div>
                    <Link
                      to={`/sops/${sop.id}`}
                      className="block w-full text-center bg-forest-secondary/10 text-forest-primary hover:bg-forest-secondary/20 px-4 py-2 rounded-xl transition-colors text-sm font-medium"
                    >
                      查看详情
                    </Link>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <i className="fa-solid fa-file-alt text-gray-400 text-3xl"></i>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">暂无SOP文档</h3>
                <p className="text-gray-500 mb-4">开始创建你的第一份标准操作流程文档</p>
                <button
                  onClick={openCreateForm}
                  className="bg-forest-secondary hover:bg-forest-primary text-white px-4 py-2 rounded-xl transition-all duration-300 shadow-sm"
                >
                  <i className="fa-solid fa-plus mr-2"></i>
                  创建SOP文档
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}