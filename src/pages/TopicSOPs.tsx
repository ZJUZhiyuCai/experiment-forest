import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { topicService, sopService } from '@/lib/cachedStorage';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { SOPCard } from '@/components/SOPCard';
import { Project, SOP } from '@/types';
import { cn } from '@/lib/utils';

export default function TopicSOPs() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [topic, setTopic] = useState<Project | null>(null);
  const [relatedSOPs, setRelatedSOPs] = useState<SOP[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      const foundTopic = topicService.getById(id);
      setTopic(foundTopic);

      const allSOPs = sopService.getAll();
      const sops = allSOPs.filter(sop => sop.projectId === id);
      setRelatedSOPs(sops);
    }
    setLoading(false);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-organic-rice-paper flex items-center justify-center">
        <div className="organic-card p-8 rounded-[2rem_1rem_2.5rem_1.5rem] text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-moss mb-4"></div>
          <p className="text-loam">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-organic-rice-paper text-loam">
      {/* 环境 Blob 背景 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="organic-blob organic-blob--moss w-[400px] h-[400px] -top-20 -right-20 opacity-15" />
        <div className="organic-blob organic-blob--sand w-[300px] h-[300px] bottom-10 -left-20 opacity-10" />
      </div>

      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={cn('transition-all duration-500 relative z-10', sidebarCollapsed ? 'ml-16' : 'ml-64')}>
        <Header
          title={`${topic?.title || '课题'} - SOP文档`}
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <div className="flex space-x-2">
              <Link to={`/sops/new?projectId=${id}`} className="organic-btn organic-btn--outline text-sm">
                <i className="fa-solid fa-plus mr-1"></i>添加课题SOP
              </Link>
              <Link to={`/topics/${id}`} className="organic-btn organic-btn--ghost text-sm">
                <i className="fa-solid fa-arrow-left mr-2"></i>
                <span>返回课题</span>
              </Link>
            </div>
          }
        />

        <main className="container mx-auto px-6 py-6">
          <div className="organic-card p-6 rounded-[2rem_1rem_2.5rem_1.5rem]">
            <h2 className="text-xl font-heading font-bold text-loam mb-6">课题SOP文档</h2>

            {topic ? (
              <div className="space-y-6">
                <div className="prose prose-sm max-w-none">
                  <p className="text-grass mb-6">
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
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-moss/15 mb-4">
                      <i className="fa-solid fa-file-pdf text-moss text-xl"></i>
                    </div>
                    <h3 className="text-lg font-heading font-medium text-loam mb-2">暂无关联SOP文档</h3>
                    <p className="text-grass mb-6">
                      此课题下还没有关联的SOP文档
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-3">
                      <Link to="/sops/new" className="organic-btn organic-btn--secondary">
                        <i className="fa-solid fa-plus mr-2"></i>创建SOP文档
                      </Link>
                      <button
                        onClick={() => navigate('/sops?select=true')}
                        className="organic-btn organic-btn--outline"
                      >
                        <i className="fa-solid fa-link mr-2"></i>关联现有SOP
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-status-error/15 mb-4">
                  <i className="fa-solid fa-exclamation-circle text-status-error text-xl"></i>
                </div>
                <h3 className="text-lg font-heading font-medium text-loam mb-2">课题不存在</h3>
                <p className="text-grass mb-6">
                  未找到指定的课题，请检查课题ID是否正确
                </p>
                <Link to="/topics" className="organic-btn organic-btn--primary">
                  <i className="fa-solid fa-arrow-left mr-2"></i>返回课题列表
                </Link>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}