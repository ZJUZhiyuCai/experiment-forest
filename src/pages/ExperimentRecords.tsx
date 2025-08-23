import { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { experimentRecordService, projectService } from '@/lib/cachedStorage';
import { ExperimentRecord, Project, ExperimentCategory } from '@/types';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { ExperimentRecordForm } from '@/components/ExperimentRecordForm';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { 
  getExperimentCategoriesByGroup, 
  getExperimentCategoryDisplayName 
} from '@/utils/dataStandardization';

export default function ExperimentRecords() {
  const { id: routeProjectId } = useParams<{ id: string }>();
  const location = useLocation();
  
  // 从URL查询参数或路由参数获取projectId
  const getProjectId = () => {
    const searchParams = new URLSearchParams(location.search);
    const queryProjectId = searchParams.get('project');
    return queryProjectId || routeProjectId;
  };
  
  const projectId = getProjectId();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [records, setRecords] = useState<ExperimentRecord[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<ExperimentRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // 获取实验类型分组
  const experimentCategories = getExperimentCategoriesByGroup();
  
  useEffect(() => {
    setLoading(true);
    try {
      const allRecords = experimentRecordService.getAll();
      
      if (projectId) {
        // 如果在课题上下文中，只显示该课题的记录
        const projectRecords = allRecords.filter(record => record.projectId === projectId);
        setRecords(projectRecords);
        
        // 获取课题信息
        const projectData = projectService.getById(projectId);
        setProject(projectData);
      } else {
        // 显示所有记录
        setRecords(allRecords);
      }
    } catch (error) {
      console.error('获取实验记录失败:', error);
      toast.error('获取实验记录失败');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, location.search]);
  
  // 过滤记录
  const filteredRecords = records.filter(record => {
    const matchesSearch = 
      record.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      record.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    
    const matchesCategory = categoryFilter === 'all' || record.category === categoryFilter;
    
    const matchesDate = (() => {
      if (dateFilter === 'all') return true;
      const recordDate = new Date(record.date);
      const today = new Date();
      
      switch (dateFilter) {
        case 'today':
          return recordDate.toDateString() === today.toDateString();
        case 'week':
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          return recordDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          return recordDate >= monthAgo;
        default:
          return true;
      }
    })();
    
    return matchesSearch && matchesStatus && matchesCategory && matchesDate;
  });
  
  // 打开创建表单
  const openCreateForm = () => {
    setCurrentRecord(null);
    setIsFormOpen(true);
  };
  
  // 打开编辑表单
  const openEditForm = (record: ExperimentRecord) => {
    setCurrentRecord(record);
    setIsFormOpen(true);
  };
  
  // 关闭表单
  const closeForm = () => {
    setIsFormOpen(false);
    setCurrentRecord(null);
    setIsSubmitting(false);
  };
  
  // 选择/取消选择记录
  const toggleRecordSelection = (recordId: string) => {
    const newSelected = new Set(selectedRecords);
    if (newSelected.has(recordId)) {
      newSelected.delete(recordId);
    } else {
      newSelected.add(recordId);
    }
    setSelectedRecords(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };
  
  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedRecords.size === filteredRecords.length) {
      setSelectedRecords(new Set());
      setShowBulkActions(false);
    } else {
      const allIds = new Set(filteredRecords.map(record => record.id));
      setSelectedRecords(allIds);
      setShowBulkActions(true);
    }
  };
  
  // 批量删除
  const bulkDelete = () => {
    if (window.confirm(`确定要删除选中的 ${selectedRecords.size} 条记录吗？此操作不可撤销。`)) {
      try {
        selectedRecords.forEach(recordId => {
          experimentRecordService.delete(recordId);
        });
        
        const updatedRecords = experimentRecordService.getAll();
        if (projectId) {
          // 如果在课题上下文中，只显示该课题的记录
          const projectRecords = updatedRecords.filter(record => record.projectId === projectId);
          setRecords(projectRecords);
        } else {
          setRecords(updatedRecords);
        }
        setSelectedRecords(new Set());
        setShowBulkActions(false);
        toast.success(`已删除 ${selectedRecords.size} 条记录`);
      } catch (error) {
        toast.error('批量删除失败，请重试');
      }
    }
  };
  
  // 删除记录
  const handleDelete = (id: string) => {
    if (window.confirm('确定要删除这条实验记录吗？此操作不可撤销。')) {
      try {
        const success = experimentRecordService.delete(id);
        if (success) {
          const updatedRecords = experimentRecordService.getAll();
          if (projectId) {
            // 如果在课题上下文中，只显示该课题的记录
            const projectRecords = updatedRecords.filter(record => record.projectId === projectId);
            setRecords(projectRecords);
          } else {
            setRecords(updatedRecords);
          }
          toast.success('实验记录已删除');
        } else {
          toast.error('删除失败，请重试');
        }
      } catch (error) {
        toast.error('删除失败，请重试');
      }
    }
  };
  
  return (
    <div className="min-h-screen bg-[#F9F6F2] text-[#555555]">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header 
          title={projectId && project ? `${project.title} - 实验记录` : '实验记录'}
          sidebarCollapsed={sidebarCollapsed}
          breadcrumb={projectId && project ? [
            { label: '课题管理', href: '/projects' },
            { label: project.title, href: `/projects/${projectId}` },
            { label: '实验记录' }
          ] : undefined}
          actions={
            <button 
              onClick={openCreateForm}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors duration-300"
            >
              <i className="fa-solid fa-plus mr-2"></i>
              新建记录
            </button>
          }
        />
        
        <main className="container mx-auto px-4 py-6">
          {/* 创建/编辑表单 */}
          <AnimatePresence>
            {isFormOpen && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-6"
              >
                <ExperimentRecordForm
                  record={currentRecord}
                  projectId={projectId}
                  onSubmit={(record) => {
                    if (currentRecord) {
                      setRecords(records.map(r => r.id === currentRecord.id ? record : r));
                    } else {
                      setRecords([...records, record]);
                    }
                    closeForm();
                  }}
                  onCancel={closeForm}
                  isSubmitting={isSubmitting}
                />
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* 高级筛选区域 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">搜索实验记录</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="搜索标题、内容或标签..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <i className="fa-solid fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">实验类型</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">所有类型</option>
                  {Object.entries(experimentCategories).map(([group, categories]) => (
                    <optgroup key={group} label={group}>
                      {categories.map(({ category, name }) => (
                        <option key={category} value={category}>{name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">状态筛选</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">所有状态</option>
                  <option value="draft">草稿</option>
                  <option value="completed">已完成</option>
                  <option value="archived">已归档</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">日期筛选</label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">所有日期</option>
                  <option value="today">今天</option>
                  <option value="week">近一周</option>
                  <option value="month">近一个月</option>
                </select>
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setDateFilter('all');
                    setCategoryFilter('all');
                  }}
                  className="w-full border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors"
                >
                  <i className="fa-solid fa-refresh mr-2"></i>
                  重置筛选
                </button>
              </div>
            </div>
          </div>
          
          {/* 批量操作栏 */}
          <AnimatePresence>
            {showBulkActions && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6"
              >
                <div className="flex justify-between items-center">
                  <span className="text-blue-700 font-medium">
                    已选中 {selectedRecords.size} 条记录
                  </span>
                  <div className="flex space-x-3">
                    <button
                      onClick={bulkDelete}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      <i className="fa-solid fa-trash mr-2"></i>
                      批量删除
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRecords(new Set());
                        setShowBulkActions(false);
                      }}
                      className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors"
                    >
                      取消选择
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* 记录列表 */}
          {loading ? (
            <div>
              <div className="mb-4 flex justify-between items-center">
                <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
                <div className="h-6 bg-gray-200 rounded w-16 animate-pulse"></div>
              </div>
              <LoadingSkeleton type="card" count={6} />
            </div>
          ) : (
            <>
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-800">
                  实验记录 ({filteredRecords.length})
                </h2>
                {filteredRecords.length > 0 && (
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedRecords.size === filteredRecords.length}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-gray-600">全选</span>
                  </label>
                )}
              </div>
          
          {filteredRecords.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-flask text-3xl text-gray-400"></i>
              </div>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                {searchQuery || statusFilter !== 'all' || dateFilter !== 'all' || categoryFilter !== 'all' ? '未找到相关记录' : '还没有实验记录'}
              </h3>
              <p className="text-gray-500 mb-6">
                {searchQuery || statusFilter !== 'all' || dateFilter !== 'all' || categoryFilter !== 'all' ? '请尝试修改筛选条件' : '开始您的第一个实验记录吧！'}
              </p>
              {!(searchQuery || statusFilter !== 'all' || dateFilter !== 'all' || categoryFilter !== 'all') && (
                <button 
                  onClick={openCreateForm}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-300"
                >
                  <i className="fa-solid fa-plus mr-2"></i>
                  创建第一个记录
                </button>
              )}
            </div>
          ) : (
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {filteredRecords.map((record, index) => (
                <motion.div 
                  key={record.id} 
                  className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 relative"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  {/* 复选框 */}
                  <div className="absolute top-4 left-4">
                    <input
                      type="checkbox"
                      checked={selectedRecords.has(record.id)}
                      onChange={() => toggleRecordSelection(record.id)}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </div>
                  
                  <div className="ml-8">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-800 mb-2">{record.title}</h3>
                        <p className="text-sm text-gray-500 mb-2">
                          <i className="fa-solid fa-calendar mr-1"></i>
                          {new Date(record.date).toLocaleDateString('zh-CN')}
                        </p>
                        {record.projectId && (() => {
                          const relatedProject = projectService.getById(record.projectId);
                          return relatedProject ? (
                            <p className="text-xs text-blue-600 mb-2">
                              <i className="fa-solid fa-project-diagram mr-1"></i>
                              所属课题：{relatedProject.title}
                            </p>
                          ) : null;
                        })()}
                        <span className={`inline-block px-2 py-1 text-xs rounded-full mr-2 ${
                          record.status === 'completed' ? 'bg-green-100 text-green-600' :
                          record.status === 'draft' ? 'bg-yellow-100 text-yellow-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {record.status === 'completed' ? '已完成' :
                           record.status === 'draft' ? '草稿' : '已归档'}
                        </span>
                        <span className="inline-block px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-600">
                          <i className="fa-solid fa-microscope mr-1"></i>
                          {getExperimentCategoryDisplayName(record.category as ExperimentCategory)}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {record.content.substring(0, 100)}{record.content.length > 100 ? '...' : ''}
                    </p>
                    
                    {record.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {record.tags.slice(0, 3).map((tag, index) => (
                          <span key={index} className="bg-blue-100 text-blue-600 px-2 py-1 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                        {record.tags.length > 3 && (
                          <span className="text-gray-500 text-xs">+{record.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center">
                      <Link 
                        to={`/records/${record.id}`}
                        className="text-emerald-600 hover:text-emerald-700 font-medium text-sm transition-colors"
                      >
                        查看详情
                      </Link>
                      
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => openEditForm(record)}
                          className="text-blue-600 hover:text-blue-700 text-sm transition-colors"
                          title="编辑"
                        >
                          <i className="fa-solid fa-edit"></i>
                        </button>
                        <button 
                          onClick={() => handleDelete(record.id)}
                          className="text-red-600 hover:text-red-700 text-sm transition-colors"
                          title="删除"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </>
      )}
        </main>
      </div>
    </div>
  );
}