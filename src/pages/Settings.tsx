import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/useTheme';
import { AISettings } from '@/types';
import { experimentRecordService, experimentNoteService, sopService } from '@/lib/cachedStorage';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';


export default function Settings() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { theme, toggleTheme, isDark } = useTheme();
  const [userProfile, setUserProfile] = useState({
    name: '实验管理员',
    email: 'admin@example.com',
    department: '研发部'
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  
  // AI API设置状态
  const [aiSettings, setAiSettings] = useState<AISettings>(() => {
    const saved = localStorage.getItem('aiSettings');
    return saved ? JSON.parse(saved) : {
      apiEndpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey: '',
      model: 'gpt-3.5-turbo',
      useCustomAPI: false
    };
  });
  
  // 表单编辑状态
  const [isEditing, setIsEditing] = useState(false);
  
  // 保存AI设置到本地存储
  const saveAiSettings = () => {
    localStorage.setItem('aiSettings', JSON.stringify(aiSettings));
    toast.success('AI API设置已保存');
  };
  
  // 处理用户资料变更
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserProfile(prev => ({ ...prev, [name]: value }));
  };
  
  // 保存用户资料
  const saveProfile = () => {
    // 在实际应用中，这里会调用API保存到服务器
    // 这里仅做本地演示
    toast.success('个人资料已更新');
    setIsEditing(false);
  };
  
  // 导出所有数据
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
  
  // 导入数据
  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        
        // 在实际应用中，这里应该有更严格的数据验证
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
    
    // 重置文件输入，允许重复选择同一文件
    e.target.value = '';
  };
  
  // 清除所有数据
  const confirmClearData = () => {
    setShowConfirmDialog(true);
  };
  
  // 确认清除数据
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
    <div className="min-h-screen bg-[#F9F6F2] text-[#555555]">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header 
          title="系统设置" 
          sidebarCollapsed={sidebarCollapsed}
        />
        
        <main className="container mx-auto px-4 py-6">
          <div className="max-w-3xl mx-auto">
            {/* 个人资料设置 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">个人资料</h2>
                {isEditing ? (
                  <button 
                    type="button" 
                    onClick={saveProfile}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-sm transition-colors"
                  >
                    <i className="fa-solid fa-save mr-1"></i>保存
                  </button>
                ) : (
                  <button 
                    type="button" 
                    onClick={() => setIsEditing(true)}
                    className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1 rounded text-sm transition-colors"
                  >
                    <i className="fa-solid fa-edit mr-1"></i>编辑
                  </button>
                )}
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">姓名</label>
                  <input
                    type="text"
                    name="name"
                    value={userProfile.name}
                    onChange={handleProfileChange}
                    disabled={!isEditing}
                    className={`w-full px-4 py-2 rounded-lg border ${isEditing ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700' : 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800'} text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">邮箱</label>
                  <input
                    type="email"
                    name="email"
                    value={userProfile.email}
                    onChange={handleProfileChange}
                    disabled={!isEditing}
                    className={`w-full px-4 py-2 rounded-lg border ${isEditing ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700' : 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800'} text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">部门</label>
                  <input
                    type="text"
                    name="department"
                    value={userProfile.department}
                    onChange={handleProfileChange}
                    disabled={!isEditing}
                    className={`w-full px-4 py-2 rounded-lg border ${isEditing ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700' : 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800'} text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
              </div>
            </div>
            
             {/* 外观设置 */}
             <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
               <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6">外观设置</h2>
               
               <div className="flex items-center justify-between mb-4">
                 <div>
                   <h3 className="font-medium text-gray-800 dark:text-white">主题模式</h3>
                   <p className="text-sm text-gray-500 dark:text-gray-400">选择应用的显示主题</p>
                 </div>
                 <div className="flex items-center space-x-2">
                   <span className="text-sm text-gray-600 dark:text-gray-300">浅色</span>
                   <label className="relative inline-flex items-center cursor-pointer">
                     <input
                       type="checkbox"
                       checked={isDark}
                       onChange={toggleTheme}
                       className="sr-only peer"
                     />
                     <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-600 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                   </label>
                   <span className="text-sm text-gray-600 dark:text-gray-300">深色</span>
                 </div>
               </div>
             </div>
             
             {/* 通知设置 */}
             <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
               <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6">通知设置</h2>
               
               <div className="flex items-center justify-between">
                 <div>
                   <h3 className="font-medium text-gray-800 dark:text-white">启用通知</h3>
                   <p className="text-sm text-gray-500 dark:text-gray-400">接收系统和实验相关通知</p>
                 </div>
                 <label className="relative inline-flex items-center cursor-pointer">
                   <input
                     type="checkbox"
                     checked={notificationsEnabled}
                     onChange={(e) => setNotificationsEnabled(e.target.checked)}
                     className="sr-only peer"
                   />
                   <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-600 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                 </label>
               </div>
             </div>
             
             {/* AI API配置 */}
             <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6" id="ai-api-settings">
               <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6">AI API配置</h2>
               
               <div className="space-y-6">
                 <div className="flex items-center justify-between">
                   <div>
                     <h3 className="font-medium text-gray-800 dark:text-white">使用自定义API</h3>
                     <p className="text-sm text-gray-500 dark:text-gray-400">启用后可配置自定义AI模型和API密钥</p>
                   </div>
                   <label className="relative inline-flex items-center cursor-pointer">
                     <input
                       type="checkbox"
                       checked={aiSettings.useCustomAPI}
                       onChange={(e) => setAiSettings(prev => ({...prev, useCustomAPI: e.target.checked}))}
                       className="sr-only peer"
                     />
                     <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-600 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                   </label>
                 </div>
                 
                  <div className={`space-y-6 ${!aiSettings.useCustomAPI ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API端点 <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={aiSettings.apiEndpoint}
                        onChange={(e) => {
                          setAiSettings(prev => ({...prev, apiEndpoint: e.target.value}));
                          // 简单URL验证
                          if (e.target.value && !e.target.value.startsWith('http')) {
                            toast.warning('API端点应以http://或https://开头');
                          }
                        }}
                        className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-200 ${
                          aiSettings.apiEndpoint && !aiSettings.apiEndpoint.startsWith('http')
                            ? 'border-red-500 dark:border-red-500 bg-red-50/50 dark:bg-red-900/10'
                            : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                        } text-gray-800 dark:text-gray-200`}
                        placeholder="https://api.openai.com/v1/chat/completions"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        请输入完整的API端点URL，包含http://或https://
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API密钥 <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <input
                          type={showApiKey ? "text" : "password"}
                          value={aiSettings.apiKey}
                          onChange={(e) => setAiSettings(prev => ({...prev, apiKey: e.target.value}))}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-10"
                          placeholder="sk-..."
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                          aria-label={showApiKey ? "隐藏密钥" : "显示密钥"}
                        >
                          <i className={`fa-solid ${showApiKey ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                      </div>
                    </div>
                    
                    {/* 改进的AI模型选择 */}

                    
                    <button 
                      type="button"
                      onClick={saveAiSettings}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
                      disabled={!aiSettings.apiEndpoint || !aiSettings.apiKey}
                    >
                      <span className="relative z-10 flex items-center justify-center">
                        <i className="fa-solid fa-save mr-2"></i>保存API设置
                      </span>
                      {!aiSettings.apiEndpoint || !aiSettings.apiKey ? (
                        <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-500 bg-gray-100 dark:bg-gray-700">
                          请填写所有必填字段
                        </span>
                      ) : (
                        <span className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-green-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></span>
                      )}
                    </button>
                    
                    {aiSettings.useCustomAPI && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800/50">
                        <div className="flex items-start">
                          <i className="fa-solid fa-exclamation-triangle text-amber-500 mt-0.5 mr-2"></i>
                          <div className="text-sm text-amber-800 dark:text-amber-300">
                            <p className="font-medium">API使用提示</p>
                            <p className="mt-1">• 请确保API密钥和端点正确无误</p>
                            <p>• 国内用户可能需要配置网络代理</p>
                            <p>• 免费API通常有调用频率限制</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
               </div>
             </div>
             
             {/* 数据管理 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6">数据管理</h2>
              
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium text-gray-800 dark:text-white">导出数据</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">将所有实验数据导出为JSON文件</p>
                  </div>
                  <button 
                    type="button"
                    onClick={exportAllData}
                    className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1 rounded text-sm transition-colors"
                  >
                    <i className="fa-solid fa-download mr-1"></i>导出
                  </button>
                </div>
                
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium text-gray-800 dark:text-white">导入数据</h3>
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
                      className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1 rounded text-sm transition-colors"
                    >
                      <i className="fa-solid fa-upload mr-1"></i>导入
                    </button>
                  </label>
                </div>
                
                <div className="flex justify-between items-center border-t border-gray-200 dark:border-gray-700 pt-6">
                  <div>
                    <h3 className="font-medium text-gray-800 dark:text-white text-red-600 dark:text-red-400">清除所有数据</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">删除系统中的所有实验数据，此操作不可撤销</p>
                  </div>
                   <button 
                     type="button"
                     onClick={() => {
                       if (window.confirm('确定要清除所有数据吗？此操作将删除所有实验记录、笔记和SOP文档，且无法恢复！')) {
                         confirmClearData();
                       }
                     }}
                     className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
                   >
                     <i className="fa-solid fa-trash mr-1"></i>清除所有数据
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
                 className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors"
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
