import { useState } from 'react';
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
    // 从本地存储加载用户资料
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
  
  // AI API设置状态
  const [aiSettings, setAiSettings] = useState<AISettings>(() => {
    const saved = localStorage.getItem('aiSettings');
    return saved ? JSON.parse(saved) : {
      apiEndpoint: 'https://api.siliconflow.cn/v1/chat/completions',
      apiKey: '',
      model: 'qwen2.5-72b-instruct',
      useCustomAPI: false
    };
  });
  
  // API测试状态
  const [isTestingAPI, setIsTestingAPI] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // 表单编辑状态
  const [isEditing, setIsEditing] = useState(false);
  
  // 保存AI设置到本地存储
  const saveAiSettings = () => {
    localStorage.setItem('aiSettings', JSON.stringify(aiSettings));
    toast.success('AI API设置已保存');
  };
  
  // 测试API连接
  const testAPIConnection = async () => {
    if (!aiSettings.apiEndpoint || !aiSettings.apiKey) {
      toast.error('请先填写API端点和密钥');
      return;
    }

    setIsTestingAPI(true);
    setApiTestResult(null);

    try {
      // 根据API类型选择合适的模型
      let defaultModel = aiSettings.model || 'gpt-3.5-turbo';
      if (aiSettings.apiEndpoint.includes('siliconflow.cn')) {
        defaultModel = aiSettings.model || 'qwen2.5-72b-instruct';
      }
      
      const testMessage = {
        model: defaultModel,
        messages: [
          { role: 'system', content: '你是一个测试助手。' },
          { role: 'user', content: '请回复"连接测试成功"' }
        ],
        max_tokens: 50,
        temperature: 0.1
      };

      console.log('测试API连接:', {
        endpoint: aiSettings.apiEndpoint,
        hasKey: !!aiSettings.apiKey,
        model: testMessage.model
      });

      const response = await fetch(aiSettings.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiSettings.apiKey}`
        },
        body: JSON.stringify(testMessage)
      });

      console.log('API测试响应状态:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API测试失败详情:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });

        let errorMessage = '';
        if (response.status === 404) {
          errorMessage = `API端点不存在 (404)\n\n可能的原因：\n• API端点地址不正确\n• 服务提供商的API版本有变化\n\n硅基流动正确格式：\n• https://api.siliconflow.cn/v1/chat/completions\n\n其他常见格式：\n• OpenAI: https://api.openai.com/v1/chat/completions\n• Azure OpenAI: https://your-resource.openai.azure.com/openai/deployments/your-model/chat/completions?api-version=2023-05-15`;
        } else if (response.status === 401) {
          errorMessage = `API密钥验证失败 (401)\n\n可能的原因：\n• API密钥错误或已过期\n• API密钥格式不正确\n• 账户余额不足或权限不够\n\n硅基流动解决建议：\n• 检查API密钥是否以 'sk-' 开头\n• 确认账户状态和余额\n• 重新生成API密钥\n• 检查模型权限`;
        } else if (response.status === 429) {
          errorMessage = `请求频率限制 (429)\n\n• 请稍后再试\n• 检查API调用配额\n• 硅基流动可能有每分钟调用限制`;
        } else if (response.status >= 500) {
          errorMessage = `服务器错误 (${response.status})\n\n• API服务暂时不可用\n• 请稍后重试\n• 硅基流动服务可能正在维护`;
        } else {
          errorMessage = `请求失败 (${response.status})\n\n${response.statusText}\n\n响应内容：${errorText}`;
        }

        setApiTestResult({
          success: false,
          message: errorMessage
        });
        return;
      }

      const data = await response.json();
      console.log('API测试成功:', data);

      if (data.choices && data.choices[0] && data.choices[0].message) {
        setApiTestResult({
          success: true,
          message: `连接测试成功！\n\n响应内容：${data.choices[0].message.content}\nAPI模型：${data.model || testMessage.model}\n使用tokens：${data.usage?.total_tokens || '未知'}`
        });
        toast.success('API连接测试成功！');
      } else {
        setApiTestResult({
          success: false,
          message: `API响应格式异常\n\n返回的数据结构不符合预期。\n响应内容：${JSON.stringify(data, null, 2)}`
        });
      }

    } catch (error) {
      console.error('API测试网络错误:', error);
      let errorMessage = '';
      
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        errorMessage = `网络连接失败\n\n可能的原因：\n• 网络连接问题\n• API端点地址不正确\n• 防火墙或代理设置阻止连接\n• CORS跨域问题（如果是浏览器环境）\n\n硅基流动解决建议：\n• 检查网络连接\n• 确认端点：https://api.siliconflow.cn/v1/chat/completions\n• 国内网络一般可直接访问硅基流动`;
      } else if (error instanceof Error) {
        errorMessage = `连接错误\n\n${error.message}\n\n请检查：\n• API端点地址是否正确\n• 网络连接是否正常\n• 硅基流动服务状态`;
      } else {
        errorMessage = `未知错误\n\n请检查控制台获取详细信息`;
      }

      setApiTestResult({
        success: false,
        message: errorMessage
      });
    } finally {
      setIsTestingAPI(false);
    }
  };
  
  // 处理用户资料变更
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserProfile((prev: any) => ({ ...prev, [name]: value }));
  };
  
  // 保存用户资料
  const saveProfile = () => {
    try {
      // 保存到本地存储
      localStorage.setItem('userProfile', JSON.stringify(userProfile));
      toast.success('个人资料已更新');
      setIsEditing(false);
    } catch (error) {
      console.error('保存用户资料失败:', error);
      toast.error('保存失败，请重试');
    }
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
                        placeholder="https://api.siliconflow.cn/v1/chat/completions"
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
                    
                    {/* AI模型选择 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">模型选择</label>
                      <select
                        value={aiSettings.model}
                        onChange={(e) => setAiSettings(prev => ({...prev, model: e.target.value}))}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <optgroup label="硅基流动模型 (推荐)">
                          <option value="qwen2.5-72b-instruct">Qwen2.5-72B-Instruct (推荐)</option>
                          <option value="deepseek-chat">DeepSeek-Chat</option>
                          <option value="glm-4-9b-chat">GLM-4-9B-Chat</option>
                          <option value="qwen2.5-14b-instruct">Qwen2.5-14B-Instruct</option>
                          <option value="qwen2.5-7b-instruct">Qwen2.5-7B-Instruct</option>
                          <option value="llama-3.1-70b-instruct">Llama-3.1-70B-Instruct</option>
                          <option value="llama-3.1-8b-instruct">Llama-3.1-8B-Instruct</option>
                        </optgroup>
                        <optgroup label="OpenAI模型">
                          <option value="gpt-4o">GPT-4o</option>
                          <option value="gpt-4o-mini">GPT-4o-mini</option>
                          <option value="gpt-4-turbo">GPT-4-Turbo</option>
                          <option value="gpt-4">GPT-4</option>
                          <option value="gpt-3.5-turbo">GPT-3.5-Turbo</option>
                        </optgroup>
                        <optgroup label="其他模型">
                          <option value="claude-3-sonnet">Claude-3-Sonnet</option>
                          <option value="claude-3-haiku">Claude-3-Haiku</option>
                          <option value="custom">自定义模型</option>
                        </optgroup>
                      </select>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        选择与API端点匹配的模型。硅基流动推荐使用Qwen2.5-72B-Instruct模型。
                      </p>
                    </div>

                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button 
                        type="button"
                        onClick={testAPIConnection}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        disabled={!aiSettings.apiEndpoint || !aiSettings.apiKey || isTestingAPI}
                      >
                        {isTestingAPI ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            测试中...
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-plug mr-2"></i>测试连接
                          </>
                        )}
                      </button>
                      
                      <button 
                        type="button"
                        onClick={saveAiSettings}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!aiSettings.apiEndpoint || !aiSettings.apiKey}
                      >
                        <i className="fa-solid fa-save mr-2"></i>保存设置
                      </button>
                    </div>
                    
                    {/* API测试结果显示 */}
                    {apiTestResult && (
                      <div className={`p-4 rounded-lg border ${
                        apiTestResult.success 
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50'
                          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'
                      }`}>
                        <div className="flex items-start">
                          <i className={`mt-0.5 mr-3 ${
                            apiTestResult.success 
                              ? 'fa-solid fa-check-circle text-green-500'
                              : 'fa-solid fa-exclamation-circle text-red-500'
                          }`}></i>
                          <div className={`flex-1 text-sm ${
                            apiTestResult.success 
                              ? 'text-green-800 dark:text-green-300'
                              : 'text-red-800 dark:text-red-300'
                          }`}>
                            <p className="font-medium mb-2">
                              {apiTestResult.success ? 'API连接测试成功' : 'API连接测试失败'}
                            </p>
                            <pre className="whitespace-pre-wrap text-xs leading-relaxed font-mono">
                              {apiTestResult.message}
                            </pre>
                          </div>
                          <button
                            type="button"
                            onClick={() => setApiTestResult(null)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors ml-2"
                          >
                            <i className="fa-solid fa-times"></i>
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* 常见API配置示例 */}
                    {aiSettings.useCustomAPI && (
                      <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                        <div className="flex items-start">
                          <i className="fa-solid fa-info-circle text-emerald-600 mt-0.5 mr-3"></i>
                          <div className="text-sm text-emerald-800 flex-1">
                            <p className="font-medium mb-3">常见API配置示例</p>
                            
                            <div className="space-y-4">
                              <div className="bg-emerald-100 p-3 rounded-lg border border-emerald-300">
                                <p className="font-medium mb-2 text-emerald-900">🚀 硅基流动 API (推荐)</p>
                                <code className="text-xs bg-white px-2 py-1 rounded break-all block mb-2">
                                  https://api.siliconflow.cn/v1/chat/completions
                                </code>
                                <div className="text-xs text-emerald-700">
                                  <p className="mb-1">• 支持模型：qwen2.5-72b-instruct, deepseek-chat, glm-4-9b-chat 等</p>
                                  <p className="mb-1">• 国内直连，速度快，价格优惠</p>
                                  <p>• API密钥格式：sk-xxxxxxxxxxxxxxxx</p>
                                </div>
                              </div>
                              
                              <div>
                                <p className="font-medium mb-1">OpenAI 官方 API</p>
                                <code className="text-xs bg-gray-100 px-2 py-1 rounded break-all">
                                  https://api.openai.com/v1/chat/completions
                                </code>
                              </div>
                              
                              <div>
                                <p className="font-medium mb-1">Azure OpenAI</p>
                                <code className="text-xs bg-gray-100 px-2 py-1 rounded break-all">
                                  https://your-resource.openai.azure.com/openai/deployments/your-model/chat/completions?api-version=2023-05-15
                                </code>
                              </div>
                              
                              <div>
                                <p className="font-medium mb-1">其他国内代理服务</p>
                                <p className="text-xs text-gray-600">
                                  请参考具体服务商提供的端点地址
                                </p>
                              </div>
                            </div>
                            
                            <div className="mt-4 pt-3 border-t border-emerald-200">
                              <p className="font-medium mb-2">硅基流动使用提示</p>
                              <ul className="text-xs space-y-1 list-disc list-inside text-emerald-700">
                                <li>注册账户后可在控制台获取API密钥</li>
                                <li>支持多种开源和商业模型</li>
                                <li>国内网络环境友好，无需代理</li>
                                <li>有免费额度，付费价格合理</li>
                                <li>建议使用qwen2.5-72b-instruct模型，效果优异</li>
                              </ul>
                            </div>
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
