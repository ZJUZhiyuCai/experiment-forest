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
import { cn } from '@/lib/utils';

// 不对称圆角变体
const cardRadiusVariants = [
  'rounded-[2rem_1rem_2.5rem_1.5rem]',
  'rounded-[1.5rem_2.5rem_1rem_2rem]',
  'rounded-[2.5rem_1.5rem_2rem_1rem]',
  'rounded-[1rem_2rem_1.5rem_2.5rem]',
  'rounded-[2rem_2.5rem_1.5rem_1rem]',
  'rounded-[1.5rem_1rem_2rem_2.5rem]',
];

export default function Notes() {
  const { id: routeProjectId } = useParams<{ id: string }>();
  const location = useLocation();

  const getProjectId = () => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('project') || routeProjectId;
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

  const [formData, setFormData] = useState({ title: '', relatedRecordId: '', content: '' });
  const [errors, setErrors] = useState({ title: '', content: '' });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await new Promise(resolve => setTimeout(resolve, 400));
        const allNotes = experimentNoteService.getAll();
        const allRecords = experimentRecordService.getAll();
        if (projectId) {
          setNotes(allNotes.filter(n => n.projectId === projectId));
          setRecords(allRecords.filter(r => r.projectId === projectId));
          setProject(projectService.getById(projectId));
        } else {
          setNotes(allNotes);
          setRecords(allRecords);
        }
      } catch (error) {
        console.error('获取数据失败:', error);
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

  const openCreateForm = () => { setCurrentNote(null); setFormData({ title: '', relatedRecordId: '', content: '' }); setErrors({ title: '', content: '' }); setIsFormOpen(true); };
  const openEditForm = (note: ExperimentNote) => { setCurrentNote(note); setFormData({ title: note.title, relatedRecordId: note.relatedRecordId || '', content: note.content }); setErrors({ title: '', content: '' }); setIsFormOpen(true); };
  const closeForm = () => { setIsFormOpen(false); setCurrentNote(null); setIsSubmitting(false); };

  const validateForm = () => {
    const newErrors = { title: !formData.title.trim() ? '请输入笔记标题' : '', content: !formData.content.trim() ? '请输入笔记内容' : '' };
    setErrors(newErrors);
    return !newErrors.title && !newErrors.content;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof typeof errors]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      setIsSubmitting(true);
      if (currentNote) {
        const updated = experimentNoteService.update(currentNote.id, { title: formData.title, relatedRecordId: formData.relatedRecordId || undefined, content: formData.content });
        if (updated) { setNotes(notes.map(n => n.id === currentNote.id ? updated : n)); toast.success('笔记已更新'); }
      } else {
        const newNote = experimentNoteService.create({ title: formData.title, relatedRecordId: formData.relatedRecordId || undefined, content: formData.content, projectId });
        setNotes([...notes, newNote]); toast.success('笔记创建成功');
      }
      closeForm();
    } catch { toast.error('操作失败'); setIsSubmitting(false); }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('确定要删除这条笔记吗？')) {
      try {
        if (experimentNoteService.delete(id)) {
          const all = experimentNoteService.getAll();
          setNotes(projectId ? all.filter(n => n.projectId === projectId) : all);
          toast.success('笔记已删除');
        }
      } catch { toast.error('删除失败'); }
    }
  };

  return (
    <div className="min-h-screen bg-organic-rice-paper text-loam" ref={performanceRef}>
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={cn('transition-all duration-500', sidebarCollapsed ? 'ml-16' : 'ml-64')}>
        <Header
          title={projectId && project ? `${project.title} - 实验笔记` : '实验笔记'}
          sidebarCollapsed={sidebarCollapsed}
          breadcrumb={projectId && project ? [
            { label: '课题管理', href: '/projects' },
            { label: project.title, href: `/projects/${projectId}` },
            { label: '实验笔记' }
          ] : undefined}
          actions={
            <button onClick={openCreateForm} className="organic-btn organic-btn--primary text-sm px-5 py-2.5">
              <i className="fa-solid fa-plus mr-2"></i>新建笔记
            </button>
          }
        />

        <main className="container mx-auto px-6 py-8 relative">
          {/* 环境 Blob */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="organic-blob organic-blob--clay w-[400px] h-[400px] -top-20 -right-20 opacity-20" />
            <div className="organic-blob organic-blob--moss w-[300px] h-[300px] bottom-20 -left-20 opacity-15" />
          </div>

          {/* 表单 */}
          <AnimatePresence>
            {isFormOpen && (
              <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="mb-8 relative z-10">
                <div className="organic-card p-8">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-xl font-heading font-bold text-loam flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-terracotta flex items-center justify-center shadow-clay">
                          <i className="fa-solid fa-leaf text-white"></i>
                        </span>
                        {currentNote ? '编辑实验笔记' : '创建新笔记'}
                      </h3>
                      <p className="text-bark mt-1">{currentNote ? '修改笔记的详细信息' : '记录您的实验观察和想法'}</p>
                    </div>
                    <button onClick={closeForm} className="p-2 rounded-lg text-grass hover:text-loam hover:bg-organic-stone transition-colors" disabled={isSubmitting}>
                      <i className="fa-solid fa-times text-xl"></i>
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-bark mb-2">笔记标题 <span className="text-status-error">*</span></label>
                      <input type="text" name="title" value={formData.title} onChange={handleChange}
                        className={cn('organic-input', errors.title && 'border-status-error')} placeholder="输入笔记标题" disabled={isSubmitting} />
                      {errors.title && <p className="mt-1 text-sm text-status-error"><i className="fa-solid fa-exclamation-circle mr-1"></i>{errors.title}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-bark mb-2">关联实验记录 (可选)</label>
                      <select name="relatedRecordId" value={formData.relatedRecordId} onChange={handleChange} className="organic-input" disabled={isSubmitting}>
                        <option value="">-- 不关联实验记录 --</option>
                        {records.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-bark mb-2">笔记内容 <span className="text-status-error">*</span></label>
                      <textarea name="content" value={formData.content} onChange={handleChange}
                        className={cn('organic-input min-h-[250px] resize-y rounded-2xl', errors.content && 'border-status-error')}
                        placeholder="记录实验中的观察、想法、问题..." disabled={isSubmitting}></textarea>
                      {errors.content && <p className="mt-1 text-sm text-status-error"><i className="fa-solid fa-exclamation-circle mr-1"></i>{errors.content}</p>}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-timber-soft">
                      <button type="button" onClick={closeForm} className="organic-btn organic-btn--ghost" disabled={isSubmitting}>取消</button>
                      <button type="submit" className="organic-btn organic-btn--secondary" disabled={isSubmitting}>
                        {isSubmitting ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i>保存中...</> : <><i className="fa-solid fa-save mr-2"></i>{currentNote ? '更新' : '保存'}</>}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 搜索框 */}
          <motion.div className="organic-card p-6 mb-8 relative z-10" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="relative">
              <input type="text" placeholder="搜索实验笔记..." className="organic-input pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-grass text-sm"></i>
            </div>
          </motion.div>

          {/* 笔记列表 */}
          {loading ? (
            <div className="relative z-10"><LoadingSkeleton type="card" count={6} /></div>
          ) : filteredNotes.length === 0 ? (
            <motion.div className="organic-card p-12 text-center relative z-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="w-20 h-20 rounded-full bg-organic-stone flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-leaf text-3xl text-grass"></i>
              </div>
              <h3 className="text-xl font-heading font-semibold text-bark mb-2">{searchQuery ? '未找到相关笔记' : '还没有实验笔记'}</h3>
              <p className="text-grass mb-6">{searchQuery ? '请尝试修改搜索关键词' : '开始记录您的第一个实验笔记吧！'}</p>
              {!searchQuery && <button onClick={openCreateForm} className="organic-btn organic-btn--secondary"><i className="fa-solid fa-plus mr-2"></i>创建第一个笔记</button>}
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
              {filteredNotes.map((note, index) => (
                <motion.div key={note.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: index * 0.05 }}
                  className={cn('organic-card p-6 group', cardRadiusVariants[index % 6], 'hover:-translate-y-2 hover:shadow-float')}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-heading font-bold text-loam mb-2 group-hover:text-terracotta transition-colors line-clamp-1">{note.title}</h3>
                      <p className="text-sm text-grass flex items-center gap-1"><i className="fa-solid fa-calendar text-xs"></i>{new Date(note.createdAt).toLocaleDateString('zh-CN')}</p>
                      {note.projectId && (() => { const p = projectService.getById(note.projectId); return p ? <p className="text-xs text-terracotta mt-1"><i className="fa-solid fa-folder mr-1"></i>{p.title}</p> : null; })()}
                      {note.relatedRecordId && (() => { const r = experimentRecordService.getById(note.relatedRecordId); return r ? <p className="text-xs text-moss mt-1"><i className="fa-solid fa-link mr-1"></i>关联：{r.title}</p> : <p className="text-xs text-grass/50 mt-1"><i className="fa-solid fa-link mr-1"></i>关联已失效</p>; })()}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEditForm(note)} className="p-2 rounded-lg text-grass hover:text-terracotta hover:bg-terracotta-light transition-colors"><i className="fa-solid fa-pen-to-square"></i></button>
                      <button onClick={() => handleDelete(note.id)} className="p-2 rounded-lg text-grass hover:text-status-error hover:bg-status-error/10 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
                    </div>
                  </div>
                  <p className="text-bark text-sm mb-4 line-clamp-3 leading-relaxed">{note.content.substring(0, 150)}{note.content.length > 150 ? '...' : ''}</p>
                  <Link to={`/notes/${note.id}`} className="block w-full text-center py-2.5 rounded-full bg-terracotta-light text-terracotta text-sm font-medium hover:bg-terracotta hover:text-white transition-all">
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