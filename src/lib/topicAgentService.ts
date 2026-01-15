import { Project, ExperimentRecord, ExperimentNote, SOP, AISettings } from '@/types';
import { chatWithAPI } from '@/lib/mockAI';

// 课题代理上下文接口
export interface TopicAgentContext {
  project: Project;
  records: ExperimentRecord[];
  notes: ExperimentNote[];
  sops: SOP[];
  currentPhase?: string;
  recentActivities?: string[];
}

// 课题代理响应接口
export interface AgentResponse {
  content: string;
  suggestions?: string[];
  actionItems?: ActionItem[];
  relatedResources?: ResourceLink[];
}

// 建议操作项
export interface ActionItem {
  type: 'experiment' | 'analysis' | 'literature' | 'sop' | 'note';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
}

// 相关资源链接
export interface ResourceLink {
  type: 'record' | 'note' | 'sop' | 'external';
  title: string;
  id?: string;
  url?: string;
}

// 课题AI代理服务类
export class TopicAgentService {
  private context: TopicAgentContext | null = null;
  private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // 初始化课题代理上下文
  initializeContext(context: TopicAgentContext): void {
    this.context = context;
    this.conversationHistory = []; // 重置对话历史
  }

  // 获取课题专业化系统提示词
  private getSystemPrompt(): string {
    if (!this.context) {
      return '你是一位专业的科研助手。';
    }

    const { project, records, notes, sops } = this.context;

    return `你是一位专业的科研AI助手，专门为课题"${project.title}"提供智能支持。

课题信息：
- 课题名称：${project.title}
- 研究描述：${project.description}
- 当前进度：${project.progress}%

课题数据：
- 实验记录：${records.length}个
- 实验笔记：${notes.length}个
- SOP文档：${sops.length}个

主要实验类型：
${this.getExperimentTypeSummary(records)}

请根据课题背景提供专业的科研指导。`;
  }

  // 获取实验类型汇总
  private getExperimentTypeSummary(records: ExperimentRecord[]): string {
    if (records.length === 0) return '暂无实验记录';

    const typeCounts = records.reduce((acc, record) => {
      acc[record.category] = (acc[record.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(typeCounts)
      .map(([type, count]) => `- ${this.translateExperimentType(type)}: ${count}个记录`)
      .join('\n');
  }

  // 翻译实验类型
  private translateExperimentType(type: string): string {
    const translations: Record<string, string> = {
      'cell_culture': '细胞培养',
      'cell_viability': '细胞活力检测',
      'flow_cytometry': '流式细胞术',
      'cell_transfection': '细胞转染',
      'pcr': 'PCR扩增',
      'western_blot': 'Western Blot',
      'gene_cloning': '基因克隆',
      'dna_sequencing': 'DNA测序',
      'rna_extraction': 'RNA提取',
      'protein_purification': '蛋白质纯化',
      'animal_behavior': '动物行为学',
      'animal_surgery': '动物手术',
      'animal_dosing': '动物给药',
      'tissue_sampling': '组织取样',
      'drug_screening': '药物筛选',
      'compound_synthesis': '化合物合成',
      'pharmacokinetics': '药代动力学',
      'toxicology': '毒理学研究',
      'dose_response': '剂量-反应研究',
      'elisa': 'ELISA检测',
      'chromatography': '色谱分析',
      'mass_spectrometry': '质谱分析',
      'immunohistochemistry': '免疫组化',
      'bacterial_culture': '细菌培养',
      'antimicrobial_test': '抗菌试验',
      'sterility_test': '无菌检验',
      'other': '其他实验'
    };
    return translations[type] || type;
  }

  // 发送消息给AI代理
  async chat(message: string): Promise<AgentResponse> {
    if (!this.context) {
      throw new Error('课题代理上下文未初始化');
    }

    // 构建上下文增强的用户消息
    const contextualMessage = this.enhanceMessageWithContext(message);

    // 添加到对话历史
    this.conversationHistory.push({ role: 'user', content: message });

    try {
      // 获取AI设置
      const aiSettings = this.getAISettings();

      let aiResponse: string;
      if (aiSettings.useCustomAPI && aiSettings.apiEndpoint && aiSettings.apiKey) {
        // 使用用户配置的API
        aiResponse = await this.callCustomAPI(contextualMessage, aiSettings);
      } else {
        // 使用模拟AI
        aiResponse = await chatWithAPI(contextualMessage, this.context.project.title);
      }

      // 添加到对话历史
      this.conversationHistory.push({ role: 'assistant', content: aiResponse });

      // 解析AI响应并生成结构化回复
      return this.parseAIResponse(aiResponse);

    } catch (error) {
      console.error('课题代理聊天失败:', error);
      throw error;
    }
  }

  // 调用用户自定义API
  private async callCustomAPI(message: string, settings: AISettings): Promise<string> {
    // 获取系统提示词，优先使用用户自定义的，否则使用默认的
    const systemPrompt = settings.systemPrompt && settings.systemPrompt.trim()
      ? settings.systemPrompt.trim()
      : this.getSystemPrompt(); // 使用默认的课题专用提示词

    const messages = [
      { role: 'system', content: systemPrompt },
      ...this.conversationHistory.slice(-10), // 保留最近10条对话
      { role: 'user', content: message }
    ];

    // 获取模型名称
    let modelName;
    if (settings.model && settings.model.trim()) {
      modelName = settings.model.trim();
    } else {
      // 如果没有指定模型，根据API端点选择默认模型
      if (settings.apiEndpoint.includes('siliconflow.cn')) {
        modelName = 'qwen2.5-72b-instruct';
      } else if (settings.apiEndpoint.includes('openai.com')) {
        modelName = 'gpt-3.5-turbo';
      }
    }

    const requestBody: any = {
      messages,
      temperature: 0.7,
      max_tokens: 1500
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
        const errorText = await response.text();
        console.error('API 响应详情:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });

        let userFriendlyMessage = '';
        if (response.status === 404) {
          userFriendlyMessage = 'API端点不存在，请检查API地址是否正确。\n\n常见的OpenAI兼容端点格式：\n• https://api.openai.com/v1/chat/completions\n• Azure: https://your-resource.openai.azure.com/openai/deployments/your-model/chat/completions?api-version=2023-05-15\n\n请在设置页面重新配置API端点地址。';
        } else if (response.status === 401) {
          userFriendlyMessage = 'API密钥无效或权限不足，请检查以下：\n• API密钥是否正确完整\n• 账户是否有足够的余额\n• 是否有访问所选模型的权限\n\n请在设置页面重新配置API密钥。';
        } else if (response.status === 429) {
          userFriendlyMessage = 'API调用频率限制，请稍后再试。\n\n可能的原因：\n• 达到了调用频率上限\n• 账户配额不足\n\n请等待一段时间后重试，或检查账户配额。';
        } else if (response.status >= 500) {
          userFriendlyMessage = `API服务暂时不可用 (${response.status})，请稍后重试。\n\n这通常是服务商的临时问题，请等待几分钟后重试。`;
        } else {
          userFriendlyMessage = `API请求失败 (${response.status})：${response.statusText}\n\n详细信息：${errorText || '无额外信息'}\n\n请检查API配置是否正确，或联系服务提供商。`;
        }

        throw new Error(userFriendlyMessage);
      }

      const data = await response.json();


      return data.choices?.[0]?.message?.content || '抱歉，AI没有返回有效响应';
    } catch (error) {
      console.error('API 调用错误:', error);

      let userFriendlyMessage = '';
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        userFriendlyMessage = '网络连接失败，无法连接到API服务。\n\n可能的原因：\n• 网络连接问题\n• API端点地址不正确\n• 防火墙或代理设置阻止连接\n• 如果在国内，可能需要配置网络代理\n\n请检查网络连接和API配置。';
      } else if (error instanceof Error) {
        userFriendlyMessage = error.message;
      } else {
        userFriendlyMessage = '发生未知错误，请检查控制台获取详细信息，或重新配置API设置。';
      }

      throw new Error(userFriendlyMessage);
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

  // 使用上下文增强消息
  private enhanceMessageWithContext(message: string): string {
    if (!this.context) return message;

    const { records, sops } = this.context;

    let contextInfo = '';

    // 如果用户询问与实验相关的问题，添加相关实验记录信息
    if (this.isExperimentRelatedQuery(message) && records.length > 0) {
      const recentRecords = records.slice(-3).map(r =>
        `实验记录: ${r.title} (${this.translateExperimentType(r.category)}, 状态: ${r.status})`
      ).join('\n');
      contextInfo += `\n最近的实验记录:\n${recentRecords}\n`;
    }

    // 如果询问SOP相关问题，添加SOP信息
    if (this.isSOPRelatedQuery(message) && sops.length > 0) {
      const recentSOPs = sops.slice(-3).map(s =>
        `SOP文档: ${s.title} (版本: ${s.version}, 状态: ${s.approvalStatus})`
      ).join('\n');
      contextInfo += `\n相关SOP文档:\n${recentSOPs}\n`;
    }

    return contextInfo ? `${message}\n\n参考信息:${contextInfo}` : message;
  }

  // 判断是否为实验相关查询
  private isExperimentRelatedQuery(message: string): boolean {
    const keywords = ['实验', '检测', '培养', '分析', '测试', '操作', '方法', '步骤', '数据', '结果'];
    return keywords.some(keyword => message.includes(keyword));
  }

  // 判断是否为SOP相关查询
  private isSOPRelatedQuery(message: string): boolean {
    const keywords = ['SOP', '标准', '流程', '操作', '规范', '步骤', '指南'];
    return keywords.some(keyword => message.includes(keyword));
  }

  // 解析AI响应并生成结构化回复
  private parseAIResponse(aiResponse: string): AgentResponse {
    const response: AgentResponse = {
      content: aiResponse
    };

    // 提取建议操作（简单的关键词匹配）
    response.actionItems = this.extractActionItems(aiResponse);

    // 提取建议问题
    response.suggestions = this.extractSuggestions(aiResponse);

    // 提取相关资源
    response.relatedResources = this.extractRelatedResources(aiResponse);

    return response;
  }

  // 提取操作建议
  private extractActionItems(response: string): ActionItem[] {
    const items: ActionItem[] = [];

    // 简单的模式匹配来提取建议
    if (response.includes('建议') || response.includes('推荐')) {
      if (response.includes('实验') || response.includes('检测')) {
        items.push({
          type: 'experiment',
          title: '设计新实验',
          description: '根据讨论内容设计后续实验',
          priority: 'medium'
        });
      }

      if (response.includes('SOP') || response.includes('标准') || response.includes('流程')) {
        items.push({
          type: 'sop',
          title: '制定标准流程',
          description: '根据讨论制定或更新SOP文档',
          priority: 'medium'
        });
      }
    }

    return items;
  }

  // 提取建议问题
  private extractSuggestions(response: string): string[] {
    const suggestions: string[] = [];

    // 根据响应内容生成相关问题
    if (response.includes('细胞培养')) {
      suggestions.push('培养基的选择和配制要注意什么？');
      suggestions.push('如何优化细胞传代的条件？');
    }

    if (response.includes('实验设计')) {
      suggestions.push('对照组的设置需要考虑哪些因素？');
      suggestions.push('样本数量的计算方法是什么？');
    }

    if (response.includes('数据分析')) {
      suggestions.push('使用哪种统计方法比较合适？');
      suggestions.push('如何处理异常数据？');
    }

    return suggestions.slice(0, 3); // 最多返回3个建议
  }

  // 提取相关资源
  private extractRelatedResources(response: string): ResourceLink[] {
    const resources: ResourceLink[] = [];

    if (!this.context) return resources;

    // 根据响应内容推荐相关资源
    const { records, sops } = this.context;

    if (response.includes('实验记录') && records.length > 0) {
      const latestRecord = records[records.length - 1];
      resources.push({
        type: 'record',
        title: latestRecord.title,
        id: latestRecord.id
      });
    }

    if (response.includes('SOP') && sops.length > 0) {
      const latestSOP = sops[sops.length - 1];
      resources.push({
        type: 'sop',
        title: latestSOP.title,
        id: latestSOP.id
      });
    }

    return resources;
  }

  // 获取对话历史
  getConversationHistory(): Array<{ role: 'user' | 'assistant'; content: string }> {
    return [...this.conversationHistory];
  }

  // 清除对话历史
  clearHistory(): void {
    this.conversationHistory = [];
  }

  // 生成课题总结报告
  async generateTopicSummary(): Promise<string> {
    if (!this.context) {
      throw new Error('课题代理上下文未初始化');
    }

    const summaryPrompt = `请基于以下课题信息生成一份详细的课题总结报告：

课题名称：${this.context.project.title}
课题描述：${this.context.project.description}
当前进度：${this.context.project.progress}%
实验记录数量：${this.context.records.length}
笔记数量：${this.context.notes.length}
SOP文档数量：${this.context.sops.length}

请包含以下内容：
1. 课题概述和目标
2. 当前进展情况
3. 主要实验成果
4. 存在的问题和挑战
5. 下一步工作建议`;

    try {
      return await chatWithAPI(summaryPrompt, this.context.project.title);
    } catch (error) {
      throw new Error('生成课题总结失败');
    }
  }
}

// 创建全局实例
export const topicAgentService = new TopicAgentService();