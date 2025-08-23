import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sopService } from '@/lib/cachedStorage';
import { SOP } from '@/types';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/Button';

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

  // 获取分类显示名称
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

  // 获取审批状态样式和文本
  const getApprovalStatus = (status: string) => {
    switch(status) {
      case 'approved':
        return { class: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', text: '已批准' };
      case 'pending':
        return { class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', text: '待审批' };
      case 'rejected':
        return { class: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', text: '已拒绝' };
      default:
        return { class: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', text: status };
    }
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

  if (error || !sop) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
            <i className="fa-solid fa-exclamation-circle mr-2"></i>错误
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{error || 'SOP文档不存在'}</p>
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
          title="SOP文档详情" 
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
            <div className="flex flex-wrap justify-between items-start mb-6 gap-4">
              <div>
                <div className="flex items-center">
                  <h1 className="text-2xl font-bold text-gray-800 dark:text-white mr-3">{sop.title}</h1>
                  <span className="text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                    v{sop.version}
                  </span>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-600 dark:text-gray-400">
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
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">目的</h2>
                <div className="prose prose-sm dark:prose-invert max-w-none bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-gray-700 dark:text-gray-300">{sop.purpose}</p>
                </div>
              </div>
            )}
            
            {sop.scope && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">适用范围</h2>
                <div className="prose prose-sm dark:prose-invert max-w-none bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-gray-700 dark:text-gray-300">{sop.scope}</p>
                </div>
              </div>
            )}
            
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">操作流程</h2>
              <div className="prose prose-sm dark:prose-invert max-w-none bg-gray-50 dark:bg-gray-700 p-6 rounded-lg font-mono text-sm">
                {sop.content.split('\n').map((line, index) => {
                  // 保留空行
                  if (!line.trim()) return <p key={index}>&nbsp;</p>;
                  
                  // 为以数字开头的行添加列表样式
                  if (/^\d+\./.test(line)) {
                    return <p key={index} className="ml-6 mb-2 text-gray-700 dark:text-gray-300">{line}</p>;
                  }
                  
                  return <p key={index} className="mb-2 text-gray-700 dark:text-gray-300">{line}</p>;
                })}
              </div>
            </div>
            
            {sop.references && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">参考资料</h2>
                <div className="prose prose-sm dark:prose-invert max-w-none bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-gray-700 dark:text-gray-300">{sop.references}</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
