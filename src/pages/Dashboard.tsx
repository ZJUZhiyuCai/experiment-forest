import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  experimentRecordService, 
  experimentNoteService, 
  sopService,
  projectService
} from '@/lib/cachedStorage';
import { ExperimentRecord, ExperimentNote, SOP, Project } from '@/types';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/Button';
import { RecordCard } from '@/components/RecordCard';
import { NoteCard } from '@/components/NoteCard';
import { SOPCard } from '@/components/SOPCard';
import { Empty } from '@/components/Empty';

export default function Dashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [recentRecords, setRecentRecords] = useState<ExperimentRecord[]>([]);
  const [recentNotes, setRecentNotes] = useState<ExperimentNote[]>([]);
  const navigate = useNavigate();
  const [featuredSOPs, setFeaturedSOPs] = useState<SOP[]>([]);
  const [topics, setTopics] = useState<Project[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // 优化统计数据计算
  const stats = useMemo(() => {
    return {
      records: experimentRecordService.getAll().length,
      notes: experimentNoteService.getAll().length,
      sops: sopService.getAll().length
    };
  }, []);

  // 计算当前月份有记录的日期
  const recordsByDate = useMemo(() => {
    const allRecords = experimentRecordService.getAll();
    const dateMap = new Map<number, number>();

    allRecords.forEach(record => {
      const recordDate = new Date(record.date);
      // 检查是否是当前月份
      if (
        recordDate.getMonth() === currentMonth.getMonth() &&
        recordDate.getFullYear() === currentMonth.getFullYear()
      ) {
        const day = recordDate.getDate();
        dateMap.set(day, (dateMap.get(day) || 0) + 1);
      }
    });

    return dateMap;
  }, [currentMonth]);

  useEffect(() => {
    // 获取所有课题
    const allTopics = projectService.getAll();
    setTopics(allTopics);
    
    // 获取最近的实验记录

    
    // 获取最近的实验记录
    const records = experimentRecordService.getAll();
    const sortedRecords = [...records].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    setRecentRecords(sortedRecords.slice(0, 3));
    
    // 获取最近的实验笔记
    const notes = experimentNoteService.getAll();
    const sortedNotes = [...notes].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    setRecentNotes(sortedNotes.slice(0, 3));
    
    // 获取精选SOP
    const sops = sopService.getAll();
    setFeaturedSOPs(sops.slice(0, 3));
  }, []);
  
  return (
    <div className="min-h-screen bg-[#F7FDF0] text-[#555555]">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header 
          title="实验森林控制台" 
          sidebarCollapsed={sidebarCollapsed}
        />
        
        <main className="container mx-auto px-4 py-6">
          {/* 欢迎横幅 */}
          <section className="mb-8">
            <div className="bg-gradient-to-br from-[#A8D5BA]/30 to-[#7FB069]/20 rounded-xl border border-[#A8D5BA]/40 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-[#4A7C59] mb-2 flex items-center">
                    <i className="fa-solid fa-seedling mr-3 text-[#7FB069]"></i>
                    欢迎回到实验小森林
                  </h1>
                  <p className="text-[#666666]">今日新增 {recentRecords.filter(r => new Date(r.date).toDateString() === new Date().toDateString()).length} 条记录，森林正在茁壮成长 🌱</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-[#888888]">森林繁茂度</p>
                  <p className="text-2xl font-bold text-[#4A7C59]">{Math.min(100, (stats.records + stats.notes + stats.sops) * 2)}%</p>
                </div>
              </div>
            </div>
          </section>

          {/* 快捷操作区 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <motion.div 
              className="bg-gradient-to-br from-[#A8D5BA] to-[#7FB069] rounded-xl shadow-md p-6 text-white flex flex-col justify-between hover:shadow-lg transition-all duration-300"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.3 }}
            >
              <div>
                <h3 className="text-lg font-semibold mb-1 flex items-center">
                  <i className="fa-solid fa-seedling mr-2"></i>
                  实验记录
                </h3>
                <p className="text-green-100 text-sm mb-4">种下实验的种子，记录科学的萌芽</p>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">{stats.records}</span>
                <Link to="/records/new" className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-all duration-300 text-sm border border-white/30">
                  <i className="fa-solid fa-plus mr-1"></i>
                  种植
                </Link>
              </div>
            </motion.div>
             
            <motion.div 
              className="bg-gradient-to-br from-[#7FB069] to-[#4A7C59] rounded-xl shadow-md p-6 text-white flex flex-col justify-between hover:shadow-lg transition-all duration-300"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.3 }}
            >
              <div>
                <h3 className="text-lg font-semibold mb-1 flex items-center">
                  <i className="fa-solid fa-leaf mr-2"></i>
                  实验笔记
                </h3>
                <p className="text-green-100 text-sm mb-4">为知识之树增添新的枝叶</p>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">{stats.notes}</span>
                <Link to="/notes/new" className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-all duration-300 text-sm border border-white/30">
                  <i className="fa-solid fa-plus mr-1"></i>
                  生长
                </Link>
              </div>
            </motion.div>
             
            <motion.div 
              className="bg-gradient-to-br from-[#4A7C59] to-[#8B4513] rounded-xl shadow-md p-6 text-white flex flex-col justify-between hover:shadow-lg transition-all duration-300"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.3 }}
            >
              <div>
                <h3 className="text-lg font-semibold mb-1 flex items-center">
                  <i className="fa-solid fa-tree mr-2"></i>
                  SOP文档
                </h3>
                <p className="text-amber-100 text-sm mb-4">培育成熟的知识大树</p>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">{stats.sops}</span>
                <Link to="/sops/new" className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-all duration-300 text-sm border border-white/30">
                  <i className="fa-solid fa-plus mr-1"></i>
                  栽培
                </Link>
              </div>
            </motion.div>
          </div>
          
          {/* 最近实验记录 */}
          <section className="mb-10">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[#4A7C59] flex items-center">
                <i className="fa-solid fa-seedling mr-2 text-[#7FB069]"></i>
                最近的幼苗
              </h2>
              <Button asChild variant="outline" size="sm">
                <Link to="/records">查看全部</Link>
              </Button>
            </div>
            
            {recentRecords.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recentRecords.map(record => (
                  <RecordCard key={record.id} record={record} />
                ))}
              </div>
            ) : (
              <Empty />
            )}
          </section>
          
          {/* 最近实验笔记 */}
          <section className="mb-10">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[#4A7C59] flex items-center">
                <i className="fa-solid fa-leaf mr-2 text-[#7FB069]"></i>
                最新的枝叶
              </h2>
              <Button asChild variant="outline" size="sm">
                <Link to="/notes">查看全部</Link>
              </Button>
            </div>
            
            {recentNotes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recentNotes.map(note => (
                  <NoteCard key={note.id} note={note} />
                ))}
              </div>
            ) : (
              <Empty />
            )}
          </section>
          
          {/* 常用SOP文档 */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[#4A7C59] flex items-center">
                <i className="fa-solid fa-tree mr-2 text-[#7FB069]"></i>
                知识大树
              </h2>
              <Button asChild variant="outline" size="sm">
                <Link to="/sops">查看全部</Link>
              </Button>
            </div>
            
            {featuredSOPs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredSOPs.map(sop => (
                  <SOPCard key={sop.id} sop={sop} />
                ))}
              </div>
            ) : (
              <Empty />
            )}
            </section>
            
            {/* 课题概览 */}
            <section className="mb-10">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100">
                  课题概览
                </h2>
                <Button asChild variant="outline" size="sm">
                  <Link to="/projects">查看所有课题</Link>
                </Button>
              </div>
              
              <div className="bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-600 p-6 transition-all duration-300 hover:shadow-md dark:hover:shadow-2xl">
                {topics.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {topics.slice(0, 3).map(project => (
                      <div 
                        key={project.id}
                        className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg border border-gray-200 dark:border-slate-600 hover:shadow-md transition-all duration-300 cursor-pointer"
                        onClick={() => navigate(`/projects/${project.id}`)}
                      >
                        <h3 className="font-medium text-gray-800 dark:text-slate-200 mb-1">{project.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-slate-400 line-clamp-2">{project.description || '无描述'}</p>
                        <div className="mt-3 flex justify-between items-center text-xs text-gray-500 dark:text-slate-400">
                          <span>
                            <i className="fa-solid fa-calendar mr-1"></i>
                            {new Date(project.createdAt).toLocaleDateString()}
                          </span>
                          <Button asChild size="sm" variant="outline" className="h-7 px-2">
                            <Link to={`/projects/${project.id}`}>查看</Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-700 mb-4">
                      <i className="fa-solid fa-folder-open text-gray-400 dark:text-slate-400"></i>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">暂无课题</h3>
                    <p className="text-gray-500 dark:text-slate-400 mb-4">
                      您还没有创建任何课题，点击下方按钮开始创建
                    </p>
                    <Button asChild>
                      <Link to="/projects/new">
                        <i className="fa-solid fa-plus mr-2"></i>创建课题
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </section>
            
            {/* 实验日历快速入口 */}
           <section className="mb-10">
             <div className="flex justify-between items-center mb-4">
               <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100">实验日历</h2>
               <Button asChild variant="outline" size="sm">
                 <Link to="/calendar">查看完整日历</Link>
               </Button>
             </div>
             
             <div className="bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-600 p-6 transition-all duration-300 hover:shadow-md dark:hover:shadow-2xl">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="text-lg font-medium text-gray-800 dark:text-slate-200">
                   {currentMonth.toLocaleString('zh-CN', { year: 'numeric', month: 'long' })}
                 </h3>
                 <div className="flex space-x-2">
                   <Button
                     size="sm"
                     variant="outline"
                     className="h-8 w-8 p-0"
                     onClick={() => {
                       const newMonth = new Date(currentMonth);
                       newMonth.setMonth(newMonth.getMonth() - 1);
                       setCurrentMonth(newMonth);
                     }}
                   >
                     <i className="fa-solid fa-chevron-left"></i>
                   </Button>
                   <Button
                     size="sm"
                     variant="outline"
                     className="h-8 w-8 p-0"
                     onClick={() => {
                       const newMonth = new Date(currentMonth);
                       newMonth.setMonth(newMonth.getMonth() + 1);
                       setCurrentMonth(newMonth);
                     }}
                   >
                     <i className="fa-solid fa-chevron-right"></i>
                   </Button>
                 </div>
               </div>

               {/* 简化的日历预览 - 使用真实数据 */}
               <div className="grid grid-cols-7 gap-1 text-center mb-2">
                 {['日', '一', '二', '三', '四', '五', '六'].map(day => (
                   <div key={day} className="text-xs font-medium text-gray-500 dark:text-slate-400 py-2">
                     {day}
                   </div>
                 ))}
               </div>

               <div className="grid grid-cols-7 gap-1 text-center">
                 {Array.from({ length: 31 }, (_, i) => i + 1).map(date => {
                   const recordCount = recordsByDate.get(date) || 0;
                   const hasRecord = recordCount > 0;
                   const isToday = date === new Date().getDate() &&
                     currentMonth.getMonth() === new Date().getMonth() &&
                     currentMonth.getFullYear() === new Date().getFullYear();

                   return (
                     <div
                       key={date}
                       className={`
                         h-10 flex flex-col items-center justify-center rounded-lg text-sm cursor-pointer transition-colors relative
                         ${hasRecord ? 'bg-[#A8D5BA]/20 text-[#555555] dark:bg-emerald-900/30 dark:text-emerald-200 font-medium' : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'}
                         ${isToday ? 'ring-2 ring-[#A8D5BA]' : ''}
                       `}
                       title={`${recordCount} 条实验记录`}
                     >
                       <span>{date}</span>
                       {hasRecord && (
                         <span className="ml-1 w-1.5 h-1.5 rounded-full bg-[#A8D5BA]"></span>
                       )}
                     </div>
                   );
                 })}
               </div>
               
               <div className="mt-4 flex justify-center">
                 <Button asChild size="sm" className="bg-[#A8D5BA] hover:bg-[#8FC5A0]">
                   <Link to="/calendar">
                     <i className="fa-solid fa-calendar mr-1"></i> 查看完整日历
                   </Link>
                 </Button>
               </div>
             </div>
           </section>
         </main>
       </div>
     </div>
   );
}
