import { useState, useEffect } from 'react';
import { Variants, motion } from 'framer-motion';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { projectService, experimentRecordService } from '@/lib/cachedStorage';
import { Project, ExperimentRecord } from '@/types';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

// 不对称圆角变体
const cardRadiusVariants = [
  'rounded-[2rem_1rem_2.5rem_1.5rem]',
  'rounded-[1.5rem_2.5rem_1rem_2rem]',
  'rounded-[2.5rem_1.5rem_2rem_1rem]',
  'rounded-[1rem_2rem_1.5rem_2.5rem]',
];

export default function Dashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentRecords, setRecentRecords] = useState<ExperimentRecord[]>([]);

  useEffect(() => {
    setProjects(projectService.getAll());
    setRecentRecords(experimentRecordService.getAll().slice(0, 5));
  }, []);

  const stats = [
    { label: '活跃课题', value: projects.length, icon: 'fa-folder-tree', color: 'moss' },
    { label: '实验记录', value: experimentRecordService.getAll().length, icon: 'fa-seedling', color: 'moss' },
    { label: 'SOP文档', value: 12, icon: 'fa-book-medical', color: 'terracotta' },
    { label: '成功率', value: '94%', icon: 'fa-chart-line', color: 'status-success' },
  ];

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20, scale: 0.98 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 200, damping: 20 } as any }
  };

  return (
    <div className="min-h-screen bg-organic-rice-paper text-loam">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <main className="flex-1 flex flex-col">
        <Header
          title="系统概览"
          sidebarCollapsed={sidebarCollapsed}
          breadcrumb={[{ label: '系统' }, { label: '仪表盘' }]}
        />

        <motion.div
          className={cn('p-8 space-y-10 transition-all duration-500 relative', sidebarCollapsed ? 'ml-16' : 'ml-64')}
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          {/* 环境 Blob 背景 */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="organic-blob organic-blob--moss w-[500px] h-[500px] -top-24 -right-24 opacity-25" />
            <div className="organic-blob organic-blob--sand w-[400px] h-[400px] bottom-10 -left-24 opacity-20" />
            <div className="organic-blob organic-blob--clay w-[300px] h-[300px] top-1/2 left-1/2 opacity-15" />
          </div>

          {/* 统计网格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                className={cn(
                  'organic-card p-6 flex flex-col justify-between h-40 group',
                  cardRadiusVariants[index % 4],
                  'hover:-translate-y-2 hover:shadow-float'
                )}
              >
                <div className="flex justify-between items-start">
                  <span className="text-sm font-medium text-grass uppercase tracking-wide">{stat.label}</span>
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    stat.color === 'moss' ? 'bg-moss-soft' :
                      stat.color === 'terracotta' ? 'bg-terracotta-light' :
                        'bg-status-success/15'
                  )}>
                    <i className={cn(
                      'fa-solid text-lg',
                      stat.icon,
                      stat.color === 'moss' ? 'text-moss' :
                        stat.color === 'terracotta' ? 'text-terracotta' :
                          'text-status-success'
                    )}></i>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-heading font-bold text-loam tabular-nums tracking-tight">
                    {stat.value}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
            {/* 活跃课题 */}
            <motion.div variants={itemVariants} className="lg:col-span-2 space-y-6">
              <div className="flex justify-between items-end">
                <h2 className="text-xl font-heading font-bold text-loam">活跃课题</h2>
                <Link to="/projects" className="text-sm font-medium text-moss hover:text-terracotta transition-colors underline underline-offset-4 decoration-moss/30">
                  查看全部
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.slice(0, 4).map((project, index) => (
                  <Link key={project.id} to={`/projects/${project.id}`}>
                    <div className={cn(
                      'organic-card p-5 group hover:shadow-float hover:-translate-y-1',
                      cardRadiusVariants[index % 4]
                    )}>
                      <div className="flex justify-between items-center mb-4">
                        <span className="px-2.5 py-1 rounded-full bg-moss-soft text-moss text-xs font-medium uppercase">
                          {project.status || '进行中'}
                        </span>
                        <div className="w-2 h-2 rounded-full bg-status-success"></div>
                      </div>
                      <h3 className="text-lg font-heading font-bold text-loam mb-1 group-hover:text-moss transition-colors truncate">
                        {project.title}
                      </h3>
                      <p className="text-sm text-bark line-clamp-1 mb-4">
                        {project.description}
                      </p>
                      <div className="flex justify-between items-center pt-4 border-t border-timber-soft">
                        <span className="text-xs text-grass">更新: {new Date().toLocaleDateString('zh-CN')}</span>
                        <i className="fa-solid fa-arrow-right text-xs opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-moss"></i>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>

            {/* 最近记录 */}
            <motion.div variants={itemVariants} className="space-y-6">
              <div className="flex justify-between items-end">
                <h2 className="text-xl font-heading font-bold text-loam">最近记录</h2>
                <Link to="/records" className="text-sm font-medium text-terracotta hover:text-moss transition-colors underline underline-offset-4 decoration-terracotta/30">
                  历史记录
                </Link>
              </div>

              <div className="organic-card p-6 space-y-5 rounded-[2rem_1.5rem_2.5rem_1rem]">
                {recentRecords.map((record, index) => (
                  <div key={record.id} className="relative pl-6 group">
                    {index !== recentRecords.length - 1 && (
                      <div className="absolute left-[3px] top-4 bottom-[-20px] w-px bg-timber" />
                    )}
                    <div className="absolute left-0 top-1 w-2 h-2 rounded-full border-2 border-moss bg-organic-rice-paper group-hover:bg-moss transition-colors" />
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs text-grass">
                        <span>{new Date(record.date).toLocaleDateString('zh-CN')}</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">#{record.id.slice(0, 4)}</span>
                      </div>
                      <Link to={`/records/${record.id}`}>
                        <h4 className="text-sm font-semibold text-loam group-hover:text-moss transition-colors cursor-pointer line-clamp-1">
                          {record.title}
                        </h4>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {/* 提示卡片 */}
              <div className="organic-card p-4 flex items-center gap-3 opacity-80 hover:opacity-100 transition-opacity border-dashed rounded-[1.5rem_2rem_1rem_2.5rem]">
                <div className="w-10 h-10 rounded-xl bg-terracotta-light flex items-center justify-center">
                  <i className="fa-solid fa-lightbulb text-terracotta"></i>
                </div>
                <p className="text-xs text-bark leading-relaxed">
                  系统提示: 您有 3 个待处理的实验记录草稿，建议尽快完善并提交。
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
