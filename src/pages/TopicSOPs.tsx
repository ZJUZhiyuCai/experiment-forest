import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { topicService, sopService } from '@/lib/cachedStorage';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/Button';
import { SOPCard } from '@/components/SOPCard';
import { Project, SOP } from '@/types';

export default function TopicSOPs() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [topic, setTopic] = useState<Project | null>(null);
  const [relatedSOPs, setRelatedSOPs] = useState<SOP[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      // 获取课题详情
      const foundTopic = topicService.getById(id);
      setTopic(foundTopic);

      // 获取关联的SOP文档
      const allSOPs = sopService.getAll();
      const sops = allSOPs.filter(sop => sop.projectId === id);
      setRelatedSOPs(sops);
      console.log('关联的SOP数量:', sops.length);
    }
    setLoading(false);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-earth-beige text-text-main">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header
          title={`${topic?.title || '课题'} - SOP文档`}
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <div className="flex space-x-2">
              <Button asChild variant="outline" size="sm">
                <Link to={`/sops/new?projectId=${id}`}>
                  <i className="fa-solid fa-plus mr-1"></i>添加课题SOP
                </Link>
              </Button>
              <Button asChild>
                <Link to={`/topics/${id}`}>
                  <i className="fa-solid fa-arrow-left mr-2"></i>
                  <span>返回课题</span>
                </Link>
              </Button>
            </div>
          }
        />

        <main className="container mx-auto px-4 py-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300 hover:shadow-md">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6">课题SOP文档</h2>

            {topic ? (
              <div className="space-y-6">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-gray-700 dark:text-gray-300 mb-6">
                    查看和管理课题 "{topic.title}" 相关的标准操作流程文档。
                  </p>
                </div>

                {relatedSOPs.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {relatedSOPs.map(sop => (
                      <SOPCard key={sop.id} sop={sop} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                      <i className="fa-solid fa-file-pdf text-gray-400"></i>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">暂无关联SOP文档</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                      此课题下还没有关联的SOP文档
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-3">
                      <Button asChild>
                        <Link to="/sops/new">
                          <i className="fa-solid fa-plus mr-2"></i>创建SOP文档
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          // 打开选择SOP的模态框或导航到SOP列表选择要关联的SOP
                          navigate('/sops?select=true');
                        }}
                      >
                        <i className="fa-solid fa-link mr-2"></i>关联现有SOP
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                  <i className="fa-solid fa-exclamation-circle text-gray-400"></i>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">课题不存在</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  未找到指定的课题，请检查课题ID是否正确
                </p>
                <Button asChild>
                  <Link to="/topics">
                    <i className="fa-solid fa-arrow-left mr-2"></i>返回课题列表
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