import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/useTheme';
import { AISettings } from '@/types';
import { experimentRecordService, experimentNoteService, sopService } from '@/lib/cachedStorage';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';

export default function Settings() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { toggleTheme, isDark } = useTheme();
  const [userProfile, setUserProfile] = useState(() => {
    const saved = localStorage.getItem('userProfile');
    return saved ? JSON.parse(saved) : {
      name: '实验管理员',
      email: 'admin@example.com',
      department: '研发部'
    };
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  
  const [aiSettings, setAiSettings] = useState<AISettings>(() => {
    const saved = localStorage.getItem('aiSettings');
    return saved ? JSON.parse(saved) : {
      apiEndpoint: 'https://api.siliconflow.cn/v1/chat/completions',
      apiKey: '',
      model: 'qwen2.5-72b-instruct',
      useCustomAPI: false
    };
  });
  
  const [isTestingAPI, setIsTestingAPI] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const saveAiSettings = () => {
    try {
      if (aiSettings.useCustomAPI) {
        if (!aiSettings.apiEndpoint || !aiSettings.apiKey) {
          toast.error('请先填写API端点和密钥');
          return;
        }
      }
      localStorage.setItem('aiSettings', JSON.stringify(aiSettings));
      toast.success('AI API设置已保存');
    } catch (error) {
      console.error('保存AI设置失败:', error);
      toast.error('保存失败，请重试');
    }
  };
  
  const autoSaveSettings = useCallback(() => {
    try {
      localStorage.setItem('aiSettings', JSON.stringify(aiSettings));
    } catch (error) {
      console.error('自动保存失败:', error);
    }
  }, [aiSettings]);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      autoSaveSettings();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [autoSaveSettings]);
  
  const testAPIConnection = async () => {
    if (!aiSettings.apiEndpoint || !aiSettings.apiKey) {
      toast.error('请先填写API端点和密钥');
      return;
    }

    setIsTestingAPI(true);
    setApiTestResult(null);

    try {
      const testMessage = {
        messages: [
          { role: 'system', content: '你是一个测试助手。' },
          { role: 'user', content: '请回复"连接测试成功"' }
        ],
        model: aiSettings.model || 'qwen2.5-72b-instruct',
        max_tokens: 50,
        temperature: 0.1
      };

      const response = await fetch(aiSettings.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiSettings.apiKey}`
        },
        body: JSON.stringify(testMessage)
      });

      if (!response.ok) {
        const errorText = await response.text();
        setApiTestResult({
          success: false,
          message: `连接失败 (${response.status}): ${errorText}`
        });
        return;
      }

      const data = await response.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        setApiTestResult({
          success: true,
          message: `连接测试成功！响应内容：${data.choices[0].message.content}`
        });
        toast.success('API连接测试成功！');
      } else {
        setApiTestResult({
          success: false,
          message: 'API响应格式异常'
        });
      }

    } catch (error) {
      console.error('API测试网络错误:', error);
      setApiTestResult({
        success: false,
        message: `网络连接失败：${error instanceof Error ? error.message : '未知错误'}`
      });
    } finally {
      setIsTestingAPI(false);
    }
  };
  
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserProfile((prev: any) => ({ ...prev, [name]: value }));
  };
  
  const saveProfile = () => {
    try {
      localStorage.setItem('userProfile', JSON.stringify(userProfile));
      toast.success('个人资料已更新');
      setIsEditing(false);
    } catch (error) {
      console.error('保存用户资料失败:', error);
      toast.error('保存失败，请重试');
    }
  };
  
  const exportAllData = () => {
    try {
      const records = experimentRecordService.getAll();
      const notes = experimentNoteService.getAll();
      const sops = sopService.getAll();
      
      const exportData = {
        records,
        notes,
        sops,
        exportDate: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `experiment_data_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('数据导出成功');
    } catch (error) {
      toast.error('数据导出失败，请重试');
      console.error('数据导出失败:', error);
    }
  };
  
  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        
        if (importedData.records && Array.isArray(importedData.records)) {
          localStorage.setItem('experiment_records', JSON.stringify(importedData.records));
        }
        
        if (importedData.notes && Array.isArray(importedData.notes)) {
          localStorage.setItem('experiment_notes', JSON.stringify(importedData.notes));
        }
        
        if (importedData.sops && Array.isArray(importedData.sops)) {
          localStorage.setItem('sops', JSON.stringify(importedData.sops));
        }
        
        toast.success('数据导入成功，页面将刷新');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (error) {
        toast.error('数据导入失败，文件格式不正确');
        console.error('数据导入失败:', error);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  
  const confirmClearData = () => {
    setShowConfirmDialog(true);
  };
  
  const clearAllData = () => {
    try {
      localStorage.removeItem('experiment_records');
      localStorage.removeItem('experiment_notes');
      localStorage.removeItem('sops');
      
      toast.success('所有数据已清除，页面将刷新');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast.error('清除数据失败，请重试');
      console.error('清除数据失败:', error);
    }
    setShowConfirmDialog(false);
  };
  
  return (
    <div className="min-h-screen bg-[#F9F6F2] dark:bg-gray-900 text-[#555555] dark:text-gray-300">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header 
          title="系统设置" 
          sidebarCollapsed={sidebarCollapsed}
        />
        
        <main className="h-[calc(100vh-64px)] p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* 页面标题 */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center space-x-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                  <i className="fa-solid fa-seedling text-white text-lg"></i>
                </div>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">实验小森林 - 系统设置</h1>
              </div>
              <p className="text-gray-600 dark:text-gray-400">配置您的实验环境，让科研更高效</p>
            </div>
            
            {/* 个人资料设置 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-emerald-100 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl flex items-center justify-center shadow-lg">
                    <i className="fa-solid fa-user text-white"></i>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-white">🌱 个人资料</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">管理您的个人信息（后期将接入后端管理）</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {isEditing ? '取消编辑' : '编辑资料'}
                </button>
              </div>
                
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">🌿 用户名</label>
                  <input
                    type="text"
                    name="name"
                    value={userProfile.name}
                    onChange={handleProfileChange}
                    disabled={!isEditing}
                    className="w-full px-4 py-3 border border-emerald-200 dark:border-gray-600 rounded-xl bg-emerald-50/50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">📧 邮箱</label>
                  <input
                    type="email"
                    name="email"
                    value={userProfile.email}
                    onChange={handleProfileChange}
                    disabled={!isEditing}
                    className="w-full px-4 py-3 border border-emerald-200 dark:border-gray-600 rounded-xl bg-emerald-50/50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">🏢 部门</label>
                  <input
                    type="text"
                    name="department"
                    value={userProfile.department}
                    onChange={handleProfileChange}
                    disabled={!isEditing}
                    className="w-full px-4 py-3 border border-emerald-200 dark:border-gray-600 rounded-xl bg-emerald-50/50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
              </div>
              
              {isEditing && (
                <div className="flex justify-end pt-4">
                  <button
                    onClick={saveProfile}
                    className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white px-6 py-2 rounded-xl font-medium transition-all transform hover:scale-105 shadow-lg"
                  >
                    💾 保存资料
                  </button>
                </div>
              )}
            </div>

            {/* AI 助手配置 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-emerald-100 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl flex items-center justify-center shadow-lg">
                  <i className="fa-solid fa-robot text-white"></i>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-white">🤖 AI 智能助手</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">配置您的AI API服务连接</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-gray-700 dark:to-gray-600 rounded-xl border border-emerald-200 dark:border-gray-600">
                  <div>
                    <h3 className="font-medium text-gray-800 dark:text-white">🔧 使用自定义AI服务</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">启用后可配置自定义AI模型和API密钥</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aiSettings.useCustomAPI}
                      onChange={(e) => setAiSettings(prev => ({...prev, useCustomAPI: e.target.checked}))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
                
                <div className={`space-y-4 ${!aiSettings.useCustomAPI ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">🔗 API端点</label>
                      <input
                        type="text"
                        value={aiSettings.apiEndpoint}
                        onChange={(e) => setAiSettings(prev => ({...prev, apiEndpoint: e.target.value}))}
                        className="w-full px-4 py-3 border border-emerald-200 dark:border-gray-600 rounded-xl bg-emerald-50/30 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        placeholder="https://api.siliconflow.cn/v1/chat/completions"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">🔑 API密钥</label>
                      <div className="relative">
                        <input
                          type={showApiKey ? "text" : "password"}
                          value={aiSettings.apiKey}
                          onChange={(e) => setAiSettings(prev => ({...prev, apiKey: e.target.value}))}
                          className="w-full px-4 py-3 border border-emerald-200 dark:border-gray-600 rounded-xl bg-emerald-50/30 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all pr-12"
                          placeholder="sk-..."
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-emerald-500 transition-colors"
                        >
                          <i className={`fa-solid ${showApiKey ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">🧠 模型名称</label>
                    <input
                      type="text"
                      value={aiSettings.model || ''}
                      onChange={(e) => setAiSettings(prev => ({...prev, model: e.target.value}))}
                      className="w-full px-4 py-3 border border-emerald-200 dark:border-gray-600 rounded-xl bg-emerald-50/30 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                      placeholder="qwen2.5-72b-instruct"
                    />
                  </div>
                  
                  <div className="flex space-x-3">
                    <button 
                      type="button"
                      onClick={testAPIConnection}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-4 py-3 rounded-xl font-medium transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:transform-none"
                      disabled={!aiSettings.apiEndpoint || !aiSettings.apiKey || isTestingAPI}
                    >
                      {isTestingAPI ? '🔄 测试中...' : '🔬 测试连接'}
                    </button>
                    
                    <button 
                      type="button"
                      onClick={saveAiSettings}
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white px-4 py-3 rounded-xl font-medium transition-all transform hover:scale-105 shadow-lg"
                    >
                      💾 保存配置
                    </button>
                  </div>
                  
                  {apiTestResult && (
                    <div className={`p-3 rounded-lg border ${
                      apiTestResult.success 
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'
                    }`}>
                      <div className="flex items-start">
                        <i className={`mt-0.5 mr-2 ${
                          apiTestResult.success 
                            ? 'fa-solid fa-check-circle text-green-500'
                            : 'fa-solid fa-exclamation-circle text-red-500'
                        }`}></i>
                        <div className={`flex-1 text-sm ${
                          apiTestResult.success 
                            ? 'text-green-800 dark:text-green-300'
                            : 'text-red-800 dark:text-red-300'
                        }`}>
                          <pre className="whitespace-pre-wrap">{apiTestResult.message}</pre>
                        </div>
                        <button
                          type="button"
                          onClick={() => setApiTestResult(null)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-2"
                        >
                          <i className="fa-solid fa-times"></i>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 主题设置 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-emerald-100 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl flex items-center justify-center shadow-lg">
                  <i className="fa-solid fa-palette text-white"></i>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-white">🎨 主题设置</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">个性化您的实验小森林界面</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-gray-700 dark:to-gray-600 rounded-xl border border-amber-200 dark:border-gray-600">
                <div>
                  <h3 className="font-medium text-gray-800 dark:text-white">🌙 主题模式</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">选择清新的浅色或温暖的深色主题</p>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-600 dark:text-gray-300">☀️ 浅色</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDark}
                      onChange={toggleTheme}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                  <span className="text-sm text-gray-600 dark:text-gray-300">🌙 深色</span>
                </div>
              </div>
            </div>
              
            {/* 数据管理 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-emerald-100 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl flex items-center justify-center shadow-lg">
                  <i className="fa-solid fa-database text-white"></i>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-white">🗺️ 数据管理</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">管理您的实验数据备份和存储</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-700 dark:to-gray-600 rounded-xl border border-green-200 dark:border-gray-600">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium text-gray-800 dark:text-white">📦 导出数据</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">将所有实验数据导出为JSON文件</p>
                    </div>
                    <button 
                      type="button"
                      onClick={exportAllData}
                      className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-4 py-2 rounded-lg font-medium transition-all transform hover:scale-105 shadow-lg"
                    >
                      <i className="fa-solid fa-download mr-2"></i>导出
                    </button>
                  </div>
                </div>
                
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600 rounded-xl border border-blue-200 dark:border-gray-600">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium text-gray-800 dark:text-white">📎 导入数据</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">从JSON文件导入实验数据</p>
                    </div>
                    <label className="inline-flex items-center">
                      <input
                        type="file"
                        accept=".json"
                        onChange={importData}
                        className="hidden"
                        id="importFile"
                      />
                      <button 
                        type="button"
                        onClick={() => document.getElementById('importFile')?.click()}
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-4 py-2 rounded-lg font-medium transition-all transform hover:scale-105 shadow-lg"
                      >
                        <i className="fa-solid fa-upload mr-2"></i>导入
                      </button>
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-xl border border-red-200 dark:border-red-800">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium text-red-600 dark:text-red-400">🗑️ 清除所有数据</h3>
                    <p className="text-sm text-red-500 dark:text-red-400">删除系统中的所有实验数据，此操作不可撤销</p>
                  </div>
                  <button 
                    type="button"
                    onClick={confirmClearData}
                    className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-4 py-2 rounded-lg font-medium transition-all transform hover:scale-105 shadow-lg"
                  >
                    <i className="fa-solid fa-trash mr-2"></i>清除数据
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      
      {/* 确认对话框 */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full mx-4"
          >
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                <i className="fa-solid fa-exclamation-triangle text-red-500 text-2xl"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">确认清除所有数据</h3>
            </div>
            
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              您确定要删除系统中的所有实验数据吗？此操作不可撤销，所有记录、笔记和SOP文档都将被永久删除。
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <button 
                type="button"
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors"
              >
                <i className="fa-solid fa-times mr-2"></i>取消
              </button>
              <button 
                type="button"
                onClick={clearAllData}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <i className="fa-solid fa-trash mr-2"></i>确认清除
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}