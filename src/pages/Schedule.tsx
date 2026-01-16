import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ScheduleEvent {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  date: string;
  type: 'experiment' | 'meeting' | 'deadline' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  completed: boolean;
  createdAt: string;
}

export default function Schedule() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');

  // 表单数据
  const [formData, setFormData] = useState<Partial<ScheduleEvent>>({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    date: selectedDate,
    type: 'experiment',
    priority: 'medium'
  });

  // 加载事件数据
  useEffect(() => {
    const savedEvents = localStorage.getItem('scheduleEvents');
    if (savedEvents) {
      setEvents(JSON.parse(savedEvents));
    }
  }, []);

  // 保存事件数据
  const saveEvents = (newEvents: ScheduleEvent[]) => {
    setEvents(newEvents);
    localStorage.setItem('scheduleEvents', JSON.stringify(newEvents));
  };

  // 处理表单输入
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 创建或更新事件
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.startTime || !formData.endTime) {
      toast.error('请填写必填字段');
      return;
    }

    const eventData: ScheduleEvent = {
      id: editingEvent?.id || Date.now().toString(),
      title: formData.title!,
      description: formData.description || '',
      startTime: formData.startTime!,
      endTime: formData.endTime!,
      date: formData.date || selectedDate,
      type: formData.type as ScheduleEvent['type'],
      priority: formData.priority as ScheduleEvent['priority'],
      completed: editingEvent?.completed || false,
      createdAt: editingEvent?.createdAt || new Date().toISOString()
    };

    if (editingEvent) {
      const updatedEvents = events.map(event =>
        event.id === editingEvent.id ? eventData : event
      );
      saveEvents(updatedEvents);
      toast.success('日程已更新');
    } else {
      saveEvents([...events, eventData]);
      toast.success('日程已创建');
    }

    closeForm();
  };

  // 删除事件
  const deleteEvent = (id: string) => {
    if (window.confirm('确定要删除这个日程吗？')) {
      const updatedEvents = events.filter(event => event.id !== id);
      saveEvents(updatedEvents);
      toast.success('日程已删除');
    }
  };

  // 切换完成状态
  const toggleCompleted = (id: string) => {
    const updatedEvents = events.map(event =>
      event.id === id ? { ...event, completed: !event.completed } : event
    );
    saveEvents(updatedEvents);
  };

  // 打开编辑表单
  const openEditForm = (event: ScheduleEvent) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      date: event.date,
      type: event.type,
      priority: event.priority
    });
    setIsFormOpen(true);
  };

  // 关闭表单
  const closeForm = () => {
    setIsFormOpen(false);
    setEditingEvent(null);
    setFormData({
      title: '',
      description: '',
      startTime: '',
      endTime: '',
      date: selectedDate,
      type: 'experiment',
      priority: 'medium'
    });
  };

  // 获取指定日期的事件
  const getEventsForDate = (date: string) => {
    return events.filter(event => event.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  // 获取类型颜色
  const getTypeColor = (type: ScheduleEvent['type']) => {
    switch (type) {
      case 'experiment': return 'bg-forest-accent/40 text-forest-primary';
      case 'meeting': return 'bg-blue-100 text-blue-700';
      case 'deadline': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // 获取优先级颜色
  const getPriorityColor = (priority: ScheduleEvent['priority']) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500';
      case 'high': return 'border-l-orange-500';
      case 'medium': return 'border-l-yellow-500';
      default: return 'border-l-green-500';
    }
  };

  return (
    <div className="min-h-screen bg-organic-rice-paper text-loam">
      {/* 环境 Blob 背景 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="organic-blob organic-blob--moss w-[400px] h-[400px] -top-20 -right-20 opacity-15" />
        <div className="organic-blob organic-blob--sand w-[300px] h-[300px] bottom-10 -left-20 opacity-10" />
      </div>

      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={cn('transition-all duration-500 relative z-10', sidebarCollapsed ? 'ml-16' : 'ml-64')}>
        <Header
          title="日程管理"
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <button onClick={() => setIsFormOpen(true)} className="organic-btn organic-btn--primary text-sm">
              <i className="fa-solid fa-plus mr-2"></i>
              新建日程
            </button>
          }
        />

        <main className="container mx-auto px-4 py-6">
          {/* 视图切换和日期选择 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center space-x-4">
                <div className="flex bg-gray-100 rounded-lg p-1">
                  {['day', 'week', 'month'].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode as any)}
                      className={`px-3 py-1 text-sm rounded transition-colors ${viewMode === mode
                        ? 'bg-forest-secondary text-white'
                        : 'text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      {mode === 'day' ? '日' : mode === 'week' ? '周' : '月'}
                    </button>
                  ))}
                </div>

                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-secondary"
                />
              </div>

              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span className="flex items-center">
                  <div className="w-3 h-3 bg-forest-secondary rounded mr-1"></div>
                  实验
                </span>
                <span className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded mr-1"></div>
                  会议
                </span>
                <span className="flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded mr-1"></div>
                  截止日期
                </span>
              </div>
            </div>
          </div>

          {/* 当日事件列表 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <i className="fa-solid fa-calendar-day mr-2 text-forest-secondary"></i>
              {new Date(selectedDate).toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
              })}
            </h2>

            {getEventsForDate(selectedDate).length === 0 ? (
              <div className="text-center py-8 text-grass">
                <i className="fa-solid fa-calendar-plus text-4xl mb-4 text-bark/30"></i>
                <p>今日暂无安排</p>
                <button onClick={() => setIsFormOpen(true)} className="organic-btn organic-btn--secondary mt-4">
                  <i className="fa-solid fa-plus mr-2"></i>
                  添加日程
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {getEventsForDate(selectedDate).map((event) => (
                  <motion.div
                    key={event.id}
                    className={`p-4 rounded-lg border-l-4 ${getPriorityColor(event.priority)} ${event.completed ? 'bg-gray-50 opacity-75' : 'bg-white'
                      } shadow-sm hover:shadow-md transition-shadow`}
                    whileHover={{ scale: 1.01 }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <button
                            onClick={() => toggleCompleted(event.id)}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center ${event.completed
                              ? 'bg-forest-secondary border-forest-secondary text-white'
                              : 'border-gray-300 hover:border-forest-secondary'
                              }`}
                          >
                            {event.completed && <i className="fa-solid fa-check text-xs"></i>}
                          </button>
                          <h3 className={`font-medium ${event.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                            {event.title}
                          </h3>
                          <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(event.type)}`}>
                            {event.type === 'experiment' ? '实验' :
                              event.type === 'meeting' ? '会议' :
                                event.type === 'deadline' ? '截止日期' : '其他'}
                          </span>
                        </div>

                        <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                          <span>
                            <i className="fa-solid fa-clock mr-1"></i>
                            {event.startTime} - {event.endTime}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs ${event.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                            event.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                              event.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-green-100 text-green-700'
                            }`}>
                            {event.priority === 'urgent' ? '紧急' :
                              event.priority === 'high' ? '高' :
                                event.priority === 'medium' ? '中' : '低'}优先级
                          </span>
                        </div>

                        {event.description && (
                          <p className="text-sm text-gray-600">{event.description}</p>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => openEditForm(event)}
                          className="p-2 text-gray-500 hover:text-forest-primary transition-colors"
                        >
                          <i className="fa-solid fa-edit"></i>
                        </button>
                        <button
                          onClick={() => deleteEvent(event.id)}
                          className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* 创建/编辑表单 */}
          {isFormOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
              onClick={(e) => e.target === e.currentTarget && closeForm()}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-xl p-6 w-full max-w-md mx-4"
              >
                <h3 className="text-lg font-bold mb-4">
                  {editingEvent ? '编辑日程' : '新建日程'}
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      标题 *
                    </label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-secondary"
                      placeholder="输入日程标题"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        开始时间 *
                      </label>
                      <input
                        type="time"
                        name="startTime"
                        value={formData.startTime}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-secondary"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        结束时间 *
                      </label>
                      <input
                        type="time"
                        name="endTime"
                        value={formData.endTime}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-secondary"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      日期
                    </label>
                    <input
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-secondary"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        类型
                      </label>
                      <select
                        name="type"
                        value={formData.type}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-secondary"
                      >
                        <option value="experiment">实验</option>
                        <option value="meeting">会议</option>
                        <option value="deadline">截止日期</option>
                        <option value="other">其他</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        优先级
                      </label>
                      <select
                        name="priority"
                        value={formData.priority}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-secondary"
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
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-secondary"
                      placeholder="输入日程描述（可选）"
                    />
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={closeForm}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-forest-secondary hover:bg-forest-primary text-white rounded-lg transition-colors"
                    >
                      {editingEvent ? '更新' : '创建'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </main>
      </div>
    </div>
  );
}