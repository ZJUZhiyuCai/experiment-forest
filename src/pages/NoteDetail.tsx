import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { experimentNoteService, experimentRecordService } from '@/lib/cachedStorage';
import { ExperimentNote, ExperimentRecord } from '@/types';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/Button';

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
        
        // 如果有关联的实验记录，获取该记录
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
            <i className="fa-solid fa-exclamation-circle mr-2"></i>错误
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{error || '实验笔记不存在'}</p>
          <Button onClick={handleBack}>
            <i className="fa-solid fa-arrow-left mr-2"></i>返回列表
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header 
          title="实验笔记详情" 
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <div className="flex space-x-2">
              <Button onClick={handleEdit} variant="outline">
                <i className="fa-solid fa-edit mr-2"></i>编辑
              </Button>
              <Button onClick={handleBack}>
                <i className="fa-solid fa-arrow-left mr-2"></i>返回
              </Button>
            </div>
          }
        />
        
        <main className="container mx-auto px-4 py-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300 hover:shadow-md">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">{note.title}</h1>
            
            {relatedRecord && (
              <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                <div className="flex items-center text-sm">
                  <i className="fa-solid fa-link text-blue-600 dark:text-blue-400 mr-2"></i>
                  <span className="text-gray-700 dark:text-gray-300 mr-2">关联实验记录:</span>
                  <a 
                    href={`/records/${relatedRecord.id}`} 
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {relatedRecord.title}
                  </a>
                </div>
              </div>
            )}
            
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">笔记内容</h2>
              <div className="prose prose-sm dark:prose-invert max-w-none bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                {note.content.split('\n').map((paragraph, index) => (
                  <p key={index} className="mb-4 text-gray-700 dark:text-gray-300">{paragraph}</p>
                ))}
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 flex justify-between">
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
