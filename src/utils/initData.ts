import { projectService } from '@/lib/storage';

// 初始化示例课题数据
export const initSampleData = () => {
  const existingProjects = projectService.getAll();
  
  // 如果已经有课题数据，就不需要初始化了
  if (existingProjects.length > 0) {
    return;
  }
  
  console.log('正在初始化示例课题数据...');
  
  // 创建示例课题
  const sampleProjects = [
    {
      title: '新型催化剂合成研究',
      description: '研究开发高效环保的新型催化剂，用于化学反应优化。本课题将探索不同金属配合物的催化性能，通过实验验证其在工业生产中的应用潜力。',
      status: 'active' as const,
      priority: 'high' as const,
      startDate: '2024-01-15',
      endDate: '2024-06-30',
      estimatedDuration: 168,
      budget: 150000,
      leader: '张教授',
      members: ['李研究员', '王博士', '刘硕士'],
      tags: ['化学', '催化剂', '材料科学'],
      objectives: [
        '合成3种新型催化剂配合物',
        '测试催化活性和选择性',
        '优化反应条件',
        '完成工业化可行性评估'
      ],
      progress: 35,
      milestones: [
        {
          id: 'milestone1',
          title: '文献调研完成',
          description: '完成相关催化剂文献的调研',
          dueDate: '2024-02-15',
          status: 'completed' as const,
          completedAt: new Date('2024-02-10')
        },
        {
          id: 'milestone2', 
          title: '催化剂合成',
          description: '完成3种催化剂的合成',
          dueDate: '2024-04-30',
          status: 'in-progress' as const
        }
      ]
    },
    {
      title: '量子点发光材料性能研究',
      description: '开展量子点发光材料的制备工艺研究，重点关注其发光效率、稳定性和色纯度。通过调控量子点的尺寸和表面修饰来优化发光性能。',
      status: 'planning' as const,
      priority: 'medium' as const,
      startDate: '2024-03-01',
      endDate: '2024-09-30',
      estimatedDuration: 214,
      budget: 120000,
      leader: '陈教授',
      members: ['赵博士', '孙研究员'],
      tags: ['量子点', '发光材料', '纳米技术'],
      objectives: [
        '制备不同尺寸的量子点',
        '表征量子点的光学性能',
        '研究表面修饰对性能的影响',
        '开发高效发光器件原型'
      ],
      progress: 10,
      milestones: [
        {
          id: 'milestone3',
          title: '实验方案设计',
          description: '完成量子点制备方案设计',
          dueDate: '2024-03-15',
          status: 'pending' as const
        }
      ]
    },
    {
      title: '生物传感器检测技术',
      description: '基于酶催化反应开发高灵敏度生物传感器，用于环境污染物和生物标志物的快速检测。项目将结合电化学和光学检测方法。',
      status: 'active' as const,
      priority: 'urgent' as const,
      startDate: '2024-02-01',
      endDate: '2024-07-31',
      estimatedDuration: 181,
      budget: 200000,
      leader: '李教授',
      members: ['周博士', '吴研究员', '马硕士', '田硕士'],
      tags: ['生物传感器', '检测技术', '生物医学'],
      objectives: [
        '设计传感器结构',
        '优化酶固定化方法',
        '建立检测标准曲线',
        '验证实际样本检测效果'
      ],
      progress: 60,
      milestones: [
        {
          id: 'milestone4',
          title: '传感器设计',
          description: '完成传感器结构设计',
          dueDate: '2024-03-01',
          status: 'completed' as const,
          completedAt: new Date('2024-02-28')
        },
        {
          id: 'milestone5',
          title: '原型制备',
          description: '制备传感器原型',
          dueDate: '2024-05-01',
          status: 'completed' as const,
          completedAt: new Date('2024-04-25')
        },
        {
          id: 'milestone6',
          title: '性能测试',
          description: '完成传感器性能测试',
          dueDate: '2024-06-30',
          status: 'in-progress' as const
        }
      ]
    }
  ];
  
  // 创建课题
  sampleProjects.forEach(projectData => {
    try {
      projectService.create(projectData);
      console.log(`创建课题成功: ${projectData.title}`);
    } catch (error) {
      console.error(`创建课题失败: ${projectData.title}`, error);
    }
  });
  
  console.log('示例课题数据初始化完成！');
};