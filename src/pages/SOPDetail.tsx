import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sopService } from '@/lib/cachedStorage';
import { SOP } from '@/types';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { cn } from '@/lib/utils';

export default function SOPDetail() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sop, setSOP] = useState<SOP | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) {
      setError('SOP文档ID不存在');
      setLoading(false);
      return;
    }

    try {
      const foundSOP = sopService.getById(id);
      if (foundSOP) {
        setSOP(foundSOP);
      } else {
        setError('未找到该SOP文档');
      }
    } catch (err) {
      setError('加载SOP文档失败');
      console.error('Error loading SOP:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleEdit = () => {
    if (sop) {
      navigate(`/sops/edit/${sop.id}`);
    }
  };

  const handleBack = () => {
    navigate('/sops');
  };

  const getCategoryName = (categoryId: string) => {
    const categories = {
      'chemical': '化学实验',
      'biological': '生物实验',
      'equipment': '设备操作',
      'safety': '安全规范',
      'other': '其他'
    };
    return categories[categoryId as keyof typeof categories] || '未分类';
  };

  const getApprovalStatus = (status: string) => {
    switch (status) {
      case 'approved':
        return { class: 'bg-moss/15 text-moss', text: '已批准' };
      case 'pending':
        return { class: 'bg-sand/30 text-bark', text: '待审批' };
      case 'rejected':
        return { class: 'bg-status-error/15 text-status-error', text: '已拒绝' };
      default:
        return { class: 'bg-timber-soft text-grass', text: status };
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

  if (error || !sop) {
    return (
      <div className="min-h-screen bg-organic-rice-paper flex items-center justify-center">
        <div className="organic-card p-8 rounded-[2rem_1.5rem_2.5rem_1rem] text-center max-w-md">
          <div className="w-14 h-14 rounded-xl bg-status-error/15 text-status-error flex items-center justify-center mx-auto mb-4 text-xl">
            <i className="fa-solid fa-exclamation-circle"></i>
          </div>
          <h2 className="text-xl font-heading font-bold text-loam mb-2">加载失败</h2>
          <p className="text-grass mb-6">{error || 'SOP文档不存在'}</p>
          <button onClick={handleBack} className="organic-btn organic-btn--primary">
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
        <div className="organic-blob organic-blob--sand w-[300px] h-[300px] bottom-10 -left-20 opacity-10" />
      </div>

      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={cn('transition-all duration-500 relative z-10', sidebarCollapsed ? 'ml-16' : 'ml-64')}>
        <Header
          title="SOP文档详情"
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <div className="flex space-x-2">
              <button onClick={handleEdit} className="organic-btn organic-btn--outline text-sm">
                <i className="fa-solid fa-edit mr-2"></i>编辑
              </button>
              <button onClick={handleBack} className="organic-btn organic-btn--ghost text-sm">
                <i className="fa-solid fa-arrow-left mr-2"></i>返回
              </button>
            </div>
          }
        />

        <main className="container mx-auto px-6 py-6">
          <div className="organic-card p-6 rounded-[2rem_1rem_2.5rem_1.5rem]">
            <div className="flex flex-wrap justify-between items-start mb-6 gap-4">
              <div>
                <div className="flex items-center">
                  <h1 className="text-2xl font-heading font-bold text-loam mr-3">{sop.title}</h1>
                  <span className="text-sm bg-timber-soft text-grass px-2 py-0.5 rounded-full">
                    v{sop.version}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-grass">
                  <div className="flex items-center">
                    <i className="fa-solid fa-user mr-1"></i>
                    <span>{sop.author}</span>
                  </div>

                  {sop.department && (
                    <div className="flex items-center">
                      <i className="fa-solid fa-building mr-1"></i>
                      <span>{sop.department}</span>
                    </div>
                  )}

                  <div className="flex items-center">
                    <i className="fa-solid fa-folder mr-1"></i>
                    <span>{getCategoryName(sop.category)}</span>
                  </div>

                  <div className="flex items-center">
                    <i className="fa-solid fa-calendar-alt mr-1"></i>
                    <span>{new Date(sop.lastUpdated).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getApprovalStatus(sop.approvalStatus).class}`}>
                  {getApprovalStatus(sop.approvalStatus).text}
                </span>
              </div>
            </div>

            {sop.purpose && (
              <div className="mb-6">
                <h2 className="text-lg font-heading font-semibold text-loam mb-2">目的</h2>
                <div className="bg-timber-soft/50 p-4 rounded-xl">
                  <MarkdownRenderer content={sop.purpose} className="sop-purpose" />
                </div>
              </div>
            )}

            {sop.scope && (
              <div className="mb-6">
                <h2 className="text-lg font-heading font-semibold text-loam mb-2">适用范围</h2>
                <div className="bg-timber-soft/50 p-4 rounded-xl">
                  <MarkdownRenderer content={sop.scope} className="sop-scope" />
                </div>
              </div>
            )}

            <div className="mb-6">
              <h2 className="text-lg font-heading font-semibold text-loam mb-3">操作流程</h2>
              <div className="bg-timber-soft/50 p-4 rounded-xl">
                <MarkdownRenderer
                  content={sop.content}
                  className="sop-procedure"
                  tableCaption={"操作步骤"}
                />
              </div>

              <div className="mt-2 text-xs text-grass flex items-center">
                <i className="fa-solid fa-lightbulb mr-1 text-sand"></i>
                <span>提示: 支持 LaTeX 数学公式 (使用 $...$ 或 $$...$$) 和代码高亮功能</span>
              </div>
            </div>

            {sop.references && (
              <div className="mb-6">
                <h2 className="text-lg font-heading font-semibold text-loam mb-2">参考资料</h2>
                <div className="bg-timber-soft/50 p-4 rounded-xl">
                  <MarkdownRenderer content={sop.references} className="sop-references" />
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
