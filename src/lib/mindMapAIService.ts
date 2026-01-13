import { Project, ExperimentRecord, ExperimentNote, SOP, AISettings, MindMapNode, MindMapEdge } from '@/types';
import { chatWithAPI } from '@/lib/mockAI';

// AI生成思维导图的配置选项
export interface MindMapGenerationOptions {
  includeExperiments?: boolean;
  includeNotes?: boolean;
  includeSOPs?: boolean;
  maxNodes?: number;
  style?: 'hierarchical' | 'radial' | 'network';
  detailLevel?: 'basic' | 'detailed' | 'comprehensive';
}

// AI生成的思维导图结构
export interface GeneratedMindMap {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  centerNode: MindMapNode;
  metadata: {
    generationTime: Date;
    nodeCount: number;
    edgeCount: number;
    generationPrompt: string;
  };
}

// AI建议的思维导图优化
export interface MindMapOptimization {
  suggestions: string[];
  newNodes?: MindMapNode[];
  newEdges?: MindMapEdge[];
  improvements: {
    type: 'structure' | 'content' | 'visual' | 'connection';
    description: string;
    priority: 'low' | 'medium' | 'high';
  }[];
}

// 思维导图AI服务类
export class MindMapAIService {
  private nodeIdCounter = 0;

  // 生成基于课题的思维导图
  async generateProjectMindMap(
    project: Project,
    records: ExperimentRecord[],
    notes: ExperimentNote[],
    sops: SOP[],
    options: MindMapGenerationOptions = {}
  ): Promise<GeneratedMindMap> {
    const {
      includeExperiments = true,
      includeNotes = true,
      includeSOPs = true,
      maxNodes = 50,
      style = 'hierarchical',
      detailLevel = 'detailed'
    } = options;

    try {
      // 构建生成提示词
      const prompt = this.buildGenerationPrompt(
        project,
        records,
        notes,
        sops,
        { includeExperiments, includeNotes, includeSOPs, style, detailLevel }
      );

      // 获取AI响应
      const aiResponse = await this.callAI(prompt);
      
      // 解析AI响应并生成思维导图
      const mindMap = await this.parseAIResponseToMindMap(
        aiResponse,
        project,
        records,
        notes,
        sops,
        maxNodes
      );

      return {
        ...mindMap,
        metadata: {
          generationTime: new Date(),
          nodeCount: mindMap.nodes.length,
          edgeCount: mindMap.edges.length,
          generationPrompt: prompt
        }
      };

    } catch (error) {
      console.error('生成思维导图失败:', error);
      throw new Error(`生成思维导图失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // 优化现有思维导图
  async optimizeMindMap(
    existingNodes: MindMapNode[],
    existingEdges: MindMapEdge[],
    project: Project
  ): Promise<MindMapOptimization> {
    try {
      const prompt = this.buildOptimizationPrompt(existingNodes, existingEdges, project);
      const aiResponse = await this.callAI(prompt);
      
      return this.parseOptimizationResponse(aiResponse);
    } catch (error) {
      console.error('优化思维导图失败:', error);
      throw new Error(`优化思维导图失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // 扩展思维导图节点
  async expandNode(
    node: MindMapNode,
    context: {
      project: Project;
      records?: ExperimentRecord[];
      notes?: ExperimentNote[];
      sops?: SOP[];
    }
  ): Promise<{ nodes: MindMapNode[]; edges: MindMapEdge[] }> {
    try {
      const prompt = this.buildExpansionPrompt(node, context);
      const aiResponse = await this.callAI(prompt);
      
      return this.parseExpansionResponse(aiResponse, node);
    } catch (error) {
      console.error('扩展节点失败:', error);
      throw new Error(`扩展节点失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // 构建生成提示词
  private buildGenerationPrompt(
    project: Project,
    records: ExperimentRecord[],
    notes: ExperimentNote[],
    sops: SOP[],
    options: Partial<MindMapGenerationOptions>
  ): string {
    let prompt = `请为以下生命医药研究课题生成一个专业的思维导图结构：

课题信息：
- 标题：${project.title}
- 描述：${project.description}
- 状态：${project.status}
- 进度：${project.progress}%
- 研究目标：${project.objectives?.join('、') || '未指定'}

数据统计：
- 实验记录：${records.length}个
- 研究笔记：${notes.length}个
- SOP文档：${sops.length}个

`;

    // 添加实验信息
    if (options.includeExperiments && records.length > 0) {
      prompt += `\n实验类型分布：\n`;
      const experimentTypes = this.getExperimentTypeSummary(records);
      prompt += experimentTypes;
    }

    // 添加笔记信息
    if (options.includeNotes && notes.length > 0) {
      prompt += `\n主要研究笔记：\n`;
      const recentNotes = notes.slice(-5).map(note => `- ${note.title}`).join('\n');
      prompt += recentNotes;
    }

    // 添加SOP信息
    if (options.includeSOPs && sops.length > 0) {
      prompt += `\n相关SOP文档：\n`;
      const sopList = sops.slice(-5).map(sop => `- ${sop.title} (${sop.category})`).join('\n');
      prompt += sopList;
    }

    prompt += `\n请生成一个${options.style === 'hierarchical' ? '层次化' : options.style === 'radial' ? '放射状' : '网络状'}的思维导图，包含以下要素：

1. 中心节点：课题主题
2. 主要分支：
   - 研究目标和假设
   - 实验设计和方法
   - 数据收集和分析
   - 结果和讨论
   - 问题和挑战
   - 下一步工作

3. 具体细节：
   - 根据现有实验记录添加具体的实验节点
   - 包含相关的技术方法和设备
   - 标注关键数据点和发现
   - 识别潜在的研究方向

请以JSON格式返回，包含节点数组和连接数组。每个节点应包含：id, title, type, category, description, priority。

详细程度：${options.detailLevel}
最大节点数：不超过50个

请确保思维导图结构合理，层次清晰，便于理解和进一步编辑。`;

    return prompt;
  }

  // 构建优化提示词
  private buildOptimizationPrompt(
    nodes: MindMapNode[],
    edges: MindMapEdge[],
    project: Project
  ): string {
    return `请分析以下思维导图结构，并提出优化建议：

课题：${project.title}

当前节点数：${nodes.length}
当前连接数：${edges.length}

节点列表：
${nodes.map(node => `- ${node.title} (${node.type})`).join('\n')}

请分析并提出以下方面的改进建议：
1. 结构优化：节点层次、连接关系
2. 内容完善：缺失的重要节点
3. 视觉改进：布局和分类优化
4. 逻辑连接：节点间关系的改进

请以JSON格式返回优化建议，包含具体的改进措施和新增节点建议。`;
  }

  // 构建扩展提示词
  private buildExpansionPrompt(
    node: MindMapNode,
    context: {
      project: Project;
      records?: ExperimentRecord[];
      notes?: ExperimentNote[];
      sops?: SOP[];
    }
  ): string {
    return `请为思维导图节点"${node.title}"生成详细的子节点和扩展内容：

节点信息：
- 标题：${node.title}
- 类型：${node.type}
- 描述：${node.content || '无'}

课题背景：${context.project.title}

请生成3-8个相关的子节点，每个子节点应该：
1. 与父节点紧密相关
2. 提供具体的技术细节或实施步骤
3. 包含实用的研究指导

请以JSON格式返回新节点和连接关系。`;
  }

  // 调用AI服务
  private async callAI(prompt: string): Promise<string> {
    const aiSettings = this.getAISettings();
    
    if (aiSettings.useCustomAPI && aiSettings.apiEndpoint && aiSettings.apiKey) {
      try {
        return await this.callCustomAPI(prompt, aiSettings);
      } catch (error) {
        console.warn('自定义AI API调用失败，使用模拟数据:', error);
        // 如果自定义API失败，降级到模拟数据
        return this.generateMockAIResponse(prompt);
      }
    } else {
      try {
        return await chatWithAPI(prompt, '思维导图生成');
      } catch (error) {
        console.warn('默认AI API调用失败，使用模拟数据:', error);
        // 如果默认API失败，降级到模拟数据
        return this.generateMockAIResponse(prompt);
      }
    }
  }

  // 调用自定义API
  private async callCustomAPI(prompt: string, settings: AISettings): Promise<string> {
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

    // 获取系统提示词
    const systemPrompt = settings.systemPrompt && settings.systemPrompt.trim()
      ? settings.systemPrompt.trim()
      : '你是一位专业的AI助手，擅长创建清晰、有逻辑的思维导图。请根据用户需求生成结构化的思维导图数据。';

    const requestBody: any = {
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    };
    
    // 只有当指定了模型时才添加模型字段
    if (modelName) {
      requestBody.model = modelName;
    }

    console.log('思维导图AI API 请求信息:', {
      endpoint: settings.apiEndpoint,
      model: requestBody.model
    });

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
        console.error('思维导图API 响应详情:', {
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
      console.log('思维导图AI API 响应成功:', { hasChoices: !!data.choices });
      
      return data.choices?.[0]?.message?.content || '生成失败';
    } catch (error) {
      console.error('思维导图API 调用错误:', error);
      
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

  // 生成模拟AI响应
  private generateMockAIResponse(prompt: string): string {
    // 根据提示词类型生成不同的模拟响应
    if (prompt.includes('思维导图')) {
      return JSON.stringify({
        nodes: [
          {
            id: 'center-node',
            title: '课题主题',
            type: 'project',
            category: 'main',
            description: '课题的核心内容和研究方向',
            priority: 'high'
          },
          {
            id: 'research-objectives',
            title: '研究目标',
            type: 'objective',
            category: 'goal',
            description: '明确的研究目标和预期成果',
            priority: 'high'
          },
          {
            id: 'experimental-design',
            title: '实验设计',
            type: 'experiment',
            category: 'method',
            description: '详细的实验方案和操作流程',
            priority: 'medium'
          },
          {
            id: 'data-analysis',
            title: '数据分析',
            type: 'analysis',
            category: 'data',
            description: '数据处理和统计分析方法',
            priority: 'medium'
          },
          {
            id: 'literature-review',
            title: '文献综述',
            type: 'document',
            category: 'resource',
            description: '相关文献和研究背景',
            priority: 'low'
          },
          {
            id: 'risk-assessment',
            title: '风险评估',
            type: 'analysis',
            category: 'planning',
            description: '潜在风险和应对策略',
            priority: 'medium'
          }
        ],
        edges: [
          { source: 'center-node', target: 'research-objectives' },
          { source: 'center-node', target: 'experimental-design' },
          { source: 'center-node', target: 'data-analysis' },
          { source: 'center-node', target: 'literature-review' },
          { source: 'experimental-design', target: 'risk-assessment' },
          { source: 'research-objectives', target: 'data-analysis' }
        ]
      });
    }
    
    // 默认响应
    return '模拟AI响应：请配置AI API以获得真实的AI生成功能。';
  }

  // 获取AI设置
  private getAISettings(): AISettings {
    const saved = localStorage.getItem('aiSettings');
    return saved ? JSON.parse(saved) : {
      apiEndpoint: '',
      apiKey: '',
      useCustomAPI: false,
      model: 'gwen2.5-72b-instruct'
    };
  }

  // 解析AI响应为思维导图
  private async parseAIResponseToMindMap(
    aiResponse: string,
    project: Project,
    records: ExperimentRecord[],
    notes: ExperimentNote[],
    sops: SOP[],
    maxNodes: number
  ): Promise<Omit<GeneratedMindMap, 'metadata'>> {
    console.log('开始解析AI响应:', aiResponse.substring(0, 200) + '...');
    
    try {
      // 尝试解析JSON响应
      let parsedData: any;
      try {
        // 提取JSON部分
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[0]);
          console.log('成功解析AI响应JSON:', parsedData);
        } else {
          console.warn('AI响应中未找到JSON，使用默认结构');
          return this.generateDefaultMindMap(project, records, notes, sops);
        }
      } catch (parseError) {
        console.warn('JSON解析失败，使用默认结构:', parseError);
        return this.generateDefaultMindMap(project, records, notes, sops);
      }

      // 转换为标准格式
      const nodes: MindMapNode[] = [];
      const edges: MindMapEdge[] = [];

      // 创建中心节点
      const centerNode: MindMapNode = {
        id: this.generateId(),
        title: project.title,
        content: project.description,
        type: 'project' as any,
        position: { x: 0, y: 0 },
        size: { width: 200, height: 100 },
        style: {
          shape: 'rectangle',
          color: '#8B5CF6',
          textColor: '#FFFFFF',
          borderColor: '#7C3AED',
          fontSize: 16
        },
        relatedId: project.id,
        relatedType: 'project',
        level: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      nodes.push(centerNode);
      console.log('创建中心节点:', centerNode);

      // 处理AI生成的节点
      if (parsedData.nodes && Array.isArray(parsedData.nodes)) {
        console.log('处理AI生成的节点，数量:', parsedData.nodes.length);
        
        parsedData.nodes.slice(0, maxNodes - 1).forEach((nodeData: any, index: number) => {
          const nodeId = nodeData.id || this.generateId();
          const node: MindMapNode = {
            id: nodeId,
            title: nodeData.title || `节点 ${index + 1}`,
            content: nodeData.description || nodeData.content || '',
            type: nodeData.type || 'experiment',
            position: this.calculateNodePosition(index, parsedData.nodes.length),
            size: { width: 150, height: 80 },
            style: this.getNodeStyle(nodeData.type || 'experiment'),
            relatedType: this.mapNodeTypeToRelatedType(nodeData.type || 'experiment'),
            level: 1,
            parent: centerNode.id,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          nodes.push(node);
          console.log(`创建节点 ${index}:`, node);

          // 创建与中心节点的连接
          const edge: MindMapEdge = {
            id: this.generateId(),
            source: centerNode.id,
            target: node.id,
            type: 'hierarchy',
            style: {
              color: '#6B7280',
              width: 2,
              strokeType: 'solid',
              arrow: true
            },
            createdAt: new Date(),
            updatedAt: new Date()
          };
          edges.push(edge);
          console.log(`创建边 ${index}:`, edge);
        });
      } else {
        console.warn('AI响应中没有有效的节点数据，使用默认结构');
        return this.generateDefaultMindMap(project, records, notes, sops);
      }

      // 处理AI生成的连接
      if (parsedData.edges && Array.isArray(parsedData.edges)) {
        console.log('处理额外的连接，数量:', parsedData.edges.length);
        
        parsedData.edges.forEach((edgeData: any, index: number) => {
          if (edgeData.source && edgeData.target) {
            // 尝试通过ID或标题找到节点
            const sourceNode = nodes.find(n => n.id === edgeData.source || n.title === edgeData.source);
            const targetNode = nodes.find(n => n.id === edgeData.target || n.title === edgeData.target);
            
            if (sourceNode && targetNode && sourceNode.id !== targetNode.id) {
              const edge: MindMapEdge = {
                id: this.generateId(),
                source: sourceNode.id,
                target: targetNode.id,
                type: 'relation',
                label: edgeData.label,
                style: {
                  color: '#6B7280',
                  width: 2,
                  strokeType: 'solid',
                  arrow: true
                },
                createdAt: new Date(),
                updatedAt: new Date()
              };
              edges.push(edge);
              console.log(`创建额外边 ${index}:`, edge);
            } else {
              console.warn('找不到连接的源或目标节点:', edgeData);
            }
          }
        });
      }

      console.log('最终生成的思维导图:', { nodeCount: nodes.length, edgeCount: edges.length });
      return { nodes, edges, centerNode };

    } catch (error) {
      console.error('解析AI响应失败，使用默认思维导图:', error);
      // 返回默认思维导图
      return this.generateDefaultMindMap(project, records, notes, sops);
    }
  }

  // 生成默认思维导图
  private generateDefaultMindMap(
    project: Project,
    records: ExperimentRecord[],
    notes: ExperimentNote[],
    sops: SOP[]
  ): Omit<GeneratedMindMap, 'metadata'> {
    console.log('生成默认思维导图，输入数据:', {
      projectTitle: project.title,
      recordCount: records.length,
      noteCount: notes.length,
      sopCount: sops.length
    });
    
    const nodes: MindMapNode[] = [];
    const edges: MindMapEdge[] = [];

    // 中心节点
    const centerNode: MindMapNode = {
      id: this.generateId(),
      title: project.title,
      content: project.description,
      type: 'project' as any,
      position: { x: 0, y: 0 },
      size: { width: 200, height: 100 },
      style: {
        shape: 'rectangle',
        color: '#8B5CF6',
        textColor: '#FFFFFF',
        borderColor: '#7C3AED',
        fontSize: 16
      },
      relatedId: project.id,
      relatedType: 'project',
      level: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    nodes.push(centerNode);
    console.log('创建默认中心节点:', centerNode);

    // 主要分支节点
    const mainBranches = [
      { title: '研究目标', type: 'objective', category: 'goal', color: '#10B981' },
      { title: '实验设计', type: 'experiment', category: 'method', color: '#F59E0B' },
      { title: '数据分析', type: 'analysis', category: 'data', color: '#3B82F6' },
      { title: '相关文档', type: 'document', category: 'resource', color: '#6366F1' }
    ];

    mainBranches.forEach((branch, index) => {
      const node: MindMapNode = {
        id: this.generateId(),
        title: branch.title,
        content: `默认生成的${branch.title}节点`,
        type: branch.type as any,
        position: this.calculateNodePosition(index, mainBranches.length),
        size: { width: 150, height: 80 },
        style: {
          shape: 'rectangle',
          color: branch.color,
          textColor: '#FFFFFF',
          borderColor: branch.color,
          fontSize: 14
        },
        relatedType: this.mapNodeTypeToRelatedType(branch.type),
        level: 1,
        parent: centerNode.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      nodes.push(node);
      console.log(`创建默认分支节点 ${index}:`, node);

      // 连接到中心节点
      const edge: MindMapEdge = {
        id: this.generateId(),
        source: centerNode.id,
        target: node.id,
        type: 'hierarchy',
        style: {
          color: '#6B7280',
          width: 2,
          strokeType: 'solid',
          arrow: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      edges.push(edge);
      console.log(`创建默认边 ${index}:`, edge);
    });

    // 根据实际数据添加额外节点
    if (records.length > 0) {
      const recordNode: MindMapNode = {
        id: this.generateId(),
        title: `实验记录 (${records.length}个)`,
        content: `包含${records.length}个实验记录`,
        type: 'experiment',
        position: this.calculateNodePosition(4, 6),
        size: { width: 120, height: 60 },
        style: this.getNodeStyle('experiment'),
        relatedType: 'experiment',
        level: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      nodes.push(recordNode);
      
      // 连接到实验设计节点
      const experimentDesignNode = nodes.find(n => n.title === '实验设计');
      if (experimentDesignNode) {
        edges.push({
          id: this.generateId(),
          source: experimentDesignNode.id,
          target: recordNode.id,
          type: 'relation',
          style: {
            color: '#9CA3AF',
            width: 1,
            strokeType: 'solid',
            arrow: true
          },
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    if (notes.length > 0) {
      const noteNode: MindMapNode = {
        id: this.generateId(),
        title: `研究笔记 (${notes.length}个)`,
        content: `包含${notes.length}个研究笔记`,
        type: 'note',
        position: this.calculateNodePosition(5, 6),
        size: { width: 120, height: 60 },
        style: this.getNodeStyle('note'),
        relatedType: 'note',
        level: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      nodes.push(noteNode);
      
      // 连接到相关文档节点
      const documentNode = nodes.find(n => n.title === '相关文档');
      if (documentNode) {
        edges.push({
          id: this.generateId(),
          source: documentNode.id,
          target: noteNode.id,
          type: 'relation',
          style: {
            color: '#9CA3AF',
            width: 1,
            strokeType: 'solid',
            arrow: true
          },
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    console.log('默认思维导图生成完成:', {
      nodeCount: nodes.length,
      edgeCount: edges.length
    });

    return { nodes, edges, centerNode };
  }

  // 解析优化响应
  private parseOptimizationResponse(response: string): MindMapOptimization {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return {
          suggestions: data.suggestions || ['优化建议解析失败'],
          newNodes: data.newNodes || [],
          newEdges: data.newEdges || [],
          improvements: data.improvements || []
        };
      }
    } catch (error) {
      console.error('解析优化响应失败:', error);
    }

    return {
      suggestions: ['建议增加更多具体的实验节点', '优化节点间的逻辑关系', '添加关键数据节点'],
      improvements: [
        {
          type: 'structure',
          description: '建议重新组织节点层次结构',
          priority: 'medium'
        }
      ]
    };
  }

  // 解析扩展响应
  private parseExpansionResponse(
    response: string,
    parentNode: MindMapNode
  ): { nodes: MindMapNode[]; edges: MindMapEdge[] } {
    const nodes: MindMapNode[] = [];
    const edges: MindMapEdge[] = [];

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        
        if (data.nodes && Array.isArray(data.nodes)) {
          data.nodes.forEach((nodeData: any, index: number) => {
            const node: MindMapNode = {
              id: this.generateId(),
              title: nodeData.title || `子节点 ${index + 1}`,
              content: nodeData.description || '',
              type: 'experiment' as any,
              position: {
                x: parentNode.position.x + 200 * Math.cos((index * 2 * Math.PI) / data.nodes.length),
                y: parentNode.position.y + 200 * Math.sin((index * 2 * Math.PI) / data.nodes.length)
              },
              size: { width: 120, height: 60 },
              style: this.getNodeStyle('experiment'),
              relatedType: 'experiment',
              level: (parentNode.level || 0) + 1,
              parent: parentNode.id,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            nodes.push(node);

            // 创建连接
            edges.push({
              id: this.generateId(),
              source: parentNode.id,
              target: node.id,
              type: 'hierarchy',
              style: {
                color: '#9CA3AF',
                width: 1,
                strokeType: 'solid',
                arrow: true
              },
              createdAt: new Date(),
              updatedAt: new Date()
            });
          });
        }
      }
    } catch (error) {
      console.error('解析扩展响应失败:', error);
    }

    return { nodes, edges };
  }

  private mapNodeTypeToRelatedType(type: string): 'project' | 'experiment' | 'sample' | 'sop' | 'note' {
    const mapping: Record<string, 'project' | 'experiment' | 'sample' | 'sop' | 'note'> = {
      'project': 'project',
      'objective': 'project', 
      'experiment': 'experiment',
      'analysis': 'experiment',
      'document': 'sop',
      'concept': 'note',
      'sop': 'sop',
      'note': 'note'
    };
    return mapping[type] || 'experiment';
  }

  // 辅助方法
  private generateId(): string {
    return `node_${Date.now()}_${++this.nodeIdCounter}`;
  }

  private calculateNodePosition(index: number, total: number): { x: number; y: number } {
    const angle = (index * 2 * Math.PI) / total;
    const radius = 300;
    return {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle)
    };
  }

  private getNodeStyle(type: string): MindMapNode['style'] {
    const styles = {
      project: { shape: 'rectangle' as const, color: '#8B5CF6', textColor: '#FFFFFF', borderColor: '#7C3AED', fontSize: 16 },
      objective: { shape: 'ellipse' as const, color: '#10B981', textColor: '#FFFFFF', borderColor: '#059669', fontSize: 14 },
      experiment: { shape: 'rectangle' as const, color: '#F59E0B', textColor: '#FFFFFF', borderColor: '#D97706', fontSize: 14 },
      analysis: { shape: 'diamond' as const, color: '#3B82F6', textColor: '#FFFFFF', borderColor: '#2563EB', fontSize: 14 },
      document: { shape: 'rectangle' as const, color: '#6366F1', textColor: '#FFFFFF', borderColor: '#4F46E5', fontSize: 14 },
      concept: { shape: 'ellipse' as const, color: '#8B5CF6', textColor: '#FFFFFF', borderColor: '#7C3AED', fontSize: 12 }
    };
    return styles[type as keyof typeof styles] || styles.concept;
  }

  private getExperimentTypeSummary(records: ExperimentRecord[]): string {
    const typeCounts = records.reduce((acc, record) => {
      acc[record.category] = (acc[record.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(typeCounts)
      .map(([type, count]) => `- ${this.translateExperimentType(type)}: ${count}个`)
      .join('\n');
  }

  private translateExperimentType(type: string): string {
    const translations: Record<string, string> = {
      'cell_culture': '细胞培养',
      'pcr': 'PCR扩增',
      'western_blot': 'Western Blot',
      'elisa': 'ELISA检测',
      'other': '其他实验'
    };
    return translations[type] || type;
  }
}

// 创建全局实例
export const mindMapAIService = new MindMapAIService();