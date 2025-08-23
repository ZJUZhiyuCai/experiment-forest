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
  model?: string; // 添加可选的模型字段
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