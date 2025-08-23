// 带缓存功能的存储服务包装器
// 在现有存储服务基础上添加缓存层，提升数据访问性能

import { ExperimentRecord, ExperimentNote, SOP, Project, ProjectStats, ExperimentPlan, Sample, SampleHistory, SampleStats } from '@/types';
import { 
  experimentRecordService as originalRecordService,
  experimentNoteService as originalNoteService,
  sopService as originalSOPService,
  projectService as originalProjectService,
  experimentPlanService as originalPlanService,
  sampleService as originalSampleService,
  sampleHistoryService as originalSampleHistoryService
} from './storage';
import { cacheService, CacheKeys, CacheInvalidation } from './cacheService';

// 缓存配置
const CACHE_TTL = {
  SHORT: 2 * 60 * 1000,   // 2分钟 - 用于频繁变更的数据
  MEDIUM: 5 * 60 * 1000,  // 5分钟 - 用于一般数据
  LONG: 10 * 60 * 1000,   // 10分钟 - 用于相对稳定的数据
};

// 带缓存的实验记录服务
export const cachedExperimentRecordService = {
  getAll: (): ExperimentRecord[] => {
    const cacheKey = CacheKeys.EXPERIMENT_RECORDS_ALL;
    let cached = cacheService.get<ExperimentRecord[]>(cacheKey);
    
    if (cached) {
      console.log('[Cache] 实验记录命中缓存:', cached.length, '条');
      return cached;
    }

    console.log('[Cache] 实验记录未命中缓存，从数据源获取');
    const records = originalRecordService.getAll();
    console.log('[Cache] 从数据源获取实验记录:', records.length, '条');
    cacheService.set(cacheKey, records, CACHE_TTL.MEDIUM);
    return records;
  },

  getById: (id: string): ExperimentRecord | null => {
    const cacheKey = CacheKeys.EXPERIMENT_RECORD_BY_ID(id);
    let cached = cacheService.get<ExperimentRecord>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const record = originalRecordService.getById(id);
    if (record) {
      cacheService.set(cacheKey, record, CACHE_TTL.MEDIUM);
    }
    return record;
  },

  getByProjectId: (projectId: string): ExperimentRecord[] => {
    const cacheKey = CacheKeys.EXPERIMENT_RECORDS_BY_PROJECT(projectId);
    let cached = cacheService.get<ExperimentRecord[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const allRecords = cachedExperimentRecordService.getAll();
    const projectRecords = allRecords.filter(record => record.projectId === projectId);
    cacheService.set(cacheKey, projectRecords, CACHE_TTL.MEDIUM);
    return projectRecords;
  },

  create: (record: Omit<ExperimentRecord, 'id' | 'createdAt' | 'updatedAt'>): ExperimentRecord => {
    const newRecord = originalRecordService.create(record);
    
    // 失效相关缓存
    CacheInvalidation.onExperimentRecordChange(newRecord.id, newRecord.projectId);
    
    // 缓存新创建的记录
    cacheService.set(CacheKeys.EXPERIMENT_RECORD_BY_ID(newRecord.id), newRecord, CACHE_TTL.MEDIUM);
    
    return newRecord;
  },

  update: (id: string, updates: Partial<ExperimentRecord>): ExperimentRecord | null => {
    const existingRecord = originalRecordService.getById(id);
    const updatedRecord = originalRecordService.update(id, updates);
    
    if (updatedRecord) {
      // 失效相关缓存
      CacheInvalidation.onExperimentRecordChange(id, updatedRecord.projectId);
      if (existingRecord && existingRecord.projectId !== updatedRecord.projectId) {
        // 如果项目ID发生变化，也要失效旧项目的缓存
        CacheInvalidation.onExperimentRecordChange(id, existingRecord.projectId);
      }
      
      // 缓存更新后的记录
      cacheService.set(CacheKeys.EXPERIMENT_RECORD_BY_ID(id), updatedRecord, CACHE_TTL.MEDIUM);
    }
    
    return updatedRecord;
  },

  delete: (id: string): boolean => {
    const existingRecord = originalRecordService.getById(id);
    const success = originalRecordService.delete(id);
    
    if (success && existingRecord) {
      // 失效相关缓存
      CacheInvalidation.onExperimentRecordChange(id, existingRecord.projectId);
    }
    
    return success;
  }
};

// 带缓存的实验笔记服务
export const cachedExperimentNoteService = {
  getAll: (): ExperimentNote[] => {
    const cacheKey = CacheKeys.EXPERIMENT_NOTES_ALL;
    let cached = cacheService.get<ExperimentNote[]>(cacheKey);
    
    if (cached) {
      console.log('[Cache] 实验笔记命中缓存:', cached.length, '条');
      return cached;
    }

    console.log('[Cache] 实验笔记未命中缓存，从数据源获取');
    const notes = originalNoteService.getAll();
    console.log('[Cache] 从数据源获取实验笔记:', notes.length, '条');
    cacheService.set(cacheKey, notes, CACHE_TTL.MEDIUM);
    return notes;
  },

  getById: (id: string): ExperimentNote | null => {
    const cacheKey = CacheKeys.EXPERIMENT_NOTE_BY_ID(id);
    let cached = cacheService.get<ExperimentNote>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const note = originalNoteService.getById(id);
    if (note) {
      cacheService.set(cacheKey, note, CACHE_TTL.MEDIUM);
    }
    return note;
  },

  getByRecordId: (recordId: string): ExperimentNote[] => {
    const cacheKey = CacheKeys.EXPERIMENT_NOTES_BY_RECORD(recordId);
    let cached = cacheService.get<ExperimentNote[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const notes = originalNoteService.getByRecordId(recordId);
    cacheService.set(cacheKey, notes, CACHE_TTL.MEDIUM);
    return notes;
  },

  getByProjectId: (projectId: string): ExperimentNote[] => {
    const cacheKey = CacheKeys.EXPERIMENT_NOTES_BY_PROJECT(projectId);
    let cached = cacheService.get<ExperimentNote[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const allNotes = cachedExperimentNoteService.getAll();
    const projectNotes = allNotes.filter(note => note.projectId === projectId);
    cacheService.set(cacheKey, projectNotes, CACHE_TTL.MEDIUM);
    return projectNotes;
  },

  create: (note: Omit<ExperimentNote, 'id' | 'createdAt' | 'updatedAt'>): ExperimentNote => {
    const newNote = originalNoteService.create(note);
    
    // 失效相关缓存
    CacheInvalidation.onExperimentNoteChange(newNote.id, newNote.projectId, newNote.relatedRecordId);
    
    // 缓存新创建的笔记
    cacheService.set(CacheKeys.EXPERIMENT_NOTE_BY_ID(newNote.id), newNote, CACHE_TTL.MEDIUM);
    
    return newNote;
  },

  update: (id: string, updates: Partial<ExperimentNote>): ExperimentNote | null => {
    const existingNote = originalNoteService.getById(id);
    const updatedNote = originalNoteService.update(id, updates);
    
    if (updatedNote) {
      // 失效相关缓存
      CacheInvalidation.onExperimentNoteChange(id, updatedNote.projectId, updatedNote.relatedRecordId);
      if (existingNote) {
        // 如果关联发生变化，也要失效旧关联的缓存
        if (existingNote.projectId !== updatedNote.projectId) {
          CacheInvalidation.onExperimentNoteChange(id, existingNote.projectId);
        }
        if (existingNote.relatedRecordId !== updatedNote.relatedRecordId) {
          CacheInvalidation.onExperimentNoteChange(id, undefined, existingNote.relatedRecordId);
        }
      }
      
      // 缓存更新后的笔记
      cacheService.set(CacheKeys.EXPERIMENT_NOTE_BY_ID(id), updatedNote, CACHE_TTL.MEDIUM);
    }
    
    return updatedNote;
  },

  delete: (id: string): boolean => {
    const existingNote = originalNoteService.getById(id);
    const success = originalNoteService.delete(id);
    
    if (success && existingNote) {
      // 失效相关缓存
      CacheInvalidation.onExperimentNoteChange(id, existingNote.projectId, existingNote.relatedRecordId);
    }
    
    return success;
  }
};

// 带缓存的SOP服务
export const cachedSOPService = {
  getAll: (): SOP[] => {
    const cacheKey = CacheKeys.SOPS_ALL;
    let cached = cacheService.get<SOP[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const sops = originalSOPService.getAll();
    cacheService.set(cacheKey, sops, CACHE_TTL.LONG);
    return sops;
  },

  getById: (id: string): SOP | null => {
    const cacheKey = CacheKeys.SOP_BY_ID(id);
    let cached = cacheService.get<SOP>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const sop = originalSOPService.getById(id);
    if (sop) {
      cacheService.set(cacheKey, sop, CACHE_TTL.LONG);
    }
    return sop;
  },

  getByProjectId: (projectId: string): SOP[] => {
    const cacheKey = CacheKeys.SOPS_BY_PROJECT(projectId);
    let cached = cacheService.get<SOP[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const allSOPs = cachedSOPService.getAll();
    const projectSOPs = allSOPs.filter(sop => sop.projectId === projectId);
    cacheService.set(cacheKey, projectSOPs, CACHE_TTL.LONG);
    return projectSOPs;
  },

  create: (sop: Omit<SOP, 'id' | 'lastUpdated'>): SOP => {
    const newSOP = originalSOPService.create(sop);
    
    // 失效相关缓存
    CacheInvalidation.onSOPChange(newSOP.id, newSOP.projectId);
    
    // 缓存新创建的SOP
    cacheService.set(CacheKeys.SOP_BY_ID(newSOP.id), newSOP, CACHE_TTL.LONG);
    
    return newSOP;
  },

  update: (id: string, updates: Partial<SOP>): SOP | null => {
    const existingSOP = originalSOPService.getById(id);
    const updatedSOP = originalSOPService.update(id, updates);
    
    if (updatedSOP) {
      // 失效相关缓存
      CacheInvalidation.onSOPChange(id, updatedSOP.projectId);
      if (existingSOP && existingSOP.projectId !== updatedSOP.projectId) {
        // 如果项目ID发生变化，也要失效旧项目的缓存
        CacheInvalidation.onSOPChange(id, existingSOP.projectId);
      }
      
      // 缓存更新后的SOP
      cacheService.set(CacheKeys.SOP_BY_ID(id), updatedSOP, CACHE_TTL.LONG);
    }
    
    return updatedSOP;
  },

  delete: (id: string): boolean => {
    const existingSOP = originalSOPService.getById(id);
    const success = originalSOPService.delete(id);
    
    if (success && existingSOP) {
      // 失效相关缓存
      CacheInvalidation.onSOPChange(id, existingSOP.projectId);
    }
    
    return success;
  }
};

// 带缓存的项目服务
export const cachedProjectService = {
  getAll: (): Project[] => {
    const cacheKey = CacheKeys.PROJECTS_ALL;
    let cached = cacheService.get<Project[]>(cacheKey);
    
    if (cached) {
      console.log('[Cache] 课题命中缓存:', cached.length, '个');
      return cached;
    }

    console.log('[Cache] 课题未命中缓存，从数据源获取');
    const projects = originalProjectService.getAll();
    console.log('[Cache] 从数据源获取课题:', projects.length, '个');
    cacheService.set(cacheKey, projects, CACHE_TTL.MEDIUM);
    return projects;
  },

  getById: (id: string): Project | null => {
    const cacheKey = CacheKeys.PROJECT_BY_ID(id);
    let cached = cacheService.get<Project>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const project = originalProjectService.getById(id);
    if (project) {
      cacheService.set(cacheKey, project, CACHE_TTL.MEDIUM);
    }
    return project;
  },

  getStats: (projectId: string): ProjectStats => {
    const cacheKey = CacheKeys.PROJECT_STATS(projectId);
    let cached = cacheService.get<ProjectStats>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const stats = originalProjectService.getStats(projectId);
    cacheService.set(cacheKey, stats, CACHE_TTL.SHORT); // 统计数据变化较频繁，使用短缓存
    return stats;
  },

  create: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Project => {
    const newProject = originalProjectService.create(project);
    
    // 失效相关缓存
    CacheInvalidation.onProjectChange(newProject.id);
    
    // 缓存新创建的项目
    cacheService.set(CacheKeys.PROJECT_BY_ID(newProject.id), newProject, CACHE_TTL.MEDIUM);
    
    return newProject;
  },

  update: (id: string, updates: Partial<Project>): Project | null => {
    const updatedProject = originalProjectService.update(id, updates);
    
    if (updatedProject) {
      // 失效相关缓存
      CacheInvalidation.onProjectChange(id);
      
      // 缓存更新后的项目
      cacheService.set(CacheKeys.PROJECT_BY_ID(id), updatedProject, CACHE_TTL.MEDIUM);
    }
    
    return updatedProject;
  },

  delete: (id: string): boolean => {
    const success = originalProjectService.delete(id);
    
    if (success) {
      // 失效相关缓存
      CacheInvalidation.onProjectChange(id);
    }
    
    return success;
  }
};

// 带缓存的实验计划服务
export const cachedExperimentPlanService = {
  getAll: (): ExperimentPlan[] => {
    const cacheKey = CacheKeys.EXPERIMENT_PLANS_ALL;
    let cached = cacheService.get<ExperimentPlan[]>(cacheKey);
    
    if (cached) {
      console.log('[Cache] 实验计划命中缓存:', cached.length, '个');
      return cached;
    }

    console.log('[Cache] 实验计划未命中缓存，从数据源获取');
    const plans = originalPlanService.getAll();
    console.log('[Cache] 从数据源获取实验计划:', plans.length, '个');
    cacheService.set(cacheKey, plans, CACHE_TTL.MEDIUM);
    return plans;
  },

  getById: (id: string): ExperimentPlan | null => {
    const cacheKey = CacheKeys.EXPERIMENT_PLAN_BY_ID(id);
    let cached = cacheService.get<ExperimentPlan>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const plan = originalPlanService.getById(id);
    if (plan) {
      cacheService.set(cacheKey, plan, CACHE_TTL.MEDIUM);
    }
    return plan;
  },

  getByProjectId: (projectId: string): ExperimentPlan[] => {
    const cacheKey = CacheKeys.EXPERIMENT_PLANS_BY_PROJECT(projectId);
    let cached = cacheService.get<ExperimentPlan[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const allPlans = cachedExperimentPlanService.getAll();
    const projectPlans = allPlans.filter(plan => plan.projectId === projectId);
    cacheService.set(cacheKey, projectPlans, CACHE_TTL.MEDIUM);
    return projectPlans;
  },

  getByDate: (date: string): ExperimentPlan[] => {
    const plans = cachedExperimentPlanService.getAll();
    return plans.filter(plan => plan.plannedDate === date);
  },

  create: (plan: Omit<ExperimentPlan, 'id' | 'createdAt' | 'updatedAt'>): ExperimentPlan => {
    const newPlan = originalPlanService.create(plan);
    
    // 失效相关缓存
    CacheInvalidation.onExperimentPlanChange(newPlan.id, newPlan.projectId);
    
    // 缓存新创建的计划
    cacheService.set(CacheKeys.EXPERIMENT_PLAN_BY_ID(newPlan.id), newPlan, CACHE_TTL.MEDIUM);
    
    return newPlan;
  },

  update: (id: string, updates: Partial<ExperimentPlan>): ExperimentPlan | null => {
    const existingPlan = originalPlanService.getById(id);
    const updatedPlan = originalPlanService.update(id, updates);
    
    if (updatedPlan) {
      // 失效相关缓存
      CacheInvalidation.onExperimentPlanChange(id, updatedPlan.projectId);
      if (existingPlan && existingPlan.projectId !== updatedPlan.projectId) {
        // 如果项目ID发生变化，也要失效旧项目的缓存
        CacheInvalidation.onExperimentPlanChange(id, existingPlan.projectId);
      }
      
      // 缓存更新后的计划
      cacheService.set(CacheKeys.EXPERIMENT_PLAN_BY_ID(id), updatedPlan, CACHE_TTL.MEDIUM);
    }
    
    return updatedPlan;
  },

  delete: (id: string): boolean => {
    const existingPlan = originalPlanService.getById(id);
    const success = originalPlanService.delete(id);
    
    if (success && existingPlan) {
      // 失效相关缓存
      CacheInvalidation.onExperimentPlanChange(id, existingPlan.projectId);
    }
    
    return success;
  }
};

// 带缓存的样本管理服务
export const cachedSampleService = {
  getAll: (): Sample[] => {
    const cacheKey = 'samples_all';
    let cached = cacheService.get<Sample[]>(cacheKey);
    
    if (cached) {
      console.log('[Cache] 样本数据命中缓存:', cached.length, '个');
      return cached;
    }

    console.log('[Cache] 样本数据未命中缓存，从数据源获取');
    const samples = originalSampleService.getAll();
    console.log('[Cache] 从数据源获取样本:', samples.length, '个');
    cacheService.set(cacheKey, samples, CACHE_TTL.MEDIUM);
    return samples;
  },

  getById: (id: string): Sample | null => {
    const cacheKey = `sample_${id}`;
    let cached = cacheService.get<Sample>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const sample = originalSampleService.getById(id);
    if (sample) {
      cacheService.set(cacheKey, sample, CACHE_TTL.MEDIUM);
    }
    return sample;
  },

  getBySampleId: (sampleId: string): Sample | null => {
    return originalSampleService.getBySampleId(sampleId);
  },

  getByProjectId: (projectId: string): Sample[] => {
    const cacheKey = `samples_project_${projectId}`;
    let cached = cacheService.get<Sample[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const allSamples = cachedSampleService.getAll();
    const projectSamples = allSamples.filter(sample => sample.projectId === projectId);
    cacheService.set(cacheKey, projectSamples, CACHE_TTL.MEDIUM);
    return projectSamples;
  },

  getByStatus: (status: string): Sample[] => {
    return originalSampleService.getByStatus(status);
  },

  getByType: (type: string): Sample[] => {
    return originalSampleService.getByType(type);
  },

  getExpiringSoon: (): Sample[] => {
    return originalSampleService.getExpiringSoon();
  },

  getLowVolume: (threshold?: number): Sample[] => {
    return originalSampleService.getLowVolume(threshold);
  },

  create: (sample: Omit<Sample, 'id' | 'createdAt' | 'updatedAt'>): Sample => {
    const newSample = originalSampleService.create(sample);
    
    // 失效相关缓存
    cacheService.delete('samples_all');
    if (newSample.projectId) {
      cacheService.delete(`samples_project_${newSample.projectId}`);
    }
    
    // 缓存新创建的样本
    cacheService.set(`sample_${newSample.id}`, newSample, CACHE_TTL.MEDIUM);
    
    return newSample;
  },

  update: (id: string, updates: Partial<Sample>): Sample | null => {
    const existingSample = originalSampleService.getById(id);
    const updatedSample = originalSampleService.update(id, updates);
    
    if (updatedSample) {
      // 失效相关缓存
      cacheService.delete('samples_all');
      cacheService.delete(`sample_${id}`);
      if (updatedSample.projectId) {
        cacheService.delete(`samples_project_${updatedSample.projectId}`);
      }
      if (existingSample && existingSample.projectId !== updatedSample.projectId) {
        cacheService.delete(`samples_project_${existingSample.projectId}`);
      }
      
      // 缓存更新后的样本
      cacheService.set(`sample_${id}`, updatedSample, CACHE_TTL.MEDIUM);
    }
    
    return updatedSample;
  },

  delete: (id: string): boolean => {
    const existingSample = originalSampleService.getById(id);
    const success = originalSampleService.delete(id);
    
    if (success && existingSample) {
      // 失效相关缓存
      cacheService.delete('samples_all');
      cacheService.delete(`sample_${id}`);
      if (existingSample.projectId) {
        cacheService.delete(`samples_project_${existingSample.projectId}`);
      }
    }
    
    return success;
  },

  useSample: (sampleId: string, experimentId: string, usedVolume?: number): boolean => {
    const success = originalSampleService.useSample(sampleId, experimentId, usedVolume);
    
    if (success) {
      // 失效相关缓存
      const sample = originalSampleService.getById(sampleId);
      if (sample) {
        cacheService.delete('samples_all');
        cacheService.delete(`sample_${sampleId}`);
        if (sample.projectId) {
          cacheService.delete(`samples_project_${sample.projectId}`);
        }
      }
    }
    
    return success;
  },

  getStats: (): SampleStats => {
    const cacheKey = 'sample_stats';
    let cached = cacheService.get<SampleStats>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const stats = originalSampleService.getStats();
    cacheService.set(cacheKey, stats, CACHE_TTL.SHORT); // 统计数据变化较频繁，使用短缓存
    return stats;
  }
};

// 带缓存的样本历史服务
export const cachedSampleHistoryService = {
  getAll: (): SampleHistory[] => {
    return originalSampleHistoryService.getAll();
  },

  getBySampleId: (sampleId: string): SampleHistory[] => {
    const cacheKey = `sample_history_${sampleId}`;
    let cached = cacheService.get<SampleHistory[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const history = originalSampleHistoryService.getBySampleId(sampleId);
    cacheService.set(cacheKey, history, CACHE_TTL.MEDIUM);
    return history;
  },

  create: (record: Omit<SampleHistory, 'id' | 'timestamp'>): SampleHistory => {
    const newRecord = originalSampleHistoryService.create({
      ...record,
      timestamp: new Date().toISOString()
    });
    
    // 失效相关缓存
    cacheService.delete(`sample_history_${record.sampleId}`);
    
    return newRecord;
  },

  deleteForSample: (sampleId: string): boolean => {
    const success = originalSampleHistoryService.deleteForSample(sampleId);
    
    if (success) {
      cacheService.delete(`sample_history_${sampleId}`);
    }
    
    return success;
  }
};

// 导出带缓存的服务（向后兼容）
export const experimentRecordService = cachedExperimentRecordService;
export const experimentNoteService = cachedExperimentNoteService;
export const sopService = cachedSOPService;
export const projectService = cachedProjectService;
export const experimentPlanService = cachedExperimentPlanService;
export const sampleService = cachedSampleService;
export const sampleHistoryService = cachedSampleHistoryService;

// 兼容性别名，保持向后兼容
export const topicService = cachedProjectService;

// 缓存管理工具
export const cacheManager = {
  // 预热缓存 - 提前加载常用数据
  preloadCache: async () => {
    try {
      console.log('[CacheManager] 开始预热缓存...');
      
      // 并行预热主要数据
      await Promise.all([
        // 预热项目列表
        Promise.resolve(cachedProjectService.getAll()),
        // 预热实验记录列表
        Promise.resolve(cachedExperimentRecordService.getAll()),
        // 预热笔记列表
        Promise.resolve(cachedExperimentNoteService.getAll()),
        // 预热SOP列表
        Promise.resolve(cachedSOPService.getAll())
      ]);
      
      console.log('[CacheManager] 缓存预热完成');
    } catch (error) {
      console.error('[CacheManager] 缓存预热失败:', error);
    }
  },

  // 获取缓存统计
  getStats: () => {
    return cacheService.getStats();
  },

  // 清理缓存
  cleanup: () => {
    cacheService.cleanup();
  },

  // 清空所有缓存
  clearAll: () => {
    CacheInvalidation.clearAll();
  }
};