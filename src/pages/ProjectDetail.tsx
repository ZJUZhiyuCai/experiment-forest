import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { projectService, experimentRecordService, experimentNoteService, sopService } from '@/lib/cachedStorage';
import { Project, ExperimentRecord, ExperimentNote, SOP, ProjectStats } from '@/types';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { cn } from '@/lib/utils';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [records, setRecords] = useState<ExperimentRecord[]>([]);
  const [notes, setNotes] = useState<ExperimentNote[]>([]);
  const [sops, setSOPs] = useState<SOP[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'records' | 'notes' | 'sops'>('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      navigate('/projects');
      return;
    }

    try {
      setLoading(true);

      const projectData = projectService.getById(id);
      if (!projectData) {
        toast.error('课题不存在');
        navigate('/projects');
        return;
      }

      setProject(projectData);

      const statsData = projectService.getStats(id);
      setStats(statsData);

      const allRecords = experimentRecordService.getAll().filter(r => r.projectId === id);
      const allNotes = experimentNoteService.getAll().filter(n => n.projectId === id);
      const allSOPs = sopService.getAll().filter(s => s.projectId === id);

      setRecords(allRecords);
      setNotes(allNotes);
      setSOPs(allSOPs);
    } catch (error) {
      console.error('获取课题详情失败:', error);
      toast.error('获取课题详情失败');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-organic-rice-paper flex items-center justify-center">
        <div className="organic-card p-8 rounded-[2rem_1rem_2.5rem_1.5rem] text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-moss mb-4"></div>
          <p className="text-loam">加载课题详情中...</p>
        </div>
      </div>
    );
  }

  if (!project) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning': return 'bg-sand/30 text-bark';
      case 'active': return 'bg-moss/15 text-moss';
      case 'paused': return 'bg-terracotta/15 text-terracotta';
      case 'completed': return 'bg-moss/20 text-moss';
      case 'archived': return 'bg-timber-soft text-grass';
      default: return 'bg-timber-soft text-grass';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'planning': return '规划中';
      case 'active': return '进行中';
      case 'paused': return '已暂停';
      case 'completed': return '已完成';
      case 'archived': return '已归档';
      default: return '未知';
    }
  };

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
          title={project.title}
          sidebarCollapsed={sidebarCollapsed}
          breadcrumb={[
            { label: '课题管理', href: '/projects' },
            { label: project.title }
          ]}
          actions={
            <div className="flex items-center space-x-3">
              <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(project.status)}`}>
                {getStatusText(project.status)}
              </span>
              <button
                onClick={() => navigate('/projects')}
                className="organic-btn organic-btn--ghost text-sm"
              >
                <i className="fa-solid fa-arrow-left mr-2"></i>
                返回列表
              </button>
            </div>
          }
        />

        <main className="container mx-auto px-6 py-6">
          {/* 课题基本信息 */}
          <div className="organic-card p-6 mb-6 rounded-[2rem_1rem_2.5rem_1.5rem]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h2 className="text-xl font-bold text-forest-primary mb-4">课题描述</h2>
                <p className="text-text-main mb-4">{project.description}</p>

                {project.tags.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-forest-primary mb-2">标签</h3>
                    <div className="flex flex-wrap gap-2">
                      {project.tags.map((tag, index) => (
                        <span key={index} className="bg-forest-secondary/10 text-forest-secondary px-3 py-1 text-sm rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-xl font-bold text-forest-primary mb-4">课题信息</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-text-muted">负责人:</span>
                    <span className="font-medium">{project.leader}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">开始日期:</span>
                    <span className="font-medium text-text-main">{new Date(project.startDate).toLocaleDateString('zh-CN')}</span>
                  </div>
                  {project.endDate && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">结束日期:</span>
                      <span className="font-medium text-text-main">{new Date(project.endDate).toLocaleDateString('zh-CN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-text-muted">进度:</span>
                    <span className="font-medium">{project.progress}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 统计数据 */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-white rounded-2xl shadow-sm border border-forest-accent/30 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-muted mb-1">实验记录</p>
                    <p className="text-2xl font-bold text-status-success">{stats.totalRecords}</p>
                  </div>
                  <i className="fa-solid fa-flask text-status-success/80 text-2xl"></i>
                </div>
                <p className="text-xs text-text-soft mt-2">已完成 {stats.completedRecords} 个</p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-forest-accent/30 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-muted mb-1">实验笔记</p>
                    <p className="text-2xl font-bold text-status-info">{stats.totalNotes}</p>
                  </div>
                  <i className="fa-solid fa-sticky-note text-status-info/80 text-2xl"></i>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-forest-accent/30 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-muted mb-1">SOP文档</p>
                    <p className="text-2xl font-bold text-status-warning">{stats.totalSOPs}</p>
                  </div>
                  <i className="fa-solid fa-file-alt text-status-warning/80 text-2xl"></i>
                </div>
              </div>
            </div>
          )}

          {/* 标签页导航 */}
          <div className="bg-white rounded-2xl shadow-sm border border-forest-accent/30">
            <div className="border-b border-forest-accent/20">
              <nav className="flex space-x-8 px-6">
                {[
                  { key: 'overview', label: '概览', icon: 'fa-chart-pie' },
                  { key: 'records', label: `实验记录 (${records.length})`, icon: 'fa-flask' },
                  { key: 'notes', label: `实验笔记 (${notes.length})`, icon: 'fa-sticky-note' },
                  { key: 'sops', label: `SOP文档 (${sops.length})`, icon: 'fa-file-alt' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center ${activeTab === tab.key
                      ? 'border-forest-primary text-forest-primary'
                      : 'border-transparent text-text-soft hover:text-text-main hover:border-forest-accent/30'
                      }`}
                  >
                    <i className={`fa-solid ${tab.icon} mr-2`}></i>
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {/* 概览标签页 */}
              {activeTab === 'overview' && (
                <div>
                  {/* AI和思维导图功能快捷入口 */}
                  <div className="mb-6 p-4 bg-gradient-to-r from-forest-main/5 to-forest-secondary/5 border border-forest-accent/20 rounded-xl">
                    <h3 className="text-lg font-semibold text-forest-primary mb-3 flex items-center">
                      <i className="fa-solid fa-magic mr-2 text-forest-secondary"></i>
                      智能化功能
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      <Link
                        to={`/chat`}
                        className="flex items-center px-4 py-2 bg-forest-secondary text-white rounded-xl hover:bg-forest-primary transition-all duration-200 transform hover:-translate-y-0.5 shadow-sm hover:shadow-md"
                      >
                        <i className="fa-solid fa-robot mr-2"></i>
                        小森博士
                      </Link>
                      <Link
                        to={`/topics/${project.id}/mindmap`}
                        className="flex items-center px-4 py-2 bg-text-muted text-white rounded-xl hover:bg-text-main transition-all duration-200 transform hover:-translate-y-0.5 shadow-sm hover:shadow-md"
                      >
                        <i className="fa-solid fa-project-diagram mr-2"></i>
                        思维导图
                      </Link>
                      <Link
                        to={`/settings#ai-api-settings`}
                        className="flex items-center px-3 py-2 border border-forest-accent/30 text-text-main hover:text-forest-primary hover:border-forest-primary rounded-xl transition-colors text-sm"
                      >
                        <i className="fa-solid fa-cog mr-2"></i>
                        AI设置
                      </Link>
                    </div>
                    <p className="text-sm text-text-soft mt-2">
                      💡 使用AI助手获得专业建议，通过思维导图可视化课题结构
                    </p>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-800 mb-4">最近活动</h3>
                  <div className="space-y-3">
                    {[...records, ...notes, ...sops]
                      .sort((a, b) => {
                        const aDate = 'lastUpdated' in a ? a.lastUpdated : a.updatedAt;
                        const bDate = 'lastUpdated' in b ? b.lastUpdated : b.updatedAt;
                        return new Date(bDate).getTime() - new Date(aDate).getTime();
                      })
                      .slice(0, 5)
                      .map((item, index) => (
                        <div key={index} className="flex items-center p-3 bg-forest-main/5 rounded-xl border border-forest-accent/10">
                          <i className={`fa-solid ${'status' in item ? 'fa-flask' :
                            'relatedRecordId' in item ? 'fa-sticky-note' : 'fa-file-alt'
                            } text-text-soft mr-3`}></i>
                          <div className="flex-1">
                            <h4 className="font-medium text-text-main">{item.title}</h4>
                            <p className="text-sm text-text-muted">
                              {'status' in item ? '实验记录' :
                                'relatedRecordId' in item ? '实验笔记' : 'SOP文档'} •
                              {new Date('lastUpdated' in item ? item.lastUpdated : item.updatedAt).toLocaleDateString('zh-CN')}
                            </p>
                          </div>
                        </div>
                      ))})
                    {[...records, ...notes, ...sops].length === 0 && (
                      <p className="text-gray-500 text-center py-8">暂无活动记录</p>
                    )}
                  </div>
                </div>
              )}

              {/* 其他标签页内容 */}
              {activeTab === 'records' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-text-main">实验记录</h3>
                    <Link
                      to={`/records?project=${project.id}`}
                      className="bg-forest-secondary hover:bg-forest-primary text-white px-4 py-2 rounded-xl transition-colors shadow-sm"
                    >
                      <i className="fa-solid fa-plus mr-2"></i>新建记录
                    </Link>
                  </div>
                  {records.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {records.map((record) => (
                        <div key={record.id} className="border border-forest-accent/30 rounded-xl p-4 hover:shadow-md transition-shadow bg-white">
                          <h4 className="font-medium text-text-main mb-2">{record.title}</h4>
                          <p className="text-sm text-text-soft mb-2">{record.content.substring(0, 100)}...</p>
                          <div className="flex justify-between items-center text-xs text-text-muted">
                            <span>{new Date(record.date).toLocaleDateString('zh-CN')}</span>
                            <Link to={`/records/${record.id}`} className="text-forest-primary hover:text-forest-secondary">查看详情</Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <i className="fa-solid fa-flask text-4xl text-gray-300 mb-4"></i>
                      <p className="text-gray-500 mb-4">该课题还没有实验记录</p>
                      <Link
                        to={`/records?project=${project.id}`}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        创建第一个记录
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'notes' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-text-main">实验笔记</h3>
                    <Link
                      to={`/notes?project=${project.id}`}
                      className="bg-forest-secondary hover:bg-forest-primary text-white px-4 py-2 rounded-xl transition-colors shadow-sm"
                    >
                      <i className="fa-solid fa-plus mr-2"></i>新建笔记
                    </Link>
                  </div>
                  {notes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {notes.map((note) => (
                        <div key={note.id} className="border border-forest-accent/30 rounded-xl p-4 hover:shadow-md transition-shadow bg-white h-auto">
                          <h4 className="font-medium text-text-main mb-2">{note.title}</h4>
                          <p className="text-sm text-text-soft mb-2">{note.content.substring(0, 100)}...</p>
                          <div className="flex justify-between items-center text-xs text-text-muted">
                            <span>{new Date(note.createdAt).toLocaleDateString('zh-CN')}</span>
                            <Link to={`/notes/${note.id}`} className="text-forest-primary hover:text-forest-secondary">查看详情</Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <i className="fa-solid fa-sticky-note text-4xl text-gray-300 mb-4"></i>
                      <p className="text-gray-500 mb-4">该课题还没有实验笔记</p>
                      <Link
                        to={`/notes?project=${project.id}`}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        创建第一个笔记
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'sops' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-text-main">SOP文档</h3>
                    <Link
                      to={`/sops?project=${project.id}`}
                      className="bg-forest-secondary hover:bg-forest-primary text-white px-4 py-2 rounded-xl transition-colors shadow-sm"
                    >
                      <i className="fa-solid fa-plus mr-2"></i>新建SOP
                    </Link>
                  </div>
                  {sops.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sops.map((sop) => (
                        <div key={sop.id} className="border border-forest-accent/30 rounded-xl p-4 hover:shadow-md transition-shadow bg-white">
                          <h4 className="font-medium text-text-main mb-2">{sop.title}</h4>
                          <p className="text-sm text-text-soft mb-2">版本: {sop.version} | 作者: {sop.author}</p>
                          <div className="flex justify-between items-center text-xs text-text-muted">
                            <span>{new Date(sop.lastUpdated).toLocaleDateString('zh-CN')}</span>
                            <Link to={`/sops/${sop.id}`} className="text-forest-primary hover:text-forest-secondary">查看详情</Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <i className="fa-solid fa-file-alt text-4xl text-gray-300 mb-4"></i>
                      <p className="text-gray-500 mb-4">该课题还没有SOP文档</p>
                      <Link
                        to={`/sops?project=${project.id}`}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        创建第一个SOP
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}