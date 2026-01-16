import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { ExperimentRecordForm } from '@/components/ExperimentRecordForm';
import { ExperimentRecord } from '@/types';
import { experimentRecordService } from '@/lib/cachedStorage';
import { cn } from '@/lib/utils';


export default function CreateRecord() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [record, setRecord] = useState<ExperimentRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();

  const isEditMode = Boolean(id);

  useEffect(() => {
    if (isEditMode && id) {
      setLoading(true);
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
    }
  }, [id, isEditMode]);

  const getInitialDate = () => {
    const params = new URLSearchParams(location.search);
    const dateParam = params.get('date');
    return dateParam || new Date().toISOString().split('T')[0];
  };

  const handleSubmit = () => {
    setIsSubmitting(false);
    setTimeout(() => {
      navigate('/projects');
    }, 3000);
  };

  const handleCancel = () => {
    navigate('/projects');
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

  if (error) {
    return (
      <div className="min-h-screen bg-organic-rice-paper flex items-center justify-center">
        <div className="organic-card p-8 rounded-[2rem_1.5rem_2.5rem_1rem] text-center max-w-md">
          <div className="w-14 h-14 rounded-xl bg-status-error/15 text-status-error flex items-center justify-center mx-auto mb-4 text-xl">
            <i className="fa-solid fa-exclamation-circle"></i>
          </div>
          <h2 className="text-xl font-heading font-bold text-loam mb-2">加载失败</h2>
          <p className="text-grass mb-6">{error}</p>
          <button onClick={handleCancel} className="organic-btn organic-btn--primary">
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
          title={isEditMode ? '编辑实验记录' : '创建实验记录'}
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <button
              onClick={() => navigate('/projects')}
              disabled={isSubmitting}
              className="organic-btn organic-btn--ghost text-sm"
            >
              <i className="fa-solid fa-arrow-left mr-2"></i>
              <span>返回列表</span>
            </button>
          }
        />

        <main className="container mx-auto px-6 py-6">
          <ExperimentRecordForm
            record={isEditMode ? record : null}
            defaultDate={getInitialDate()}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
            className="max-w-3xl mx-auto"
          />
        </main>
      </div>
    </div>
  );
}