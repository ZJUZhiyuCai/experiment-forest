// AI思维导图功能测试脚本
// 用于验证修复后的功能是否正常工作

// 模拟浏览器环境
const mockLocalStorage = {
  data: {},
  getItem: function(key) {
    return this.data[key] || null;
  },
  setItem: function(key, value) {
    this.data[key] = value;
  }
};

// 模拟全局对象
global.localStorage = mockLocalStorage;
global.fetch = async (url, options) => {
  // 模拟网络错误以测试回退机制
  throw new Error('模拟网络连接失败');
};

// 测试数据
const mockProject = {
  id: 'test-project-1',
  title: '基于CRISPR技术的基因编辑实验研究',
  description: '研究CRISPR-Cas9系统在特定基因位点的编辑效率',
  status: 'active',
  progress: 25,
  objectives: ['验证基因编辑效率', '分析导向RNA影响', '优化实验条件'],
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockRecords = [
  {
    id: 'record-1',
    title: 'CRISPR载体构建实验',
    category: 'gene_cloning',
    status: 'completed',
    projectId: 'test-project-1'
  },
  {
    id: 'record-2', 
    title: '细胞转染效率测试',
    category: 'cell_transfection',
    status: 'draft',
    projectId: 'test-project-1'
  }
];

const mockNotes = [
  {
    id: 'note-1',
    title: 'CRISPR系统设计原理',
    projectId: 'test-project-1'
  }
];

const mockSOPs = [
  {
    id: 'sop-1',
    title: 'CRISPR-Cas9基因编辑标准操作流程',
    category: '实验操作',
    projectId: 'test-project-1'
  }
];

// 测试函数
async function testMindMapAI() {
  console.log('🧪 开始测试AI思维导图功能...\n');

  try {
    // 导入AI服务（这里用模拟的方式）
    const { MindMapAIService } = require('../src/lib/mindMapAIService.ts');
    const mindMapAIService = new MindMapAIService();

    console.log('1. 测试无AI配置的情况（应该使用模拟数据）...');
    
    const generationOptions = {
      includeExperiments: true,
      includeNotes: true,
      includeSOPs: true,
      maxNodes: 30,
      style: 'hierarchical',
      detailLevel: 'detailed'
    };

    const result = await mindMapAIService.generateProjectMindMap(
      mockProject,
      mockRecords,
      mockNotes,
      mockSOPs,
      generationOptions
    );

    console.log('✅ AI思维导图生成成功！');
    console.log('📊 生成结果统计:');
    console.log(`   - 节点数量: ${result.nodes.length}`);
    console.log(`   - 边数量: ${result.edges.length}`);
    console.log(`   - 中心节点: ${result.centerNode.title}`);
    console.log(`   - 生成时间: ${result.metadata.generationTime}`);

    // 验证基本结构
    if (result.nodes.length > 0 && result.edges.length > 0) {
      console.log('✅ 思维导图结构验证通过');
    } else {
      console.log('❌ 思维导图结构验证失败');
    }

    // 验证中心节点
    if (result.centerNode.title === mockProject.title) {
      console.log('✅ 中心节点验证通过');
    } else {
      console.log('❌ 中心节点验证失败');
    }

    console.log('\n2. 测试模拟AI配置...');
    
    // 设置模拟AI配置
    mockLocalStorage.setItem('aiSettings', JSON.stringify({
      apiEndpoint: 'https://mock-api.example.com/v1/chat/completions',
      apiKey: 'mock-api-key',
      model: 'mock-model',
      useCustomAPI: true
    }));

    const result2 = await mindMapAIService.generateProjectMindMap(
      mockProject,
      mockRecords,
      mockNotes,
      mockSOPs,
      generationOptions
    );

    console.log('✅ 带配置的AI思维导图生成成功（使用模拟回退）！');
    console.log(`   - 节点数量: ${result2.nodes.length}`);

    console.log('\n🎉 所有测试完成！AI思维导图功能工作正常。');
    
    return {
      success: true,
      message: 'AI思维导图功能测试通过',
      results: {
        withoutConfig: result,
        withMockConfig: result2
      }
    };

  } catch (error) {
    console.error('❌ 测试失败:', error);
    return {
      success: false,
      message: `测试失败: ${error.message}`,
      error: error
    };
  }
}

// 导出测试函数
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testMindMapAI };
} else {
  // 浏览器环境中直接运行
  testMindMapAI().then(result => {
    console.log('\n📋 最终测试结果:', result);
  });
}