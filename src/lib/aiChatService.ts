import { 
  ChatSession, 
  ChatMessage, 
  ChatContext, 
  ChatAttachment, 
  AIAssistantConfig, 
  ExperimentCategory,
  AISettings 
} from '@/types';

// AI聊天服务类
export class AIChatService {
  private sessions: Map<string, ChatSession> = new Map();
  private config: AIAssistantConfig;

  constructor() {
    this.config = this.getDefaultConfig();
    this.loadSessions();
  }

  // 获取默认AI配置
  private getDefaultConfig(): AIAssistantConfig {
    return {
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1500,
      systemPrompt: `你是一位乐于助人的AI助手。请提供有用、准确的信息和建议。`,
      experimentPrompts: {},
      features: {
        experimentAdvice: true,
        literatureSearch: true,
        dataAnalysis: true,
        sopGeneration: true,
        protocolOptimization: true
      }
    };
  }

  // 从localStorage加载会话数据
  private loadSessions(): void {
    try {
      const saved = localStorage.getItem('aiChatSessions');
      if (saved) {
        const sessionsData = JSON.parse(saved);
        Object.entries(sessionsData).forEach(([id, session]) => {
          this.sessions.set(id, session as ChatSession);
        });
      }
    } catch (error) {
      console.error('加载AI聊天会话失败:', error);
    }
  }

  // 保存会话数据到localStorage
  private saveSessions(): void {
    try {
      const sessionsObj = Object.fromEntries(this.sessions);
      localStorage.setItem('aiChatSessions', JSON.stringify(sessionsObj));
    } catch (error) {
      console.error('保存AI聊天会话失败:', error);
    }
  }

  // 获取AI设置
  private getAISettings(): AISettings {
    const saved = localStorage.getItem('aiSettings');
    return saved ? JSON.parse(saved) : {
      apiEndpoint: '',
      apiKey: '',
      useCustomAPI: false,
      model: 'gpt-3.5-turbo'
    };
  }

  // 创建新的聊天会话
  createSession(title: string, projectId?: string, experimentType?: ExperimentCategory): ChatSession {
    const session: ChatSession = {
      id: this.generateId(),
      title,
      description: '',
      messages: [],
      projectId,
      experimentType,
      tags: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 添加欢迎消息
    const welcomeMessage = this.createWelcomeMessage(experimentType);
    session.messages.push(welcomeMessage);
    session.lastMessageAt = welcomeMessage.timestamp;

    this.sessions.set(session.id, session);
    this.saveSessions();
    return session;
  }

  // 创建欢迎消息
  private createWelcomeMessage(experimentType?: ExperimentCategory): ChatMessage {
    const welcomeText = "您好！我是您的AI助手，很高兴为您服务。\n\n请告诉我您需要什么帮助！";

    return {
      id: this.generateId(),
      role: 'assistant',
      content: welcomeText,
      timestamp: new Date(),
      context: { experimentType }
    };
  }

  // 发送消息并获取AI回复
  async sendMessage(
    sessionId: string, 
    content: string, 
    context?: ChatContext,
    attachments?: ChatAttachment[]
  ): Promise<ChatMessage> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }

    // 创建用户消息
    const userMessage: ChatMessage = {
      id: this.generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
      context,
      attachments
    };

    // 添加用户消息到会话
    session.messages.push(userMessage);
    session.lastMessageAt = userMessage.timestamp;
    session.updatedAt = new Date();

    try {
      // 获取AI回复
      const aiResponse = await this.getAIResponse(session, content, context, attachments);
      
      // 创建AI回复消息
      const aiMessage: ChatMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: aiResponse.content,
        timestamp: new Date(),
        context,
        suggestions: aiResponse.suggestions
      };

      // 添加AI消息到会话
      session.messages.push(aiMessage);
      session.lastMessageAt = aiMessage.timestamp;
      session.updatedAt = new Date();

      // 保存会话
      this.saveSessions();

      return aiMessage;
    } catch (error) {
      // 创建错误消息
      const errorMessage: ChatMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: '抱歉，我遇到了一些问题，无法处理您的请求。请稍后再试。',
        timestamp: new Date(),
        context,
        error: error instanceof Error ? error.message : String(error)
      };

      session.messages.push(errorMessage);
      this.saveSessions();

      return errorMessage;
    }
  }

  // 获取AI回复
  private async getAIResponse(
    session: ChatSession, 
    userMessage: string, 
    context?: ChatContext,
    attachments?: ChatAttachment[]
  ): Promise<{ content: string; suggestions?: string[] }> {
    const settings = this.getAISettings();

    // 如果启用了API且配置完整，使用真实API
    if (settings.useCustomAPI && settings.apiEndpoint && settings.apiKey && settings.model) {
      try {
        return await this.callAIAPI(userMessage, settings);
      } catch (error) {
        console.warn('API调用失败，使用模拟数据:', error);
        return this.generateMockResponse(userMessage, context);
      }
    } else {
      // 使用模拟数据
      return this.generateMockResponse(userMessage, context);
    }
  }

  // 调用AI API（简化版）
  private async callAIAPI(userMessage: string, settings: AISettings): Promise<{ content: string; suggestions?: string[] }> {
    // 获取系统提示词
    const systemPrompt = settings.systemPrompt && settings.systemPrompt.trim() 
      ? settings.systemPrompt.trim() 
      : '你是一个乐于助人的AI助手。请提供有用、准确的信息和建议。';
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    // 获取模型名称
    let modelName;
    if (settings.model && settings.model.trim()) {
      modelName = settings.model.trim();
    } else {
      // 如果没有指定模型，根据API端点选择默认模型，或者不指定模型让API自己决定
      if (settings.apiEndpoint.includes('siliconflow.cn')) {
        modelName = 'qwen2.5-72b-instruct';
      } else if (settings.apiEndpoint.includes('openai.com')) {
        modelName = 'gpt-3.5-turbo';
      }
      // 其他情况不指定模型，让API使用默认模型
    }

    const requestBody: any = {
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens
    };
    
    // 只有当指定了模型时才添加模型字段
    if (modelName) {
      requestBody.model = modelName;
    }

    // 标准化API端点
    let apiEndpoint = settings.apiEndpoint;
    if (!apiEndpoint.includes('/chat/completions')) {
      if (apiEndpoint.includes('siliconflow.cn')) {
        // 硅基流动API格式
        if (!apiEndpoint.includes('/v1')) {
          apiEndpoint = apiEndpoint.replace(/\/$/, '') + '/v1/chat/completions';
        } else {
          apiEndpoint = apiEndpoint.replace(/\/$/, '') + '/chat/completions';
        }
      } else {
        // 其他API格式
        apiEndpoint = apiEndpoint.replace(/\/$/, '') + '/chat/completions';
      }
    }

    console.log('AI API调用信息:', {
      endpoint: apiEndpoint,
      model: requestBody.model,
      hasKey: !!settings.apiKey
    });

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        let errorMessage = `API请求失败 (${response.status}): ${response.statusText}`;
        
        // 根据错误类型提供具体建议
        if (response.status === 401) {
          errorMessage = 'API密钥验证失败，请检查密钥是否正确或是否有足够权限';
        } else if (response.status === 404) {
          errorMessage = 'API端点不存在，请检查端点地址是否正确';
        } else if (response.status === 429) {
          errorMessage = 'API调用频率限制，请稍后重试';
        } else if (response.status >= 500) {
          errorMessage = 'API服务暂时不可用，请稍后重试';
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        return {
          content: data.choices[0].message.content,
          suggestions: ['需要更多帮助吗？', '想了解相关资源吗？']
        };
      } else {
        throw new Error('API返回格式异常，未找到有效响应内容');
      }
    } catch (error) {
      console.error('AI API调用错误:', error);
      
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('网络连接失败，请检查网络连接和API端点地址');
      } else if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('API调用发生未知错误');
      }
    }
  }

  // 生成模拟AI回复
  private generateMockResponse(userMessage: string, context?: ChatContext): Promise<{ content: string; suggestions?: string[] }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const response = this.generateContextualResponse(userMessage, context);
        resolve(response);
      }, 1000 + Math.random() * 1500);
    });
  }

  // 生成上下文相关的回复
  private generateContextualResponse(userMessage: string, context?: ChatContext): { content: string; suggestions?: string[] } {
    // 简单的智能回复，不包含固定的专业能力描述
    const responses = [
      '我理解您的问题，让我为您提供一些建议。',
      '这是一个很好的问题，我来帮您分析一下。',
      '根据您的描述，我有以下想法可以分享。',
      '我很乐意为您提供帮助，请告诉我更多细节。',
      '让我为您详细解答这个问题。'
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    return { 
      content: randomResponse,
      suggestions: [] // 移除所有建议
    };
  }

  // 简化的消息类型分析（实际不再需要复杂分析）
  private analyzeMessageType(message: string): string {
    return 'general';
  }

  // 检查关键词
  private containsKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  // 更新会话
  updateSession(session: ChatSession): void {
    this.sessions.set(session.id, session);
    this.saveSessions();
  }

  // 获取所有会话
  getAllSessions(): ChatSession[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  // 获取特定会话
  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  // 删除会话
  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      this.saveSessions();
    }
    return deleted;
  }

  // 生成ID
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

// 创建全局实例
export const aiChatService = new AIChatService();