// 实验记录类型定义 - 生命医药领域专业分类
export type ExperimentCategory = 
  // 细胞生物学实验
  | 'cell_culture'          // 细胞培养
  | 'cell_viability'        // 细胞活力检测
  | 'flow_cytometry'        // 流式细胞术
  | 'cell_transfection'     // 细胞转染
  // 分子生物学实验
  | 'pcr'                   // PCR扩增
  | 'western_blot'          // Western Blot
  | 'gene_cloning'          // 基因克隆
  | 'dna_sequencing'        // DNA测序
  | 'rna_extraction'        // RNA提取
  | 'protein_purification'  // 蛋白质纯化
  // 动物实验
  | 'animal_behavior'       // 动物行为学
  | 'animal_surgery'        // 动物手术
  | 'animal_dosing'         // 动物给药
  | 'tissue_sampling'       // 组织取样
  // 药物研发
  | 'drug_screening'        // 药物筛选
  | 'compound_synthesis'    // 化合物合成
  | 'pharmacokinetics'      // 药代动力学
  | 'toxicology'            // 毒理学研究
  | 'dose_response'         // 剂量-反应研究
  // 生化分析
  | 'elisa'                 // ELISA检测
  | 'chromatography'        // 色谱分析
  | 'mass_spectrometry'     // 质谱分析
  | 'immunohistochemistry'  // 免疫组化
  // 微生物学
  | 'bacterial_culture'     // 细菌培养
  | 'antimicrobial_test'    // 抗菌试验
  | 'sterility_test'        // 无菌检验
  // 其他
  | 'other';

export interface ExperimentRecord {
  id: string;
  title: string;
  date: string;
  content: string;
  status: 'draft' | 'completed' | 'archived';
  category: ExperimentCategory;
  subCategory?: string;         // 子分类，用于更细致的分类
  methodology?: string;         // 实验方法学
  equipment?: string[];         // 使用的设备仪器
  reagents?: string[];          // 使用的试剂
  sampleType?: string;          // 样本类型
  sampleSize?: number;          // 样本数量
  relatedSamples?: string[];    // 关联的样本ID数组
  dataFormat?: 'numerical' | 'categorical' | 'image' | 'sequence' | 'mixed'; // 数据格式
  experimentalConditions?: {    // 实验条件
    temperature?: number;
    humidity?: number;
    ph?: number;
    [key: string]: any;
  };
  qualityControl?: {            // 质量控制
    controls: string[];         // 对照组
    replicates: number;         // 重复次数
    randomization: boolean;     // 是否随机化
  };
  dataValidation?: {            // 数据验证
    isValidated: boolean;
    validationErrors?: string[];
    validationDate?: Date;
  };
  tags: string[];
  projectId?: string; // 关联的课题ID
  createdAt: Date;
  updatedAt: Date;
}

// 实验笔记类型定义
export interface ExperimentNote {
  id: string;
  title: string;
  relatedRecordId?: string;
  projectId?: string; // 关联的课题ID
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

// SOP文档类型定义
export interface SOP {
  id: string;
  title: string;
  version: string;
  author: string;
  department: string;
  category: string;
  purpose: string;
  scope: string;
  content: string;
  approvalStatus: 'draft' | 'pending' | 'approved' | 'rejected';
  references: string;
  lastUpdated: Date;
  projectId?: string; // 关联的课题ID
}

// 课题状态类型
export type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed' | 'archived';

// 课题优先级类型
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';

// 课题类型定义（扩展版）
export interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate: string;
  endDate?: string;
  estimatedDuration?: number; // 预计持续时间（天）
  progress: number; // 进度百分比 0-100
  budget?: number; // 预算
  leader: string; // 课题负责人
  members: string[]; // 参与成员
  tags: string[]; // 标签
  objectives: string[]; // 课题目标
  milestones: ProjectMilestone[]; // 里程碑
  createdAt: Date;
  updatedAt: Date;
}

// 课题里程碑
export interface ProjectMilestone {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  status: 'pending' | 'in-progress' | 'completed' | 'overdue';
  completedAt?: Date;
}

// 实验计划类型
export interface ExperimentPlan {
  id: string;
  title: string;
  description: string;
  projectId: string; // 关联的课题ID
  plannedDate: string; // 计划执行日期
  plannedTime?: string; // 计划执行时间
  duration?: number; // 预计持续时间（小时）
  category: ExperimentCategory;
  priority: 'low' | 'medium' | 'high';
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'postponed';
  requiredResources: string[]; // 所需资源
  notes?: string; // 备注
  assignedTo?: string; // 负责人
  relatedRecordId?: string; // 关联的实验记录ID（执行后）
  createdAt: Date;
  updatedAt: Date;
}

// 课题统计信息
export interface ProjectStats {
  projectId: string;
  totalRecords: number;
  totalNotes: number;
  totalSOPs: number;
  totalPlans: number;
  completedRecords: number;
  completedPlans: number;
  progressPercentage: number;
}

// AI设置类型定义
export interface AISettings {
  apiEndpoint: string;
  apiKey: string;
  useCustomAPI: boolean;
  model?: string; // 可选的模型字段，留空时使用默认模型
  systemPrompt?: string; // 可选的系统提示词，用于自定义Agent
}

// 数据标准化相关类型定义
export interface DataValidationRule {
  field: string;
  type: 'required' | 'numeric' | 'range' | 'pattern' | 'custom';
  value?: any;
  message: string;
}

export interface ExperimentDataStandard {
  category: ExperimentCategory;
  requiredFields: string[];
  validationRules: DataValidationRule[];
  dataFormat: {
    template?: string;
    units?: { [key: string]: string };
    ranges?: { [key: string]: { min: number; max: number } };
  };
}

// 常用SOP模板类型定义
export interface SOPTemplate {
  id: string;
  title: string;
  category: ExperimentCategory;
  version: string;
  author: string;
  department: string;
  purpose: string;
  scope: string;
  content: string;
  isTemplate: boolean;
  templateTags: string[];
}

// 样本管理相关类型定义

// 样本类型
export type SampleType = 
  | 'biological'         // 生物样本
  | 'chemical'           // 化学样本
  | 'reagent'            // 试剂
  | 'standard'           // 标准品
  | 'control'            // 对照品
  | 'other';             // 其他

// 样本状态
export type SampleStatus = 
  | 'available'          // 可用
  | 'in_use'             // 使用中
  | 'exhausted'          // 已用完
  | 'expired'            // 已过期
  | 'contaminated'       // 已污染
  | 'reserved';          // 已预留

// 存储条件
export type StorageCondition = 
  | 'room_temperature'   // 室温
  | 'refrigerated'       // 冷藏(4°C)
  | 'frozen_minus_20'    // 冷冻(-20°C)
  | 'frozen_minus_80'    // 超低温(-80°C)
  | 'liquid_nitrogen'    // 液氮
  | 'desiccated';        // 干燥

// 样本记录接口
export interface Sample {
  id: string;
  sampleId: string;           // 样本编号（用户自定义）
  name: string;               // 样本名称
  type: SampleType;           // 样本类型
  status: SampleStatus;       // 当前状态
  
  // 来源信息
  source?: {
    donorId?: string;         // 供体编号
    donorAge?: string;        // 年龄
    donorGender?: 'male' | 'female' | 'unknown'; // 性别
    species?: string;         // 物种
    tissueType?: string;      // 组织类型
    cellLine?: string;        // 细胞系
    collectionDate?: string;  // 采集日期
    collectionMethod?: string; // 采集方法
  };
  
  // 量体信息
  quantity?: {
    volume?: string;          // 体积
    volumeUnit?: string;      // 体积单位
    concentration?: string;   // 浓度
    concentrationUnit?: string; // 浓度单位
    weight?: string;          // 重量
    weightUnit?: string;      // 重量单位
  };
  
  // 存储信息
  storage?: {
    condition?: StorageCondition; // 存储条件
    location?: string;        // 存储位置
    container?: string;       // 容器编号
    containerType?: string;   // 容器类型
  };
  
  // 日期信息
  dates?: {
    receivedDate?: string;    // 接收日期
    expiryDate?: string;      // 过期日期
    lastAccessDate?: string;  // 最后访问日期
  };
  
  // 质量控制
  qualityControl?: {
    purity?: string;          // 纯度（%）
    purityMethod?: string;    // 纯度检测方法
    sterility?: boolean;      // 是否无菌
    endotoxin?: string;       // 内毒素含量
    viability?: string;       // 细胞活力（%）
  };
  
  // 关联信息
  projectId?: string;         // 关联项目
  tags?: string[];            // 标签
  notes?: string;             // 备注
  
  // 系统信息
  createdAt: string;          // 创建日期
  updatedAt: string;          // 更新日期
}

// 样本操作历史记录
export interface SampleHistory {
  id: string;
  sampleId: string;           // 关联的样本 ID
  actionType: 'created' | 'updated' | 'used' | 'moved' | 'status_changed'; // 操作类型
  description: string;        // 操作描述
  userId?: string;            // 操作人 ID
  experimentId?: string;      // 关联的实验 ID
  changes?: any;              // 变更详情
  timestamp: string;          // 操作时间
}

// 样本统计信息
export interface SampleStats {
  totalSamples: number;
  availableSamples: number;
  expiringSoon: number;       // 30天内过期
  lowVolume: number;          // 低存量样本
  byType: { [key in SampleType]?: number };
  byStatus: { [key in SampleStatus]?: number };
  byStorageCondition: { [key in StorageCondition]?: number };
}

// ============================================
// AI聊天功能相关类型定义
// ============================================

// 聊天消息角色类型
export type ChatRole = 'user' | 'assistant' | 'system';

// 聊天上下文类型
export interface ChatContext {
  experimentType?: ExperimentCategory;  // 当前实验类型
  projectId?: string;                   // 当前项目ID
  recordId?: string;                    // 当前实验记录ID
  sopId?: string;                       // 当前SOP文档ID
  sampleId?: string;                    // 当前样本ID
  pageContext?: string;                 // 页面上下文
}

// 聊天附件类型
export interface ChatAttachment {
  type: 'record' | 'sop' | 'sample' | 'project' | 'file';
  id: string;
  name: string;
  url?: string;
  size?: number;
  previewData?: any;                    // 预览数据
}

// 聊天消息类型
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: Date;
  context?: ChatContext;                // 消息上下文
  attachments?: ChatAttachment[];       // 附件列表
  isTyping?: boolean;                   // 是否正在输入
  error?: string;                       // 错误信息
  suggestions?: string[];               // AI建议回复
}

// 聊天会话类型
export interface ChatSession {
  id: string;
  title: string;
  description?: string;
  messages: ChatMessage[];
  projectId?: string;                   // 关联项目
  experimentType?: ExperimentCategory;  // 主要实验类型
  tags?: string[];                      // 会话标签
  isActive: boolean;                    // 是否活跃
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date;                 // 最后消息时间
}

// AI助手配置类型
export interface AIAssistantConfig {
  model: string;                        // AI模型名称
  temperature: number;                  // 创造性参数 0-1
  maxTokens: number;                    // 最大token数
  systemPrompt: string;                 // 系统提示词
  experimentPrompts: {                  // 实验类型特定提示词
    [key in ExperimentCategory]?: string;
  };
  features: {                           // 功能开关
    experimentAdvice: boolean;          // 实验建议
    literatureSearch: boolean;          // 文献搜索
    dataAnalysis: boolean;              // 数据分析
    sopGeneration: boolean;             // SOP生成
    protocolOptimization: boolean;      // 协议优化
  };
}

// AI分析结果类型
export interface AIAnalysisResult {
  type: 'experiment_advice' | 'data_analysis' | 'literature_recommendation' | 'sop_optimization';
  title: string;
  content: string;
  confidence: number;                   // 置信度 0-1
  suggestions: string[];                // 具体建议
  references?: string[];                // 参考文献
  relatedData?: any;                    // 相关数据
  timestamp: Date;
}

// ============================================
// 思维导图功能相关类型定义
// ============================================

// 思维导图节点类型
export type MindMapNodeType = 
  | 'project'           // 项目节点
  | 'experiment'        // 实验节点
  | 'sample'            // 样本节点
  | 'sop'               // SOP节点
  | 'note'              // 笔记节点
  | 'milestone'         // 里程碑节点
  | 'resource'          // 资源节点
  | 'analysis'          // 分析节点
  | 'custom';           // 自定义节点

// 节点形状类型
export type NodeShape = 'rectangle' | 'circle' | 'diamond' | 'ellipse' | 'hexagon';

// 边连接类型
export type EdgeType = 
  | 'relation'          // 关联关系
  | 'flow'              // 流程关系
  | 'dependency'        // 依赖关系
  | 'hierarchy'         // 层级关系
  | 'temporal'          // 时间关系
  | 'causal';           // 因果关系

// 思维导图节点
export interface MindMapNode {
  id: string;
  title: string;
  content?: string;
  type: MindMapNodeType;
  
  // 位置和样式
  position: { x: number; y: number };
  size: { width: number; height: number };
  style: {
    color: string;                      // 背景色
    borderColor: string;                // 边框色
    textColor: string;                  // 文字色
    shape: NodeShape;                   // 节点形状
    icon?: string;                      // 图标
    fontSize?: number;                  // 字体大小
    borderWidth?: number;               // 边框宽度
  };
  
  // 数据关联
  relatedId?: string;                   // 关联的实际数据ID
  relatedType?: 'project' | 'experiment' | 'sample' | 'sop' | 'note';
  
  // 节点元数据
  level?: number;                       // 层级深度
  isCollapsed?: boolean;                // 是否折叠
  children?: string[];                  // 子节点ID列表
  parent?: string;                      // 父节点ID
  
  // 系统信息
  createdAt: Date;
  updatedAt: Date;
}

// 思维导图边
export interface MindMapEdge {
  id: string;
  source: string;                       // 源节点ID
  target: string;                       // 目标节点ID
  label?: string;                       // 边标签
  type: EdgeType;                       // 连接类型
  
  // 样式设置
  style: {
    color: string;                      // 线条颜色
    width: number;                      // 线条粗细
    strokeType: 'solid' | 'dashed' | 'dotted'; // 线条样式
    arrow: boolean;                     // 是否显示箭头
    arrowSize?: number;                 // 箭头大小
    curved?: boolean;                   // 是否弯曲
  };
  
  // 数据关联
  relatedData?: any;                    // 关联数据
  
  // 系统信息
  createdAt: Date;
  updatedAt: Date;
}

// 思维导图
export interface MindMap {
  id: string;
  title: string;
  description?: string;
  
  // 图谱数据
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  
  // 布局设置
  layout: {
    type: 'force' | 'hierarchy' | 'radial' | 'grid' | 'manual'; // 布局类型
    direction?: 'horizontal' | 'vertical';   // 布局方向
    spacing?: { x: number; y: number };      // 节点间距
    centerNode?: string;                     // 中心节点ID
  };
  
  // 视图设置
  viewport: {
    zoom: number;                            // 缩放级别
    center: { x: number; y: number };        // 视图中心
    bounds: {                                // 视图边界
      minX: number; maxX: number;
      minY: number; maxY: number;
    };
  };
  
  // 关联信息
  projectId?: string;                        // 关联项目
  type: 'project_overview' | 'experiment_flow' | 'data_relations' | 'custom'; // 图谱类型
  
  // 协作信息
  createdBy: string;                         // 创建者
  collaborators?: string[];                  // 协作者列表
  isPublic: boolean;                         // 是否公开
  
  // 版本信息
  version: number;                           // 版本号
  tags?: string[];                           // 标签
  
  // 系统信息
  createdAt: Date;
  updatedAt: Date;
  lastViewedAt?: Date;                       // 最后查看时间
}

// 思维导图模板
export interface MindMapTemplate {
  id: string;
  name: string;
  description: string;
  category: 'project' | 'experiment' | 'analysis' | 'workflow' | 'general';
  
  // 模板数据
  templateNodes: Omit<MindMapNode, 'id' | 'relatedId' | 'createdAt' | 'updatedAt'>[];
  templateEdges: Omit<MindMapEdge, 'id' | 'source' | 'target' | 'createdAt' | 'updatedAt'>[];
  
  // 应用设置
  applicableTypes?: ExperimentCategory[];    // 适用的实验类型
  autoGenerate?: boolean;                    // 是否支持自动生成
  
  // 模板信息
  author: string;
  version: string;
  downloadCount: number;
  rating: number;                            // 评分 1-5
  isBuiltIn: boolean;                        // 是否内置模板
  
  createdAt: Date;
  updatedAt: Date;
}

// 思维导图操作历史
export interface MindMapHistory {
  id: string;
  mindMapId: string;
  actionType: 'create' | 'update' | 'delete' | 'move' | 'style_change' | 'layout_change';
  targetType: 'node' | 'edge' | 'layout' | 'viewport';
  targetId?: string;
  oldValue?: any;
  newValue?: any;
  userId: string;
  timestamp: Date;
}

// 思维导图统计信息
export interface MindMapStats {
  totalMaps: number;
  totalNodes: number;
  totalEdges: number;
  mapsByType: { [key: string]: number };
  averageNodesPerMap: number;
  mostUsedNodeTypes: { type: MindMapNodeType; count: number }[];
  recentActivity: {
    created: number;
    updated: number;
    viewed: number;
  };
}