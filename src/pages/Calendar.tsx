import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/Button';
import { toast } from 'sonner';

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  date: string;
  type: 'experiment' | 'meeting' | 'deadline' | 'task' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  completed: boolean;
  isTask: boolean;
  createdAt: string;
}

export default function Calendar() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [moodHistory, setMoodHistory] = useState<any[]>([]);
  const [showMoodHistory, setShowMoodHistory] = useState(false);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragMode, setDragMode] = useState<'move' | 'resize-start' | 'resize-end'>('move');
  const [originalEvent, setOriginalEvent] = useState<CalendarEvent | null>(null);
  const [hasMoved, setHasMoved] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [formData, setFormData] = useState<Partial<CalendarEvent>>({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    date: '',
    type: 'experiment',
    priority: 'medium',
    isTask: false
  });

  // 基础配置
  const mainTimeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 6; hour <= 23; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    return slots;
  }, []);

  const weekDays = (() => {
    const week = [];
    const startOfWeek = new Date(currentWeek);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);
    
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(startOfWeek);
      currentDay.setDate(startOfWeek.getDate() + i);
      week.push(currentDay);
    }
    return week;
  })();

  const weekDayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  
  const moods = [
    { emoji: '😊', name: '开心' },
    { emoji: '😌', name: '平静' },
    { emoji: '😔', name: '沮丧' },
    { emoji: '😤', name: '生气' },
    { emoji: '🤔', name: '思考' }
  ];
  
  const tags = [
    { id: 'work', name: '工作', color: 'emerald' },
    { id: 'study', name: '学习', color: 'blue' },
    { id: 'life', name: '生活', color: 'green' },
    { id: 'exercise', name: '运动', color: 'yellow' },
    { id: 'rest', name: '休息', color: 'indigo' }
  ];

  // 工具函数
  const getCurrentTimePosition = useCallback(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    if (hours < 6 || hours > 23) {
      return null;
    }
    
    return ((hours - 6) + minutes / 60) * 64;
  }, []);

  const isToday = useCallback((dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  }, []);

  const getEventsForDate = (date: string) => {
    return events.filter(event => event.date === date && !event.isTask);
  };

  const getEventPosition = (event: CalendarEvent) => {
    const startHour = parseInt(event.startTime.split(':')[0]);
    const startMinute = parseInt(event.startTime.split(':')[1]);
    const endHour = parseInt(event.endTime.split(':')[0]);
    const endMinute = parseInt(event.endTime.split(':')[1]);
    
    const startPos = ((startHour - 6) + startMinute / 60) * 64;
    const duration = ((endHour - startHour) + (endMinute - startMinute) / 60) * 64;
    
    return { top: startPos, height: Math.max(duration, 40) };
  };

  const getTypeColor = (type: CalendarEvent['type']) => {
    const colors = {
      experiment: 'text-stone-700',
      meeting: 'text-stone-700', 
      deadline: 'text-rose-700',
      task: 'text-amber-700',
      other: 'text-gray-700'
    };
    const backgrounds = {
      experiment: 'rgba(255, 255, 255, 0.8)',
      meeting: 'rgba(255, 255, 255, 0.7)',
      deadline: 'rgba(255, 255, 255, 0.8)',
      task: 'rgba(255, 255, 255, 0.7)',
      other: 'rgba(255, 255, 255, 0.6)'
    };
    return {
      color: colors[type],
      background: backgrounds[type],
      border: 'rgba(72, 128, 141, 0.2)'
    };
  };

  const getPriorityColor = (priority: CalendarEvent['priority']) => {
    const colors = {
      urgent: 'border-l-rose-300',
      high: 'border-l-orange-300',
      medium: 'border-l-stone-400',
      low: 'border-l-gray-300'
    };
    return colors[priority];
  };

  const allTasks = events.filter(e => e.isTask).sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    if (a.date !== b.date) {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }
    return 0;
  });

  // 事件处理
  const loadMoodHistory = useCallback(() => {
    const history = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const key = `dailyMood_${dateStr}`;
      const data = localStorage.getItem(key);
      if (data) {
        history.push(JSON.parse(data));
      }
    }
    setMoodHistory(history);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadMoodHistory();
    
    const savedEvents = localStorage.getItem('calendarEvents');
    if (savedEvents) {
      setEvents(JSON.parse(savedEvents));
    } else {
      const today = new Date().toISOString().split('T')[0];
      const sampleEvents: CalendarEvent[] = [
        {
          id: '1',
          title: '细胞培养实验',
          description: '进行HEK293细胞的培养和传代实验',
          startTime: '09:00',
          endTime: '11:00',
          date: today,
          type: 'experiment',
          priority: 'high',
          completed: false,
          isTask: false,
          createdAt: new Date().toISOString()
        }
      ];
      setEvents(sampleEvents);
      localStorage.setItem('calendarEvents', JSON.stringify(sampleEvents));
    }
    
    const savedMood = localStorage.getItem('dailyMood');
    if (savedMood) {
      const mood = JSON.parse(savedMood);
      setSelectedMood(mood.mood || '');
    }
  }, [loadMoodHistory]);

  const saveEvents = (newEvents: CalendarEvent[]) => {
    setEvents(newEvents);
    localStorage.setItem('calendarEvents', JSON.stringify(newEvents));
  };

  const saveMood = () => {
    const today = new Date().toISOString().split('T')[0];
    const moodData = {
      date: today,
      mood: selectedMood,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem(`dailyMood_${today}`, JSON.stringify(moodData));
    localStorage.setItem('dailyMood', JSON.stringify(moodData));
    loadMoodHistory();
    toast.success('心情已记录');
  };

  // 拖拽功能
  const handleMouseDown = (e: React.MouseEvent, event: CalendarEvent, mode: 'move' | 'resize-start' | 'resize-end' = 'move') => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedEvent(event);
    setOriginalEvent(event);
    setIsDragging(true);
    setDragStartY(e.clientY);
    setDragMode(mode);
    setHasMoved(false);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !draggedEvent || !originalEvent) return;
    
    const deltaY = e.clientY - dragStartY;
    const timeSlotHeight = 64; // 每小时的像素高度
    // 降低灵敏度：需要移动更多像素才能改变时间
    const pixelsPerSlot = 32; // 需要移动32像素才改变30分钟
    const deltaSlots = Math.round(deltaY / pixelsPerSlot);
    const deltaMinutes = deltaSlots * 30; // 每次调整30分钟
    
    if (Math.abs(deltaMinutes) >= 30) { // 至少变化30分钟才更新
      setHasMoved(true); // 标记为已移动
      
      const [startHour, startMinute] = originalEvent.startTime.split(':').map(Number);
      const [endHour, endMinute] = originalEvent.endTime.split(':').map(Number);
      const originalStartMinutes = startHour * 60 + startMinute;
      const originalEndMinutes = endHour * 60 + endMinute;
      
      let newStartMinutes = originalStartMinutes;
      let newEndMinutes = originalEndMinutes;
      
      if (dragMode === 'move') {
        // 移动整个事件
        newStartMinutes = originalStartMinutes + deltaMinutes;
        newEndMinutes = originalEndMinutes + deltaMinutes;
      } else if (dragMode === 'resize-start') {
        // 调整开始时间
        newStartMinutes = originalStartMinutes + deltaMinutes;
        // 确保开始时间不晚于结束时间
        if (newStartMinutes >= originalEndMinutes) {
          newStartMinutes = originalEndMinutes - 30;
        }
      } else if (dragMode === 'resize-end') {
        // 调整结束时间
        newEndMinutes = originalEndMinutes + deltaMinutes;
        // 确保结束时间不早于开始时间
        if (newEndMinutes <= originalStartMinutes) {
          newEndMinutes = originalStartMinutes + 30;
        }
      }
      
      // 限制在时间范围内 (6:00-23:30)
      newStartMinutes = Math.max(6 * 60, Math.min(newStartMinutes, 23 * 60));
      newEndMinutes = Math.max(6 * 60 + 30, Math.min(newEndMinutes, 23 * 60 + 30));
      
      const newStartHour = Math.floor(newStartMinutes / 60);
      const newStartMin = newStartMinutes % 60;
      const newEndHour = Math.floor(newEndMinutes / 60);
      const newEndMin = newEndMinutes % 60;
      
      const newStartTime = `${newStartHour.toString().padStart(2, '0')}:${newStartMin.toString().padStart(2, '0')}`;
      const newEndTime = `${newEndHour.toString().padStart(2, '0')}:${newEndMin.toString().padStart(2, '0')}`;
      
      const updatedEvent = {
        ...originalEvent,
        startTime: newStartTime,
        endTime: newEndTime
      };
      
      setDraggedEvent(updatedEvent);
    }
  }, [isDragging, draggedEvent, originalEvent, dragStartY, dragMode]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && draggedEvent && originalEvent) {
      // 只有当时间真的改变了才更新
      if (draggedEvent.startTime !== originalEvent.startTime || draggedEvent.endTime !== originalEvent.endTime) {
        const updatedEvents = events.map(event =>
          event.id === draggedEvent.id ? draggedEvent : event
        );
        saveEvents(updatedEvents);
        // 移除toast提示，让操作更流畅
      }
    }
    
    setIsDragging(false);
    setDraggedEvent(null);
    setOriginalEvent(null);
    setDragStartY(0);
    setDragMode('move');
    
    // 延迟重置hasMoved，避免立即触发点击事件
    setTimeout(() => {
      setHasMoved(false);
    }, 100);
  }, [isDragging, draggedEvent, originalEvent, events, saveEvents]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
      toast.error('请填写标题');
      return;
    }

    if (!formData.date) {
      toast.error('请选择日期');
      return;
    }

    const eventData: CalendarEvent = {
      id: editingEvent?.id || Date.now().toString(),
      title: formData.title!,
      description: formData.description || '',
      startTime: formData.startTime || '09:00',
      endTime: formData.endTime || '10:00',
      date: formData.date!,
      type: formData.type as CalendarEvent['type'],
      priority: formData.priority as CalendarEvent['priority'],
      completed: false,
      isTask: formData.isTask || false,
      createdAt: new Date().toISOString()
    };

    let updatedEvents;
    if (editingEvent) {
      updatedEvents = events.map(event => 
        event.id === editingEvent.id ? eventData : event
      );
      toast.success('已更新');
    } else {
      updatedEvents = [...events, eventData];
      toast.success(formData.isTask ? '待办事项已创建' : '实验已创建');
    }

    saveEvents(updatedEvents);
    closeForm();
  };

  const deleteEvent = (id: string) => {
    if (window.confirm('确定要删除吗？')) {
      const updatedEvents = events.filter(event => event.id !== id);
      saveEvents(updatedEvents);
      toast.success('已删除');
      // 如果删除的是正在编辑的事件，关闭编辑表单
      if (editingEvent?.id === id) {
        closeForm();
      }
    }
  };

  const toggleCompleted = (id: string) => {
    const updatedEvents = events.map(event =>
      event.id === id ? { ...event, completed: !event.completed } : event
    );
    saveEvents(updatedEvents);
  };

  const handleTimeSlotClick = useCallback((date: string, time: string) => {
    const startHour = parseInt(time.split(':')[0]);
    const endHour = startHour + 1;
    setFormData({
      title: '',
      description: '',
      date,
      startTime: time,
      endTime: `${endHour.toString().padStart(2, '0')}:00`,
      type: 'experiment',
      priority: 'medium',
      isTask: false
    });
    setEditingEvent(null);
    setIsFormOpen(true);
  }, []);

  const openEditForm = (event: CalendarEvent) => {
    setEditingEvent(event);
    setFormData({...event});
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingEvent(null);
    setFormData({
      title: '',
      description: '',
      startTime: '',
      endTime: '',
      date: '',
      type: 'experiment',
      priority: 'medium',
      isTask: false
    });
  };

  return (
    <div className="min-h-screen" style={{background: 'linear-gradient(135deg, #FFFFFF 0%, #E5EDC1 30%, #48808D 100%)'}}>
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header 
          title="实验日历" 
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <div className="flex space-x-2">
              <Button 
                onClick={() => {setFormData({...formData, isTask: true}); setIsFormOpen(true);}}
                className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-3 py-2"
              >
                <i className="fa-solid fa-plus mr-1"></i>
                待办
              </Button>
              <Button 
                onClick={() => {setFormData({...formData, isTask: false}); setIsFormOpen(true);}}
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm px-3 py-2"
              >
                <i className="fa-solid fa-plus mr-1"></i>
                实验
              </Button>
            </div>
          }
        />
        
        <main className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 周视图 */}
            <div className="lg:col-span-2">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/30 overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b border-white/30 bg-white/60 backdrop-blur-sm">
                  <div className="flex items-center space-x-4">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setCurrentWeek(new Date(currentWeek.getTime() - 7 * 24 * 60 * 60 * 1000))}
                      className="p-3 rounded-xl hover:bg-white/50 hover:shadow-md transition-all text-stone-700 bg-white/40 backdrop-blur-sm"
                    >
                      <i className="fa-solid fa-chevron-left" style={{color: '#48808D'}}></i>
                    </motion.button>
                    
                    <div className="text-center">
                      <h2 className="text-xl font-bold flex items-center" style={{color: '#48808D'}}>
                        <i className="fa-solid fa-calendar-alt mr-2" style={{color: '#48808D'}}></i>
                        {currentWeek.getFullYear()}年{currentWeek.getMonth() + 1}月
                      </h2>
                      <p className="text-sm mt-1 font-medium" style={{color: '#48808D'}}>
                        {weekDays[0].getDate()}日 - {weekDays[6].getDate()}日
                      </p>
                    </div>
                    
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setCurrentWeek(new Date(currentWeek.getTime() + 7 * 24 * 60 * 60 * 1000))}
                      className="p-3 rounded-xl hover:bg-white/50 hover:shadow-md transition-all text-stone-700 bg-white/40 backdrop-blur-sm"
                    >
                      <i className="fa-solid fa-chevron-right" style={{color: '#48808D'}}></i>
                    </motion.button>
                  </div>
                  
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setCurrentWeek(new Date())}
                    className="px-4 py-2 text-white rounded-xl text-sm transition-all shadow-sm"
                    style={{backgroundColor: '#48808D'}}>
                    <i className="fa-solid fa-calendar-day mr-2"></i>
                    今天
                  </motion.button>
                </div>

                <div className="overflow-auto" style={{ maxHeight: '70vh' }}>
                  <div className="grid grid-cols-8 relative">
                    {/* 时间轴 */}
                    <div className="bg-white/60 backdrop-blur-sm border-r border-white/30">
                      <div className="h-16 flex items-center justify-center text-sm font-semibold border-b border-white/30 bg-white/40 backdrop-blur-sm" style={{color: '#48808D'}}>
                        <i className="fa-solid fa-clock mr-1"></i>
                        时间
                      </div>
                      {mainTimeSlots.map((time, index) => (
                        <div key={time} className={`h-16 px-3 py-2 text-sm border-b border-white/20 flex items-center justify-center font-medium ${
                          index % 2 === 0 ? 'bg-white/30' : 'bg-white/10'
                        }`} style={{color: '#48808D'}}>
                          {time}
                        </div>
                      ))}
                    </div>
                    
                    {/* 日期列 */}
                    {weekDays.map((day, index) => {
                      const dateStr = day.toISOString().split('T')[0];
                      const dayEvents = getEventsForDate(dateStr);
                      const isTodayDate = isToday(dateStr);
                      const isWeekend = index === 0 || index === 6;
                      const currentTimePos = getCurrentTimePosition();
                      
                      return (
                        <div key={dateStr} className="relative border-r border-gray-200">
                          {/* 日期头 */}
                          <div className={`h-16 px-3 py-2 border-b border-white/30 text-center transition-all ${
                            isTodayDate ? 'bg-white/70 backdrop-blur-sm' : 
                            isWeekend ? 'bg-white/50 backdrop-blur-sm' : 'bg-white/30 backdrop-blur-sm'
                          }`}>
                            <div className={`text-xs mb-1 ${
                              isTodayDate ? 'font-semibold' : ''
                            }`} style={{color: isTodayDate ? '#48808D' : '#48808D'}}>
                              {weekDayNames[index]}
                            </div>
                            <div className={`text-lg font-bold`} style={{color: isTodayDate ? '#48808D' : '#48808D'}}>
                              {day.getDate()}
                            </div>
                            {isTodayDate && (
                              <div className="w-2 h-2 rounded-full mx-auto mt-1 animate-pulse" style={{backgroundColor: '#48808D'}}></div>
                            )}
                          </div>
                          
                          {/* 时间槽 */}
                          <div className="relative">
                            {mainTimeSlots.map((time, timeIndex) => (
                              <motion.div
                                key={time}
                                className={`h-16 border-b border-white/20 transition-all duration-200 cursor-pointer group relative ${
                                  timeIndex % 2 === 0 ? 'bg-white/20' : 'bg-white/10'
                                }`}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(255,255,255,0.4)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = timeIndex % 2 === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)';
                                }}
                                onClick={() => handleTimeSlotClick(dateStr, time)}
                                whileHover={{ scale: 1.005 }}
                              >
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
                                  <div className="text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg" style={{backgroundColor: '#48808D'}}>
                                    <i className="fa-solid fa-plus text-sm"></i>
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                            
                            {/* 当前时间线 */}
                            {isTodayDate && currentTimePos !== null && (
                              <motion.div
                                initial={{ opacity: 0, scaleX: 0 }}
                                animate={{ opacity: 1, scaleX: 1 }}
                                className="absolute left-0 right-0 z-20 h-0.5 shadow-sm"
                                style={{ top: currentTimePos, backgroundColor: '#48808D' }}
                              >
                                <motion.div 
                                  animate={{ scale: [1, 1.1, 1] }}
                                  transition={{ repeat: Infinity, duration: 2 }}
                                  className="absolute right-0 -top-3 text-xs text-white px-2 py-1 rounded-lg shadow-lg"
                                  style={{backgroundColor: '#48808D'}}
                                >
                                  <i className="fa-solid fa-clock mr-1"></i>
                                  {currentTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                                </motion.div>
                                <div className="absolute right-0 -top-1 w-2 h-2 rounded-full shadow-lg animate-pulse" style={{backgroundColor: '#48808D'}}></div>
                              </motion.div>
                            )}
                            
                            {/* 事件层 */}
                            {dayEvents.map(event => {
                              const position = getEventPosition(event);
                              const isEventDragging = isDragging && draggedEvent?.id === event.id;
                              const displayEvent = isEventDragging ? draggedEvent : event;
                              const displayPosition = isEventDragging ? getEventPosition(draggedEvent!) : position;
                              
                              return (
                                <motion.div
                                  key={event.id}
                                  layout
                                  className={`absolute left-1 right-1 rounded-xl shadow-sm border transition-all duration-200 group ${
                                    getPriorityColor(displayEvent!.priority)
                                  } border-l-4 hover:shadow-lg cursor-move ${
                                    displayEvent!.completed ? 'opacity-60' : ''
                                  } ${
                                    isEventDragging ? 'shadow-xl scale-105 z-50' : 'z-10'
                                  }`}
                                  style={{
                                    background: getTypeColor(displayEvent!.type).background,
                                    borderColor: getTypeColor(displayEvent!.type).border,
                                    top: displayPosition.top,
                                    height: displayPosition.height,
                                    boxShadow: isEventDragging ? '0 20px 25px -5px rgba(72, 128, 141, 0.3), 0 10px 10px -5px rgba(72, 128, 141, 0.2)' : undefined,
                                    transform: isEventDragging ? 'scale(1.05)' : undefined,
                                    border: isEventDragging ? '2px solid #48808D' : undefined
                                  }}
                                  onMouseDown={(e) => handleMouseDown(e, event, 'move')}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // 只有在非拖拽状态且没有移动的情况下才允许编辑
                                    if (!isDragging && !hasMoved) {
                                      openEditForm(event);
                                    }
                                  }}
                                  whileHover={{ scale: 1.02 }}
                                >
                                  {/* 上部调整手柄 */}
                                  <div 
                                    className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      handleMouseDown(e, event, 'resize-start');
                                    }}
                                  >
                                    <div className="w-full h-1 rounded-t-xl" style={{backgroundColor: '#48808D'}}></div>
                                  </div>
                                  
                                  <div className="p-3 h-full flex flex-col relative overflow-hidden" style={{color: getTypeColor(displayEvent!.type).color}}>
                                    {/* 优先级指示器 */}
                                    <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                                      displayEvent!.priority === 'urgent' ? 'bg-rose-300' :
                                      displayEvent!.priority === 'high' ? 'bg-orange-300' :
                                      displayEvent!.priority === 'medium' ? 'bg-stone-400' :
                                      'bg-gray-300'
                                    }`}></div>
                                    
                                    <div className="text-sm font-semibold truncate mb-1 pr-3">
                                      {displayEvent!.title}
                                    </div>
                                    
                                    <div className="text-xs opacity-70 mb-1">
                                      {displayEvent!.startTime} - {displayEvent!.endTime}
                                    </div>
                                    
                                    {displayEvent!.description && displayPosition.height > 60 && (
                                      <div className="text-xs opacity-60 line-clamp-2 flex-1">
                                        {displayEvent!.description}
                                      </div>
                                    )}
                                    
                                    {/* 删除按钮 */}
                                    <button
                                      className="absolute top-1 left-1 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center hover:bg-red-600 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteEvent(event.id);
                                      }}
                                    >
                                      <i className="fa-solid fa-times"></i>
                                    </button>
                                  </div>
                                  
                                  {/* 下部调整手柄 */}
                                  <div 
                                    className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      handleMouseDown(e, event, 'resize-end');
                                    }}
                                  >
                                    <div className="w-full h-1 rounded-b-xl" style={{backgroundColor: '#48808D'}}></div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            
            {/* 右侧：待办事项与心情记录 */}
            <div className="lg:col-span-1 space-y-4">
              {/* 待办事项 */}
              <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-white/30 overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b border-white/30 bg-white/60 backdrop-blur-sm">
                  <h3 className="font-semibold flex items-center" style={{color: '#48808D'}}>
                    <i className="fa-solid fa-list-check mr-2" style={{color: '#48808D'}}></i>
                    待办事项
                  </h3>
                  <button 
                    onClick={() => {setFormData({...formData, isTask: true}); setIsFormOpen(true);}}
                    className="text-xs px-3 py-1.5 text-white rounded-lg transition-all shadow-sm"
                    style={{backgroundColor: '#48808D'}}
                  >
                    <i className="fa-solid fa-plus mr-1"></i>
                    添加
                  </button>
                </div>
                
                <div className="p-4">
                  {allTasks.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <i className="fa-solid fa-clipboard-check text-4xl mb-4 opacity-50"></i>
                      <div className="text-sm">暂无待办事项</div>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {allTasks.map((task) => (
                        <motion.div
                          key={task.id}
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className={`p-3 rounded-xl border-l-4 ${
                            getPriorityColor(task.priority)
                          } ${
                            task.completed ? 'bg-gray-50 opacity-60' : 'bg-white shadow-sm'
                          } hover:shadow-md transition-all group border border-gray-100`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 flex-1">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => toggleCompleted(task.id)}
                                className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${
                                  task.completed
                                    ? 'bg-stone-500 border-stone-500'
                                    : 'border-stone-300 hover:border-stone-500'
                                }`}
                              >
                                {task.completed && (
                                  <motion.i
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="fa-solid fa-check text-white text-xs"
                                  />
                                )}
                              </motion.button>
                              
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm font-medium truncate ${
                                  task.completed ? 'line-through text-gray-400' : 'text-gray-700'
                                }`}>
                                  {task.title}
                                </div>
                                {task.description && (
                                  <div className={`text-xs truncate mt-1 ${
                                    task.completed ? 'text-gray-300' : 'text-gray-500'
                                  }`}>
                                    {task.description}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => openEditForm(task)}
                                className="p-1.5 text-gray-400 hover:text-stone-600 rounded transition-colors"
                              >
                                <i className="fa-solid fa-edit text-xs"></i>
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteEvent(task.id);
                                }}
                                className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                              >
                                <i className="fa-solid fa-trash text-xs"></i>
                              </motion.button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 心情记录 */}
              <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-white/30 overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b border-white/30 bg-gradient-to-r from-pink-50/80 to-rose-50/80 backdrop-blur-sm">
                  <h3 className="font-semibold text-gray-800 flex items-center">
                    <i className="fa-solid fa-heart text-pink-500 mr-2"></i>
                    今日心情
                  </h3>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => setShowMoodHistory(true)}
                      className="text-xs px-3 py-1.5 text-gray-600 hover:text-gray-800 bg-white/80 border border-gray-200 rounded-lg transition-all hover:shadow-sm"
                    >
                      <i className="fa-solid fa-history mr-1"></i>
                      历史
                    </button>
                    <button 
                      onClick={saveMood}
                      disabled={!selectedMood}
                      className="text-xs px-3 py-1.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg hover:from-pink-600 hover:to-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                      <i className="fa-solid fa-save mr-1"></i>
                      保存
                    </button>
                  </div>
                </div>
                
                <div className="p-4">
                  <div className="text-xs text-gray-500 mb-3 text-center">
                    选择今天的心情
                  </div>
                  
                  <div className="grid grid-cols-5 gap-2">
                    {moods.map(mood => (
                      <motion.button
                        key={mood.name}
                        onClick={() => setSelectedMood(mood.name)}
                        className={`aspect-square rounded-xl text-2xl flex items-center justify-center transition-all duration-200 ${
                          selectedMood === mood.name
                            ? 'bg-gradient-to-br from-yellow-100 to-orange-100 scale-110 shadow-lg ring-2 ring-yellow-300'
                            : 'bg-gray-50/80 hover:bg-gray-100/80 hover:scale-105'
                        }`}
                        whileHover={{ scale: selectedMood === mood.name ? 1.1 : 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {mood.emoji}
                      </motion.button>
                    ))}
                  </div>
                  
                  {selectedMood && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 p-3 bg-gradient-to-r from-purple-50/80 to-pink-50/80 rounded-lg text-center border border-purple-200"
                    >
                      <div className="text-sm text-gray-700">
                        今天的心情：<span className="font-medium text-purple-600">{selectedMood}</span>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 模态框 */}
          <AnimatePresence>
            {showMoodHistory && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl max-h-[80vh] overflow-hidden flex flex-col"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-stone-800 flex items-center">
                      <i className="fa-solid fa-heart text-pink-400 mr-2"></i>
                      心情历史
                    </h3>
                    <button 
                      onClick={() => setShowMoodHistory(false)}
                      className="p-2 text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
                    >
                      <i className="fa-solid fa-times"></i>
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3">
                    {moodHistory.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <i className="fa-solid fa-heart-broken text-4xl mb-4 opacity-50"></i>
                        <div>暂无心情记录</div>
                      </div>
                    ) : (
                      moodHistory.map((item, index) => (
                        <motion.div 
                          key={index} 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="p-4 bg-gradient-to-r from-stone-50 to-neutral-50 rounded-xl border border-stone-200"
                        >
                          <div className="flex justify-between items-center">
                            <div className="text-sm font-medium text-stone-800">
                              {new Date(item.date).toLocaleDateString('zh-CN', {
                                month: 'short',
                                day: 'numeric',
                                weekday: 'short'
                              })}
                            </div>
                            {item.mood && (
                              <div className="flex items-center space-x-2">
                                <div className="text-2xl">
                                  {moods.find(m => m.name === item.mood)?.emoji}
                                </div>
                                <span className="text-sm text-stone-700 font-medium">
                                  {item.mood}
                                </span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isFormOpen && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-800">
                      {editingEvent ? '编辑' : '新建'}{formData.isTask ? '待办' : '实验'}
                    </h3>
                    <button 
                      onClick={closeForm}
                      className="p-1 text-gray-500 hover:text-gray-700"
                    >
                      <i className="fa-solid fa-times"></i>
                    </button>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        标题 *
                      </label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-transparent"
                        placeholder={formData.isTask ? '输入待办事项...' : '输入实验名称...'}
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="flex items-center p-3 bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isTask || false}
                          onChange={(e) => setFormData({...formData, isTask: e.target.checked})}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">设置为待办事项</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        日期 *
                      </label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-transparent"
                        required
                      />
                    </div>

                    {!formData.isTask && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            开始时间
                          </label>
                          <input
                            type="time"
                            value={formData.startTime}
                            onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-transparent"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            结束时间
                          </label>
                          <input
                            type="time"
                            value={formData.endTime}
                            onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          类型
                        </label>
                        <select
                          value={formData.type}
                          onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-transparent bg-white"
                        >
                          <option value="experiment">实验</option>
                          <option value="meeting">会议</option>
                          <option value="deadline">截止日期</option>
                          <option value="task">待办</option>
                          <option value="other">其他</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          优先级
                        </label>
                        <select
                          value={formData.priority}
                          onChange={(e) => setFormData({...formData, priority: e.target.value as any})}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-transparent bg-white"
                        >
                          <option value="low">低</option>
                          <option value="medium">中</option>
                          <option value="high">高</option>
                          <option value="urgent">紧急</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        描述
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded resize-none focus:ring-1 focus:ring-emerald-500 focus:border-transparent"
                        placeholder="说明..."
                      />
                    </div>

                    <div className="flex space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={closeForm}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        className={`flex-1 px-4 py-2 text-white rounded ${
                          formData.isTask 
                            ? 'bg-blue-500 hover:bg-blue-600' 
                            : 'bg-emerald-500 hover:bg-emerald-600'
                        }`}
                      >
                        {editingEvent ? '更新' : '创建'}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}