import { useParams, Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { projectService, experimentRecordService, experimentNoteService, sopService } from '@/lib/cachedStorage';
import { Project } from '@/types';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/Button';
import { toast } from 'sonner';
import { topicAgentService, TopicAgentContext, AgentResponse, ActionItem } from '@/lib/topicAgentService';

// 增强的消息类型定义
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  actionItems?: ActionItem[];
  isLoading?: boolean;
}

export default function TopicAI() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentInitialized, setAgentInitialized] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [contextStats, setContextStats] = useState({ records: 0, notes: 0, sops: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 加载课题信息和初始化Agent
  useEffect(() => {
    if (id) {
      const foundProject = projectService.getById(id);
      if (!foundProject) {
        toast.error('未找到该课题');
        return;
      }
      
      setProject(foundProject);
      
      // 获取课题相关数据
      const records = experimentRecordService.getAll().filter(r => r.projectId === id);
      const notes = experimentNoteService.getAll().filter(n => n.projectId === id);
      const sops = sopService.getAll().filter(s => s.projectId === id);
      
      setContextStats({ records: records.length, notes: notes.length, sops: sops.length });
      
      // 初始化Agent上下文
      const context: TopicAgentContext = {
        project: foundProject,
        records,
        notes,
        sops
      };
      
      topicAgentService.initializeContext(context);
      setAgentInitialized(true);
      
      // 加载保存的聊天记录
      const savedChat = localStorage.getItem(`topic_${id}_agent_chat`);
      if (savedChat) {
        try {
          const parsedChat = JSON.parse(savedChat);
          setMessages(parsedChat);
        } catch (error) {
          console.error('解析聊天记录失败:', error);
          toast.error('加载聊天记录失败');
        }
      } else {
        // 添加欢迎消息
        const welcomeMessage: ChatMessage = {
          id: `welcome_${Date.now()}`,
          role: 'assistant',
          content: `🤖 您好！我是小森博士，您的专属AI课题助手！\n\n我专门为课题"${foundProject.title}"提供智能支持。\n\n📊 **课题数据概览**\n• 实验记录: ${records.length} 个\n• 实验笔记: ${notes.length} 个\n• SOP文档: ${sops.length} 个\n• 当前进度: ${foundProject.progress}%\n\n🧬 **我的专业能力**\n• 实验设计优化和技术问题解答\n• 数据分析指导和结果解释\n• SOP制定和流程优化\n• 课题进展评估和规划建议\n\n作为生命医药领域的专业AI助手，我会基于您的课题背景提供精准的科研指导。请告诉我您需要什么帮助！`,
          timestamp: new Date(),
          suggestions: [
            '当前实验进展如何？有什么问题需要解决？',
            '帮我分析一下最新的实验数据',
            '制定下阶段的实验计划',
            '如何优化实验方案提高效率？'
          ]
        };
        setMessages([welcomeMessage]);
      }
      
      // 检查AI API配置状态
      const aiSettings = JSON.parse(localStorage.getItem('aiSettings') || '{"useCustomAPI": false}');
      if (!aiSettings.useCustomAPI || !aiSettings.apiEndpoint || !aiSettings.apiKey) {
        toast.info('💡 提示：您可以在设置中配置自定义AI API以获得更专业的响应', {
          duration: 5000,
          action: {
            label: '前往设置',
            onClick: () => window.open('/settings#ai-api-settings', '_blank')
          }
        });
      }
    }
  }, [id]);
  
  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // 保存聊天记录到本地存储
  useEffect(() => {
    if (id && messages.length > 0) {
      localStorage.setItem(`topic_${id}_agent_chat`, JSON.stringify(messages));
    }
  }, [messages, id]);
  
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !agentInitialized) return;
    
    const message = inputMessage.trim();
    setInputMessage('');
    
    // 添加用户消息
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    try {
      // 获取Agent响应
      const agentResponse: AgentResponse = await topicAgentService.chat(message);
      
      // 添加AI回复
      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: agentResponse.content,
        timestamp: new Date(),
        suggestions: agentResponse.suggestions,
        actionItems: agentResponse.actionItems
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error('Agent聊天失败:', error);
      
      // 添加错误消息
      const errorMessage: ChatMessage = {
        id: `msg_${Date.now() + 2}`,
        role: 'assistant',
        content: error instanceof Error 
          ? `抱歉，无法获取AI响应: ${error.message}` 
          : '抱歉，AI服务暂时不可用，请稍后再试',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
      toast.error('获取AI响应失败');
      
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClearChat = () => {
    if (window.confirm('确定要清除所有聊天记录吗？')) {
      setMessages([]);
      topicAgentService.clearHistory();
      if (id) {
        localStorage.removeItem(`topic_${id}_agent_chat`);
      }
      toast.success('聊天记录已清除');
    }
  };
  
  // 处理建议问题点击
  const handleSuggestionClick = (suggestion: string) => {
    setInputMessage(suggestion);
    // 自动发送消息
    setTimeout(() => {
      handleSendMessage();
    }, 100);
  };
  
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  return (
    <div className="min-h-screen bg-[#F9F6F2] text-[#555555]">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={sidebarCollapsed ? 'ml-16' : 'ml-64'}>
        <Header 
          title={`${project?.title || '课题'} - 小森博士`} 
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <div className="flex space-x-2">
              <Button 
                variant="outline"
                size="sm"
                onClick={handleClearChat}
                disabled={messages.length === 0}
              >
                <i className="fa-solid fa-trash mr-1"></i>清除记录
              </Button>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setShowSuggestions(!showSuggestions)}
              >
                <i className={`fa-solid ${showSuggestions ? 'fa-eye-slash' : 'fa-eye'} mr-1`}></i>
                {showSuggestions ? '隐藏建议' : '显示建议'}
              </Button>
              <Button asChild>
                <Link to={`/topics/${id}`}>
                  <i className="fa-solid fa-arrow-left mr-2"></i>
                  <span>返回课题</span>
                </Link>
              </Button>
            </div>
          }
        />
        
        <main className="container mx-auto px-4 py-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col h-[calc(100vh-180px)] transition-all duration-300 hover:shadow-md">
            {/* Agent状态栏 */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-gray-700 dark:to-gray-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${agentInitialized ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                      🤖 小森博士 - AI课题助手
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {project ? `专业服务于: ${project.title}` : '正在初始化...'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-300">
                  <div className="flex items-center">
                    <i className="fa-solid fa-flask mr-1 text-emerald-500"></i>
                    <span>{contextStats.records}个实验</span>
                  </div>
                  <div className="flex items-center">
                    <i className="fa-solid fa-sticky-note mr-1 text-amber-500"></i>
                    <span>{contextStats.notes}个笔记</span>
                  </div>
                  <div className="flex items-center">
                    <i className="fa-solid fa-file-lines mr-1 text-blue-500"></i>
                    <span>{contextStats.sops}个SOP</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 聊天消息区域 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
                  <div className="w-20 h-20 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full flex items-center justify-center mb-4 animate-pulse">
                    <i className="fa-solid fa-robot text-3xl text-white"></i>
                  </div>
                  <h3 className="text-lg font-medium mb-2">{agentInitialized ? '开始与AI代理对话' : '正在初始化Agent...'}</h3>
                  <p className="max-w-md">{agentInitialized ? '向AI代理提问关于课题的问题，获取专业的实验指导和建议' : '请稍候，正在为您准备专业的课题AI助手'}</p>
                </div>
              ) : (
                messages.map(message => (
                  <motion.div 
                    key={message.id} 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      {/* 头像 */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${message.role === 'user' ? 'ml-3' : 'mr-3'} ${
                        message.role === 'user' 
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white' 
                          : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white'
                      }`}>
                        {message.role === 'user' ? (
                          <i className="fa-solid fa-user"></i>
                        ) : (
                          <i className="fa-solid fa-robot"></i>
                        )}
                      </div>
                      
                      {/* 消息内容 */}
                      <div className="flex-1">
                        <div className={`px-4 py-3 rounded-2xl shadow-sm ${message.role === 'user' 
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-br-md' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-md'
                        }`}>
                          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        </div>
                        
                        {/* 时间戳 */}
                        <div className={`text-xs text-gray-500 dark:text-gray-400 mt-2 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                          {formatTime(new Date(message.timestamp))}
                        </div>
                        
                        {/* 建议问题 */}
                        {message.suggestions && message.suggestions.length > 0 && showSuggestions && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-3 space-y-2"
                          >
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">💡 相关问题建议：</p>
                            {message.suggestions.map((suggestion, index) => (
                              <button
                                key={index}
                                onClick={() => handleSuggestionClick(suggestion)}
                                className="block w-full text-left text-sm py-2 px-3 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg hover:bg-emerald-50 dark:hover:bg-gray-500 hover:border-emerald-300 dark:hover:border-emerald-500 transition-all duration-200 text-gray-700 dark:text-gray-200"
                              >
                                <i className="fa-solid fa-lightbulb mr-2 text-emerald-500"></i>
                                {suggestion}
                              </button>
                            ))}
                          </motion.div>
                        )}
                        
                        {/* 操作建议 */}
                        {message.actionItems && message.actionItems.length > 0 && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-3 space-y-2"
                          >
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">⚙️ 建议操作：</p>
                            {message.actionItems.map((action, index) => (
                              <div
                                key={index}
                                className={`text-sm py-2 px-3 border-l-4 rounded-r-lg ${
                                  action.priority === 'high' ? 'border-red-400 bg-red-50 dark:bg-red-900/20' :
                                  action.priority === 'medium' ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20' :
                                  'border-green-400 bg-green-50 dark:bg-green-900/20'
                                }`}
                              >
                                <div className="font-medium text-gray-800 dark:text-gray-200">
                                  <i className={`mr-2 ${
                                    action.type === 'experiment' ? 'fa-solid fa-flask text-emerald-500' :
                                    action.type === 'analysis' ? 'fa-solid fa-chart-line text-blue-500' :
                                    action.type === 'literature' ? 'fa-solid fa-book text-purple-500' :
                                    action.type === 'sop' ? 'fa-solid fa-file-lines text-orange-500' :
                                    'fa-solid fa-sticky-note text-yellow-500'
                                  }`}></i>
                                  {action.title}
                                </div>
                                <p className="text-gray-600 dark:text-gray-300 text-xs mt-1">{action.description}</p>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
              
              {/* 加载指示器 */}
              {isLoading && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-green-600 rounded-full flex items-center justify-center">
                      <i className="fa-solid fa-robot text-white"></i>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-2xl rounded-bl-md">
                      <div className="flex items-center space-x-2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-300">AI代理正在思考...</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
            
            {/* 输入区域 */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50">
              {/* 快捷操作按钮 */}
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  onClick={() => handleSuggestionClick('当前实验进展如何？有什么问题需要解决？')}
                  className="px-3 py-1 text-xs bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-800 dark:hover:bg-emerald-700 text-emerald-700 dark:text-emerald-200 rounded-full transition-colors"
                  disabled={isLoading}
                >
                  📈 进展查询
                </button>
                <button
                  onClick={() => handleSuggestionClick('帮我分析一下最新的实验数据')}
                  className="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 dark:bg-blue-800 dark:hover:bg-blue-700 text-blue-700 dark:text-blue-200 rounded-full transition-colors"
                  disabled={isLoading}
                >
                  📊 数据分析
                </button>
                <button
                  onClick={() => handleSuggestionClick('推荐一些相关的研究文献')}
                  className="px-3 py-1 text-xs bg-purple-100 hover:bg-purple-200 dark:bg-purple-800 dark:hover:bg-purple-700 text-purple-700 dark:text-purple-200 rounded-full transition-colors"
                  disabled={isLoading}
                >
                  📚 文献推荐
                </button>
                <button
                  onClick={() => handleSuggestionClick('制定下阶段的实验计划')}
                  className="px-3 py-1 text-xs bg-orange-100 hover:bg-orange-200 dark:bg-orange-800 dark:hover:bg-orange-700 text-orange-700 dark:text-orange-200 rounded-full transition-colors"
                  disabled={isLoading}
                >
                  📝 计划制定
                </button>
              </div>
              
              {/* 输入框和发送按钮 */}
              <div className="flex space-x-3">
                <div className="flex-1 relative">
                  <textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={agentInitialized ? "请输入您的问题，我会基于课题上下文给出专业建议..." : "正在初始化AI代理..."}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500 resize-none min-h-[60px] max-h-[120px] transition-all duration-200 shadow-sm"
                    disabled={!agentInitialized || isLoading}
                  />
                  {inputMessage && (
                    <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                      ⌘ + Enter 发送
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col space-y-2">
                  <Button 
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isLoading || !agentInitialized}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 disabled:transform-none"
                    size="sm"
                  >
                    {isLoading ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                        思考中
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-paper-plane mr-2"></i>
                        发送
                      </>
                    )}
                  </Button>
                  
                  {/* 额外操作按钮 */}
                  <Button 
                    onClick={() => {
                      if (project) {
                        topicAgentService.generateTopicSummary()
                          .then(summary => {
                            const summaryMessage: ChatMessage = {
                              id: `summary_${Date.now()}`,
                              role: 'assistant',
                              content: `📊 **课题总结报告**\n\n${summary}`,
                              timestamp: new Date()
                            };
                            setMessages(prev => [...prev, summaryMessage]);
                          })
                          .catch(error => {
                            toast.error('生成课题总结失败');
                          });
                      }
                    }}
                    variant="outline"
                    size="sm"
                    disabled={!agentInitialized || isLoading}
                    className="text-xs px-3 py-2 border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-600 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                  >
                    <i className="fa-solid fa-chart-pie mr-1"></i>
                    生成总结
                  </Button>
                </div>
              </div>
              
              {/* 提示信息 */}
              <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center space-x-4">
                  <span>📝 Shift + Enter 换行</span>
                  <span>✨ Enter 发送消息</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${
                    agentInitialized ? 'bg-green-400' : 'bg-yellow-400'
                  } animate-pulse`}></div>
                  <span>{agentInitialized ? 'AI代理已就绪' : '初始化中'}</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}