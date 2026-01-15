import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/useTheme';
import { AISettings } from '@/types';
import { experimentRecordService, experimentNoteService, sopService } from '@/lib/cachedStorage';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { Button } from '@/components/Button';

export default function Settings() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const { toggleTheme: _toggleTheme, isDark: _isDark } = useTheme();

  // User Profile State
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const [userProfile, setUserProfile] = useState(() => {
    const saved = localStorage.getItem('userProfile');
    return saved ? JSON.parse(saved) : {
      name: '实验管理员',
      email: 'admin@example.com',
      department: '研发部'
    };
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // AI Settings State
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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Auto-save AI Settings
  const prevAiSettingsRef = useRef<string>(JSON.stringify(aiSettings));
  useEffect(() => {
    const currentSettingsString = JSON.stringify(aiSettings);
    if (currentSettingsString !== prevAiSettingsRef.current) {
      const timer = setTimeout(() => {
        try {
          localStorage.setItem('aiSettings', currentSettingsString);
          console.log('[Settings] Auto-saved');
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }, 1000);
      prevAiSettingsRef.current = currentSettingsString;
      return () => clearTimeout(timer);
    }
  }, [aiSettings]);

  // Handlers
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserProfile((prev: any) => ({ ...prev, [name]: value }));
  };

  const saveProfile = () => {
    try {
      localStorage.setItem('userProfile', JSON.stringify(userProfile));
      toast.success('个人资料已更新');
      setIsEditingProfile(false);
    } catch (error) {
      toast.error('保存失败');
    }
  };

  const testAPIConnection = async () => {
    if (!aiSettings.apiEndpoint || !aiSettings.apiKey) {
      toast.error('请填写 API 信息');
      return;
    }
    setIsTestingAPI(true);
    setApiTestResult(null);
    try {
      const response = await fetch(aiSettings.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiSettings.apiKey}` },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Ping' }],
          model: aiSettings.model || 'qwen2.5-72b-instruct',
          max_tokens: 10
        })
      });

      if (response.ok) {
        setApiTestResult({ success: true, message: '连接成功！API 配置有效。' });
        toast.success('连接成功');
      } else {
        const err = await response.text();
        setApiTestResult({ success: false, message: `连接失败: ${err}` });
      }
    } catch (e) {
      setApiTestResult({ success: false, message: `网络错误: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setIsTestingAPI(false);
    }
  };

  // Data Management
  const exportAllData = () => {
    const data = {
      records: experimentRecordService.getAll(),
      notes: experimentNoteService.getAll(),
      sops: sopService.getAll(),
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `experiment_forest_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('导出成功');
  };

  const clearAllData = () => {
    localStorage.removeItem('experiment_records');
    localStorage.removeItem('experiment_notes');
    localStorage.removeItem('sops');
    toast.success('所有数据已清除');
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <div className="min-h-screen bg-earth-beige/20 text-text-main">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        <Header title="系统设置" sidebarCollapsed={sidebarCollapsed} />

        <main className="p-8 max-w-5xl mx-auto space-y-8">
          {/* Header Section */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-forest-primary/10 flex items-center justify-center text-forest-primary text-2xl shadow-sm">
              <i className="fa-solid fa-cog"></i>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-forest-primary">设置与配置</h1>
              <p className="text-text-muted">管理您的个人资料、AI 助手及数据备份</p>
            </div>
          </div>

          {/* Profile Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-forest-accent/20 overflow-hidden">
            <div className="p-6 border-b border-forest-accent/10 flex justify-between items-center bg-forest-secondary/5">
              <h2 className="text-lg font-bold text-forest-primary flex items-center gap-2">
                <i className="fa-solid fa-user-circle"></i> 个人资料
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => isEditingProfile ? saveProfile() : setIsEditingProfile(true)}
                className={isEditingProfile ? "text-forest-primary bg-forest-accent/20" : "text-text-muted"}
              >
                {isEditingProfile ? <><i className="fa-solid fa-save mr-2"></i>保存</> : <><i className="fa-solid fa-pen mr-2"></i>编辑</>}
              </Button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {['name', 'email', 'department'].map((field) => (
                <div key={field} className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    {field === 'name' ? '用户名' : field === 'email' ? '邮箱地址' : '所属部门'}
                  </label>
                  <input
                    type={field === 'email' ? 'email' : 'text'}
                    name={field}
                    value={(userProfile as any)[field]}
                    onChange={handleProfileChange}
                    disabled={!isEditingProfile}
                    className="w-full px-4 py-2 rounded-lg border border-forest-accent/30 bg-earth-beige/30 focus:bg-white focus:ring-2 focus:ring-forest-secondary/50 focus:border-forest-secondary transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* AI Settings Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-forest-accent/20 overflow-hidden">
            <div className="p-6 border-b border-forest-accent/10 bg-forest-secondary/5">
              <h2 className="text-lg font-bold text-forest-primary flex items-center gap-2">
                <i className="fa-solid fa-robot"></i> AI 助手配置
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-text-main">启用自定义 API</p>
                  <p className="text-sm text-text-muted">使用您自己的 LLM 服务提供商</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aiSettings.useCustomAPI}
                    onChange={e => setAiSettings({ ...aiSettings, useCustomAPI: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-earth-beige peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-forest-primary"></div>
                </label>
              </div>

              <AnimatePresence>
                {aiSettings.useCustomAPI && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-4 pt-4 border-t border-forest-accent/10"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-text-muted">API 端点 (Endpoint)</label>
                        <input
                          type="text"
                          value={aiSettings.apiEndpoint}
                          onChange={e => setAiSettings({ ...aiSettings, apiEndpoint: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-forest-accent/30 focus:ring-2 focus:ring-forest-secondary/50"
                          placeholder="https://api.example.com/v1/chat/completions"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-text-muted">模型名称 (Model)</label>
                        <input
                          type="text"
                          value={aiSettings.model}
                          onChange={e => setAiSettings({ ...aiSettings, model: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-forest-accent/30 focus:ring-2 focus:ring-forest-secondary/50"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-bold text-text-muted">API 密钥 (Key)</label>
                        <div className="relative">
                          <input
                            type={showApiKey ? "text" : "password"}
                            value={aiSettings.apiKey}
                            onChange={e => setAiSettings({ ...aiSettings, apiKey: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border border-forest-accent/30 focus:ring-2 focus:ring-forest-secondary/50 pr-10"
                            placeholder="sk-..."
                          />
                          <button
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-2.5 text-text-muted hover:text-forest-primary"
                          >
                            <i className={`fa-solid ${showApiKey ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        onClick={testAPIConnection}
                        disabled={isTestingAPI}
                        className="border-forest-accent/30 text-forest-primary hover:bg-forest-accent/10"
                      >
                        {isTestingAPI ? <i className="fa-solid fa-circle-notch fa-spin mr-2" /> : <i className="fa-solid fa-plug mr-2" />}
                        {isTestingAPI ? "测试中..." : "测试连接"}
                      </Button>

                      {apiTestResult && (
                        <span className={`text-sm flex items-center gap-2 ${apiTestResult.success ? 'text-green-600' : 'text-red-500'}`}>
                          <i className={`fa-solid ${apiTestResult.success ? 'fa-check' : 'fa-times'}`}></i>
                          {apiTestResult.message}
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Data Management Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-forest-accent/20 overflow-hidden">
            <div className="p-6 border-b border-forest-accent/10 bg-forest-secondary/5">
              <h2 className="text-lg font-bold text-forest-primary flex items-center gap-2">
                <i className="fa-solid fa-database"></i> 数据管理
              </h2>
            </div>
            <div className="p-6 flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={exportAllData}
                  className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                >
                  <i className="fa-solid fa-file-export mr-2"></i> 导出备份
                </Button>
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('importInput')?.click()}
                  className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                >
                  <i className="fa-solid fa-file-import mr-2"></i> 导入数据
                </Button>
                <input
                  id="importInput"
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        try {
                          const data = JSON.parse(ev.target?.result as string);
                          if (data.records) localStorage.setItem('experiment_records', JSON.stringify(data.records));
                          if (data.notes) localStorage.setItem('experiment_notes', JSON.stringify(data.notes));
                          if (data.sops) localStorage.setItem('sops', JSON.stringify(data.sops));
                          toast.success('导入成功，正在刷新...');
                          setTimeout(() => window.location.reload(), 1000);
                        } catch (err) {
                          toast.error('文件格式错误');
                        }
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
              </div>

              <Button
                onClick={() => setShowConfirmDialog(true)}
                className="bg-red-50 text-red-600 hover:bg-red-100 border-none shadow-none"
              >
                <i className="fa-solid fa-trash mr-2"></i> 清除所有数据
              </Button>
            </div>
          </section>
        </main>
      </div>

      {/* Confirm Dialog */}
      <AnimatePresence>
        {showConfirmDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-500 flex items-center justify-center mx-auto mb-4 text-xl">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <h3 className="text-xl font-bold text-center text-gray-800 mb-2">确认清除数据？</h3>
              <p className="text-center text-gray-500 mb-6">
                此操作将永久删除所有本地存储的实验记录和笔记，且无法恢复。
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowConfirmDialog(false)}>取消</Button>
                <Button className="flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={clearAllData}>确认删除</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}