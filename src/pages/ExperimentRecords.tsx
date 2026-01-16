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
import { cn } from '@/lib/utils';
import {
  getExperimentCategoriesByGroup,
  getExperimentCategoryDisplayName
} from '@/utils/dataStandardization';

// 不对称圆角变体
const cardRadiusVariants = [
  'rounded-[2rem_1rem_2.5rem_1.5rem]',
  'rounded-[1.5rem_2.5rem_1rem_2rem]',
  'rounded-[2.5rem_1.5rem_2rem_1rem]',
  'rounded-[1rem_2rem_1.5rem_2.5rem]',
  'rounded-[2rem_2.5rem_1.5rem_1rem]',
  'rounded-[1.5rem_1rem_2rem_2.5rem]',
];

export default function ExperimentRecords() {
  const { id: routeProjectId } = useParams<{ id: string }>();
  const location = useLocation();

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

  const experimentCategories = getExperimentCategoriesByGroup();

  useEffect(() => {
    setLoading(true);
    try {
      const allRecords = experimentRecordService.getAll();
      if (projectId) {
        const projectRecords = allRecords.filter(record => record.projectId === projectId);
        setRecords(projectRecords);
        const projectData = projectService.getById(projectId);
        setProject(projectData);
      } else {
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
        case 'today': return recordDate.toDateString() === today.toDateString();
        case 'week': return recordDate >= new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        case 'month': return recordDate >= new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        default: return true;
      }
    })();
    return matchesSearch && matchesStatus && matchesCategory && matchesDate;
  });

  const openCreateForm = () => { setCurrentRecord(null); setIsFormOpen(true); };
  const openEditForm = (record: ExperimentRecord) => { setCurrentRecord(record); setIsFormOpen(true); };
  const closeForm = () => { setIsFormOpen(false); setCurrentRecord(null); setIsSubmitting(false); };

  const toggleRecordSelection = (recordId: string) => {
    const newSelected = new Set(selectedRecords);
    if (newSelected.has(recordId)) { newSelected.delete(recordId); }
    else { newSelected.add(recordId); }
    setSelectedRecords(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  const toggleSelectAll = () => {
    if (selectedRecords.size === filteredRecords.length) {
      setSelectedRecords(new Set());
      setShowBulkActions(false);
    } else {
      setSelectedRecords(new Set(filteredRecords.map(r => r.id)));
      setShowBulkActions(true);
    }
  };

  const bulkDelete = () => {
    if (window.confirm(`确定要删除选中的 ${selectedRecords.size} 条记录吗？`)) {
      try {
        selectedRecords.forEach(id => experimentRecordService.delete(id));
        const updated = experimentRecordService.getAll();
        setRecords(projectId ? updated.filter(r => r.projectId === projectId) : updated);
        setSelectedRecords(new Set());
        setShowBulkActions(false);
        toast.success(`已删除 ${selectedRecords.size} 条记录`);
      } catch { toast.error('批量删除失败'); }
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('确定要删除这条实验记录吗？')) {
      try {
        if (experimentRecordService.delete(id)) {
          const updated = experimentRecordService.getAll();
          setRecords(projectId ? updated.filter(r => r.projectId === projectId) : updated);
          toast.success('实验记录已删除');
        }
      } catch { toast.error('删除失败'); }
    }
  };

  return (
    <div className="min-h-screen bg-organic-rice-paper text-loam">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={cn('transition-all duration-500', sidebarCollapsed ? 'ml-16' : 'ml-64')}>
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
              className="organic-btn organic-btn--primary text-sm px-5 py-2.5"
            >
              <i className="fa-solid fa-plus mr-2"></i>
              新建记录
            </button>
          }
        />

        <main className="container mx-auto px-6 py-8 relative">
          {/* 环境 Blob 背景 */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="organic-blob organic-blob--moss w-[400px] h-[400px] -top-20 -right-20 opacity-20" />
            <div className="organic-blob organic-blob--sand w-[300px] h-[300px] bottom-20 -left-20 opacity-15" />
          </div>

          {/* 创建/编辑表单 */}
          <AnimatePresence>
            {isFormOpen && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-8 relative z-10"
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

          {/* 筛选区域 - 有机卡片风格 */}
          <motion.div
            className="organic-card p-6 mb-8 relative z-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* 搜索框 */}
              <div>
                <label className="block text-sm font-medium text-bark mb-2">搜索实验记录</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="搜索标题、内容或标签..."
                    className="organic-input pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-grass text-sm"></i>
                </div>
              </div>

              {/* 类型筛选 */}
              <div>
                <label className="block text-sm font-medium text-bark mb-2">实验类型</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="organic-input"
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

              {/* 状态筛选 */}
              <div>
                <label className="block text-sm font-medium text-bark mb-2">状态筛选</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="organic-input"
                >
                  <option value="all">所有状态</option>
                  <option value="draft">草稿</option>
                  <option value="completed">已完成</option>
                  <option value="archived">已归档</option>
                </select>
              </div>

              {/* 日期筛选 */}
              <div>
                <label className="block text-sm font-medium text-bark mb-2">日期筛选</label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="organic-input"
                >
                  <option value="all">所有日期</option>
                  <option value="today">今天</option>
                  <option value="week">近一周</option>
                  <option value="month">近一个月</option>
                </select>
              </div>

              {/* 重置按钮 */}
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setDateFilter('all');
                    setCategoryFilter('all');
                  }}
                  className="organic-btn organic-btn--outline w-full text-sm"
                >
                  <i className="fa-solid fa-refresh mr-2"></i>
                  重置筛选
                </button>
              </div>
            </div>
          </motion.div>

          {/* 批量操作栏 */}
          <AnimatePresence>
            {showBulkActions && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cn(
                  'organic-card p-4 mb-6 relative z-10',
                  'bg-gradient-to-r from-moss-soft/50 to-terracotta-light/30'
                )}
              >
                <div className="flex justify-between items-center">
                  <span className="text-moss font-semibold">
                    已选中 {selectedRecords.size} 条记录
                  </span>
                  <div className="flex gap-3">
                    <button
                      onClick={bulkDelete}
                      className="px-4 py-2 rounded-full bg-status-error text-white text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      <i className="fa-solid fa-trash mr-2"></i>批量删除
                    </button>
                    <button
                      onClick={() => { setSelectedRecords(new Set()); setShowBulkActions(false); }}
                      className="organic-btn organic-btn--ghost text-sm"
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
            <div className="relative z-10">
              <LoadingSkeleton type="card" count={6} />
            </div>
          ) : (
            <div className="relative z-10">
              <div className="mb-6 flex justify-between items-center">
                <h2 className="text-xl font-heading font-bold text-loam">
                  实验记录 ({filteredRecords.length})
                </h2>
                {filteredRecords.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-bark hover:text-moss transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedRecords.size === filteredRecords.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-timber text-moss focus:ring-moss/30"
                    />
                    全选
                  </label>
                )}
              </div>

              {filteredRecords.length === 0 ? (
                <motion.div
                  className="organic-card p-12 text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="w-20 h-20 rounded-full bg-organic-stone flex items-center justify-center mx-auto mb-4">
                    <i className="fa-solid fa-flask text-3xl text-grass"></i>
                  </div>
                  <h3 className="text-xl font-heading font-semibold text-bark mb-2">
                    {searchQuery || statusFilter !== 'all' || dateFilter !== 'all' || categoryFilter !== 'all'
                      ? '未找到相关记录' : '还没有实验记录'}
                  </h3>
                  <p className="text-grass mb-6">
                    {searchQuery || statusFilter !== 'all' || dateFilter !== 'all' || categoryFilter !== 'all'
                      ? '请尝试修改筛选条件' : '开始您的第一个实验记录吧！'}
                  </p>
                  {!(searchQuery || statusFilter !== 'all' || dateFilter !== 'all' || categoryFilter !== 'all') && (
                    <button onClick={openCreateForm} className="organic-btn organic-btn--primary">
                      <i className="fa-solid fa-plus mr-2"></i>创建第一个记录
                    </button>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {filteredRecords.map((record, index) => (
                    <motion.div
                      key={record.id}
                      className={cn(
                        'organic-card p-6 relative group',
                        cardRadiusVariants[index % 6],
                        'hover:-translate-y-2 hover:shadow-float'
                      )}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.05 }}
                    >
                      {/* 复选框 */}
                      <div className="absolute top-5 left-5">
                        <input
                          type="checkbox"
                          checked={selectedRecords.has(record.id)}
                          onChange={() => toggleRecordSelection(record.id)}
                          className="w-4 h-4 rounded border-timber text-moss focus:ring-moss/30"
                        />
                      </div>

                      <div className="ml-8">
                        {/* 标题和日期 */}
                        <div className="mb-4">
                          <h3 className="text-lg font-heading font-bold text-loam mb-2 group-hover:text-moss transition-colors line-clamp-1">
                            {record.title}
                          </h3>
                          <p className="text-sm text-grass flex items-center gap-1">
                            <i className="fa-solid fa-calendar text-xs"></i>
                            {new Date(record.date).toLocaleDateString('zh-CN')}
                          </p>
                          {record.projectId && (() => {
                            const relatedProject = projectService.getById(record.projectId);
                            return relatedProject ? (
                              <p className="text-xs text-terracotta mt-1">
                                <i className="fa-solid fa-folder mr-1"></i>
                                {relatedProject.title}
                              </p>
                            ) : null;
                          })()}
                        </div>

                        {/* 状态和类型标签 */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          <span className={cn(
                            'px-3 py-1 text-xs font-medium rounded-full',
                            record.status === 'completed' ? 'bg-status-success/15 text-status-success' :
                              record.status === 'draft' ? 'bg-terracotta/15 text-terracotta' :
                                'bg-grass/15 text-grass'
                          )}>
                            {record.status === 'completed' ? '已完成' : record.status === 'draft' ? '草稿' : '已归档'}
                          </span>
                          <span className="px-3 py-1 text-xs font-medium rounded-full bg-moss-soft text-moss">
                            {getExperimentCategoryDisplayName(record.category as ExperimentCategory)}
                          </span>
                        </div>

                        {/* 内容预览 */}
                        <p className="text-bark text-sm mb-4 line-clamp-2">
                          {record.content.substring(0, 100)}{record.content.length > 100 ? '...' : ''}
                        </p>

                        {/* 标签 */}
                        {record.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {record.tags.slice(0, 3).map((tag, i) => (
                              <span key={i} className="px-2 py-0.5 text-xs rounded-md bg-organic-stone text-bark">
                                #{tag}
                              </span>
                            ))}
                            {record.tags.length > 3 && (
                              <span className="text-xs text-grass">+{record.tags.length - 3}</span>
                            )}
                          </div>
                        )}

                        {/* 操作按钮 */}
                        <div className="flex justify-between items-center pt-4 border-t border-timber-soft">
                          <Link
                            to={`/records/${record.id}`}
                            className="px-4 py-2 rounded-full bg-moss-soft text-moss text-sm font-medium hover:bg-moss hover:text-moss-light transition-all"
                          >
                            <i className="fa-solid fa-eye mr-1.5"></i>查看详情
                          </Link>
                          <div className="flex gap-1">
                            <button
                              onClick={() => openEditForm(record)}
                              className="p-2 rounded-lg text-grass hover:text-moss hover:bg-moss-soft transition-colors"
                              title="编辑"
                            >
                              <i className="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button
                              onClick={() => handleDelete(record.id)}
                              className="p-2 rounded-lg text-grass hover:text-status-error hover:bg-status-error/10 transition-colors"
                              title="删除"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}