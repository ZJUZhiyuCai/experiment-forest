import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { experimentRecordService, experimentNoteService, sopService } from '@/lib/cachedStorage';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';

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
    <div className="min-h-screen bg-[#F9F6F2] text-[#555555]">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header 
          title="实验管理系统" 
          sidebarCollapsed={sidebarCollapsed}
        />
        
        <main className="container mx-auto px-4 py-6">
          <section className="mb-10">
            <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl shadow-lg border border-white/20 overflow-hidden p-8">
              <motion.h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent mb-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>欢迎来到实验小森林</motion.h1>
              <p className="text-[#666666] mb-6 text-lg">高效管理实验记录、笔记和标准操作流程，让科研工作更轻松</p>
              <div className="flex flex-wrap gap-4">
                <Link to="/records/new" className="bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 shadow-md hover:shadow-lg"><i className="fa-solid fa-plus mr-2"></i>创建实验记录</Link>
                <Link to="/calendar" className="border-2 border-emerald-500 text-emerald-600 bg-white/30 backdrop-blur-sm hover:bg-white/50 px-6 py-3 rounded-lg font-semibold transition-all duration-300 shadow-sm"><i className="fa-solid fa-calendar mr-2"></i>查看实验日历</Link>
              </div>
            </div>
          </section>
          
          {/* 统计数据卡片 */}
          <section className="mb-10">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <motion.div className="bg-white/70 backdrop-blur-md rounded-xl shadow-md border border-white/20 p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
                <div className="flex justify-between items-start mb-4">
                  <div><p className="text-[#888888] text-sm">实验记录 🌱</p><h3 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">{stats.records}</h3></div>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shadow-sm"><i className="fa-solid fa-seedling text-emerald-500 text-xl"></i></div>
                </div>
                <Link to="/records" className="block w-full text-center border border-emerald-200 text-emerald-600 hover:bg-emerald-50 px-4 py-2 rounded-lg transition-all duration-300 text-sm">查看幼苗</Link>
              </motion.div>
              
              <motion.div className="bg-white/70 backdrop-blur-md rounded-xl shadow-md border border-white/20 p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
                <div className="flex justify-between items-start mb-4">
                  <div><p className="text-[#888888] text-sm">实验笔记 🍃</p><h3 className="text-3xl font-bold bg-gradient-to-r from-[#7FB069] to-[#A8D5BA] bg-clip-text text-transparent">{stats.notes}</h3></div>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center shadow-sm"><i className="fa-solid fa-leaf text-[#7FB069] text-xl"></i></div>
                </div>
                <Link to="/notes" className="block w-full text-center border border-green-200 text-[#7FB069] hover:bg-green-50 px-4 py-2 rounded-lg transition-all duration-300 text-sm">查看枝叶</Link>
              </motion.div>
              
              <motion.div className="bg-white/70 backdrop-blur-md rounded-xl shadow-md border border-white/20 p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.3 }}>
                <div className="flex justify-between items-start mb-4">
                  <div><p className="text-[#888888] text-sm">SOP文档 🌳</p><h3 className="text-3xl font-bold bg-gradient-to-r from-[#4A7C59] to-[#7FB069] bg-clip-text text-transparent">{stats.sops}</h3></div>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4A7C59]/20 to-[#7FB069]/20 flex items-center justify-center shadow-sm"><i className="fa-solid fa-tree text-[#4A7C59] text-xl"></i></div>
                </div>
                <Link to="/sops" className="block w-full text-center border border-[#4A7C59]/30 text-[#4A7C59] hover:bg-[#4A7C59]/10 px-4 py-2 rounded-lg transition-all duration-300 text-sm">查看大树</Link>
              </motion.div>
            </div>
          </section>

          {/* 我的实验森林 */}
          <section className="mb-10">
            <div className="bg-gradient-to-br from-[#F7FDF0] to-[#A8D5BA]/20 rounded-xl shadow-lg border border-[#A8D5BA]/30 overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-[#4A7C59] mb-2 flex items-center">
                      <i className="fa-solid fa-seedling mr-3 text-[#7FB069]"></i>
                      我的实验森林
                    </h2>
                    <p className="text-[#666666]">每一次实验都是森林中的新生命 🌿</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-[#888888]">森林覆盖率</p>
                    <p className="text-2xl font-bold text-[#4A7C59]">{Math.min(100, Math.round((stats.records + stats.notes + stats.sops) * 3.33))}%</p>
                  </div>
                </div>
                
                {/* 森林可视化区域 */}
                <div className="relative h-48 bg-gradient-to-t from-[#8B4513]/10 to-[#87CEEB]/20 rounded-lg overflow-hidden mb-6">
                  {/* 地面 */}
                  <div className="absolute bottom-0 w-full h-8 bg-gradient-to-t from-[#8B4513]/20 to-transparent"></div>
                  
                  {/* 动态生成的树木 */}
                  <div className="absolute inset-0 flex items-end justify-center space-x-4 px-8">
                    {/* 实验记录 - 幼苗 */}
                    {Array.from({ length: Math.min(stats.records, 8) }, (_, i) => (
                      <motion.div
                        key={`record-${i}`}
                        className="flex flex-col items-center cursor-pointer group"
                        initial={{ scale: 0, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: i * 0.1 }}
                        whileHover={{ scale: 1.1 }}
                      >
                        <i className="fa-solid fa-seedling text-[#7FB069] text-lg group-hover:text-[#4A7C59] transition-colors"></i>
                        <div className="w-1 h-2 bg-[#8B4513] group-hover:bg-[#8B4513]/80 transition-colors"></div>
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
                        whileHover={{ scale: 1.1 }}
                      >
                        <i className="fa-solid fa-leaf text-[#A8D5BA] text-xl group-hover:text-[#7FB069] transition-colors"></i>
                        <div className="w-1 h-4 bg-[#8B4513] group-hover:bg-[#8B4513]/80 transition-colors"></div>
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
                        whileHover={{ scale: 1.1 }}
                      >
                        <i className="fa-solid fa-tree text-[#4A7C59] text-2xl group-hover:text-[#7FB069] transition-colors"></i>
                        <div className="w-2 h-6 bg-[#8B4513] group-hover:bg-[#8B4513]/80 transition-colors"></div>
                      </motion.div>
                    ))}
                  </div>
                  
                  {/* 天空中的云朵 */}
                  <div className="absolute top-4 right-8">
                    <motion.i 
                      className="fa-solid fa-cloud text-white/40 text-xl"
                      animate={{ x: [0, 10, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    ></motion.i>
                  </div>
                  <div className="absolute top-8 left-12">
                    <motion.i 
                      className="fa-solid fa-cloud text-white/30 text-sm"
                      animate={{ x: [0, -8, 0] }}
                      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                    ></motion.i>
                  </div>
                  
                  {/* 如果没有内容，显示空旷的土地 */}
                  {(stats.records + stats.notes + stats.sops) === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center text-[#888888]">
                        <i className="fa-solid fa-seedling text-4xl mb-4 opacity-30"></i>
                        <p className="text-sm">开始您的第一个实验，种下第一棵树苗吧！</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* 森林成就 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white/50 rounded-lg p-3 text-center">
                    <i className="fa-solid fa-award text-[#FFD700] text-lg mb-1"></i>
                    <p className="text-xs text-[#666666]">播种者</p>
                    <p className="text-sm font-medium text-[#4A7C59]">{stats.records > 0 ? '已解锁' : '待解锁'}</p>
                  </div>
                  <div className="bg-white/50 rounded-lg p-3 text-center">
                    <i className="fa-solid fa-medal text-[#C0C0C0] text-lg mb-1"></i>
                    <p className="text-xs text-[#666666]">园丁</p>
                    <p className="text-sm font-medium text-[#4A7C59]">{stats.notes >= 5 ? '已解锁' : `${stats.notes}/5`}</p>
                  </div>
                  <div className="bg-white/50 rounded-lg p-3 text-center">
                    <i className="fa-solid fa-crown text-[#FFD700] text-lg mb-1"></i>
                    <p className="text-xs text-[#666666]">森林守护者</p>
                    <p className="text-sm font-medium text-[#4A7C59]">{stats.sops >= 3 ? '已解锁' : `${stats.sops}/3`}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
          
          {/* 今日种树提醒 */}
          <section className="mb-10">
            <div className="bg-gradient-to-r from-[#A8D5BA]/20 to-[#7FB069]/20 rounded-xl border border-[#A8D5BA]/40 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <i className="fa-solid fa-calendar-day text-[#4A7C59] text-2xl mr-4"></i>
                  <div>
                    <h3 className="text-lg font-bold text-[#4A7C59]">今日种树目标</h3>
                    <p className="text-[#666666] text-sm">完成一个实验记录，为森林添加新绿意</p>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <Link to="/records" className="bg-[#4A7C59] hover:bg-[#7FB069] text-white px-4 py-2 rounded-lg transition-colors text-sm">
                    <i className="fa-solid fa-seedling mr-1"></i>种下幼苗
                  </Link>
                  <Link to="/notes" className="bg-[#7FB069] hover:bg-[#A8D5BA] text-white px-4 py-2 rounded-lg transition-colors text-sm">
                    <i className="fa-solid fa-leaf mr-1"></i>添加枝叶
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <footer className="mt-16 pt-6 border-t border-[#E6F0FA] text-center text-sm text-[#888888]"><p>🌲 实验小森林 - 让每一次发现都生根发芽 🌱</p><p className="mt-1 text-xs">作者：Zhiyu Cai 邮箱：3210102604@zju.edu.cn</p></footer>
        </main>
      </div>
    </div>
  );
}