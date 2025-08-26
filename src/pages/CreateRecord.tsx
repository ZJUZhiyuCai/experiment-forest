import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/Button';
import { ExperimentRecordForm } from '@/components/ExperimentRecordForm';
import { ExperimentRecord } from '@/types';
import { experimentRecordService } from '@/lib/cachedStorage';


export default function CreateRecord() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [record, setRecord] = useState<ExperimentRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  
  // 检测是否为编辑模式
  const isEditMode = Boolean(id);
  
  // 加载现有记录（如果是编辑模式）
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
  
  // 从URL获取日期参数
  const getInitialDate = () => {
    const params = new URLSearchParams(location.search);
    const dateParam = params.get('date');
    return dateParam || new Date().toISOString().split('T')[0];
  };
  
  const handleSubmit = () => {
    // 这里只是处理表单提交成功后的逻辑
    // 实际的保存逻辑在ExperimentRecordForm中处理
    setIsSubmitting(false);
    // 延迟导航以确保用户看到成功提示和动画
    setTimeout(() => {
      navigate('/records');
    }, 3000); // 增加到3秒，让用户有充足时间看到成功动画
  };
  
  const handleCancel = () => {
    navigate('/records');
  };
  
  // 加载中状态
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
  
  // 错误状态
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
            <i className="fa-solid fa-exclamation-circle mr-2"></i>错误
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{error}</p>
          <Button onClick={handleCancel}>
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
          title={isEditMode ? '编辑实验记录' : '创建实验记录'} 
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <Button 
              onClick={() => navigate('/records')} 
              variant="outline"
              disabled={isSubmitting}
            >
              <i className="fa-solid fa-arrow-left mr-2"></i>
              <span>返回列表</span>
            </Button>
          }
        />
        
        <main className="container mx-auto px-4 py-6">
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