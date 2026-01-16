import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { experimentRecordService } from '@/lib/cachedStorage';
import { ExperimentRecord } from '@/types';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { cn } from '@/lib/utils';

export default function RecordDetail() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [record, setRecord] = useState<ExperimentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) {
      setError('记录ID不存在');
      setLoading(false);
      return;
    }

    try {
      const foundRecord = experimentRecordService.getById(id);
      if (foundRecord) {
        setRecord(foundRecord);
      } else {
        setError('未找到该实验记录');
      }
    } catch (err) {
      setError('加载实验记录失败');
      console.error('Error loading record:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleEdit = () => {
    if (record) {
      navigate(`/records/edit/${record.id}`);
    }
  };

  const handleBack = () => {
    navigate('/records');
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

  if (error || !record) {
    return (
      <div className="min-h-screen bg-organic-rice-paper flex items-center justify-center">
        <div className="organic-card p-8 rounded-[2rem_1.5rem_2.5rem_1rem] text-center max-w-md">
          <div className="w-14 h-14 rounded-xl bg-status-error/15 text-status-error flex items-center justify-center mx-auto mb-4 text-xl">
            <i className="fa-solid fa-exclamation-circle"></i>
          </div>
          <h2 className="text-xl font-heading font-bold text-loam mb-2">加载失败</h2>
          <p className="text-grass mb-6">{error || '实验记录不存在'}</p>
          <button onClick={handleBack} className="organic-btn organic-btn--primary">
            <i className="fa-solid fa-arrow-left mr-2"></i>返回列表
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (date: Date | string): string => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) {
        return '无效日期';
      }
      return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(dateObj);
    } catch (error) {
      console.error('格式化日期失败:', error);
      return '无效日期';
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
          title="实验记录详情"
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
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-2xl font-heading font-bold text-loam mb-2">{record.title}</h1>
                <div className="flex items-center text-sm text-grass flex-wrap gap-2">
                  <span className="mr-2">
                    <i className="fa-solid fa-calendar mr-1"></i>
                    {formatDate(record.date)}
                  </span>
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    record.status === 'draft' ? 'bg-sand/30 text-bark' :
                      record.status === 'completed' ? 'bg-moss/15 text-moss' :
                        'bg-timber-soft text-grass'
                  )}>
                    {record.status === 'draft' ? '草稿' : record.status === 'completed' ? '已完成' : '已归档'}
                  </span>
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    record.category === 'cell_culture' ? 'bg-moss/15 text-moss' :
                      record.category === 'animal_dosing' ? 'bg-terracotta/15 text-terracotta' :
                        record.category === 'compound_synthesis' ? 'bg-sand/30 text-bark' :
                          record.category === 'bacterial_culture' ? 'bg-moss/15 text-moss' :
                            'bg-timber-soft text-grass'
                  )}>
                    {record.category === 'cell_culture' ? '细胞培养' :
                      record.category === 'animal_dosing' ? '动物给药' :
                        record.category === 'compound_synthesis' ? '化合物合成' :
                          record.category === 'bacterial_culture' ? '细菌培养' : '其他实验'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-heading font-semibold text-loam mb-3">实验内容</h2>
              <div className="bg-timber-soft/50 p-4 rounded-xl">
                <MarkdownRenderer
                  content={record.content}
                  className="experimental-data-display"
                  tableCaption={"实验数据表"}
                />
              </div>

              <div className="mt-2 text-xs text-grass flex items-center">
                <i className="fa-solid fa-lightbulb mr-1 text-sand"></i>
                <span>提示: 支持 LaTeX 数学公式 (使用 $...$ 或 $$...$$) 和代码高亮功能</span>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-heading font-semibold text-loam mb-3">标签</h2>
              <div className="flex flex-wrap gap-2">
                {record.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-moss/15 text-moss text-sm rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-timber-soft text-sm text-grass">
              <div className="flex justify-between">
                <div>
                  <p>创建时间: {formatDate(record.createdAt)}</p>
                </div>
                <div>
                  <p>最后更新: {formatDate(record.updatedAt)}</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
