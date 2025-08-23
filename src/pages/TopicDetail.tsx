import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { topicService, experimentRecordService, sopService } from '@/lib/cachedStorage';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/Button';
import { RecordCard } from '@/components/RecordCard';
import { SOPCard } from '@/components/SOPCard';

export default function TopicDetail() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [relatedRecords, setRelatedRecords] = useState([]);
  const [relatedSOPs, setRelatedSOPs] = useState([]);
  const { id } = useParams();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!id) {
      setError('课题ID不存在');
      setLoading(false);
      return;
    }
    
    try {
      // 获取课题详情
      const foundTopic = topicService.getById(id);
      if (foundTopic) {
        setTopic(foundTopic);
        
        // 获取关联的实验记录
        const allRecords = experimentRecordService.getAll();
        const records = allRecords.filter(record => record.topicId === id);
        setRelatedRecords(records);
        
        // 获取关联的SOP
        const allSOPs = sopService.getAll();
        const sops = allSOPs.filter(sop => sop.topicId === id);
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
      navigate(`/topics/edit/${topic.id}`);
    }
  };
  
  const handleDelete = () => {
    if (window.confirm('确定要删除这个课题吗？此操作不可撤销。')) {
      try {
        const success = topicService.delete(topic.id);
        if (success) {
          toast.success('课题已删除');
          navigate('/topics');
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }
  
  if (error || !topic) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
            <i className="fa-solid fa-exclamation-circle mr-2"></i>错误
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{error || '课题不存在'}</p>
          <Button onClick={() => navigate('/topics')}>
            <i className="fa-solid fa-arrow-left mr-2"></i>返回课题列表
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#F9F6F2] text-[#555555]">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header 
          title="课题详情" 
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <div className="flex space-x-2">
              <Button onClick={handleEdit} variant="outline">
                <i className="fa-solid fa-edit mr-2"></i>编辑
              </Button>
              <Button onClick={handleDelete} variant="danger">
                <i className="fa-solid fa-trash mr-2"></i>删除
              </Button>
              <Button onClick={() => navigate('/topics')}>
                <i className="fa-solid fa-arrow-left mr-2"></i>返回列表
              </Button>
            </div>
          }
        />
        
        <main className="container mx-auto px-4 py-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6 transition-all duration-300 hover:shadow-md">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">{topic.title}</h1>
            
            <div className="prose prose-sm dark:prose-invert max-w-none mb-6">
              <p className="text-gray-700 dark:text-gray-300">
                {topic.description || '无描述'}
              </p>
            </div>
            
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
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
                <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <Link to={`/topics/${topic.id}/ai`}>
                    <i className="fa-solid fa-lightbulb mr-2"></i>
                    <span>AI课题助手</span>
                  </Link>
                </Button>
              </div>
           </div>
          </div>
          
          {/* 关联的实验记录 */}
          <section className="mb-10">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                关联实验记录
                <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                  ({relatedRecords.length})
                </span>
              </h2>
              <Button asChild variant="outline" size="sm">
                <Link to="/records/new">
                  <i className="fa-solid fa-plus mr-1"></i>添加记录
                </Link>
              </Button>
            </div>
            
            {relatedRecords.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedRecords.map(record => (
                  <RecordCard key={record.id} record={record} />
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                  <i className="fa-solid fa-file-text text-gray-400"></i>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">暂无关联实验记录</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  此课题下还没有关联的实验记录
                </p>
                <Button asChild>
                  <Link to="/records/new">
                    <i className="fa-solid fa-plus mr-2"></i>{' '}
                    创建实验记录
                  </Link>
                </Button>
              </div>
            )}
          </section>
          
          {/* 关联的SOP */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                关联SOP文档
                <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                  ({relatedSOPs.length})
                </span>
              </h2>
              <Button asChild variant="outline" size="sm">
                <Link to="/sops/new">
                  <i className="fa-solid fa-plus mr-1"></i>添加SOP
                </Link>
              </Button>
            </div>
            
            {relatedSOPs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedSOPs.map(sop => (
                  <SOPCard key={sop.id} sop={sop} />
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                  <i className="fa-solid fa-file-pdf text-gray-\400"></i>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">暂无关联SOP文档</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  此课题下还没有关联的SOP文档
                </p>
                <Button asChild>
                  <Link to="/sops/new">
                    <i className="fa-solid fa-plus mr-2"></i>创建SOP文档
                  </Link>
                </Button>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}