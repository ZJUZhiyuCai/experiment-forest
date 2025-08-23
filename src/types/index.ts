// 实验记录类型定义
export type ExperimentCategory = 'cell' | 'animal' | 'chemical' | 'microbiology' | 'other';

export interface ExperimentRecord {
  id: string;
  title: string;
  date: string;
  content: string;
  status: 'draft' | 'completed' | 'archived';
  category: ExperimentCategory;
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
}