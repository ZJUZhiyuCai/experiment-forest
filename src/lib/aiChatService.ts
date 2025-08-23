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
      systemPrompt: `你是一位专业的生命医药领域实验管理AI助手。你具备以下专业知识：
1. 生物医学实验设计和优化
2. 细胞培养、分子生物学、动物实验等技术
3. 数据分析和统计方法
4. 实验室安全和质量控制
5. 文献检索和科研写作

请用专业、准确、友好的语言回答用户问题，提供实用的建议和解决方案。`,
      experimentPrompts: {
        'cell_culture': '专注于细胞培养技术，包括培养基选择、传代操作、污染防控等',
        'pcr': '专注于PCR技术优化，包括引物设计、反应条件、产物分析等',
        'western_blot': '专注于Western Blot技术，包括蛋白提取、电泳条件、抗体选择等',
        'elisa': '专注于ELISA检测，包括包被、封闭、检测条件优化等',
        'animal_dosing': '专注于动物给药实验，包括给药途径、剂量计算、伦理要求等',
        'other': '提供通用的实验设计和技术支持'
      },
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
    let welcomeText = "您好！我是您的AI实验助手，很高兴为您服务。";
    
    if (experimentType) {
      const typeNames: Record<ExperimentCategory, string> = {
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
      welcomeText += `\n\n我注意到您正在进行${typeNames[experimentType] || experimentType}相关的实验。我可以为您提供：\n\n`;
      welcomeText += "• 🧪 实验设计和优化建议\n";
      welcomeText += "• 📋 标准操作流程(SOP)指导\n";
      welcomeText += "• 📊 数据分析和统计方法\n";
      welcomeText += "• 📚 相关文献和资源推荐\n";
      welcomeText += "• 🛡️ 实验室安全注意事项\n\n";
      welcomeText += "请告诉我您遇到的具体问题，我会尽力为您提供专业的解答！";
    } else {
      welcomeText += "\n\n我可以帮助您解决实验设计、数据分析、文献检索等方面的问题。请告诉我您需要什么帮助！";
    }

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
    const messages = [
      { role: 'system', content: this.config.systemPrompt },
      { role: 'user', content: userMessage }
    ];

    const requestBody = {
      model: settings.model || this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens
    };

    let apiEndpoint = settings.apiEndpoint;
    if (!apiEndpoint.includes('/chat/completions')) {
      apiEndpoint = apiEndpoint.replace(/\/?$/, '/chat/completions');
    }

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      return {
        content: data.choices[0].message.content,
        suggestions: ['需要更多帮助吗？', '想了解相关资源吗？']
      };
    } else {
      throw new Error('API返回格式不支持');
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
    const messageType = this.analyzeMessageType(userMessage);
    
    let baseResponse = '';
    let suggestions: string[] = [];

    switch (messageType) {
      case 'experimental_design':
        baseResponse = `关于实验设计，我建议从以下几个方面考虑：

🎯 **实验目标明确化**
- 明确研究假设和预期结果
- 确定主要和次要终点指标

📊 **实验设计要素**
- 样本量计算：确保统计功效
- 随机化：减少选择偏倚
- 对照组设置：阴性/阳性对照

需要我详细展开某个方面吗？`;
        suggestions = ['能否告诉我更多实验细节？', '需要帮助设计对照组吗？'];
        break;

      case 'data_analysis':
        baseResponse = `数据分析是实验的关键环节：

📊 **数据准备**
- 数据清洗：异常值识别和处理
- 数据转换：标准化和归一化

📈 **统计方法选择**
- 描述性统计：均值、标准差、分布特征
- 假设检验：t检验、方差分析、卡方检验

推荐工具：R、Python、GraphPad Prism、SPSS`;
        suggestions = ['需要帮助选择统计方法吗？', '想了解数据可视化技巧吗？'];
        break;

      default:
        baseResponse = `我很乐意为您提供帮助！

🔬 **我的专业领域**
- 实验设计与优化
- 数据分析与统计
- 文献检索与综述
- 实验室安全管理

请告诉我您需要什么帮助，我会根据您的具体情况提供专业建议！`;
        suggestions = ['需要实验设计帮助吗？', '想了解数据分析方法吗？'];
    }

    return { content: baseResponse, suggestions };
  }

  // 分析消息类型
  private analyzeMessageType(message: string): string {
    const lower = message.toLowerCase();
    
    if (this.containsKeywords(lower, ['设计', '方案', '实验', '计划'])) {
      return 'experimental_design';
    } else if (this.containsKeywords(lower, ['数据', '分析', '统计', '结果'])) {
      return 'data_analysis';
    } else {
      return 'general';
    }
  }

  // 检查关键词
  private containsKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
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