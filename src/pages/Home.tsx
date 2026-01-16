import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { experimentRecordService, experimentNoteService, sopService } from '@/lib/cachedStorage';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { cn } from '@/lib/utils';

// 不对称圆角变体
const cardRadiusVariants = [
  'rounded-[2rem_1rem_2.5rem_1.5rem]',
  'rounded-[1.5rem_2.5rem_1rem_2rem]',
  'rounded-[2.5rem_1.5rem_2rem_1rem]',
];

/**
 * 🌿 有机首页 (Organic Home)
 * 侘寂风格 - 温暖、自然、不完美之美
 */
export default function Home() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [stats, setStats] = useState({ records: 0, notes: 0, sops: 0 });

  useEffect(() => {
    try {
      const records = experimentRecordService.getAll();
      const notes = experimentNoteService.getAll();
      const sops = sopService.getAll();
      setStats({ records: records.length, notes: notes.length, sops: sops.length });
    } catch (error) {
      console.error('获取统计数据失败:', error);
      setStats({ records: 0, notes: 0, sops: 0 });
    }
  }, []);

  return (
    <div className="min-h-screen bg-organic-rice-paper text-loam">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={cn('transition-all duration-500', sidebarCollapsed ? 'ml-16' : 'ml-64')}>
        <Header
          title="实验管理系统"
          sidebarCollapsed={sidebarCollapsed}
        />

        <main className="container mx-auto px-6 py-8 relative">
          {/* 环境 Blob 背景 */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="organic-blob organic-blob--moss w-[500px] h-[500px] -top-20 -right-20 opacity-30" />
            <div className="organic-blob organic-blob--clay w-[400px] h-[400px] top-1/2 -left-40 opacity-20" />
          </div>

          {/* 英雄区 - 有机卡片 */}
          <section className="mb-12 relative z-10">
            <motion.div
              className={cn(
                'organic-card organic-card--asymmetric-1 p-8 md:p-10',
                'bg-gradient-to-br from-organic-card to-organic-stone/30'
              )}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <h1 className="text-4xl md:text-5xl font-heading font-bold text-loam mb-4 leading-tight">
                欢迎来到
                <span className="gradient-text"> 实验小森林</span>
              </h1>
              <p className="text-bark text-lg mb-8 max-w-2xl">
                高效管理实验记录、笔记和标准操作流程，让每一次科研发现都生根发芽 🌱
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  to="/records/new"
                  className={cn(
                    'organic-btn organic-btn--primary',
                    'inline-flex items-center gap-2'
                  )}
                >
                  <i className="fa-solid fa-plus"></i>
                  创建实验记录
                </Link>
                <Link
                  to="/calendar"
                  className="organic-btn organic-btn--outline inline-flex items-center gap-2"
                >
                  <i className="fa-solid fa-calendar"></i>
                  查看实验日历
                </Link>
              </div>
            </motion.div>
          </section>

          {/* 统计卡片 - 不对称圆角 */}
          <section className="mb-12 relative z-10">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { label: '实验记录', emoji: '🌱', count: stats.records, path: '/records', color: 'moss', btnText: '查看幼苗' },
                { label: '实验笔记', emoji: '🍃', count: stats.notes, path: '/notes', color: 'terracotta', btnText: '查看枝叶' },
                { label: 'SOP文档', emoji: '🌳', count: stats.sops, path: '/sops', color: 'moss', btnText: '查看大树' },
              ].map((item, index) => (
                <motion.div
                  key={item.label}
                  className={cn(
                    'organic-card p-6',
                    cardRadiusVariants[index],
                    'hover:-translate-y-2 hover:shadow-float'
                  )}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 * (index + 1) }}
                >
                  <div className="flex justify-between items-start mb-5">
                    <div>
                      <p className="text-grass text-sm mb-1">{item.label} {item.emoji}</p>
                      <h3 className={cn(
                        'text-4xl font-heading font-bold',
                        item.color === 'moss' ? 'text-moss' : 'text-terracotta'
                      )}>
                        {item.count}
                      </h3>
                    </div>
                    <div className={cn(
                      'w-14 h-14 rounded-2xl flex items-center justify-center',
                      item.color === 'moss' ? 'bg-moss-soft' : 'bg-terracotta-light',
                      'shadow-minimal'
                    )}>
                      <i className={cn(
                        'fa-solid text-2xl',
                        index === 0 ? 'fa-seedling text-moss' :
                          index === 1 ? 'fa-leaf text-terracotta' :
                            'fa-tree text-moss'
                      )}></i>
                    </div>
                  </div>
                  <Link
                    to={item.path}
                    className={cn(
                      'block w-full text-center py-2.5 rounded-full',
                      'border-2 transition-all duration-300',
                      item.color === 'moss'
                        ? 'border-moss/30 text-moss hover:bg-moss hover:text-moss-light hover:border-moss'
                        : 'border-terracotta/30 text-terracotta hover:bg-terracotta hover:text-white hover:border-terracotta',
                      'text-sm font-semibold'
                    )}
                  >
                    {item.btnText}
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>

          {/* 我的实验森林 - 有机风格 */}
          <section className="mb-12 relative z-10">
            <motion.div
              className="organic-card organic-card--asymmetric-2 overflow-hidden"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h2 className="text-2xl font-heading font-bold text-loam mb-2 flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl bg-moss flex items-center justify-center shadow-moss">
                        <i className="fa-solid fa-seedling text-moss-light"></i>
                      </span>
                      我的实验森林
                    </h2>
                    <p className="text-bark">每一次实验都是森林中的新生命 🌿</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-grass mb-1">森林覆盖率</p>
                    <p className="text-3xl font-heading font-bold text-moss">
                      {Math.min(100, Math.round((stats.records + stats.notes + stats.sops) * 3.33))}%
                    </p>
                  </div>
                </div>

                {/* 森林可视化区域 */}
                <div className="relative h-52 bg-gradient-to-t from-terracotta/10 via-organic-stone/30 to-moss-soft/20 rounded-3xl overflow-hidden mb-8">
                  {/* 地面 */}
                  <div className="absolute bottom-0 w-full h-10 bg-gradient-to-t from-terracotta/20 to-transparent"></div>

                  {/* 动态生成的树木 */}
                  <div className="absolute inset-0 flex items-end justify-center space-x-5 px-8 pb-4">
                    {/* 实验记录 - 幼苗 */}
                    {Array.from({ length: Math.min(stats.records, 8) }, (_, i) => (
                      <motion.div
                        key={`record-${i}`}
                        className="flex flex-col items-center cursor-pointer group"
                        initial={{ scale: 0, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: i * 0.1 }}
                        whileHover={{ scale: 1.15, y: -4 }}
                      >
                        <i className="fa-solid fa-seedling text-moss text-xl group-hover:text-terracotta transition-colors duration-300"></i>
                        <div className="w-1 h-3 bg-terracotta/60 rounded-full mt-1"></div>
                      </motion.div>
                    ))}

                    {/* 实验笔记 - 小树 */}
                    {Array.from({ length: Math.min(stats.notes, 6) }, (_, i) => (
                      <motion.div
                        key={`note-${i}`}
                        className="flex flex-col items-center cursor-pointer group"
                        initial={{ scale: 0, y: 30 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: (stats.records * 0.1) + (i * 0.15) }}
                        whileHover={{ scale: 1.15, y: -4 }}
                      >
                        <i className="fa-solid fa-leaf text-moss/70 text-2xl group-hover:text-moss transition-colors duration-300"></i>
                        <div className="w-1.5 h-5 bg-terracotta/60 rounded-full mt-1"></div>
                      </motion.div>
                    ))}

                    {/* SOP文档 - 大树 */}
                    {Array.from({ length: Math.min(stats.sops, 4) }, (_, i) => (
                      <motion.div
                        key={`sop-${i}`}
                        className="flex flex-col items-center cursor-pointer group"
                        initial={{ scale: 0, y: 40 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: (stats.records * 0.1) + (stats.notes * 0.15) + (i * 0.2) }}
                        whileHover={{ scale: 1.15, y: -4 }}
                      >
                        <i className="fa-solid fa-tree text-moss text-3xl group-hover:text-terracotta transition-colors duration-300"></i>
                        <div className="w-2 h-7 bg-terracotta/70 rounded-full mt-1"></div>
                      </motion.div>
                    ))}
                  </div>

                  {/* 天空中的云朵 */}
                  <div className="absolute top-5 right-10">
                    <motion.i
                      className="fa-solid fa-cloud text-organic-card/60 text-2xl"
                      animate={{ x: [0, 12, 0] }}
                      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                    ></motion.i>
                  </div>
                  <div className="absolute top-10 left-14">
                    <motion.i
                      className="fa-solid fa-cloud text-organic-card/40 text-lg"
                      animate={{ x: [0, -10, 0] }}
                      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    ></motion.i>
                  </div>

                  {/* 空状态 */}
                  {(stats.records + stats.notes + stats.sops) === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center text-grass">
                        <i className="fa-solid fa-seedling text-5xl mb-4 opacity-30"></i>
                        <p className="text-sm">开始您的第一个实验，种下第一棵树苗吧！</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 森林成就 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { icon: 'fa-award', label: '播种者', condition: stats.records > 0, progress: null },
                    { icon: 'fa-medal', label: '园丁', condition: stats.notes >= 5, progress: stats.notes < 5 ? `${stats.notes}/5` : null },
                    { icon: 'fa-crown', label: '森林守护者', condition: stats.sops >= 3, progress: stats.sops < 3 ? `${stats.sops}/3` : null },
                  ].map((badge, index) => (
                    <div
                      key={badge.label}
                      className={cn(
                        'rounded-2xl p-4 text-center transition-all duration-300',
                        badge.condition
                          ? 'bg-moss-soft border border-moss/20'
                          : 'bg-organic-stone/50 border border-timber-soft'
                      )}
                    >
                      <i className={cn(
                        'fa-solid text-2xl mb-2',
                        badge.icon,
                        badge.condition ? 'text-terracotta' : 'text-grass/50'
                      )}></i>
                      <p className="text-xs text-grass mb-1">{badge.label}</p>
                      <p className={cn(
                        'text-sm font-semibold',
                        badge.condition ? 'text-moss' : 'text-bark'
                      )}>
                        {badge.condition ? '已解锁' : badge.progress}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </section>

          {/* 今日种树提醒 */}
          <section className="mb-12 relative z-10">
            <motion.div
              className={cn(
                'organic-card organic-card--asymmetric-3 p-6',
                'bg-gradient-to-r from-moss-soft/50 to-terracotta-light/30'
              )}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-terracotta flex items-center justify-center shadow-clay">
                    <i className="fa-solid fa-calendar-day text-white text-xl"></i>
                  </div>
                  <div>
                    <h3 className="text-lg font-heading font-bold text-loam">今日种树目标</h3>
                    <p className="text-bark text-sm">完成一个实验记录，为森林添加新绿意</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Link
                    to="/records"
                    className="organic-btn organic-btn--primary text-sm px-5 py-2"
                  >
                    <i className="fa-solid fa-seedling mr-2"></i>种下幼苗
                  </Link>
                  <Link
                    to="/notes"
                    className="organic-btn organic-btn--secondary text-sm px-5 py-2"
                  >
                    <i className="fa-solid fa-leaf mr-2"></i>添加枝叶
                  </Link>
                </div>
              </div>
            </motion.div>
          </section>

          {/* 页脚 */}
          <footer className="relative z-10 mt-20 pt-8 border-t border-timber-soft text-center">
            <p className="text-grass text-sm">🌲 实验小森林 - 让每一次发现都生根发芽 🌱</p>
            <p className="mt-2 text-xs text-grass/70">
              作者：Zhiyu Cai 邮箱：22519085@zju.edu.cn
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}