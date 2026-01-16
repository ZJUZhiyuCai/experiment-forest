import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { experimentRecordService, experimentNoteService, sopService, projectService } from '@/lib/cachedStorage';
import { ExperimentRecord, ExperimentNote, SOP, Project } from '@/types';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { cn } from '@/lib/utils';

interface ForestStats {
  totalTrees: number;
  seedlings: number;
  saplings: number;
  matureTrees: number;
  forestCoverage: number;
  achievements: string[];
}

// 不对称圆角变体
const cardRadiusVariants = [
  'rounded-[2rem_1rem_2.5rem_1.5rem]',
  'rounded-[1.5rem_2.5rem_1rem_2rem]',
  'rounded-[2.5rem_1.5rem_2rem_1rem]',
  'rounded-[1rem_2rem_1.5rem_2.5rem]',
];

export default function MyForest() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [records, setRecords] = useState<ExperimentRecord[]>([]);
  const [notes, setNotes] = useState<ExperimentNote[]>([]);
  const [sops, setSOPs] = useState<SOP[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedTree, setSelectedTree] = useState<any>(null);
  const [forestStats, setForestStats] = useState<ForestStats>({
    totalTrees: 0,
    seedlings: 0,
    saplings: 0,
    matureTrees: 0,
    forestCoverage: 0,
    achievements: []
  });

  useEffect(() => {
    const allRecords = experimentRecordService.getAll();
    const allNotes = experimentNoteService.getAll();
    const allSOPs = sopService.getAll();
    const allProjects = projectService.getAll();

    setRecords(allRecords);
    setNotes(allNotes);
    setSOPs(allSOPs);
    setProjects(allProjects);

    const totalTrees = allRecords.length + allNotes.length + allSOPs.length;
    const achievements = [];

    if (allRecords.length > 0) achievements.push('播种者');
    if (allNotes.length >= 5) achievements.push('园丁');
    if (allSOPs.length >= 3) achievements.push('森林守护者');
    if (totalTrees >= 20) achievements.push('森林之主');
    if (allProjects.length >= 3) achievements.push('生态建设师');

    setForestStats({
      totalTrees,
      seedlings: allRecords.length,
      saplings: allNotes.length,
      matureTrees: allSOPs.length,
      forestCoverage: Math.min(100, totalTrees * 2.5),
      achievements
    });
  }, []);

  const generateForestLayout = () => {
    const allItems = [
      ...records.map(r => ({ ...r, type: 'record', icon: 'fa-seedling', color: 'var(--moss)' })),
      ...notes.map(n => ({ ...n, type: 'note', icon: 'fa-leaf', color: 'var(--terracotta)' })),
      ...sops.map(s => ({ ...s, type: 'sop', icon: 'fa-tree', color: 'var(--loam)' }))
    ];

    allItems.sort((a, b) => {
      const getItemDate = (item: any) => {
        if (item.type === 'record' && item.createdAt) return new Date(item.createdAt);
        else if (item.type === 'note' && item.createdAt) return new Date(item.createdAt);
        else if (item.type === 'sop' && item.lastUpdated) return new Date(item.lastUpdated);
        return new Date(0);
      };
      return getItemDate(a).getTime() - getItemDate(b).getTime();
    });

    return allItems.map((item, index) => {
      const seed = item.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
      const x = (seed % 80) + 10;
      const y = ((seed * 17) % 60) + 20;
      return { ...item, x, y, size: item.type === 'sop' ? 'large' : item.type === 'note' ? 'medium' : 'small', delay: index * 0.1 };
    });
  };

  const forestTrees = generateForestLayout();

  return (
    <div className="min-h-screen bg-organic-rice-paper text-loam">
      {/* 环境 Blob 背景 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="organic-blob organic-blob--moss w-[600px] h-[600px] -top-40 -right-40 opacity-20" />
        <div className="organic-blob organic-blob--terracotta w-[400px] h-[400px] bottom-0 -left-20 opacity-15" />
        <div className="organic-blob organic-blob--sand w-[300px] h-[300px] top-1/2 left-1/4 opacity-10" />
      </div>

      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={cn('transition-all duration-500 relative z-10', sidebarCollapsed ? 'ml-16' : 'ml-64')}>
        <Header title="我的实验森林" sidebarCollapsed={sidebarCollapsed} />

        <main className="container mx-auto px-6 py-6">
          {/* 森林统计信息 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[
              { icon: 'fa-tree', value: forestStats.totalTrees, label: '总树木数量', color: 'moss' },
              { icon: 'fa-seedling', value: forestStats.seedlings, label: '实验幼苗', color: 'moss' },
              { icon: 'fa-leaf', value: forestStats.saplings, label: '知识枝叶', color: 'terracotta' },
              { icon: 'fa-percentage', value: `${forestStats.forestCoverage}%`, label: '森林覆盖率', color: 'sand' },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  'organic-card p-6 text-center hover:-translate-y-1 hover:shadow-float transition-all',
                  cardRadiusVariants[index]
                )}
              >
                <div className={cn(
                  'w-14 h-14 rounded-xl mx-auto mb-3 flex items-center justify-center',
                  stat.color === 'moss' ? 'bg-moss-soft' : stat.color === 'terracotta' ? 'bg-terracotta-light' : 'bg-organic-stone'
                )}>
                  <i className={cn(
                    'fa-solid text-2xl',
                    stat.icon,
                    stat.color === 'moss' ? 'text-moss' : stat.color === 'terracotta' ? 'text-terracotta' : 'text-bark'
                  )}></i>
                </div>
                <h3 className="text-3xl font-heading font-bold text-loam">{stat.value}</h3>
                <p className="text-grass text-sm">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          {/* 成就展示 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="organic-card p-6 mb-8 rounded-[1.5rem_2.5rem_1rem_2rem]"
          >
            <h2 className="text-xl font-heading font-bold text-loam mb-4 flex items-center">
              <div className="w-10 h-10 rounded-xl bg-terracotta-light flex items-center justify-center mr-3">
                <i className="fa-solid fa-trophy text-terracotta"></i>
              </div>
              森林成就
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { name: '播种者', icon: 'fa-seedling', condition: records.length > 0, description: '创建第一个实验记录' },
                { name: '园丁', icon: 'fa-leaf', condition: notes.length >= 5, description: '创建5个实验笔记' },
                { name: '森林守护者', icon: 'fa-tree', condition: sops.length >= 3, description: '创建3个SOP文档' },
                { name: '森林之主', icon: 'fa-crown', condition: forestStats.totalTrees >= 20, description: '拥有20棵树木' },
                { name: '生态建设师', icon: 'fa-city', condition: projects.length >= 3, description: '管理3个课题项目' }
              ].map((achievement, index) => (
                <motion.div
                  key={achievement.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className={cn(
                    'p-4 rounded-xl text-center transition-all duration-300',
                    achievement.condition
                      ? 'bg-terracotta-light/50 border border-terracotta/30 hover:shadow-terracotta hover:-translate-y-1'
                      : 'bg-organic-stone/50 border border-timber-soft opacity-60'
                  )}
                >
                  <div className={cn(
                    'w-12 h-12 rounded-lg mx-auto mb-2 flex items-center justify-center',
                    achievement.condition ? 'bg-terracotta/20' : 'bg-bark/10'
                  )}>
                    <i className={cn(
                      'fa-solid text-xl',
                      achievement.icon,
                      achievement.condition ? 'text-terracotta' : 'text-bark/50'
                    )}></i>
                  </div>
                  <h4 className={cn('text-sm font-medium mb-1', achievement.condition ? 'text-loam' : 'text-bark/50')}>
                    {achievement.name}
                  </h4>
                  <p className="text-xs text-grass">{achievement.description}</p>
                  {achievement.condition && (
                    <div className="mt-2">
                      <span className="inline-block w-2 h-2 bg-terracotta rounded-full animate-pulse"></span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* 互动森林画布 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="organic-card overflow-hidden rounded-[2.5rem_1rem_2rem_1.5rem]"
          >
            <div className="p-6 border-b border-timber-soft bg-moss-soft/30">
              <h2 className="text-xl font-heading font-bold text-loam flex items-center">
                <i className="fa-solid fa-seedling mr-3 text-moss"></i>
                森林生态图
              </h2>
              <p className="text-grass text-sm mt-1">点击任意树木查看详细信息</p>
            </div>

            <div className="relative h-96 p-6">
              {/* 背景装饰 */}
              <div className="absolute inset-0 overflow-hidden">
                {/* 云朵 */}
                {Array.from({ length: 3 }, (_, i) => (
                  <motion.i
                    key={`cloud-${i}`}
                    className="fa-solid fa-cloud text-white/40 absolute top-4"
                    style={{
                      fontSize: `${16 + i * 4}px`,
                      left: `${20 + i * 30}%`,
                      top: `${10 + i * 5}%`
                    }}
                    animate={{ x: [0, 10, 0] }}
                    transition={{
                      duration: 3 + i,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                ))}

                {/* 太阳 */}
                <motion.i
                  className="fa-solid fa-sun text-status-warning absolute top-4 right-8 text-2xl"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                />
              </div>

              {/* 森林树木 */}
              <div className="relative w-full h-full">
                {forestTrees.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-text-muted">
                      <i className="fa-solid fa-seedling text-6xl mb-4 opacity-30"></i>
                      <h3 className="text-lg font-medium mb-2">森林等待您的第一颗种子</h3>
                      <p className="text-sm mb-6">开始创建实验记录，种下您的第一棵树吧！</p>
                      <Link
                        to="/records/new"
                        className="bg-forest-primary hover:bg-forest-secondary text-white px-6 py-3 rounded-lg transition-colors"
                      >
                        <i className="fa-solid fa-seedling mr-2"></i>
                        种下第一棵树
                      </Link>
                    </div>
                  </div>
                ) : (
                  forestTrees.map((tree) => (
                    <motion.div
                      key={tree.id}
                      className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 group"
                      style={{
                        left: `${tree.x}%`,
                        top: `${tree.y}%`
                      }}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        duration: 0.5,
                        delay: tree.delay,
                        type: "spring"
                      }}
                      whileHover={{ scale: 1.2 }}
                      onClick={() => setSelectedTree(tree)}
                    >
                      {/* 树木图标 */}
                      <div className="relative">
                        <i
                          className={`fa-solid ${tree.icon} transition-all duration-300`}
                          style={{
                            color: tree.color,
                            fontSize: tree.size === 'large' ? '28px' : tree.size === 'medium' ? '20px' : '16px'
                          }}
                        />

                        {/* 树干 */}
                        <div
                          className="absolute top-full left-1/2 transform -translate-x-1/2 bg-earth-brown transition-all duration-300"
                          style={{
                            width: tree.size === 'large' ? '4px' : tree.size === 'medium' ? '3px' : '2px',
                            height: tree.size === 'large' ? '12px' : tree.size === 'medium' ? '8px' : '6px'
                          }}
                        />

                        {/* Hover提示 */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-black/80 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {tree.title}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </motion.div>

          {/* 选中树木的详情弹窗 */}
          {selectedTree && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedTree(null)}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-xl p-6 max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-forest-primary flex items-center">
                    <i className={`fa-solid ${selectedTree.icon} mr-2`} style={{ color: selectedTree.color }}></i>
                    {selectedTree.title}
                  </h3>
                  <button
                    onClick={() => setSelectedTree(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <i className="fa-solid fa-times"></i>
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-600">类型: </span>
                    <span className="text-sm font-medium">
                      {selectedTree.type === 'record' ? '实验记录 🌱' :
                        selectedTree.type === 'note' ? '实验笔记 🍃' : 'SOP文档 🌳'}
                    </span>
                  </div>

                  <div>
                    <span className="text-sm text-gray-600">种植时间: </span>
                    <span className="text-sm font-medium">
                      {new Date(selectedTree.createdAt || selectedTree.lastUpdated).toLocaleDateString('zh-CN')}
                    </span>
                  </div>

                  {selectedTree.content && (
                    <div>
                      <span className="text-sm text-gray-600">描述: </span>
                      <p className="text-sm text-gray-800 mt-1">
                        {selectedTree.content.substring(0, 100)}...
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end mt-6 space-x-3">
                  <button
                    onClick={() => setSelectedTree(null)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    关闭
                  </button>
                  <Link
                    to={`/${selectedTree.type === 'record' ? 'records' : selectedTree.type === 'note' ? 'notes' : 'sops'}/${selectedTree.id}`}
                    className="px-4 py-2 bg-forest-primary text-white rounded-lg hover:bg-forest-secondary transition-colors"
                  >
                    查看详情
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          )}
        </main>
      </div>
    </div>
  );
}