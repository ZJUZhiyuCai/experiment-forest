import { useParams, Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { topicService } from '@/lib/cachedStorage';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/Button';
import { toast } from 'sonner';
import { chatWithAI } from '@/lib/mockAI';

// 消息类型定义
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function TopicAI() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { id } = useParams<{ id: string }>();
  const [topic, setTopic] = useState(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 加载课题信息和历史聊天记录
  useEffect(() => {
    if (id) {
      const foundTopic = topicService.getById(id);
      setTopic(foundTopic);
      
      // 加载保存的聊天记录
      const savedChat = localStorage.getItem(`topic_${id}_chat`);
      if (savedChat) {
        try {
          const parsedChat = JSON.parse(savedChat);
          setMessages(parsedChat);
        } catch (error) {
          console.error('解析聊天记录失败:', error);
          toast.error('加载聊天记录失败');
        }
      }
      
      // 检查AI API配置状态
      const aiSettings = JSON.parse(localStorage.getItem('aiSettings') || '{"useCustomAPI": false}');
      if (!aiSettings.useCustomAPI || !aiSettings.apiEndpoint || !aiSettings.apiKey || !aiSettings.model) {
        toast.warning('AI API配置不完整，当前使用模拟数据。请在设置中配置API以获取真实AI响应。');
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
      localStorage.setItem(`topic_${id}_chat`, JSON.stringify(messages));
    }
  }, [messages, id]);
  
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    
    // 添加用户消息
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    
    try {
      // 获取AI响应
      const aiResponse = await chatWithAI(inputMessage, topic?.title || '实验课题');
      
      // 添加AI回复
      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI聊天失败:', error);
      
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
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClearChat = () => {
    if (window.confirm('确定要清除所有聊天记录吗？')) {
      setMessages([]);
      if (id) {
        localStorage.removeItem(`topic_${id}_chat`);
      }
      toast.success('聊天记录已清除');
    }
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
          title={`${topic?.title || '课题'} - AI对话`} 
          sidebarCollapsed={sidebarCollapsed}
          actions={
            <div className="flex space-x-2">
              <Button 
                variant="outline"
                size="sm"
                onClick={handleClearChat}
              >
                <i className="fa-solid fa-trash mr-1"></i>清除记录
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
            {/* 聊天头部 */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">课题AI对话</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {topic ? `与AI讨论课题: ${topic.title}` : '请选择一个课题开始对话'}
              </p>
            </div>
            
            {/* 聊天消息区域 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                    <i className="fa-solid fa-comments text-2xl"></i>
                  </div>
                  <h3 className="text-lg font-medium mb-2">开始与AI对话</h3>
                  <p className="max-w-md">向AI提问关于课题的问题，获取实验设计、数据分析和文献建议</p>
                </div>
              ) : (
                messages.map(message => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.role === 'user' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white'
                      }`}>
                        {message.role === 'user' ? (
                          <i className="fa-solid fa-user"></i>
                        ) : (
                          <i className="fa-solid fa-robot"></i>
                        )}
                      </div>
                      <div className={`ml-2 mr-2`}>
                        <div className={`px-4 py-2 rounded-lg ${
                          message.role === 'user' 
                            ? 'bg-blue-500 text-white rounded-br-none' 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'
                        }`}>
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        </div>
                        <div className={`text-xs text-gray-500 dark:text-gray-400 mt-1 ${
                          message.role === 'user' ? 'text-right' : ''
                        }`}>
                          {formatTime(new Date(message.timestamp))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* 输入区域 */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex space-x-2">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="输入您的问题... (Shift+Enter换行)"
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[80px]"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  className="whitespace-nowrap"
                >
                  {isLoading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin mr-2"></i>发送中...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane mr-2"></i>发送
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}