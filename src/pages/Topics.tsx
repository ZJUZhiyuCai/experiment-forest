import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { projectService } from '@/lib/cachedStorage';
import { Project } from '@/types';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { cn } from '@/lib/utils';

export default function Topics() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const allProjects = projectService.getAll();
    setProjects(allProjects);
  }, []);

  const filteredProjects = projects.filter(project =>
    project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (project.description && project.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleDelete = (id: string) => {
    if (window.confirm('确定要删除这个课题吗？此操作不可撤销。')) {
      try {
        const success = projectService.delete(id);
        if (success) {
          const updatedProjects = projectService.getAll();
          setProjects(updatedProjects);
          toast.success('课题已删除');
        } else {
          toast.error('删除失败，请重试');
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '删除课题失败，请重试');
      }
    }
  };

  return (
    <div className="min-h-screen bg-organic-rice-paper text-loam">
      {/* 环境 Blob 背景 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="organic-blob organic-blob--moss w-[400px] h-[400px] -top-20 -right-20 opacity-15" />
        <div className="organic-blob organic-blob--terracotta w-[300px] h-[300px] bottom-10 -left-20 opacity-10" />
      </div>

      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={cn('transition-all duration-500 relative z-10', sidebarCollapsed ? 'ml-16' : 'ml-64')}>
        <Header
          title="课题管理"
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <button onClick={() => navigate('/projects/new')} className="organic-btn organic-btn--primary text-sm">
              <i className="fa-solid fa-plus mr-2"></i>
              <span>新建课题</span>
            </button>
          }
        />

        <main className="container mx-auto px-6 py-6">
          {/* 搜索 */}
          <div className="organic-card p-4 mb-6 rounded-[1.5rem_1rem_2rem_1.2rem]">
            <div className="relative">
              <input
                type="text"
                placeholder="搜索课题..."
                className="organic-input pl-10 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <i className="fa-solid fa-search absolute left-4 top-1/2 transform -translate-y-1/2 text-bark/50"></i>
            </div>
          </div>

          {/* 课题列表 */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-heading font-bold text-loam">
                所有课题
                <span className="ml-2 text-sm font-normal text-grass">
                  ({filteredProjects.length})
                </span>
              </h2>
            </div>

            {filteredProjects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.map(project => (
                  <div
                    key={project.id}
                    className="organic-card rounded-[1.5rem_1rem_2rem_1.2rem] overflow-hidden hover:shadow-lg transition-all duration-natural"
                  >
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-lg font-heading font-semibold text-loam line-clamp-1">
                          <Link to={`/projects/${project.id}`} className="hover:text-moss transition-colors">
                            {project.title}
                          </Link>
                        </h3>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => navigate(`/projects/${project.id}`)}
                            className="p-2 rounded-full hover:bg-timber-soft transition-colors text-grass"
                            aria-label="查看"
                          >
                            <i className="fa-solid fa-eye"></i>
                          </button>
                          <button
                            onClick={() => navigate(`/projects/edit/${project.id}`)}
                            className="p-2 rounded-full hover:bg-timber-soft transition-colors text-grass"
                            aria-label="编辑"
                          >
                            <i className="fa-solid fa-pencil"></i>
                          </button>
                          <button
                            onClick={() => handleDelete(project.id)}
                            className="p-2 rounded-full hover:bg-status-error/10 transition-colors text-grass hover:text-status-error"
                            aria-label="删除"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      </div>

                      <p className="text-sm text-grass line-clamp-3 mb-4">
                        {project.description || '无描述'}
                      </p>

                      <div className="flex justify-between items-center text-xs text-grass">
                        <span>
                          <i className="fa-solid fa-calendar mr-1"></i>
                          {new Date(project.createdAt).toLocaleDateString()}
                        </span>
                        <Link to={`/projects/${project.id}`} className="organic-btn organic-btn--outline text-xs py-1 px-3">
                          查看详情
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="organic-card p-8 text-center rounded-[2rem_1rem_2.5rem_1.5rem]">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-moss/15 mb-4">
                  <i className="fa-solid fa-folder-open text-moss text-xl"></i>
                </div>
                <h3 className="text-lg font-heading font-medium text-loam mb-2">暂无课题</h3>
                <p className="text-grass mb-4">
                  您还没有创建任何课题，点击下方按钮开始创建
                </p>
                <Link to="/projects/new" className="organic-btn organic-btn--secondary">
                  <i className="fa-solid fa-plus mr-2"></i>创建课题
                </Link>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}