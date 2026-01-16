import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { projectService, experimentRecordService, sopService } from '@/lib/storage';
import { Project, ExperimentRecord, SOP } from '@/types';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { RecordCard } from '@/components/RecordCard';
import { SOPCard } from '@/components/SOPCard';
import { cn } from '@/lib/utils';

export default function TopicDetail() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [topic, setTopic] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [relatedRecords, setRelatedRecords] = useState<ExperimentRecord[]>([]);
  const [relatedSOPs, setRelatedSOPs] = useState<SOP[]>([]);
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) {
      setError('课题ID不存在');
      setLoading(false);
      return;
    }

    try {
      const foundTopic = projectService.getById(id);
      if (foundTopic) {
        setTopic(foundTopic);

        const allRecords = experimentRecordService.getAll();
        const records = allRecords.filter(record => record.projectId === id);
        setRelatedRecords(records);

        const allSOPs = sopService.getAll();
        const sops = allSOPs.filter(sop => sop.projectId === id);
        setRelatedSOPs(sops);
      } else {
        setError('未找到该课题');
      }
    } catch (err) {
      setError('加载课题失败');
      console.error('加载课题失败:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleEdit = () => {
    if (topic) {
      navigate(`/projects/edit/${topic.id}`);
    }
  };

  const handleDelete = () => {
    if (window.confirm('确定要删除这个课题吗？此操作不可撤销。')) {
      try {
        const success = topic && projectService.delete(topic.id);
        if (success) {
          toast.success('课题已删除');
          navigate('/projects');
        } else {
          toast.error('删除失败，请重试');
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '删除课题失败，请重试');
      }
    }
  };

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

  if (error || !topic) {
    return (
      <div className="min-h-screen bg-organic-rice-paper flex items-center justify-center">
        <div className="organic-card p-8 rounded-[2rem_1.5rem_2.5rem_1rem] text-center max-w-md">
          <div className="w-14 h-14 rounded-xl bg-status-error/15 text-status-error flex items-center justify-center mx-auto mb-4 text-xl">
            <i className="fa-solid fa-exclamation-circle"></i>
          </div>
          <h2 className="text-xl font-heading font-bold text-loam mb-2">加载失败</h2>
          <p className="text-grass mb-6">{error || '课题不存在'}</p>
          <button onClick={() => navigate('/projects')} className="organic-btn organic-btn--primary">
            <i className="fa-solid fa-arrow-left mr-2"></i>返回列表
          </button>
        </div>
      </div>
    );
  }

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
          title="课题详情"
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <div className="flex space-x-2">
              <button onClick={handleEdit} className="organic-btn organic-btn--outline text-sm">
                <i className="fa-solid fa-edit mr-2"></i>编辑
              </button>
              <button onClick={handleDelete} className="organic-btn organic-btn--danger text-sm">
                <i className="fa-solid fa-trash mr-2"></i>删除
              </button>
              <button onClick={() => navigate('/projects')} className="organic-btn organic-btn--ghost text-sm">
                <i className="fa-solid fa-arrow-left mr-2"></i>返回列表
              </button>
            </div>
          }
        />

        <main className="container mx-auto px-6 py-6">
          <div className="organic-card p-6 mb-6 rounded-[2rem_1rem_2.5rem_1.5rem]">
            <h1 className="text-2xl font-heading font-bold text-loam mb-4">{topic.title}</h1>

            <div className="prose prose-sm max-w-none mb-6">
              <p className="text-grass">
                {topic.description || '无描述'}
              </p>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-grass">
              <div className="flex items-center">
                <i className="fa-solid fa-calendar mr-1"></i>
                <span>创建时间: {new Date(topic.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex items-center">
                <i className="fa-solid fa-history mr-1"></i>
                <span>更新时间: {new Date(topic.updatedAt).toLocaleString()}</span>
              </div>
              <div className="flex items-center">
                <i className="fa-solid fa-file-alt mr-1"></i>
                <span>实验记录: {relatedRecords.length}</span>
              </div>
              <div className="flex items-center">
                <i className="fa-solid fa-file-pdf mr-1"></i>
                <span>SOP文档: {relatedSOPs.length}</span>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/chat" className="organic-btn organic-btn--primary text-sm">
                  <i className="fa-solid fa-robot mr-2"></i>
                  <span>AI助手</span>
                </Link>
                <Link to={`/topics/${topic.id}/mindmap`} className="organic-btn organic-btn--secondary text-sm">
                  <i className="fa-solid fa-project-diagram mr-2"></i>
                  <span>思维导图</span>
                </Link>
              </div>
            </div>
          </div>

          {/* 关联的实验记录 */}
          <section className="mb-10">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-heading font-bold text-loam">
                关联实验记录
                <span className="ml-2 text-sm font-normal text-grass">
                  ({relatedRecords.length})
                </span>
              </h2>
              <Link to="/records/new" className="organic-btn organic-btn--outline text-sm">
                <i className="fa-solid fa-plus mr-1"></i>添加记录
              </Link>
            </div>

            {relatedRecords.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedRecords.map(record => (
                  <RecordCard key={record.id} record={record} />
                ))}
              </div>
            ) : (
              <div className="organic-card p-6 text-center rounded-[1.5rem_2rem_1rem_2.5rem]">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-moss/15 mb-4">
                  <i className="fa-solid fa-file-text text-moss"></i>
                </div>
                <h3 className="text-lg font-heading font-medium text-loam mb-2">暂无关联实验记录</h3>
                <p className="text-grass mb-4">
                  此课题下还没有关联的实验记录
                </p>
                <Link to="/records/new" className="organic-btn organic-btn--secondary">
                  <i className="fa-solid fa-plus mr-2"></i>{' '}
                  创建实验记录
                </Link>
              </div>
            )}
          </section>

          {/* 关联的SOP */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-heading font-bold text-loam">
                关联SOP文档
                <span className="ml-2 text-sm font-normal text-grass">
                  ({relatedSOPs.length})
                </span>
              </h2>
              <Link to="/sops/new" className="organic-btn organic-btn--outline text-sm">
                <i className="fa-solid fa-plus mr-1"></i>添加SOP
              </Link>
            </div>

            {relatedSOPs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedSOPs.map(sop => (
                  <SOPCard key={sop.id} sop={sop} />
                ))}
              </div>
            ) : (
              <div className="organic-card p-6 text-center rounded-[2rem_1.5rem_1rem_2.5rem]">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-terracotta/15 mb-4">
                  <i className="fa-solid fa-file-pdf text-terracotta"></i>
                </div>
                <h3 className="text-lg font-heading font-medium text-loam mb-2">暂无关联SOP文档</h3>
                <p className="text-grass mb-4">
                  此课题下还没有关联的SOP文档
                </p>
                <Link to="/sops/new" className="organic-btn organic-btn--secondary">
                  <i className="fa-solid fa-plus mr-2"></i>创建SOP文档
                </Link>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}