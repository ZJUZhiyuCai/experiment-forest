import { ExperimentRecord, ExperimentNote, SOP, Project, ExperimentPlan, ProjectStats } from '@/types';

// 生成唯一ID
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
};

// 存储键名定义
const STORAGE_KEYS = {
  EXPERIMENT_RECORDS: 'experiment_records',
  EXPERIMENT_NOTES: 'experiment_notes',
  SOPS: 'sops',
  PROJECTS: 'projects', // 更改为Projects
  EXPERIMENT_PLANS: 'experiment_plans' // 新增实验计划
};

// 实验记录存储服务
export const experimentRecordService = {
  getAll: (): ExperimentRecord[] => {
    const records = localStorage.getItem(STORAGE_KEYS.EXPERIMENT_RECORDS);
    if (!records) return [];
    
    try {
      const parsedRecords = JSON.parse(records);
      // 将字符串日期转换为Date对象
      return parsedRecords.map((record: any) => ({
        ...record,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt)
      }));
    } catch (error) {
      console.error('解析实验记录失败:', error);
      // 清除损坏的数据
      localStorage.removeItem(STORAGE_KEYS.EXPERIMENT_RECORDS);
      return [];
    }
  },
  
  getById: (id: string): ExperimentRecord | null => {
    const records = experimentRecordService.getAll();
    return records.find(record => record.id === id) || null;
  },
  
  create: (record: Omit<ExperimentRecord, 'id' | 'createdAt' | 'updatedAt'>): ExperimentRecord => {
    if (!record.title || !record.date) {
      throw new Error('实验标题和日期不能为空');
    }
    
    const now = new Date();
     const newRecord: ExperimentRecord = {
       ...record,
       id: generateId(),
       createdAt: now,
       updatedAt: now,
       projectId: record.projectId
     };
    
    try {
      const records = experimentRecordService.getAll();
      records.push(newRecord);
      
      // 将Date对象转换为ISO字符串存储
      const recordsToStore = records.map(record => ({
        ...record,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString()
      }));
      
      localStorage.setItem(STORAGE_KEYS.EXPERIMENT_RECORDS, JSON.stringify(recordsToStore));
      return newRecord;
    } catch (error) {
      console.error('创建实验记录失败:', error);
      throw new Error('创建实验记录失败，请重试');
    }
  },
  
  update: (id: string, updates: Partial<ExperimentRecord>): ExperimentRecord | null => {
    const records = experimentRecordService.getAll();
    const index = records.findIndex(record => record.id === id);
    
    if (index === -1) return null;
    
    records[index] = {
      ...records[index],
      ...updates,
      updatedAt: new Date()
    };
    
    try {
      // 将Date对象转换为ISO字符串存储
      const recordsToStore = records.map(record => ({
        ...record,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString()
      }));
      
      localStorage.setItem(STORAGE_KEYS.EXPERIMENT_RECORDS, JSON.stringify(recordsToStore));
      return records[index];
    } catch (error) {
      console.error('更新实验记录失败:', error);
      throw new Error('更新实验记录失败，请重试');
    }
  },
  
  delete: (id: string): boolean => {
    const records = experimentRecordService.getAll();
    const newRecords = records.filter(record => record.id !== id);
    
    if (records.length === newRecords.length) return false;
    
    try {
      // 将Date对象转换为ISO字符串存储
      const recordsToStore = newRecords.map(record => ({
        ...record,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString()
      }));
      
      localStorage.setItem(STORAGE_KEYS.EXPERIMENT_RECORDS, JSON.stringify(recordsToStore));
      return true;
    } catch (error) {
      console.error('删除实验记录失败:', error);
      throw new Error('删除实验记录失败，请重试');
    }
  }
};

// 实验笔记存储服务
export const experimentNoteService = {
  getAll: (): ExperimentNote[] => {
    const notes = localStorage.getItem(STORAGE_KEYS.EXPERIMENT_NOTES);
    if (!notes) return [];
    
    try {
      const parsedNotes = JSON.parse(notes);
      // 将字符串日期转换为Date对象
      return parsedNotes.map((note: any) => ({
        ...note,
        createdAt: new Date(note.createdAt),
        updatedAt: new Date(note.updatedAt)
      }));
    } catch (error) {
      console.error('解析实验笔记失败:', error);
      localStorage.removeItem(STORAGE_KEYS.EXPERIMENT_NOTES);
      return [];
    }
  },
  
  getById: (id: string): ExperimentNote | null => {
    const notes = experimentNoteService.getAll();
    return notes.find(note => note.id === id) || null;
  },
  
  getByRecordId: (recordId: string): ExperimentNote[] => {
    const notes = experimentNoteService.getAll();
    return notes.filter(note => note.relatedRecordId === recordId);
  },
  
  create: (note: Omit<ExperimentNote, 'id' | 'createdAt' | 'updatedAt'>): ExperimentNote => {
    if (!note.title || !note.content) {
      throw new Error('笔记标题和内容不能为空');
    }
    
    const now = new Date();
    const newNote: ExperimentNote = {
      ...note,
      id: generateId(),
      createdAt: now,
      updatedAt: now
    };
    
    const notes = experimentNoteService.getAll();
    notes.push(newNote);
    
    // 将Date对象转换为ISO字符串存储
    const notesToStore = notes.map(note => ({
      ...note,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString()
    }));
    
    localStorage.setItem(STORAGE_KEYS.EXPERIMENT_NOTES, JSON.stringify(notesToStore));
    
    return newNote;
  },
  
  update: (id: string, updates: Partial<ExperimentNote>): ExperimentNote | null => {
    const notes = experimentNoteService.getAll();
    const index = notes.findIndex(note => note.id === id);
    
    if (index === -1) return null;
    
    // 验证更新数据
    if (updates.title === '' || updates.content === '') {
      throw new Error('笔记标题和内容不能为空');
    }
    
    notes[index] = {
      ...notes[index],
      ...updates,
      updatedAt: new Date()
    };
    
    // 将Date对象转换为ISO字符串存储
    const notesToStore = notes.map(note => ({
      ...note,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString()
    }));
    
    localStorage.setItem(STORAGE_KEYS.EXPERIMENT_NOTES, JSON.stringify(notesToStore));
    return notes[index];
  },
  
  delete: (id: string): boolean => {
    const notes = experimentNoteService.getAll();
    const newNotes = notes.filter(note => note.id !== id);
    
    if (notes.length === newNotes.length) return false;
    
    // 将Date对象转换为ISO字符串存储
    const notesToStore = newNotes.map(note => ({
      ...note,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString()
    }));
    
    localStorage.setItem(STORAGE_KEYS.EXPERIMENT_NOTES, JSON.stringify(notesToStore));
    return true;
  }
};

// SOP文档存储服务
export const sopService = {
  getAll: (): SOP[] => {
    const sops = localStorage.getItem(STORAGE_KEYS.SOPS);
    if (!sops) return [];
    
    try {
      const parsedSOPs = JSON.parse(sops);
      // 将字符串日期转换为Date对象
      return parsedSOPs.map((sop: any) => ({
        ...sop,
        lastUpdated: new Date(sop.lastUpdated)
      }));
    } catch (error) {
      console.error('解析SOP数据失败:', error);
      localStorage.removeItem(STORAGE_KEYS.SOPS);
      return [];
    }
  },
  
  getById: (id: string): SOP | null => {
    const sops = sopService.getAll();
    return sops.find(sop => sop.id === id) || null;
  },
  create: (sop: Omit<SOP, 'id' | 'lastUpdated'>): SOP => {
      const newSOP: SOP = {
        ...sop,
        id: generateId(),
        lastUpdated: new Date(),
        projectId: sop.projectId
      };
     
     console.log('创建新SOP:', newSOP);
     const sops = sopService.getAll();
    sops.push(newSOP);
    
    // 将Date对象转换为ISO字符串存储
    const sopsToStore = sops.map(sop => ({
      ...sop,
      lastUpdated: sop.lastUpdated.toISOString()
    }));
    
    localStorage.setItem(STORAGE_KEYS.SOPS, JSON.stringify(sopsToStore));
    
    return newSOP;
  },
  
  update: (id: string, updates: Partial<SOP>): SOP | null => {
    const sops = sopService.getAll();
    const index = sops.findIndex(sop => sop.id === id);
    
    if (index === -1) return null;
    
    sops[index] = {
      ...sops[index],
      ...updates,
      lastUpdated: new Date()
    };
    
    // 将Date对象转换为ISO字符串存储
    const sopsToStore = sops.map(sop => ({
      ...sop,
      lastUpdated: sop.lastUpdated.toISOString()
    }));
    
    localStorage.setItem(STORAGE_KEYS.SOPS, JSON.stringify(sopsToStore));
    return sops[index];
  },
  
  delete: (id: string): boolean => {
    const sops = sopService.getAll();
    const newSops = sops.filter(sop => sop.id !== id);
    
    if (sops.length === newSops.length) return false;
    
    // 将Date对象转换为ISO字符串存储
    const sopsToStore = newSops.map(sop => ({
      ...sop,
      lastUpdated: sop.lastUpdated.toISOString()
    }));
    
    localStorage.setItem(STORAGE_KEYS.SOPS, JSON.stringify(sopsToStore));
    return true;
  }
};

// 课题管理存储服务
export const projectService = {
  getAll: (): Project[] => {
    const projects = localStorage.getItem(STORAGE_KEYS.PROJECTS);
    if (!projects) return [];
    
    try {
      const parsedProjects = JSON.parse(projects);
      return parsedProjects.map((project: any) => ({
        ...project,
        createdAt: new Date(project.createdAt),
        updatedAt: new Date(project.updatedAt),
        milestones: project.milestones?.map((milestone: any) => ({
          ...milestone,
          completedAt: milestone.completedAt ? new Date(milestone.completedAt) : undefined
        })) || []
      }));
    } catch (error) {
      console.error('解析课题数据失败:', error);
      localStorage.removeItem(STORAGE_KEYS.PROJECTS);
      return [];
    }
  },
  
  getById: (id: string): Project | null => {
    const projects = projectService.getAll();
    return projects.find(project => project.id === id) || null;
  },
  
  create: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Project => {
    if (!project.title) {
      throw new Error('课题标题不能为空');
    }
    
    const now = new Date();
    const newProject: Project = {
      ...project,
      id: generateId(),
      progress: project.progress || 0,
      members: project.members || [],
      tags: project.tags || [],
      objectives: project.objectives || [],
      milestones: project.milestones || [],
      createdAt: now,
      updatedAt: now
    };
    
    try {
      const projects = projectService.getAll();
      projects.push(newProject);
      
      const projectsToStore = projects.map(p => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        milestones: p.milestones.map(m => ({
          ...m,
          completedAt: m.completedAt?.toISOString()
        }))
      }));
      
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projectsToStore));
      return newProject;
    } catch (error) {
      console.error('创建课题失败:', error);
      throw new Error('创建课题失败，请重试');
    }
  },
  
  update: (id: string, updates: Partial<Project>): Project | null => {
    const projects = projectService.getAll();
    const index = projects.findIndex(project => project.id === id);
    
    if (index === -1) return null;
    
    if (updates.title === '') {
      throw new Error('课题标题不能为空');
    }
    
    projects[index] = {
      ...projects[index],
      ...updates,
      updatedAt: new Date()
    };
    
    try {
      const projectsToStore = projects.map(p => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        milestones: p.milestones.map(m => ({
          ...m,
          completedAt: m.completedAt?.toISOString()
        }))
      }));
      
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projectsToStore));
      return projects[index];
    } catch (error) {
      console.error('更新课题失败:', error);
      throw new Error('更新课题失败，请重试');
    }
  },
  
  delete: (id: string): boolean => {
    const projects = projectService.getAll();
    const newProjects = projects.filter(project => project.id !== id);
    
    if (projects.length === newProjects.length) return false;
    
    try {
      const projectsToStore = newProjects.map(p => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        milestones: p.milestones.map(m => ({
          ...m,
          completedAt: m.completedAt?.toISOString()
        }))
      }));
      
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projectsToStore));
      return true;
    } catch (error) {
      console.error('删除课题失败:', error);
      throw new Error('删除课题失败，请重试');
    }
  },
  
  // 获取课题统计信息
  getStats: (projectId: string): ProjectStats => {
    const records = experimentRecordService.getAll().filter(r => r.projectId === projectId);
    const notes = experimentNoteService.getAll().filter(n => n.projectId === projectId);
    const sops = sopService.getAll().filter(s => s.projectId === projectId);
    const plans = experimentPlanService.getAll().filter(p => p.projectId === projectId);
    
    const completedRecords = records.filter(r => r.status === 'completed').length;
    const completedPlans = plans.filter(p => p.status === 'completed').length;
    
    const progressPercentage = records.length > 0 
      ? Math.round((completedRecords / records.length) * 100)
      : 0;
    
    return {
      projectId,
      totalRecords: records.length,
      totalNotes: notes.length,
      totalSOPs: sops.length,
      totalPlans: plans.length,
      completedRecords,
      completedPlans,
      progressPercentage
    };
  }
};

// 实验计划存储服务
export const experimentPlanService = {
  getAll: (): ExperimentPlan[] => {
    const plans = localStorage.getItem(STORAGE_KEYS.EXPERIMENT_PLANS);
    if (!plans) return [];
    
    try {
      const parsedPlans = JSON.parse(plans);
      return parsedPlans.map((plan: any) => ({
        ...plan,
        createdAt: new Date(plan.createdAt),
        updatedAt: new Date(plan.updatedAt)
      }));
    } catch (error) {
      console.error('解析实验计划失败:', error);
      localStorage.removeItem(STORAGE_KEYS.EXPERIMENT_PLANS);
      return [];
    }
  },
  
  getById: (id: string): ExperimentPlan | null => {
    const plans = experimentPlanService.getAll();
    return plans.find(plan => plan.id === id) || null;
  },
  
  getByProjectId: (projectId: string): ExperimentPlan[] => {
    const plans = experimentPlanService.getAll();
    return plans.filter(plan => plan.projectId === projectId);
  },
  
  getByDate: (date: string): ExperimentPlan[] => {
    const plans = experimentPlanService.getAll();
    return plans.filter(plan => plan.plannedDate === date);
  },
  
  create: (plan: Omit<ExperimentPlan, 'id' | 'createdAt' | 'updatedAt'>): ExperimentPlan => {
    if (!plan.title || !plan.projectId || !plan.plannedDate) {
      throw new Error('计划标题、关联课题和计划日期不能为空');
    }
    
    const now = new Date();
    const newPlan: ExperimentPlan = {
      ...plan,
      id: generateId(),
      requiredResources: plan.requiredResources || [],
      createdAt: now,
      updatedAt: now
    };
    
    try {
      const plans = experimentPlanService.getAll();
      plans.push(newPlan);
      
      const plansToStore = plans.map(p => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString()
      }));
      
      localStorage.setItem(STORAGE_KEYS.EXPERIMENT_PLANS, JSON.stringify(plansToStore));
      return newPlan;
    } catch (error) {
      console.error('创建实验计划失败:', error);
      throw new Error('创建实验计划失败，请重试');
    }
  },
  
  update: (id: string, updates: Partial<ExperimentPlan>): ExperimentPlan | null => {
    const plans = experimentPlanService.getAll();
    const index = plans.findIndex(plan => plan.id === id);
    
    if (index === -1) return null;
    
    if (updates.title === '' || updates.plannedDate === '') {
      throw new Error('计划标题和计划日期不能为空');
    }
    
    plans[index] = {
      ...plans[index],
      ...updates,
      updatedAt: new Date()
    };
    
    try {
      const plansToStore = plans.map(p => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString()
      }));
      
      localStorage.setItem(STORAGE_KEYS.EXPERIMENT_PLANS, JSON.stringify(plansToStore));
      return plans[index];
    } catch (error) {
      console.error('更新实验计划失败:', error);
      throw new Error('更新实验计划失败，请重试');
    }
  },
  
  delete: (id: string): boolean => {
    const plans = experimentPlanService.getAll();
    const newPlans = plans.filter(plan => plan.id !== id);
    
    if (plans.length === newPlans.length) return false;
    
    try {
      const plansToStore = newPlans.map(p => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString()
      }));
      
      localStorage.setItem(STORAGE_KEYS.EXPERIMENT_PLANS, JSON.stringify(plansToStore));
      return true;
    } catch (error) {
      console.error('删除实验计划失败:', error);
      throw new Error('删除实验计划失败，请重试');
    }
  }
};

// 兼容性别名，保持向后兼容
export const topicService = projectService;



