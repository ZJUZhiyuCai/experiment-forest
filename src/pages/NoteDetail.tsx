import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { experimentNoteService, experimentRecordService } from '@/lib/cachedStorage';
import { ExperimentNote, ExperimentRecord } from '@/types';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { cn } from '@/lib/utils';

export default function NoteDetail() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [note, setNote] = useState<ExperimentNote | null>(null);
  const [relatedRecord, setRelatedRecord] = useState<ExperimentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) {
      setError('笔记ID不存在');
      setLoading(false);
      return;
    }

    try {
      const foundNote = experimentNoteService.getById(id);
      if (foundNote) {
        setNote(foundNote);

        if (foundNote.relatedRecordId) {
          const record = experimentRecordService.getById(foundNote.relatedRecordId);
          setRelatedRecord(record);
        }
      } else {
        setError('未找到该实验笔记');
      }
    } catch (err) {
      setError('加载实验笔记失败');
      console.error('Error loading note:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleEdit = () => {
    if (note) {
      navigate(`/notes/edit/${note.id}`);
    }
  };

  const handleBack = () => {
    navigate('/notes');
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

  if (error || !note) {
    return (
      <div className="min-h-screen bg-organic-rice-paper flex items-center justify-center">
        <div className="organic-card p-8 rounded-[2rem_1.5rem_2.5rem_1rem] text-center max-w-md">
          <div className="w-14 h-14 rounded-xl bg-status-error/15 text-status-error flex items-center justify-center mx-auto mb-4 text-xl">
            <i className="fa-solid fa-exclamation-circle"></i>
          </div>
          <h2 className="text-xl font-heading font-bold text-loam mb-2">加载失败</h2>
          <p className="text-grass mb-6">{error || '实验笔记不存在'}</p>
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
        <div className="organic-blob organic-blob--terracotta w-[400px] h-[400px] -top-20 -right-20 opacity-15" />
        <div className="organic-blob organic-blob--sand w-[300px] h-[300px] bottom-10 -left-20 opacity-10" />
      </div>

      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={cn('transition-all duration-500 relative z-10', sidebarCollapsed ? 'ml-16' : 'ml-64')}>
        <Header
          title="实验笔记详情"
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
            <h1 className="text-2xl font-heading font-bold text-loam mb-2">{note.title}</h1>

            {relatedRecord && (
              <div className="mb-6 p-3 bg-moss/10 rounded-xl border border-moss/20">
                <div className="flex items-center text-sm">
                  <i className="fa-solid fa-link text-moss mr-2"></i>
                  <span className="text-grass mr-2">关联实验记录:</span>
                  <a
                    href={`/records/${relatedRecord.id}`}
                    className="text-moss hover:text-terracotta transition-colors"
                  >
                    {relatedRecord.title}
                  </a>
                </div>
              </div>
            )}

            <div className="mb-6">
              <h2 className="text-lg font-heading font-semibold text-loam mb-3">笔记内容</h2>
              <div className="bg-timber-soft/50 p-4 rounded-xl">
                <MarkdownRenderer content={note.content} />
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-timber-soft text-sm text-grass flex justify-between">
              <div>
                <p>创建时间: {new Date(note.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p>最后更新: {new Date(note.updatedAt).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
