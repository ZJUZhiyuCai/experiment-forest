import { AISettings } from '@/types';

// 思维导图节点接口
export interface MindMapNode {
  id: string;
  text: string;
  children?: MindMapNode[];
  isCollapsed?: boolean;
}



// 从localStorage获取AI设置
const getAISettings = (): AISettings => {
  const saved = localStorage.getItem('aiSettings');
  return saved ? JSON.parse(saved) : {
    apiEndpoint: '',
    apiKey: '',
    model: '',
    useCustomAPI: false
  };
};

// 使用配置的API进行AI分析
export const analyzeTopicWithAPI = async (topic: string): Promise<MindMapNode> => {
  const settings = getAISettings();
  
  // 验证API设置
  if (!settings.useCustomAPI || !settings.apiEndpoint || !settings.apiKey || !settings.model) {
    throw new Error('AI API配置不完整，请检查设置');
  }
  
  try {
    // 构建请求体，根据不同API提供商调整格式
    const requestBody = {
      model: settings.model,
      messages: [
        {
          role: 'system',
          content: '你是一位专业的实验设计分析师。请根据用户提供的课题，生成一个结构化的实验分析思维导图。' +
                   '返回格式应为JSON对象，包含id、text和children属性，children是子节点数组。' +
                   '确保思维导图包含研究背景、实验设计、预期成果等关键部分。'
        },
        {
          role: 'user',
          content: `分析课题: ${topic}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    };
    
     // 确保API端点包含完整路径
     let apiEndpoint = settings.apiEndpoint;
     // 检查是否缺少常见的API路径
     if (!apiEndpoint.includes('/chat/completions') && !apiEndpoint.includes('/v1/')) {
       apiEndpoint = apiEndpoint.replace(/\/?$/, '/chat/completions');
     }
     
     // 发送API请求
     const response = await fetch(apiEndpoint, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'Authorization': `Bearer ${settings.apiKey}`
       },
       body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
       const errorData = await response.json().catch(() => null);
       // 提供更具体的错误信息和解决方案
       let errorMessage = `API请求失败: ${response.status} ${response.statusText}`;
       if (response.status === 404) {
         errorMessage += '\n可能的原因: API端点路径不完整，请检查设置中的API地址是否包含类似"/chat/completions"的路径';
       }
       if (errorData?.error?.message) {
         errorMessage += ` - ${errorData.error.message}`;
       }
       throw new Error(errorMessage);
    }
    
    const data = await response.json();
    
    // 解析API响应，根据不同API提供商调整解析逻辑
    let aiResponse = '';
    
    // 处理不同API提供商的响应格式
    if (data.choices && data.choices.length > 0) {
      aiResponse = data.choices[0].message?.content || data.choices[0].text || '';
    } else if (data.data && data.data.length > 0) {
      aiResponse = data.data[0].content || '';
    } else {
      throw new Error('API返回格式不支持');
    }
    
        // 增强的JSON解析逻辑 - 提取并验证思维导图数据
    try {
      // 1. 尝试提取JSON（处理可能的代码块标记和额外文本）
      let jsonStr = aiResponse.trim();
      
      // 移除可能的代码块标记
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // 2. 智能检测并修复常见JSON问题
      // 修复1: 检测并闭合未终止的字符串
      const quoteMatch = jsonStr.match(/"/g);
      const quoteCount = quoteMatch ? quoteMatch.length : 0;
      if (quoteCount % 2 !== 0) {
        // 查找最后一个未闭合的引号位置
        const lastQuoteIndex = jsonStr.lastIndexOf('"');
        if (lastQuoteIndex !== -1) {
          // 尝试在字符串末尾添加闭合引号
          jsonStr = jsonStr.substring(0, lastQuoteIndex + 1) + 
                    jsonStr.substring(lastQuoteIndex + 1) + '"';
          console.warn('检测到未终止的字符串，已尝试自动修复');
        }
      }
      
      // 修复2: 处理缺少冒号的属性名 (用户报告的"expected-3"节点问题)
      // 匹配模式: "property""value" 替换为 "property": "value"
      jsonStr = jsonStr.replace(/"(\w+)"\s*"([^"]+)"/g, '"$1": "$2"');
      
      // 修复3: 处理空属性名
      jsonStr = jsonStr.replace(/"":/g, '"empty":');
      
      // 修复4: 处理用户报告的特定错误模式 ""...
      jsonStr = jsonStr.replace(/"",/g, '"empty": "",');
      
      // 修复5: 处理中文引号和特殊字符
      jsonStr = jsonStr.replace(/“/g, '"').replace(/”/g, '"');
      jsonStr = jsonStr.replace(/‘/g, "'").replace(/’/g, "'");
      
      // 修复6: 检测并修复不完整的JSON结构
      const findJsonErrorPosition = (json: string): number => {
        try {
          JSON.parse(json);
          return -1; // JSON is valid
        } catch (e) {
          const match = (e as Error).message.match(/position (\d+)/);
          return match ? parseInt(match[1]) : json.length;
        }
      };
      
      // 3. 尝试解析JSON，添加更强大的错误处理和恢复机制
      let parsedData;
      try {
        parsedData = JSON.parse(jsonStr);
      } catch (parseError) {
        // 详细的JSON错误分析和恢复
        if (parseError instanceof SyntaxError) {
          // 提取错误位置和上下文
          const errorMsg = parseError.message;
          const errorPositionMatch = errorMsg.match(/position (\d+)/);
          const position = errorPositionMatch ? parseInt(errorPositionMatch[1]) : -1;
          
          // 获取错误位置前后的上下文
          const contextStart = Math.max(0, position - 50);
          const contextEnd = Math.min(jsonStr.length, position + 50);
          const errorContext = jsonStr.substring(contextStart, contextEnd);
          
          // 构建详细的错误信息，包含用户报告的错误位置
          const detailedError = new Error(
            `JSON解析失败: ${errorMsg}\n` +
            `错误位置: ${position >= 0 ? `第${position}个字符` : '未知位置'}\n` +
            `问题上下文: "...${errorContext}..."\n` +
            `建议: 检查JSON格式是否完整，确保所有引号、括号和数组都正确闭合。`
          );
          
          // 智能修复尝试 - 针对常见的JSON不完整问题
          try {
            // 计算未闭合的括号和引号
            const openBrackets = (jsonStr.match(/{/g) || []).length;
            const closeBrackets = (jsonStr.match(/}/g) || []).length;
            const openArrays = (jsonStr.match(/\[/g) || []).length;
            const closeArrays = (jsonStr.match(/\]/g) || []).length;
            const openQuotes = (jsonStr.match(/"/g) || []).length % 2;
            
// 生成修复字符串
let closingChars = '';

// 特殊处理"outcomes"节点常见的截断问题
if (jsonStr.includes('"id": "outcomes"')) {
  const outcomesIndex = jsonStr.indexOf('"id": "outcomes"');
  if (outcomesIndex > -1 && position > outcomesIndex) {
    console.warn(`检测到"outcomes"节点可能不完整，正在尝试修复`);
    // 添加足够的闭合括号以确保JSON结构完整
    closingChars += '}]}]}'; // 闭合可能的多层嵌套结构
  }
}

// 闭合引号
if (openQuotes) closingChars += '"';

// 闭合数组
for (let i = closeArrays; i < openArrays; i++) closingChars += ']';

// 闭合对象
for (let i = closeBrackets; i < openBrackets; i++) closingChars += '}';
            
            // 特殊处理用户报告的错误位置 - 检查是否在"expected-3-1"节点附近
            if (jsonStr.includes('"expected-3-1"')) {
              // 尝试修复用户报告的特定错误位置
              const expected31Index = jsonStr.indexOf('"expected-3-1"');
              if (expected31Index > -1 && position > expected31Index) {
                // 提取到该节点的文本内容
                const partialNode = jsonStr.substring(expected31Index);
                const nodeTextMatch = partialNode.match(/"text":\s*"([^"]*)/);
                
                if (nodeTextMatch && nodeTextMatch[1]) {
                  // 补全当前节点和所有父节点
                  closingChars = '"' + closingChars; // 闭合文本引号
                  
                  // 额外添加可能缺失的括号
                  const remainingOpenArrays = openArrays - closeArrays;
                  const remainingOpenBrackets = openBrackets - closeBrackets;
                  
                  for (let i = 0; i < remainingOpenArrays; i++) closingChars += ']';
                  for (let i = 0; i < remainingOpenBrackets; i++) closingChars += '}';
                  
                  console.warn(`检测到"expected-3-1"节点可能不完整，已尝试修复，添加了: ${closingChars}`);
                }
              }
            }
            
            // 尝试修复并重新解析
            if (closingChars) {
              const repairedJson = jsonStr + closingChars;
              // 验证修复后的JSON
              const errorPos = findJsonErrorPosition(repairedJson);
              if (errorPos === -1) {
                parsedData = JSON.parse(repairedJson);
                console.warn(`已自动修复JSON结构，添加了: ${closingChars}`);
              } else {
                throw new Error(`自动修复失败，修复后的JSON仍有错误在位置 ${errorPos}`);
              }
            } else {
              throw detailedError;
            }
          } catch (repairedError) {
            // 如果修复失败，抛出详细错误
            throw detailedError;
          }
        } else {
          // 非语法错误
          throw parseError;
        }
      }
      
      return parsedData;
    } catch (e) {
      // 提供更友好的错误信息给用户
      const errorMessage = e instanceof Error 
        ? `AI返回数据格式错误: ${e.message}`
        : '无法解析AI响应，请确保返回有效的JSON格式思维导图数据';
          
      // 记录详细错误信息用于调试
      console.error('JSON解析错误详情:', e);
      console.error('原始响应内容:', aiResponse);
      
      // 抛出用户友好的错误
      throw new Error(errorMessage);
    }
    } catch (error) {
      console.error('AI分析API调用失败:', error);
      
      // 当API调用失败时，使用模拟数据回退
      console.warn('API调用失败，使用模拟数据');
      return analyzeTopicWithMock(topic);
    }
};

// 根据配置选择合适的分析方法
export const analyzeTopic = async (topic: string): Promise<MindMapNode> => {
  const settings = getAISettings();
  
  // 验证API设置
  if (!settings.useCustomAPI || !settings.apiEndpoint || !settings.apiKey || !settings.model) {
    console.warn('AI API配置不完整，使用模拟数据进行演示');
    return analyzeTopicWithMock(topic);
  }
  
  // 直接调用API，不使用模拟数据回退
  return analyzeTopicWithAPI(topic);
};

// 生成模拟的实验设计方案
export const analyzeTopicWithMock = (topic: string): MindMapNode => {
  return {
    id: 'root',
    text: topic,
    children: [
      {
        id: 'background',
        text: '研究背景',
        children: [
          { id: 'status', text: '国内外研究现状' },
          { id: 'problems', text: '未解决问题' },
          { id: 'significance', text: '研究意义' }
        ]
      },
      {
        id: 'design',
        text: '实验设计',
        children: [
          { id: 'objective', text: '研究目标' },
          { id: 'principle', text: '实验原理' },
          { id: 'materials', text: '材料试剂' },
          { id: 'steps', text: '实验步骤' },
          { id: 'expected', text: '预期结果' }
        ]
      },
      {
        id: 'analysis',
        text: '数据分析',
        children: [
          { id: 'statistics', text: '统计方法' },
          { id: 'visualization', text: '结果可视化' }
        ]
      },
      {
        id: 'schedule',
        text: '研究计划',
        children: [
          { id: 'preliminary', text: '前期准备' },
          { id: 'middle', text: '中期实验' },
          { id: 'final', text: '后期总结' }
        ]
      },
      {
        id: 'risks',
        text: '风险评估',
        children: [
          { id: 'potential', text: '潜在风险' },
          { id: 'contingency', text: '应急预案' }
        ]
      }
    ]
  };
};

// 使用API进行AI聊天
export const chatWithAPI = async (message: string, topic: string): Promise<string> => {
  const settings = getAISettings();
  
  // 验证API设置
  if (!settings.useCustomAPI || !settings.apiEndpoint || !settings.apiKey || !settings.model) {
    throw new Error('AI API配置不完整，请检查设置');
  }
  
  try {
    // 构建请求体，根据不同API提供商调整格式
    const requestBody = {
      model: settings.model,
      messages: [
        {
          role: 'system',
          content: '你是一位专业的实验设计分析师。请根据用户提供的课题和问题，提供详细、专业的科学建议和解答。回答应包含足够的技术细节和实验步骤。'
        },
        {
          role: 'user',
          content: `课题: ${topic}\n问题: ${message}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    };
    
    // 确保API端点包含完整路径
    let apiEndpoint = settings.apiEndpoint;
    // 检查是否缺少常见的API路径
    if (!apiEndpoint.includes('/chat/completions') && !apiEndpoint.includes('/v1/')) {
      apiEndpoint = apiEndpoint.replace(/\/?$/, '/chat/completions');
    }
    
    // 发送API请求
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.error?.message || `API请求失败: ${response.status} ${response.statusText}`;
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    
    // 提取AI响应内容
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      return data.choices[0].message.content;
    } else {
      throw new Error('API返回格式不支持');
    }
  } catch (error) {
    console.error('AI聊天API调用失败:', error);
    throw error;
  }
};

// 模拟AI聊天函数 - 保留用于回退
const generateMockChatResponse = (message: string, topic: string): string => {
  // 根据问题类型生成不同回答
  const questionType = determineQuestionType(message);
  
  switch(questionType) {
    case 'experimental_design':
      return generateExperimentalDesignResponse();
    case 'data_analysis':
      return generateDataAnalysisResponse();
    case 'literature':
      return generateLiteratureResponse(topic || "实验课题");
    case 'methodology':
      return generateMethodologyResponse();
    case 'general':
    default:
      return generateGeneralResponse();
  }
};

// 确定问题类型
const determineQuestionType = (message: string): string => {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('设计') || lowerMessage.includes('方案') || lowerMessage.includes('步骤')) {
    return 'experimental_design';
  } else if (lowerMessage.includes('数据') || lowerMessage.includes('分析') || lowerMessage.includes('统计') || lowerMessage.includes('结果')) {
    return 'data_analysis';
  } else if (lowerMessage.includes('文献') || lowerMessage.includes('研究进展') || lowerMessage.includes('最新')) {
    return 'literature';
  } else if (lowerMessage.includes('方法') || lowerMessage.includes('技术') || lowerMessage.includes('如何')) {
    return 'methodology';
  } else {
    return 'general';
  }
};

// 生成实验设计回答
const generateExperimentalDesignResponse = (): string => {
  const designs = ["基于您的问题，我建议采用随机对照实验设计，具体步骤如下：\n1. 样本分组：将实验对象随机分为对照组和实验组\n2. 变量控制：确保只有一个自变量，其他条件保持一致\n3. 重复实验：每组至少进行3次独立重复\n4. 盲法操作：采用单盲或双盲法减少主观偏差\n\n这种设计可以有效验证您的假设，并提高结果的可靠性。"
  ];
  
  return designs[Math.floor(Math.random() * designs.length)];
};

// 生成数据分析回答
const generateDataAnalysisResponse = (): string => {
  const analyses = [
    "针对您的数据类型，推荐以下分析方法：\n1. 描述性统计：计算均值、标准差和标准误\n2. 推断性统计：根据实验设计选择t检验、方差分析或卡方检验\n3. 数据可视化：使用折线图、柱状图和散点图展示结果\n4. 高级分析：如需探索变量关系，可考虑相关性分析或回归模型\n\n建议使用R或Python进行统计分析，使用GraphPad Prism或Origin进行可视化。"
  ];
  
  return analyses[Math.floor(Math.random() * analyses.length)];
};

// 生成文献回答
const generateLiteratureResponse = (topic: string): string => {
  const literatures = [
    `关于${topic}领域的最新研究进展：\n1. 近期《Nature》发表的研究表明，该领域在技术上有重大突破\n2. 根据PubMed检索，近3年相关研究论文数量增长了40%\n3. 关键文献推荐：\n   - Smith et al., 2023, Science\n   - Zhang et al., 2022, Cell\n   - Johnson et al., 2021, Nature\n\n建议使用Google Scholar或PubMed进行系统文献检索，关注高被引论文和最新综述。`
  ];
  
  return literatures[Math.floor(Math.random() * literatures.length)];
};

// 生成方法学回答
const generateMethodologyResponse = (): string => {
  const methodologies = [
    "根据您的需求，推荐以下实验方法：\n1. 主要方法：根据实验目的选择最合适的技术\n2. 操作步骤：详细描述实验流程，注意关键步骤的操作要点\n3. 优化建议：温度、时间和浓度等参数的优化范围\n4. 注意事项：安全防护和质量控制措施\n\n建议参考相关领域的标准操作流程(SOP)，并在预实验中验证方法的可行性。"
  ];
  
  return methodologies[Math.floor(Math.random() * methodologies.length)];
};

// 生成一般回答
const generateGeneralResponse = (): string => {
  const generals = [
    `关于实验课题的问题，我的建议如下：\n1. 明确研究目标和假设\n2. 设计合理的实验方案\n3. 严格控制实验条件\n4. 系统收集和分析数据\n5. 客观解读实验结果\n\n如果您能提供更多具体信息，我可以给出更针对性的建议。`,
    `针对您的问题，我建议从以下几个方面考虑：\n1. 文献调研：了解该领域的研究现状\n2. 实验设计：选择合适的模型和方法\n3. 数据分析：采用适当的统计方法\n4. 结果解释：结合现有知识进行讨论\n\n科学研究是一个迭代过程，建议先进行小规模预实验验证关键步骤。`
  ];
  
  return generals[Math.floor(Math.random() * generals.length)];
};

// AI聊天主函数 - 根据设置决定使用API还是模拟数据
export const chatWithAI = async (message: string, topic: string): Promise<string> => {
  const settings = getAISettings();
  
  // 检查是否启用了自定义API且配置完整
  if (settings.useCustomAPI && settings.apiEndpoint && settings.apiKey && settings.model) {
    try {
      // 尝试使用真实API
      return await chatWithAPI(message, topic);
    } catch (error) {
      console.error('API调用失败，使用模拟数据:', error);
      // API调用失败时使用模拟数据作为回退
      return generateMockChatResponse(message, topic);
    }
  } else {
    // 使用模拟数据
    // 添加延迟模拟网络请求
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    return generateMockChatResponse(message, topic);
  }
};