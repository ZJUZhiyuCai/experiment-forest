import { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { sopService, projectService } from '@/lib/cachedStorage';
import { SOP, Project } from '@/types';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { usePerformanceProfiler } from '@/hooks/usePerformance';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { FullscreenTextarea } from '@/components/FullscreenTextarea';
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

export default function SOPs() {
  const { id: routeProjectId } = useParams<{ id: string }>();
  const location = useLocation();

  const getProjectId = () => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('project') || routeProjectId;
  };

  const projectId = getProjectId();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sops, setSOPs] = useState<SOP[]>([]);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentSOP, setCurrentSOP] = useState<SOP | null>(null);

  const { ref: performanceRef } = usePerformanceProfiler('SOPs', [sops, loading, searchQuery]);

  const [formData, setFormData] = useState({ title: '', version: '1.0', author: '实验管理员', content: '' });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await new Promise(resolve => setTimeout(resolve, 400));
        const allSOPs = sopService.getAll();
        if (projectId) {
          setSOPs(allSOPs.filter(s => s.projectId === projectId));
          setProject(projectService.getById(projectId));
        } else {
          setSOPs(allSOPs);
        }
      } catch (error) {
        console.error('获取SOP失败:', error);
        toast.error('获取SOP列表失败');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [projectId, location.search]);

  const filteredSOPs = sops.filter(sop =>
    sop.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sop.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openCreateForm = () => { setCurrentSOP(null); setFormData({ title: '', version: '1.0', author: '实验管理员', content: '' }); setIsFormOpen(true); };
  const openEditForm = (sop: SOP) => { setCurrentSOP(sop); setFormData({ title: sop.title, version: sop.version, author: sop.author, content: sop.content }); setIsFormOpen(true); };
  const closeForm = () => { setIsFormOpen(false); setCurrentSOP(null); };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) { toast.error('请输入SOP文档标题'); return; }
    if (!formData.author.trim()) { toast.error('请输入作者名称'); return; }
    try {
      if (currentSOP) {
        const updated = sopService.update(currentSOP.id, { title: formData.title, version: formData.version, author: formData.author, content: formData.content });
        if (updated) { setSOPs(sops.map(s => s.id === currentSOP.id ? updated : s)); toast.success('SOP已更新'); }
      } else {
        const newSOP = sopService.create({ title: formData.title, version: formData.version, author: formData.author, content: formData.content, department: '实验室', category: '通用', purpose: '标准操作流程', scope: '实验室操作', approvalStatus: 'draft', references: '', projectId });
        setSOPs([...sops, newSOP]); toast.success('SOP创建成功');
      }
      closeForm();
    } catch { toast.error('操作失败'); }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('确定要删除这份SOP文档吗？')) {
      try {
        if (sopService.delete(id)) {
          const all = sopService.getAll();
          setSOPs(projectId ? all.filter(s => s.projectId === projectId) : all);
          toast.success('SOP已删除');
        }
      } catch { toast.error('删除失败'); }
    }
  };

  return (
    <div ref={performanceRef} className="min-h-screen bg-organic-rice-paper text-loam">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={cn('transition-all duration-500', sidebarCollapsed ? 'ml-16' : 'ml-64')}>
        <Header
          title={projectId && project ? `${project.title} - SOP文档` : 'SOP文档'}
          sidebarCollapsed={sidebarCollapsed}
          breadcrumb={projectId && project ? [
            { label: '课题管理', href: '/projects' },
            { label: project.title, href: `/projects/${projectId}` },
            { label: 'SOP文档' }
          ] : undefined}
          actions={
            <button onClick={openCreateForm} className="organic-btn organic-btn--primary text-sm px-5 py-2.5">
              <i className="fa-solid fa-plus mr-2"></i>新建SOP
            </button>
          }
        />

        <main className="container mx-auto px-6 py-8 relative">
          {/* 环境 Blob */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="organic-blob organic-blob--moss w-[450px] h-[450px] -top-20 -right-20 opacity-20" />
            <div className="organic-blob organic-blob--clay w-[350px] h-[350px] bottom-10 -left-20 opacity-15" />
          </div>

          {/* 表单 */}
          <AnimatePresence>
            {isFormOpen && (
              <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="mb-8 relative z-10">
                <div className="organic-card p-8">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-xl font-heading font-bold text-loam flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-moss flex items-center justify-center shadow-moss">
                          <i className="fa-solid fa-book-medical text-moss-light"></i>
                        </span>
                        {currentSOP ? '编辑SOP文档' : '创建SOP文档'}
                      </h3>
                    </div>
                    <button onClick={closeForm} className="p-2 rounded-lg text-grass hover:text-loam hover:bg-organic-stone transition-colors">
                      <i className="fa-solid fa-times text-xl"></i>
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-bark mb-2">文档标题 <span className="text-status-error">*</span></label>
                      <input type="text" name="title" value={formData.title} onChange={handleChange} className="organic-input" placeholder="输入SOP文档标题" required />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-bark mb-2">版本号</label>
                        <input type="text" name="version" value={formData.version} onChange={handleChange} className="organic-input" placeholder="如: 1.0" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-bark mb-2">作者 <span className="text-status-error">*</span></label>
                        <input type="text" name="author" value={formData.author} onChange={handleChange} className="organic-input" placeholder="输入作者" required />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-bark mb-2">SOP内容</label>
                      <FullscreenTextarea value={formData.content} onChange={(v) => setFormData(prev => ({ ...prev, content: v }))} title="SOP内容" placeholder="详细描述标准操作流程...">
                        <textarea name="content" value={formData.content} onChange={handleChange}
                          className="organic-input min-h-[350px] resize-y rounded-2xl pr-12" placeholder="详细描述标准操作流程..." />
                      </FullscreenTextarea>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-timber-soft">
                      <button type="button" onClick={closeForm} className="organic-btn organic-btn--ghost">取消</button>
                      <button type="submit" className="organic-btn organic-btn--primary"><i className="fa-solid fa-save mr-2"></i>{currentSOP ? '更新' : '保存'}</button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 搜索区域 */}
          <motion.div className="organic-card p-6 mb-8 relative z-10" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-bark mb-2">搜索SOP</label>
                <div className="relative">
                  <input type="text" placeholder="输入关键词搜索..." className="organic-input pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-grass text-sm"></i>
                </div>
              </div>
            </div>
          </motion.div>

          {/* SOP列表 */}
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-heading font-bold text-loam">
                所有SOP文档 <span className="text-grass font-normal">({filteredSOPs.length})</span>
              </h2>
              <div className="flex gap-3">
                <button onClick={openCreateForm} className="organic-btn organic-btn--secondary text-sm px-4 py-2">
                  <i className="fa-solid fa-plus mr-2"></i>新建
                </button>
                <button className="organic-btn organic-btn--outline text-sm px-4 py-2">
                  <i className="fa-solid fa-file-export mr-2"></i>导出
                </button>
              </div>
            </div>

            {loading ? (
              <LoadingSkeleton type="card" count={6} />
            ) : filteredSOPs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSOPs.map((sop, index) => (
                  <motion.div key={sop.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: index * 0.05 }}
                    className={cn('organic-card p-6 group', cardRadiusVariants[index % 6], 'hover:-translate-y-2 hover:shadow-float')}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-heading font-bold text-loam mb-2 group-hover:text-moss transition-colors line-clamp-1">{sop.title}</h3>
                        <p className="text-sm text-grass">版本: {sop.version} | 作者: {sop.author}</p>
                        <p className="text-xs text-grass/70 mt-1">{new Date(sop.lastUpdated).toLocaleDateString('zh-CN')}</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEditForm(sop)} className="p-2 rounded-lg text-grass hover:text-moss hover:bg-moss-soft transition-colors"><i className="fa-solid fa-pen-to-square"></i></button>
                        <button onClick={() => handleDelete(sop.id)} className="p-2 rounded-lg text-grass hover:text-status-error hover:bg-status-error/10 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
                      </div>
                    </div>
                    <p className="text-bark text-sm mb-4 line-clamp-3 leading-relaxed">{sop.content.substring(0, 150)}{sop.content.length > 150 ? '...' : ''}</p>
                    <Link to={`/sops/${sop.id}`} className="block w-full text-center py-2.5 rounded-full bg-moss-soft text-moss text-sm font-medium hover:bg-moss hover:text-moss-light transition-all">
                      查看详情
                    </Link>
                  </motion.div>
                ))}
              </div>
            ) : (
              <motion.div className="organic-card p-12 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="w-20 h-20 rounded-full bg-organic-stone flex items-center justify-center mx-auto mb-4">
                  <i className="fa-solid fa-book-medical text-3xl text-grass"></i>
                </div>
                <h3 className="text-xl font-heading font-semibold text-bark mb-2">暂无SOP文档</h3>
                <p className="text-grass mb-6">开始创建你的第一份标准操作流程文档</p>
                <button onClick={openCreateForm} className="organic-btn organic-btn--primary"><i className="fa-solid fa-plus mr-2"></i>创建SOP</button>
              </motion.div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}