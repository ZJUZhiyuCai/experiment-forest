import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatSession, ChatMessage, ChatContext, ExperimentCategory, AISettings } from '../types';
import { aiChatService } from '../lib/aiChatService';
import { toast } from 'sonner';

// 将静态映射提取到组件外部,避免每次渲染时重新创建
const EXPERIMENT_TYPE_NAMES: Record<ExperimentCategory, string> = {
  // 细胞生物学实验
  'cell_culture': '细胞培养',
  'cell_viability': '细胞活力检测',
  'flow_cytometry': '流式细胞术',
  'cell_transfection': '细胞转染',
  // 分子生物学实验
  'pcr': 'PCR扩增',
  'western_blot': 'Western Blot',
  'gene_cloning': '基因克隆',
  'dna_sequencing': 'DNA测序',
  'rna_extraction': 'RNA提取',
  'protein_purification': '蛋白质纯化',
  // 动物实验
  'animal_behavior': '动物行为学',
  'animal_surgery': '动物手术',
  'animal_dosing': '动物给药',
  'tissue_sampling': '组织取样',
  // 药物研发
  'drug_screening': '药物筛选',
  'compound_synthesis': '化合物合成',
  'pharmacokinetics': '药代动力学',
  'toxicology': '毒理学研究',
  'dose_response': '剂量-反应研究',
  // 生化分析
  'elisa': 'ELISA检测',
  'chromatography': '色谱分析',
  'mass_spectrometry': '质谱分析',
  'immunohistochemistry': '免疫组化',
  // 微生物学
  'bacterial_culture': '细菌培养',
  'antimicrobial_test': '抗菌试验',
  'sterility_test': '无菌检验',
  // 其他
  'other': '通用实验'
};

// 纯函数,不需要在组件内部定义
const getExperimentTypeName = (type: ExperimentCategory): string => {
  return EXPERIMENT_TYPE_NAMES[type] || type;
};

interface AIChatComponentProps {
  projectId?: string;
  experimentType?: ExperimentCategory;
  className?: string;
  onSessionChange?: (session: ChatSession) => void;
}

export const AIChatComponent: React.FC<AIChatComponentProps> = React.memo(({
  projectId,
  experimentType,
  className = '',
  onSessionChange
}) => {
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);
  const [showAgentConfig, setShowAgentConfig] = useState(false);
  const [agentPrompt, setAgentPrompt] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // 加载Agent配置
  useEffect(() => {
    const saved = localStorage.getItem('aiSettings');
    if (saved) {
      const settings: AISettings = JSON.parse(saved);
      setAgentPrompt(settings.systemPrompt || '');
    }
  }, []);
  
  // 保存Agent配置
  const saveAgentPrompt = useCallback(() => {
    const saved = localStorage.getItem('aiSettings');
    const settings: AISettings = saved ? JSON.parse(saved) : {
      apiEndpoint: '',
      apiKey: '',
      useCustomAPI: false
    };
    
    settings.systemPrompt = agentPrompt;
    localStorage.setItem('aiSettings', JSON.stringify(settings));
    toast.success('Agent配置已保存');
    setShowAgentConfig(false);
  }, [agentPrompt]);

  // 使用useCallback优化函数引用稳定性
  const loadSessions = useCallback(() => {
    const allSessions = aiChatService.getAllSessions();
    setSessions(allSessions);
    
    // 如果没有当前会话，创建一个新的
    if (!currentSession && allSessions.length === 0) {
      createNewSession();
    } else if (!currentSession && allSessions.length > 0) {
      setCurrentSession(allSessions[0]);
      onSessionChange?.(allSessions[0]);
    }
  }, [currentSession, onSessionChange]);

  const createNewSession = useCallback(() => {
    const title = experimentType ? 
      `${getExperimentTypeName(experimentType)}咨询` : 
      `AI助手对话 - ${new Date().toLocaleDateString()}`;
    
    const newSession = aiChatService.createSession(title, projectId, experimentType);
    setCurrentSession(newSession);
    setSessions(prev => [newSession, ...prev]);
    onSessionChange?.(newSession);
    setShowSessionList(false);
  }, [experimentType, projectId, onSessionChange]);

  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || !currentSession || isLoading) return;

    const message = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    try {
      const context: ChatContext = {
        experimentType,
        projectId,
        pageContext: 'chat_interface'
      };

      await aiChatService.sendMessage(
        currentSession.id,
        message,
        context
      );

      // 更新当前会话
      const updatedSession = aiChatService.getSession(currentSession.id);
      if (updatedSession) {
        setCurrentSession(updatedSession);
        onSessionChange?.(updatedSession);
      }
    } catch (error) {
      toast.error('发送消息失败，请重试');
      console.error('发送消息失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [inputMessage, currentSession, isLoading, experimentType, projectId, onSessionChange]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const selectSession = useCallback((session: ChatSession) => {
    setCurrentSession(session);
    onSessionChange?.(session);
    setShowSessionList(false);
  }, [onSessionChange]);

  const deleteSession = useCallback((sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这个对话吗？')) {
      aiChatService.deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      if (currentSession?.id === sessionId) {
        const remainingSessions = sessions.filter(s => s.id !== sessionId);
        if (remainingSessions.length > 0) {
          setCurrentSession(remainingSessions[0]);
          onSessionChange?.(remainingSessions[0]);
        } else {
          createNewSession();
        }
      }
      toast.success('对话已删除');
    }
  }, [currentSession, sessions, onSessionChange, createNewSession]);

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // 加载会话列表
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // 自动滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages, scrollToBottom]);

  return (
    <div className={`flex flex-col h-full bg-gradient-to-b from-emerald-50/30 to-white dark:from-gray-900 dark:to-gray-800 ${className}`}>
      {/* 美化头部 - 小森博士 (指定配色方案) */}
      <div 
        className="flex items-center justify-between px-6 py-4 border-b border-white/20 backdrop-blur-sm"
        style={{ 
          background: 'linear-gradient(90deg, rgba(136, 165, 136, 0.9) 0%, rgba(166, 183, 161, 0.8) 50%, rgba(242, 237, 226, 0.85) 100%)'
        }}
      >
        <div className="flex items-center space-x-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md border border-white/30 backdrop-blur-sm"
            style={{ background: 'rgba(136, 165, 136, 0.7)' }}
          >
            <i className="fa-solid fa-seedling text-white text-lg drop-shadow-sm"></i>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white drop-shadow-sm">🌲 小森博士</h3>
            <p className="text-xs text-white/80">您的专属实验助手</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowAgentConfig(!showAgentConfig)}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200 backdrop-blur-sm"
            title="智能配置"
          >
            <i className="fa-solid fa-brain"></i>
          </button>
          <button
            onClick={createNewSession}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200 backdrop-blur-sm"
            title="新实验对话"
          >
            <i className="fa-solid fa-plus"></i>
          </button>
          <button
            onClick={() => {
              if (currentSession && currentSession.messages.length > 1) {
                if (window.confirm('确定要清除当前对话的上下文吗？')) {
                  const welcomeMessage = currentSession.messages[0];
                  currentSession.messages = [welcomeMessage];
                  currentSession.updatedAt = new Date();
                  aiChatService.updateSession(currentSession);
                  setCurrentSession({...currentSession});
                  onSessionChange?.(currentSession);
                  toast.success('对话上下文已清除');
                }
              }
            }}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200 backdrop-blur-sm"
            title="清除记忆"
            disabled={!currentSession || currentSession.messages.length <= 1}
          >
            <i className="fa-solid fa-eraser"></i>
          </button>
          <button
            onClick={() => setShowSessionList(!showSessionList)}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200 backdrop-blur-sm"
            title="实验记录"
          >
            <i className="fa-solid fa-history"></i>
          </button>
        </div>
      </div>

      {/* Agent配置面板 - 指定配色主题 */}
      <AnimatePresence>
        {showAgentConfig && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-white/20 backdrop-blur-sm"
            style={{ background: 'rgba(242, 237, 226, 0.9)' }}
          >
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md border border-white/30"
                    style={{ background: 'rgba(136, 165, 136, 0.8)' }}
                  >
                    <i className="fa-solid fa-brain text-white text-sm"></i>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-800">🧠 智能配置</h4>
                </div>
                <button
                  onClick={() => setShowAgentConfig(false)}
                  className="text-gray-600 hover:text-gray-800 p-1 rounded-lg hover:bg-white/30 transition-all"
                >
                  <i className="fa-solid fa-times"></i>
                </button>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center space-x-2">
                  <i className="fa-solid fa-seedling" style={{ color: '#88A588' }}></i>
                  <span>🌿 系统提示词</span>
                </label>
                <textarea
                  value={agentPrompt}
                  onChange={(e) => setAgentPrompt(e.target.value)}
                  className="w-full px-4 py-3 text-sm border border-white/30 rounded-xl resize-none text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 transition-all backdrop-blur-sm"
                  style={{ 
                    background: 'rgba(255, 255, 255, 0.8)'
                  }}
                  placeholder="定义AI的角色和行为，例如：你是一位专业的科研助手..."
                  rows={4}
                />
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: '🔬 科研助手', prompt: '你是一位专业的科研助手，擅长实验设计、数据分析和文献检索。请用专业、准确、友好的语言回答问题。' },
                    { name: '💻 代码助手', prompt: '你是一位经验丰富的程序员，擅长多种编程语言和技术栈。请提供清晰、可读的代码和详细的解释。' },
                    { name: '📝 学术写作', prompt: '你是一位学术写作专家，熟悉各种学术规范和写作技巧。请帮助改进论文结构、语言表达和逻辑清晰度。' }
                  ].map((template) => (
                    <button
                      key={template.name}
                      onClick={() => setAgentPrompt(template.prompt)}
                      className="text-xs px-3 py-2 border border-white/30 rounded-lg hover:bg-white/40 transition-all font-medium backdrop-blur-sm"
                      style={{ background: 'rgba(255, 255, 255, 0.6)' }}
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => setAgentPrompt('')}
                    className="text-sm px-4 py-2 text-gray-600 border border-white/30 rounded-lg hover:bg-white/30 transition-all backdrop-blur-sm"
                    style={{ background: 'rgba(255, 255, 255, 0.6)' }}
                  >
                    🗑️ 清除
                  </button>
                  <button
                    onClick={saveAgentPrompt}
                    className="text-sm px-4 py-2 text-white rounded-lg transition-all shadow-md backdrop-blur-sm"
                    style={{ background: 'rgba(136, 165, 136, 0.9)' }}
                  >
                    💾 保存
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 会话列表 - 指定配色主题 */}
      <AnimatePresence>
        {showSessionList && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-white/20 max-h-64 overflow-y-auto backdrop-blur-sm"
            style={{ background: 'rgba(166, 183, 161, 0.9)' }}
          >
            <div className="p-3">
              <div className="flex items-center space-x-2 mb-3 px-2">
                <div 
                  className="w-6 h-6 rounded-lg flex items-center justify-center shadow-sm border border-white/30"
                  style={{ background: 'rgba(136, 165, 136, 0.8)' }}
                >
                  <i className="fa-solid fa-history text-white text-xs"></i>
                </div>
                <h4 className="text-sm font-semibold text-white">🌲 实验记录</h4>
              </div>
              
              {sessions.map((session) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => selectSession(session)}
                  className={`flex items-center justify-between p-3 mb-2 rounded-xl cursor-pointer transition-all duration-200 backdrop-blur-sm border border-white/20 ${
                    currentSession?.id === session.id
                      ? 'shadow-md'
                      : 'hover:shadow-sm'
                  }`}
                  style={{
                    background: currentSession?.id === session.id
                      ? 'rgba(242, 237, 226, 0.95)'
                      : 'rgba(255, 255, 255, 0.7)'
                  }}
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm border border-white/30"
                      style={{
                        background: currentSession?.id === session.id
                          ? 'rgba(136, 165, 136, 0.9)'
                          : 'rgba(166, 183, 161, 0.7)'
                      }}
                    >
                      <i className={`fa-solid fa-comments text-xs ${
                        currentSession?.id === session.id
                          ? 'text-white'
                          : 'text-white/80'
                      }`}></i>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        currentSession?.id === session.id
                          ? 'text-gray-800'
                          : 'text-gray-700'
                      }`}>
                        {session.title}
                      </p>
                      <p className={`text-xs ${
                        currentSession?.id === session.id
                          ? 'text-gray-600'
                          : 'text-gray-500'
                      }`}>
                        🗞️ {session.messages.length} 条消息
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => deleteSession(session.id, e)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-100/50 rounded-lg transition-all backdrop-blur-sm"
                  >
                    <i className="fa-solid fa-trash text-xs"></i>
                  </button>
                </motion.div>
              ))}
              
              {sessions.length === 0 && (
                <div className="text-center py-8">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 border border-white/30"
                    style={{ background: 'rgba(166, 183, 161, 0.6)' }}
                  >
                    <i className="fa-solid fa-seedling text-white text-lg"></i>
                  </div>
                  <p className="text-sm text-white">🌱 还没有实验记录</p>
                  <p className="text-xs text-white/80">开始一段新的科研之旅吧</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {currentSession?.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start mb-4"
          >
            <div className="flex items-center space-x-3">
              {/* 小森博士头像 */}
              <motion.div 
                animate={{ rotate: [0, 3, -3, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="w-10 h-10 bg-gradient-to-br from-slate-500 via-gray-600 to-slate-700 rounded-full flex items-center justify-center shadow-md border-2 border-gray-300 dark:border-gray-600"
              >
                <i className="fa-solid fa-seedling text-gray-100 text-sm"></i>
              </motion.div>
              
              {/* 加载气泡 */}
              <div className="bg-white dark:bg-gray-700 rounded-2xl p-4 max-w-xs shadow-sm border border-gray-200 dark:border-gray-600 mr-4 relative">
                {/* 气泡尖角 */}
                <div className="absolute left-0 top-4 transform -translate-x-2">
                  <div className="w-0 h-0 border-r-8 border-r-white dark:border-r-gray-700 border-t-4 border-t-transparent border-b-4 border-b-transparent"></div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="flex space-x-1">
                    <motion.div 
                      animate={{ y: [0, -6, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: 'rgba(136, 165, 136, 0.8)' }}
                    />
                    <motion.div 
                      animate={{ y: [0, -6, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0.1 }}
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: 'rgba(166, 183, 161, 0.8)' }}
                    />
                    <motion.div 
                      animate={{ y: [0, -6, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: 'rgba(242, 237, 226, 0.8)' }}
                    />
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'rgba(136, 165, 136, 0.9)' }}>🤔 小森博士正在思考...</span>
                </div>
                
                {/* 思考提示 */}
                <div className="mt-2 text-xs" style={{ color: 'rgba(136, 165, 136, 0.7)' }}>
                  🌿 正在查阅科研资料，请稍等...
                </div>
              </div>
            </div>
          </motion.div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 应用指定配色方案的输入区域 */}
      <div 
        className="p-4 backdrop-blur-sm"
        style={{
          borderTop: '1px solid rgba(136, 165, 136, 0.3)',
          background: 'linear-gradient(90deg, rgba(242, 237, 226, 0.9) 0%, rgba(166, 183, 161, 0.8) 50%, rgba(136, 165, 136, 0.7) 100%)'
        }}
      >
        <div className="flex items-end space-x-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="🌿 输入您的问题，小森博士随时为您服务..."
              className="w-full px-4 py-3 text-sm rounded-xl resize-none text-gray-700 placeholder-gray-500 focus:outline-none focus:ring-2 transition-all duration-200 shadow-sm hover:shadow-md"
              style={{
                background: 'rgba(242, 237, 226, 0.8)',
                border: '1px solid rgba(136, 165, 136, 0.4)',
                minHeight: '44px',
                maxHeight: '120px',
                height: 'auto'
              }}
              rows={1}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
            
            {/* 输入提示 */}
            {inputMessage.length > 0 && (
              <div className="absolute bottom-2 right-12 text-xs" style={{ color: 'rgba(136, 165, 136, 0.7)' }}>
                {inputMessage.length}/1000
              </div>
            )}
          </div>
          
          {/* 发送按钮 */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="p-3 rounded-xl font-medium transition-all duration-200 shadow-lg text-white"
            style={{
              background: !inputMessage.trim() || isLoading
                ? 'rgba(136, 165, 136, 0.5)'
                : 'linear-gradient(135deg, rgba(136, 165, 136, 0.9) 0%, rgba(166, 183, 161, 0.8) 100%)',
              cursor: !inputMessage.trim() || isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? (
              <motion.i 
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="fa-solid fa-spinner text-sm"
              />
            ) : (
              <i className="fa-solid fa-paper-plane text-sm"></i>
            )}
          </motion.button>
        </div>
        
        {/* 快捷操作 */}
        <div className="flex items-center justify-between mt-3 px-1">
          <div className="flex items-center space-x-3 text-xs" style={{ color: 'rgba(136, 165, 136, 0.7)' }}>
            <span className="flex items-center space-x-1">
              <i className="fa-solid fa-keyboard" style={{ color: 'rgba(136, 165, 136, 0.8)' }}></i>
              <span>Enter 发送</span>
            </span>
            <span className="flex items-center space-x-1">
              <i className="fa-solid fa-plus" style={{ color: 'rgba(136, 165, 136, 0.8)' }}></i>
              <span>Shift+Enter 换行</span>
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-1.5 rounded-lg transition-all"
              style={{
                color: 'rgba(136, 165, 136, 0.7)',
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(166, 183, 161, 0.3)';
                e.currentTarget.style.color = 'rgba(136, 165, 136, 0.9)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'rgba(136, 165, 136, 0.7)';
              }}
              title="清空输入"
              onClick={() => setInputMessage('')}
            >
              <i className="fa-solid fa-eraser text-xs"></i>
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-1.5 rounded-lg transition-all"
              style={{
                color: 'rgba(136, 165, 136, 0.7)',
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(166, 183, 161, 0.3)';
                e.currentTarget.style.color = 'rgba(136, 165, 136, 0.9)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'rgba(136, 165, 136, 0.7)';
              }}
              title="文件上传"
              onClick={() => {}}
            >
              <i className="fa-solid fa-paperclip text-xs"></i>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
});

// 指定配色主题消息气泡组件
const MessageBubble: React.FC<{ message: ChatMessage }> = React.memo(({ message }) => {
  const isUser = message.role === 'user';
  const isError = !!message.error;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* 消息气泡 */}
        <div
          className={`relative rounded-2xl px-4 py-3 shadow-sm backdrop-blur-sm border border-white/20 ml-4 mr-4`}
          style={{
            background: isUser
              ? 'linear-gradient(135deg, rgba(136, 165, 136, 0.9) 0%, rgba(166, 183, 161, 0.8) 100%)'
              : isError
              ? 'linear-gradient(135deg, rgba(255, 182, 193, 0.9) 0%, rgba(255, 160, 122, 0.8) 100%)'
              : 'linear-gradient(135deg, rgba(242, 237, 226, 0.95) 0%, rgba(255, 255, 255, 0.9) 100%)',
            color: isUser ? 'white' : isError ? '#8B0000' : '#4A5568'
          }}
        >
          {/* 气泡尖角 */}
          {isUser ? (
            <div className="absolute right-0 top-4 transform translate-x-2">
              <div className="w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent" style={{ borderLeftWidth: '8px', borderLeftColor: '#88A588' }}></div>
            </div>
          ) : (
            <div className="absolute left-0 top-4 transform -translate-x-2">
              <div className="w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent" style={{ borderRightWidth: '8px', borderRightColor: isError ? '#FFB6C1' : '#F2EDE2' }}></div>
            </div>
          )}
          
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
          
          {/* 建议回复 */}
          {message.suggestions && message.suggestions.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs opacity-75 font-medium">🌿 推荐回复：</p>
              {message.suggestions.map((suggestion, index) => (
                <motion.button
                  key={index}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="block w-full text-left text-xs py-2 px-3 rounded-lg transition-all border border-white/30 backdrop-blur-sm"
                  style={{ background: 'rgba(255, 255, 255, 0.4)' }}
                  onClick={() => {
                    // 可以实现点击建议自动填入输入框的功能
                  }}
                >
                  ✨ {suggestion}
                </motion.button>
              ))}
            </div>
          )}
        </div>
        
        {/* 时间戳 */}
        <p className={`text-xs mt-2 px-1 flex items-center space-x-1 ${
          isUser
            ? 'text-gray-600 justify-end'
            : 'text-gray-500 justify-start'
        }`}>
          <i className="fa-solid fa-clock text-xs"></i>
          <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </p>
      </div>
      
      {/* 美化头像 */}
      <div className={`${isUser ? 'order-1 mr-3' : 'order-2 ml-3'} flex-shrink-0`}>
        {isUser ? (
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="w-10 h-10 rounded-full flex items-center justify-center shadow-md border-2 border-white/50 backdrop-blur-sm"
            style={{ background: 'linear-gradient(135deg, rgba(136, 165, 136, 0.9) 0%, rgba(166, 183, 161, 0.8) 100%)' }}
          >
            <i className="fa-solid fa-user text-white text-sm"></i>
          </motion.div>
        ) : (
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="w-10 h-10 rounded-full flex items-center justify-center shadow-md border-2 border-white/50 backdrop-blur-sm"
            style={{ background: 'linear-gradient(135deg, rgba(166, 183, 161, 0.9) 0%, rgba(242, 237, 226, 0.8) 100%)' }}
          >
            <i className="fa-solid fa-seedling text-white text-sm drop-shadow-sm"></i>
          </motion.div>
        )}
        
        {/* 状态指示器 */}
        <div 
          className="w-3 h-3 rounded-full mt-1 mx-auto animate-pulse"
          style={{
            backgroundColor: isUser
              ? '#A6B7A1'
              : isError
              ? '#FF6B6B'
              : '#88A588'
          }}
        ></div>
      </div>
    </motion.div>
  );
});

// 添加显示名称用于调试
AIChatComponent.displayName = 'AIChatComponent';
MessageBubble.displayName = 'MessageBubble';