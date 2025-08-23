import React, { useState } from 'react';
import { ChatSession, ExperimentCategory } from '@/types';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { AIChatComponent } from '@/components/AIChatComponent';

export default function AIChat() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [selectedExperimentType, setSelectedExperimentType] = useState<ExperimentCategory | undefined>();

  const experimentTypes = [
    { value: 'cell_culture', label: '细胞培养', icon: 'fa-microscope' },
    { value: 'pcr', label: 'PCR扩增', icon: 'fa-dna' },
    { value: 'western_blot', label: 'Western Blot', icon: 'fa-vial' },
    { value: 'elisa', label: 'ELISA检测', icon: 'fa-flask' },
    { value: 'animal_dosing', label: '动物给药', icon: 'fa-pills' },
    { value: 'flow_cytometry', label: '流式细胞术', icon: 'fa-chart-line' },
    { value: 'gene_cloning', label: '基因克隆', icon: 'fa-clone' },
    { value: 'other', label: '其他实验', icon: 'fa-beaker' }
  ];

  const handleSessionChange = (session: ChatSession) => {
    setCurrentSession(session);
  };

  const handleExperimentTypeChange = (type: ExperimentCategory | undefined) => {
    setSelectedExperimentType(type);
    // 实验类型改变时，可以创建新的专业会话
  };

  return (
    <div className="min-h-screen bg-[#F9F6F2] text-[#555555]">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header 
          title="AI智能助手" 
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <div className="flex items-center space-x-4">
              {/* 实验类型选择器 */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">专业领域:</label>
                <select
                  value={selectedExperimentType || ''}
                  onChange={(e) => handleExperimentTypeChange(e.target.value as ExperimentCategory || undefined)}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="">通用助手</option>
                  {experimentTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* 当前会话信息 */}
              {currentSession && (
                <div className="text-sm text-gray-600">
                  <i className="fa-solid fa-comments mr-1"></i>
                  {currentSession.messages.length} 条消息
                </div>
              )}
            </div>
          }
        />
        
        <main className="container mx-auto px-4 py-6">
          {/* 顶部说明卡片 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-green-600 rounded-full flex items-center justify-center">
                <i className="fa-solid fa-robot text-white text-xl"></i>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-800 mb-2">
                  AI实验助手
                  {selectedExperimentType && (
                    <span className="ml-2 text-emerald-600">
                      • {experimentTypes.find(t => t.value === selectedExperimentType)?.label}专业版
                    </span>
                  )}
                </h2>
                <p className="text-gray-600 mb-4">
                  专业的生命医药领域AI助手，为您提供实验设计、数据分析、文献检索等全方位支持。
                  {selectedExperimentType ? '当前已切换到专业模式，将提供更精准的领域建议。' : ''}
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex items-center space-x-2 text-sm text-gray-700">
                    <i className="fa-solid fa-lightbulb text-emerald-500"></i>
                    <span>实验设计建议</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-700">
                    <i className="fa-solid fa-chart-bar text-emerald-500"></i>
                    <span>数据分析指导</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-700">
                    <i className="fa-solid fa-book text-emerald-500"></i>
                    <span>文献资源推荐</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-700">
                    <i className="fa-solid fa-shield-alt text-emerald-500"></i>
                    <span>安全操作指导</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 实验类型快捷选择 */}
          {!selectedExperimentType && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                <i className="fa-solid fa-flask text-emerald-500 mr-2"></i>
                选择专业领域
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {experimentTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => handleExperimentTypeChange(type.value as ExperimentCategory)}
                    className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-emerald-300 hover:bg-emerald-50 transition-all duration-200 group"
                  >
                    <i className={`fa-solid ${type.icon} text-2xl text-gray-400 group-hover:text-emerald-500 transition-colors mb-2`}></i>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-emerald-600 text-center">
                      {type.label}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-4 text-center">
                选择您的专业领域，AI助手将提供更精准的专业建议
              </p>
            </div>
          )}

          {/* AI聊天组件 */}
          <div className="h-[600px]">
            <AIChatComponent
              experimentType={selectedExperimentType}
              onSessionChange={handleSessionChange}
              className="h-full"
            />
          </div>

          {/* 底部提示 */}
          <div className="mt-6 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <i className="fa-solid fa-info-circle text-emerald-500 mt-1"></i>
              <div className="flex-1">
                <h4 className="font-medium text-emerald-800 mb-1">使用提示</h4>
                <ul className="text-sm text-emerald-700 space-y-1">
                  <li>• 详细描述您的实验背景和具体问题，AI将提供更精准的建议</li>
                  <li>• 可以上传实验数据、协议文件等资料以获得针对性指导</li>
                  <li>• 支持多轮对话，AI会记住上下文信息</li>
                  <li>• 所有对话历史都会自动保存，方便随时查阅</li>
                </ul>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}