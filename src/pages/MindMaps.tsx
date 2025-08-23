import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MindMap, MindMapTemplate, ExperimentCategory } from '@/types';
import { mindMapService } from '@/lib/mindMapService';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { MindMapEditor } from '@/components/MindMapEditor';
import { toast } from 'sonner';

export default function MindMaps() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mindMaps, setMindMaps] = useState<MindMap[]>([]);
  const [templates, setTemplates] = useState<MindMapTemplate[]>([]);
  const [selectedMindMap, setSelectedMindMap] = useState<MindMap | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { id } = useParams();

  // 创建表单状态
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    type: 'custom' as MindMap['type'],
    templateId: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (id && mindMaps.length > 0) {
      const mindMap = mindMaps.find(m => m.id === id);
      if (mindMap) {
        setSelectedMindMap(mindMap);
      } else {
        toast.error('思维导图不存在');
        navigate('/mindmaps');
      }
    }
  }, [id, mindMaps]);

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const allMindMaps = mindMapService.getAllMindMaps();
      const allTemplates = mindMapService.getAllTemplates();
      
      setMindMaps(allMindMaps);
      setTemplates(allTemplates);
    } catch (error) {
      console.error('加载思维导图失败:', error);
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 创建新思维导图
  const createMindMap = () => {
    if (!createForm.title.trim()) {
      toast.error('请输入思维导图标题');
      return;
    }

    try {
      const newMindMap = mindMapService.createMindMap(
        createForm.title,
        createForm.description,
        undefined,
        createForm.type,
        createForm.templateId || undefined
      );

      setMindMaps(prev => [newMindMap, ...prev]);
      setShowCreateModal(false);
      setCreateForm({ title: '', description: '', type: 'custom', templateId: '' });
      navigate(`/mindmaps/${newMindMap.id}`);
      toast.success('思维导图创建成功');
    } catch (error) {
      console.error('创建思维导图失败:', error);
      toast.error('创建失败，请重试');
    }
  };

  // 删除思维导图
  const deleteMindMap = (mindMapId: string) => {
    if (window.confirm('确定要删除这个思维导图吗？此操作不可撤销。')) {
      try {
        const success = mindMapService.deleteMindMap(mindMapId);
        if (success) {
          setMindMaps(prev => prev.filter(m => m.id !== mindMapId));
          if (selectedMindMap?.id === mindMapId) {
            setSelectedMindMap(null);
            navigate('/mindmaps');
          }
          toast.success('思维导图已删除');
        } else {
          toast.error('删除失败，请重试');
        }
      } catch (error) {
        console.error('删除思维导图失败:', error);
        toast.error('删除失败，请重试');
      }
    }
  };

  // 保存思维导图
  const handleSave = (mindMap: MindMap) => {
    setMindMaps(prev => prev.map(m => m.id === mindMap.id ? mindMap : m));
  };

  // 获取思维导图类型标签
  const getTypeLabel = (type: MindMap['type']) => {
    const types = {
      'project_overview': '项目总览',
      'experiment_flow': '实验流程',
      'data_relations': '数据关联',
      'custom': '自定义'
    };
    return types[type] || type;
  };

  // 获取思维导图类型颜色
  const getTypeColor = (type: MindMap['type']) => {
    const colors = {
      'project_overview': 'bg-blue-100 text-blue-700',
      'experiment_flow': 'bg-green-100 text-green-700',
      'data_relations': 'bg-purple-100 text-purple-700',
      'custom': 'bg-gray-100 text-gray-700'
    };
    return colors[type] || colors.custom;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F6F2] text-[#555555] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mb-4"></div>
          <p className="text-gray-600">加载思维导图...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F6F2] text-[#555555]">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header 
          title={selectedMindMap ? selectedMindMap.title : "思维导图"} 
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <div className="flex items-center space-x-3">
              {selectedMindMap && (
                <button
                  onClick={() => {
                    setSelectedMindMap(null);
                    navigate('/mindmaps');
                  }}
                  className="px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <i className="fa-solid fa-arrow-left mr-2"></i>
                  返回列表
                </button>
              )}
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-300 shadow-md hover:shadow-lg"
              >
                <i className="fa-solid fa-plus mr-2"></i>
                新建思维导图
              </button>
            </div>
          }
        />
        
        <main className="container mx-auto px-4 py-6">
          {selectedMindMap ? (
            // 编辑模式
            <div className="h-[calc(100vh-200px)]">
              <MindMapEditor
                mindMapId={selectedMindMap.id}
                onSave={handleSave}
                className="h-full"
              />
            </div>
          ) : (
            // 列表模式
            <>
              {/* 统计信息 */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <i className="fa-solid fa-project-diagram text-emerald-600 text-xl"></i>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">总数</p>
                      <p className="text-2xl font-bold text-gray-900">{mindMaps.length}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <i className="fa-solid fa-folder text-blue-600 text-xl"></i>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">项目相关</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {mindMaps.filter(m => m.projectId).length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <i className="fa-solid fa-template text-purple-600 text-xl"></i>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">模板数量</p>
                      <p className="text-2xl font-bold text-gray-900">{templates.length}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <i className="fa-solid fa-clock text-green-600 text-xl"></i>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">最近更新</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {mindMaps.filter(m => {
                          const dayAgo = new Date();
                          dayAgo.setDate(dayAgo.getDate() - 1);
                          return new Date(m.updatedAt) > dayAgo;
                        }).length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 思维导图列表 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-800">我的思维导图</h3>
                    <button
                      onClick={() => setShowTemplates(!showTemplates)}
                      className="text-emerald-600 hover:text-emerald-700 font-medium text-sm"
                    >
                      <i className="fa-solid fa-template mr-1"></i>
                      {showTemplates ? '隐藏模板' : '查看模板'}
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {mindMaps.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="fa-solid fa-project-diagram text-3xl text-gray-400"></i>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-600 mb-2">还没有思维导图</h3>
                      <p className="text-gray-500 mb-6">创建您的第一个思维导图，开始可视化思考！</p>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 shadow-md hover:shadow-lg"
                      >
                        <i className="fa-solid fa-plus mr-2"></i>
                        创建思维导图
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {mindMaps.map((mindMap) => (
                        <motion.div
                          key={mindMap.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-200 cursor-pointer group"
                          onClick={() => navigate(`/mindmaps/${mindMap.id}`)}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-800 group-hover:text-emerald-600 transition-colors">
                                {mindMap.title}
                              </h4>
                              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                {mindMap.description}
                              </p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteMindMap(mindMap.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                            >
                              <i className="fa-solid fa-trash text-sm"></i>
                            </button>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className={`inline-block px-2 py-1 text-xs rounded-full ${getTypeColor(mindMap.type)}`}>
                              {getTypeLabel(mindMap.type)}
                            </span>
                            <div className="text-xs text-gray-500">
                              {mindMap.nodes.length} 节点 • {mindMap.edges.length} 连接
                            </div>
                          </div>

                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>
                                <i className="fa-solid fa-clock mr-1"></i>
                                {new Date(mindMap.updatedAt).toLocaleDateString()}
                              </span>
                              {mindMap.projectId && (
                                <span className="text-emerald-600">
                                  <i className="fa-solid fa-link mr-1"></i>
                                  关联项目
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 模板展示 */}
              <AnimatePresence>
                {showTemplates && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200"
                  >
                    <div className="p-6 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-800">可用模板</h3>
                      <p className="text-sm text-gray-600 mt-1">选择模板快速创建思维导图</p>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {templates.map((template) => (
                          <div
                            key={template.id}
                            className="border border-gray-200 rounded-lg p-4 hover:border-emerald-300 hover:bg-emerald-50 transition-all duration-200 cursor-pointer"
                            onClick={() => {
                              setCreateForm(prev => ({ ...prev, templateId: template.id }));
                              setShowCreateModal(true);
                            }}
                          >
                            <div className="flex items-center mb-2">
                              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                                <i className="fa-solid fa-template text-emerald-600 text-sm"></i>
                              </div>
                              <h4 className="ml-3 font-medium text-gray-800">{template.name}</h4>
                            </div>
                            <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>v{template.version}</span>
                              <div className="flex items-center space-x-2">
                                <span>⭐ {template.rating}</span>
                                <span>↓ {template.downloadCount}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </main>
      </div>

      {/* 创建思维导图模态框 */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-xl shadow-lg max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">创建思维导图</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">标题</label>
                    <input
                      type="text"
                      value={createForm.title}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="输入思维导图标题"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">描述</label>
                    <textarea
                      value={createForm.description}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      rows={3}
                      placeholder="描述思维导图的用途"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">类型</label>
                    <select
                      value={createForm.type}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, type: e.target.value as MindMap['type'] }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="custom">自定义</option>
                      <option value="project_overview">项目总览</option>
                      <option value="experiment_flow">实验流程</option>
                      <option value="data_relations">数据关联</option>
                    </select>
                  </div>

                  {templates.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">使用模板（可选）</label>
                      <select
                        value={createForm.templateId}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, templateId: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">不使用模板</option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={createMindMap}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                  >
                    创建
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}