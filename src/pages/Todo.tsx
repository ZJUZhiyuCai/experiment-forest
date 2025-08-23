import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/Button';
import { toast } from 'sonner';

interface TodoItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'experiment' | 'research' | 'admin' | 'personal';
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export default function Todo() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'urgent'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // 表单数据
  const [formData, setFormData] = useState<Partial<TodoItem>>({
    title: '',
    description: '',
    priority: 'medium',
    category: 'experiment',
    dueDate: '',
    tags: []
  });

  // 加载待办事项数据
  useEffect(() => {
    const savedTodos = localStorage.getItem('todoItems');
    if (savedTodos) {
      setTodos(JSON.parse(savedTodos));
    }
  }, []);

  // 保存待办事项数据
  const saveTodos = (newTodos: TodoItem[]) => {
    setTodos(newTodos);
    localStorage.setItem('todoItems', JSON.stringify(newTodos));
  };

  // 处理表单输入
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'tags') {
      setFormData(prev => ({ ...prev, [name]: value.split(',').map(tag => tag.trim()) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // 创建或更新待办事项
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title?.trim()) {
      toast.error('请填写任务标题');
      return;
    }

    const todoData: TodoItem = {
      id: editingTodo?.id || Date.now().toString(),
      title: formData.title.trim(),
      description: formData.description || '',
      completed: editingTodo?.completed || false,
      priority: formData.priority as TodoItem['priority'],
      category: formData.category as TodoItem['category'],
      dueDate: formData.dueDate || undefined,
      tags: formData.tags || [],
      createdAt: editingTodo?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (editingTodo) {
      const updatedTodos = todos.map(todo => 
        todo.id === editingTodo.id ? todoData : todo
      );
      saveTodos(updatedTodos);
      toast.success('任务已更新');
    } else {
      saveTodos([todoData, ...todos]);
      toast.success('任务已创建');
    }

    closeForm();
  };

  // 切换完成状态
  const toggleCompleted = (id: string) => {
    const updatedTodos = todos.map(todo =>
      todo.id === id ? { 
        ...todo, 
        completed: !todo.completed, 
        updatedAt: new Date().toISOString() 
      } : todo
    );
    saveTodos(updatedTodos);
    
    const todo = todos.find(t => t.id === id);
    if (todo) {
      toast.success(todo.completed ? '任务已标记为未完成' : '任务已完成！');
    }
  };

  // 删除待办事项
  const deleteTodo = (id: string) => {
    if (window.confirm('确定要删除这个任务吗？')) {
      const updatedTodos = todos.filter(todo => todo.id !== id);
      saveTodos(updatedTodos);
      toast.success('任务已删除');
    }
  };

  // 打开编辑表单
  const openEditForm = (todo: TodoItem) => {
    setEditingTodo(todo);
    setFormData({
      title: todo.title,
      description: todo.description,
      priority: todo.priority,
      category: todo.category,
      dueDate: todo.dueDate || '',
      tags: todo.tags
    });
    setIsFormOpen(true);
  };

  // 关闭表单
  const closeForm = () => {
    setIsFormOpen(false);
    setEditingTodo(null);
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      category: 'experiment',
      dueDate: '',
      tags: []
    });
  };

  // 过滤待办事项
  const filteredTodos = todos.filter(todo => {
    // 状态筛选
    if (filter === 'active' && todo.completed) return false;
    if (filter === 'completed' && !todo.completed) return false;
    if (filter === 'urgent' && todo.priority !== 'urgent') return false;
    
    // 搜索筛选
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        todo.title.toLowerCase().includes(query) ||
        todo.description.toLowerCase().includes(query) ||
        todo.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    return true;
  });

  // 获取统计数据
  const stats = {
    total: todos.length,
    completed: todos.filter(todo => todo.completed).length,
    urgent: todos.filter(todo => todo.priority === 'urgent' && !todo.completed).length,
    overdue: todos.filter(todo => 
      todo.dueDate && 
      new Date(todo.dueDate) < new Date() && 
      !todo.completed
    ).length
  };

  // 获取优先级颜色
  const getPriorityColor = (priority: TodoItem['priority']) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  // 获取分类颜色
  const getCategoryColor = (category: TodoItem['category']) => {
    switch (category) {
      case 'experiment': return 'text-emerald-600 bg-emerald-100';
      case 'research': return 'text-blue-600 bg-blue-100';
      case 'admin': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // 获取分类名称
  const getCategoryName = (category: TodoItem['category']) => {
    switch (category) {
      case 'experiment': return '实验';
      case 'research': return '研究';
      case 'admin': return '管理';
      default: return '个人';
    }
  };

  return (
    <div className="min-h-screen bg-[#F7FDF0] text-[#555555]">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header 
          title="待办事项" 
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <Button onClick={() => setIsFormOpen(true)}>
              <i className="fa-solid fa-plus mr-2"></i>
              新建任务
            </Button>
          }
        />
        
        <main className="container mx-auto px-4 py-6">
          {/* 统计卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">总任务</p>
                  <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
                </div>
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <i className="fa-solid fa-tasks text-emerald-600"></i>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">已完成</p>
                  <p className="text-2xl font-bold text-emerald-600">{stats.completed}</p>
                </div>
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <i className="fa-solid fa-check text-emerald-600"></i>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">紧急任务</p>
                  <p className="text-2xl font-bold text-red-600">{stats.urgent}</p>
                </div>
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <i className="fa-solid fa-exclamation text-red-600"></i>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">过期任务</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.overdue}</p>
                </div>
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <i className="fa-solid fa-clock text-orange-600"></i>
                </div>
              </div>
            </div>
          </div>

          {/* 筛选和搜索 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: '全部', count: stats.total },
                  { key: 'active', label: '进行中', count: stats.total - stats.completed },
                  { key: 'completed', label: '已完成', count: stats.completed },
                  { key: 'urgent', label: '紧急', count: stats.urgent }
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setFilter(item.key as any)}
                    className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                      filter === item.key
                        ? 'bg-emerald-500 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {item.label} ({item.count})
                  </button>
                ))}
              </div>
              
              <div className="relative w-full md:w-64">
                <i className="fa-solid fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                <input
                  type="text"
                  placeholder="搜索任务..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* 待办事项列表 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            {filteredTodos.length === 0 ? (
              <div className="text-center py-12">
                <i className="fa-solid fa-clipboard-list text-4xl text-gray-400 mb-4"></i>
                <h3 className="text-lg font-medium text-gray-600 mb-2">
                  {searchQuery ? '未找到匹配的任务' : '暂无待办事项'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchQuery ? '尝试其他关键词' : '开始添加您的第一个任务'}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setIsFormOpen(true)}>
                    <i className="fa-solid fa-plus mr-2"></i>
                    创建任务
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                <AnimatePresence>
                  {filteredTodos.map((todo) => {
                    const isOverdue = todo.dueDate && new Date(todo.dueDate) < new Date() && !todo.completed;
                    
                    return (
                      <motion.div
                        key={todo.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={`p-4 hover:bg-gray-50 transition-colors ${
                          todo.completed ? 'opacity-75' : ''
                        } ${isOverdue ? 'bg-red-50' : ''}`}
                      >
                        <div className="flex items-start space-x-3">
                          <button
                            onClick={() => toggleCompleted(todo.id)}
                            className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              todo.completed
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-gray-300 hover:border-emerald-500'
                            }`}
                          >
                            {todo.completed && <i className="fa-solid fa-check text-xs"></i>}
                          </button>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className={`font-medium ${
                                todo.completed ? 'line-through text-gray-500' : 'text-gray-800'
                              }`}>
                                {todo.title}
                              </h3>
                              
                              <span className={`px-2 py-1 text-xs rounded-full border ${getPriorityColor(todo.priority)}`}>
                                {todo.priority === 'urgent' ? '紧急' :
                                 todo.priority === 'high' ? '高' :
                                 todo.priority === 'medium' ? '中' : '低'}
                              </span>
                              
                              <span className={`px-2 py-1 text-xs rounded ${getCategoryColor(todo.category)}`}>
                                {getCategoryName(todo.category)}
                              </span>
                            </div>
                            
                            {todo.description && (
                              <p className="text-sm text-gray-600 mb-2">{todo.description}</p>
                            )}
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4 text-xs text-gray-500">
                                {todo.dueDate && (
                                  <span className={`flex items-center ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                                    <i className="fa-solid fa-calendar mr-1"></i>
                                    {new Date(todo.dueDate).toLocaleDateString()}
                                    {isOverdue && (
                                      <span className="ml-1 text-red-600">(已过期)</span>
                                    )}
                                  </span>
                                )}
                                
                                <span>
                                  <i className="fa-solid fa-clock mr-1"></i>
                                  {new Date(todo.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              
                              {todo.tags.length > 0 && (
                                <div className="flex items-center space-x-1">
                                  {todo.tags.slice(0, 3).map((tag, index) => (
                                    <span
                                      key={index}
                                      className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded"
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                  {todo.tags.length > 3 && (
                                    <span className="text-xs text-gray-500">+{todo.tags.length - 3}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => openEditForm(todo)}
                              className="p-2 text-gray-500 hover:text-emerald-600 transition-colors"
                            >
                              <i className="fa-solid fa-edit"></i>
                            </button>
                            <button
                              onClick={() => deleteTodo(todo.id)}
                              className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                            >
                              <i className="fa-solid fa-trash"></i>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* 创建/编辑表单 */}
          <AnimatePresence>
            {isFormOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                onClick={(e) => e.target === e.currentTarget && closeForm()}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white rounded-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
                >
                  <h3 className="text-lg font-bold mb-4">
                    {editingTodo ? '编辑任务' : '新建任务'}
                  </h3>
                  
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        任务标题 *
                      </label>
                      <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        placeholder="输入任务标题"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        任务描述
                      </label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        placeholder="输入任务描述（可选）"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          优先级
                        </label>
                        <select
                          name="priority"
                          value={formData.priority}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="low">低</option>
                          <option value="medium">中</option>
                          <option value="high">高</option>
                          <option value="urgent">紧急</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          分类
                        </label>
                        <select
                          name="category"
                          value={formData.category}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="experiment">实验</option>
                          <option value="research">研究</option>
                          <option value="admin">管理</option>
                          <option value="personal">个人</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        截止日期
                      </label>
                      <input
                        type="date"
                        name="dueDate"
                        value={formData.dueDate}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        标签（用逗号分隔）
                      </label>
                      <input
                        type="text"
                        name="tags"
                        value={formData.tags?.join(', ') || ''}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        placeholder="例如：重要, 实验, 论文"
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
                        className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
                      >
                        {editingTodo ? '更新' : '创建'}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}