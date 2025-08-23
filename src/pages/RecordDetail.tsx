import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { experimentRecordService } from '@/lib/cachedStorage';
import { ExperimentRecord } from '@/types';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/Button';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';

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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
            <i className="fa-solid fa-exclamation-circle mr-2"></i>错误
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{error || '实验记录不存在'}</p>
          <Button onClick={handleBack}>
            <i className="fa-solid fa-arrow-left mr-2"></i>返回列表
          </Button>
        </div>
      </div>
    );
  }

  // 格式化日期
  const formatDate = (date: Date | string): string => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      // 检查日期是否有效
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header 
          title="实验记录详情" 
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
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">{record.title}</h1>
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <span className="mr-4">
                    <i className="fa-solid fa-calendar mr-1"></i>
                    {formatDate(record.date)}
                  </span>
                   <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                     record.status === 'draft' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                     record.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                     'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                   } mr-2`}>
                     {record.status === 'draft' ? '草稿' : record.status === 'completed' ? '已完成' : '已归档'}
                   </span>
                   <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                     record.category === 'cell' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                     record.category === 'animal' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                     record.category === 'chemical' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                     record.category === 'microbiology' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                     'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                   }`}>
                     {record.category === 'cell' ? '细胞实验' :
                      record.category === 'animal' ? '动物实验' :
                      record.category === 'chemical' ? '化学实验' :
                      record.category === 'microbiology' ? '微生物实验' : '其他实验'}
                   </span>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">实验内容</h2>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <MarkdownRenderer content={record.content} />
              </div>
            </div>
            
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">标签</h2>
              <div className="flex flex-wrap gap-2">
                {record.tags.map((tag, index) => (
                  <span 
                    key={index}
                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
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
