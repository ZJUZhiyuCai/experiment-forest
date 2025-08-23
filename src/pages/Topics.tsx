import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { projectService } from '@/lib/cachedStorage';
import { Project } from '@/types';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/Button';

export default function Topics() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  
  useEffect(() => {
    // 获取所有课题
    const allProjects = projectService.getAll();
    setProjects(allProjects);
  }, []);
  
  // 过滤课题
  const filteredProjects = projects.filter(project => 
    project.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (project.description && project.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  // 删除课题
  const handleDelete = (id: string) => {
    if (window.confirm('确定要删除这个课题吗？此操作不可撤销。')) {
      try {
        const success = projectService.delete(id);
        if (success) {
          // 重新从服务获取最新数据，确保删除后的数据一致性
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
    <div className="min-h-screen bg-[#F9F6F2] text-[#555555]">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header 
          title="课题管理" 
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <Button onClick={() => navigate('/projects/new')}>
              <i className="fa-solid fa-plus mr-2"></i>
              <span>新建课题</span>
            </Button>
          }
        />
        
        <main className="container mx-auto px-4 py-6">
          {/* 搜索 */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6 transition-all duration-300 hover:shadow-md">
            <div className="relative">
              <input
                type="text"
                placeholder="搜索课题..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"  
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <i className="fa-solid fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
            </div>
          </div>
          
          {/* 课题列表 */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                所有课题
                <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                  ({filteredProjects.length})
                </span>
              </h2>
            </div>
            
            {filteredProjects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.map(project => (
                  <div 
                    key={project.id}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 hover:shadow-md"
                  >
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white line-clamp-1">
                          <Link to={`/projects/${project.id}`} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                            {project.title}
                          </Link>
                        </h3>
                        <div className="flex space-x-1">
                          <button 
                            onClick={() => navigate(`/projects/${project.id}`)}
                            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
                            aria-label="查看"
                          >
                            <i className="fa-solid fa-eye"></i>
                          </button>
                          <button 
                            onClick={() => navigate(`/projects/edit/${project.id}`)}
                            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
                            aria-label="编辑"
                          >
                            <i className="fa-solid fa-pencil"></i>
                          </button>
                          <button 
                            onClick={() => handleDelete(project.id)}
                            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                            aria-label="删除"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 mb-4">
                        {project.description || '无描述'}
                      </p>
                      
                      <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                        <span>
                          <i className="fa-solid fa-calendar mr-1"></i>
                          {new Date(project.createdAt).toLocaleDateString()}
                        </span>
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/projects/${project.id}`}>查看详情</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                  <i className="fa-solid fa-folder-open text-gray-400"></i>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">暂无课题</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  您还没有创建任何课题，点击下方按钮开始创建
                </p>
                <Button asChild>
                  <Link to="/projects/new">
                    <i className="fa-solid fa-plus mr-2"></i>创建课题
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}