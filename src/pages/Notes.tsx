import { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { experimentNoteService, experimentRecordService, projectService } from '@/lib/cachedStorage';
import { ExperimentNote, ExperimentRecord, Project } from '@/types';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { usePerformanceProfiler } from '@/hooks/usePerformance';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';

export default function Notes() {
  const { id: routeProjectId } = useParams<{ id: string }>();
  const location = useLocation();

  const getProjectId = () => {
    const searchParams = new URLSearchParams(location.search);
    const queryProjectId = searchParams.get('project');
    return queryProjectId || routeProjectId;
  };

  const projectId = getProjectId();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notes, setNotes] = useState<ExperimentNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [records, setRecords] = useState<ExperimentRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentNote, setCurrentNote] = useState<ExperimentNote | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { ref: performanceRef } = usePerformanceProfiler('Notes', [notes, loading, searchQuery]);

  const [formData, setFormData] = useState({
    title: '',
    relatedRecordId: '',
    content: ''
  });

  const [errors, setErrors] = useState({
    title: '',
    content: ''
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await new Promise(resolve => setTimeout(resolve, 600));

        const allNotes = experimentNoteService.getAll();
        const allRecords = experimentRecordService.getAll();

        if (projectId) {
          const projectNotes = allNotes.filter(note => note.projectId === projectId);
          const projectRecords = allRecords.filter(record => record.projectId === projectId);
          setNotes(projectNotes);
          setRecords(projectRecords);

          const projectData = projectService.getById(projectId);
          setProject(projectData);
        } else {
          setNotes(allNotes);
          setRecords(allRecords);
        }
      } catch (error) {
        console.error('获取数据失败:', error);
        setNotes([]);
        setRecords([]);
        toast.error('获取笔记列表失败');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId, location.search]);

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openCreateForm = () => {
    setCurrentNote(null);
    setFormData({ title: '', relatedRecordId: '', content: '' });
    setErrors({ title: '', content: '' });
    setIsFormOpen(true);
  };

  const openEditForm = (note: ExperimentNote) => {
    setCurrentNote(note);
    setFormData({
      title: note.title,
      relatedRecordId: note.relatedRecordId || '',
      content: note.content
    });
    setErrors({ title: '', content: '' });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setCurrentNote(null);
    setIsSubmitting(false);
  };

  const validateForm = (): boolean => {
    const newErrors = {
      title: !formData.title.trim() ? '请输入笔记标题' : '',
      content: !formData.content.trim() ? '请输入笔记内容' : ''
    };
    setErrors(newErrors);
    return Object.values(newErrors).every(error => !error);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setIsSubmitting(true);

      if (currentNote) {
        const updatedNote = experimentNoteService.update(currentNote.id, {
          title: formData.title,
          relatedRecordId: formData.relatedRecordId || undefined,
          content: formData.content
        });

        if (updatedNote) {
          setNotes(notes.map(note => note.id === currentNote.id ? updatedNote : note));
          toast.success('笔记已更新');
        } else {
          toast.error('更新失败');
        }
      } else {
        const newNote = experimentNoteService.create({
          title: formData.title,
          relatedRecordId: formData.relatedRecordId || undefined,
          content: formData.content,
          projectId: projectId
        });

        setNotes([...notes, newNote]);
        toast.success('笔记创建成功');
      }

      closeForm();
    } catch (error) {
      toast.error(currentNote ? '更新失败，请重试' : '创建失败，请重试');
      console.error('操作失败:', error);
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('确定要删除这条笔记吗？此操作不可撤销。')) {
      try {
        const success = experimentNoteService.delete(id);
        if (success) {
          const allNotes = experimentNoteService.getAll();
          if (projectId) {
            const projectNotes = allNotes.filter(note => note.projectId === projectId);
            setNotes(projectNotes);
          } else {
            setNotes(allNotes);
          }
          toast.success('实验笔记已删除');
        } else {
          toast.error('删除失败，请重试');
        }
      } catch (error) {
        toast.error('删除失败，请重试');
      }
    }
  };

  return (
    <div className="min-h-screen bg-earth-beige text-text-main" ref={performanceRef}>
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header
          title={projectId && project ? `${project.title} - 实验笔记` : '实验笔记'}
          sidebarCollapsed={sidebarCollapsed}
          breadcrumb={projectId && project ? [
            { label: '课题管理', href: '/projects' },
            { label: project.title, href: `/projects/${projectId}` },
            { label: '实验笔记' }
          ] : undefined}
          actions={
            <button
              onClick={openCreateForm}
              className="bg-forest-secondary hover:bg-forest-primary text-white px-4 py-2 rounded-lg font-semibold transition-colors duration-300 shadow-sm"
            >
              <i className="fa-solid fa-plus mr-2"></i>
              新建笔记
            </button>
          }
        />

        <main className="container mx-auto px-4 py-6">
          <AnimatePresence>
            {isFormOpen && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-6"
              >
                <div className="bg-forest-main/5 rounded-xl shadow-sm border border-forest-accent/20 p-6 mb-6">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-forest-primary mb-2 flex items-center">
                        <i className="fa-solid fa-seedling mr-3 text-forest-secondary"></i>
                        {currentNote ? '编辑实验笔记' : '创建新笔记'}
                      </h3>
                      <p className="text-text-soft">
                        {currentNote ? '修改笔记的详细信息' : '记录您的实验观察和想法'}
                      </p>
                    </div>
                    <button
                      onClick={closeForm}
                      className="p-3 text-text-muted hover:text-text-main hover:bg-white/50 rounded-lg transition-all duration-200"
                      disabled={isSubmitting}
                    >
                      <i className="fa-solid fa-times text-xl"></i>
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        笔记标题 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        className={`w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-forest-secondary/50 transition-all ${errors.title
                          ? 'border-status-error bg-status-error/5'
                          : 'border-forest-accent/30 bg-white'
                          }`}
                        placeholder="输入笔记标题"
                        disabled={isSubmitting}
                      />
                      {errors.title && (
                        <p className="mt-1 text-sm text-status-error flex items-center">
                          <i className="fa-solid fa-exclamation-circle mr-1"></i> {errors.title}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        关联实验记录 (可选)
                      </label>
                      <select
                        name="relatedRecordId"
                        value={formData.relatedRecordId}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-forest-accent/30 bg-white focus:outline-none focus:ring-2 focus:ring-forest-secondary/50"
                        disabled={isSubmitting}
                      >
                        <option value="">-- 不关联实验记录 --</option>
                        {records.map(record => (
                          <option key={record.id} value={record.id}>{record.title}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        笔记内容 <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        name="content"
                        value={formData.content}
                        onChange={handleChange}
                        className={`w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-forest-secondary/50 min-h-[300px] resize-y transition-all ${errors.content
                          ? 'border-status-error bg-status-error/5'
                          : 'border-forest-accent/30 bg-white'
                          }`}
                        placeholder="记录实验中的观察、想法、问题或其他重要信息..."
                        disabled={isSubmitting}
                      ></textarea>
                      {errors.content && (
                        <p className="mt-1 text-sm text-status-error flex items-center">
                          <i className="fa-solid fa-exclamation-circle mr-1"></i> {errors.content}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={closeForm}
                        className="border border-forest-accent/30 text-text-main hover:bg-forest-accent/10 px-4 py-2 rounded-xl transition-colors"
                        disabled={isSubmitting}
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        className="bg-forest-secondary hover:bg-forest-primary text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                            保存中...
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-save mr-2"></i>
                            {currentNote ? '更新笔记' : '保存笔记'}
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="搜索实验笔记..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-forest-accent/30 bg-earth-beige/50 focus:outline-none focus:ring-2 focus:ring-forest-secondary/50 focus:border-forest-secondary"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <i className="fa-solid fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted"></i>
            </div>
          </div>

          {loading ? (
            <LoadingSkeleton type="card" count={6} />
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-earth-beige rounded-full flex items-center justify-center mx-auto mb-4 border border-forest-accent/20">
                <i className="fa-solid fa-sticky-note text-3xl text-forest-secondary/50"></i>
              </div>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                {searchQuery ? '未找到相关笔记' : '还没有实验笔记'}
              </h3>
              <p className="text-gray-500 mb-6">
                {searchQuery ? '请尝试修改搜索关键词' : '开始记录您的第一个实验笔记吧！'}
              </p>
              {!searchQuery && (
                <button
                  onClick={openCreateForm}
                  className="bg-forest-secondary hover:bg-forest-primary text-white px-6 py-3 rounded-xl font-semibold transition-colors duration-300 shadow-md"
                >
                  <i className="fa-solid fa-plus mr-2"></i>
                  创建第一个笔记
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredNotes.map((note, index) => (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="group bg-white rounded-2xl shadow-sm border border-forest-accent/30 p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-text-main mb-2 group-hover:text-forest-primary transition-colors">{note.title}</h3>
                      <p className="text-sm text-text-soft mb-2">
                        <i className="fa-solid fa-calendar mr-1 text-forest-secondary/70"></i>
                        {new Date(note.createdAt).toLocaleDateString('zh-CN')}
                      </p>
                      {note.projectId && (() => {
                        const relatedProject = projectService.getById(note.projectId);
                        return relatedProject ? (
                          <p className="text-xs text-forest-secondary mb-2">
                            <i className="fa-solid fa-project-diagram mr-1"></i>
                            所属课题：{relatedProject.title}
                          </p>
                        ) : null;
                      })()}
                      {note.relatedRecordId && (() => {
                        const relatedRecord = experimentRecordService.getById(note.relatedRecordId);
                        return relatedRecord ? (
                          <p className="text-xs text-forest-secondary mb-2">
                            <i className="fa-solid fa-link mr-1"></i>
                            关联实验：{relatedRecord.title}
                          </p>
                        ) : (
                          <p className="text-xs text-text-muted/70 mb-2">
                            <i className="fa-solid fa-link mr-1"></i>
                            关联实验记录已不存在
                          </p>
                        );
                      })()}
                    </div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => openEditForm(note)}
                        className="p-2 text-text-soft hover:bg-forest-accent/20 hover:text-forest-primary rounded-lg transition-colors"
                        title="编辑"
                      >
                        <i className="fa-solid fa-pen-to-square"></i>
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="p-2 text-text-soft hover:bg-status-error/10 hover:text-status-error rounded-lg transition-colors"
                        title="删除"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>

                  <p className="text-text-main/80 text-sm mb-4 line-clamp-4">
                    {note.content.substring(0, 150)}{note.content.length > 150 ? '...' : ''}
                  </p>

                  <Link
                    to={`/notes/${note.id}`}
                    className="block w-full text-center bg-forest-secondary/10 text-forest-primary hover:bg-forest-secondary/20 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                  >
                    查看详情
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}