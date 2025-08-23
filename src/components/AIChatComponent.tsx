import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatSession, ChatMessage, ChatContext, ExperimentCategory } from '@/types';
import { aiChatService } from '@/lib/aiChatService';
import { toast } from 'sonner';

interface AIChatComponentProps {
  projectId?: string;
  experimentType?: ExperimentCategory;
  className?: string;
  onSessionChange?: (session: ChatSession) => void;
}

export const AIChatComponent: React.FC<AIChatComponentProps> = ({
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 加载会话列表
  useEffect(() => {
    loadSessions();
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages]);

  const loadSessions = () => {
    const allSessions = aiChatService.getAllSessions();
    setSessions(allSessions);
    
    // 如果没有当前会话，创建一个新的
    if (!currentSession && allSessions.length === 0) {
      createNewSession();
    } else if (!currentSession && allSessions.length > 0) {
      setCurrentSession(allSessions[0]);
      onSessionChange?.(allSessions[0]);
    }
  };

  const createNewSession = () => {
    const title = experimentType ? 
      `${getExperimentTypeName(experimentType)}咨询` : 
      `AI助手对话 - ${new Date().toLocaleDateString()}`;
    
    const newSession = aiChatService.createSession(title, projectId, experimentType);
    setCurrentSession(newSession);
    setSessions(prev => [newSession, ...prev]);
    onSessionChange?.(newSession);
    setShowSessionList(false);
  };

  const sendMessage = async () => {
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

      const aiMessage = await aiChatService.sendMessage(
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
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getExperimentTypeName = (type: ExperimentCategory): string => {
    const names = {
      'cell_culture': '细胞培养',
      'pcr': 'PCR扩增',
      'western_blot': 'Western Blot',
      'elisa': 'ELISA检测',
      'animal_dosing': '动物给药',
      'other': '通用实验'
    };
    return names[type] || type;
  };

  const selectSession = (session: ChatSession) => {
    setCurrentSession(session);
    onSessionChange?.(session);
    setShowSessionList(false);
  };

  const deleteSession = (sessionId: string, e: React.MouseEvent) => {
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
  };

  return (
    <div className={`flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-green-600 rounded-full flex items-center justify-center">
            <i className="fa-solid fa-robot text-white text-sm"></i>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              {currentSession?.title || 'AI助手'}
            </h3>
            {experimentType && (
              <p className="text-sm text-gray-500">
                {getExperimentTypeName(experimentType)}专业助手
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={createNewSession}
            className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
            title="新建对话"
          >
            <i className="fa-solid fa-plus"></i>
          </button>
          <button
            onClick={() => setShowSessionList(!showSessionList)}
            className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
            title="对话列表"
          >
            <i className="fa-solid fa-list"></i>
          </button>
        </div>
      </div>

      {/* 会话列表 */}
      <AnimatePresence>
        {showSessionList && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-gray-200 max-h-48 overflow-y-auto"
          >
            <div className="p-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => selectSession(session)}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                    currentSession?.id === session.id
                      ? 'bg-emerald-50 border border-emerald-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {session.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {session.messages.length} 条消息 • {new Date(session.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => deleteSession(session.id, e)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <i className="fa-solid fa-trash text-xs"></i>
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {currentSession?.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3 max-w-xs">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm text-gray-500">AI正在思考...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入您的问题..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              rows={1}
              style={{
                minHeight: '44px',
                maxHeight: '120px',
                height: 'auto'
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="px-4 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-md hover:shadow-lg"
          >
            <i className="fa-solid fa-paper-plane"></i>
          </button>
        </div>
        
        <p className="text-xs text-gray-400 mt-2 text-center">
          按 Enter 发送消息，Shift + Enter 换行
        </p>
      </div>
    </div>
  );
};

// 消息气泡组件
const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';
  const isError = !!message.error;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[70%] ${isUser ? 'order-2' : 'order-1'}`}>
        <div
          className={`rounded-lg p-3 ${
            isUser
              ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white'
              : isError
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          
          {/* 建议回复 */}
          {message.suggestions && message.suggestions.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs opacity-75">建议:</p>
              {message.suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  className="block w-full text-left text-xs py-1 px-2 bg-white bg-opacity-20 rounded hover:bg-opacity-30 transition-colors"
                  onClick={() => {
                    // 可以实现点击建议自动填入输入框的功能
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <p className="text-xs text-gray-400 mt-1 px-1">
          {new Date(message.timestamp).toLocaleTimeString()}
        </p>
      </div>
      
      {/* 头像 */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'order-1 mr-3' : 'order-2 ml-3'}`}>
        {isUser ? (
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
            <i className="fa-solid fa-user text-white text-xs"></i>
          </div>
        ) : (
          <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-green-600 rounded-full flex items-center justify-center">
            <i className="fa-solid fa-robot text-white text-xs"></i>
          </div>
        )}
      </div>
    </motion.div>
  );
};